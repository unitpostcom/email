import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, watch, writeFileSync, type FSWatcher } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { lintEmailDesign, type DesignHint } from "../design-lint";
import { renderToHtml, resolveVariables } from "../render";
import { parseDocument, type EmailDocument } from "../schema";
import { renderToText } from "../text";
import { DEV_UI_HTML } from "./ui";

// `npx @unitpost/email dev`: a local preview server for a folder of emails.
//
// An email is either a module whose default export (or first exported
// function) is a React component built from `@unitpost/email/react`, or a
// `.json` EmailDocument (what the editor, the API and `parseTsx` produce). A
// component's preview props come from `Component.PreviewProps`.
//
// Modules are bundled with the project's own esbuild (dependencies stay
// external), written under node_modules/.cache so `react` and the library
// resolve from the project, and imported fresh on every change. The server
// listens on 127.0.0.1 only.

export const EMAIL_MODULE_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js", ".mts", ".mjs"];

export type DevServerOptions = {
  /** Folder of emails, relative to `cwd`. Default "emails". */
  dir?: string;
  /** Default 3030; the next free port is used when it is taken. */
  port?: number;
  cwd?: string;
  /** Environment for "Send test" (UNITPOST_API_KEY, UNITPOST_FROM, UNITPOST_BASE_URL). */
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
};

export type EmailEntry = { id: string; name: string };

export type EmailPreview = {
  id: string;
  html: string;
  text: string;
  hints: DesignHint[];
  bytes: number;
  error: string | null;
};

// Files that aren't emails: helpers and partials start with "_", tests and
// type declarations are skipped.
export function listEmails(root: string): EmailEntry[] {
  const out: EmailEntry[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir).sort();
    } catch {
      return;
    }
    for (const name of entries) {
      if (name.startsWith("_") || name.startsWith(".") || name === "node_modules") continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (/\.(test|spec)\.|\.d\.ts$/.test(name)) continue;
      const ext = extname(name);
      if (ext !== ".json" && !EMAIL_MODULE_EXTENSIONS.includes(ext)) continue;
      const id = relative(root, full).split(sep).join("/");
      out.push({ id, name: id.slice(0, -ext.length) });
    }
  };
  walk(root);
  return out;
}

/** The nearest folder at or above `from` that has a package.json. */
export function findProjectRoot(from: string): string {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const up = dirname(dir);
    if (up === dir) return resolve(from);
    dir = up;
  }
}

type Esbuild = typeof import("esbuild");

async function loadEsbuild(projectRoot: string): Promise<Esbuild> {
  for (const base of [join(projectRoot, "package.json"), import.meta.url]) {
    try {
      const path = createRequire(base).resolve("esbuild");
      const mod = (await import(pathToFileURL(path).href)) as Esbuild & { default?: Esbuild };
      return mod.default ?? mod;
    } catch {
      // try the next place
    }
  }
  throw new Error("Previewing React emails needs esbuild in this project: npm install --save-dev esbuild");
}

type Loaded = { doc: EmailDocument; inputs: string[] };

export class EmailLoader {
  private esbuild: Promise<Esbuild> | null = null;
  private readonly lastBundle = new Map<string, string>();
  readonly cacheDir: string;

  constructor(readonly projectRoot: string) {
    this.cacheDir = join(projectRoot, "node_modules", ".cache", "unitpost-email");
  }

  async load(file: string): Promise<Loaded> {
    if (file.endsWith(".json")) {
      return { doc: parseDocument(JSON.parse(readFileSync(file, "utf8"))), inputs: [file] };
    }
    this.esbuild ??= loadEsbuild(this.projectRoot);
    const esbuild = await this.esbuild;
    // Bundle the email with the project's `react`, so the element is made by
    // the same React the component uses.
    const result = await esbuild.build({
      stdin: {
        contents: `export * as mod from ${JSON.stringify("./" + basename(file))};\nexport { createElement } from "react";\n`,
        resolveDir: dirname(file),
        sourcefile: "unitpost-email-preview.js",
        loader: "js",
      },
      absWorkingDir: this.projectRoot,
      bundle: true,
      format: "esm",
      platform: "node",
      packages: "external",
      jsx: "automatic",
      write: false,
      metafile: true,
      sourcemap: "inline",
      logLevel: "silent",
      // A CommonJS helper's require() of a package stays a runtime call; give
      // the ESM bundle a require to make it with.
      banner: {
        js: 'import { createRequire as __unitpostCreateRequire } from "node:module";\nconst require = __unitpostCreateRequire(import.meta.url);',
      },
    });
    mkdirSync(this.cacheDir, { recursive: true });
    const code = result.outputFiles[0].text;
    const out = join(this.cacheDir, `${createHash("sha256").update(file).digest("hex").slice(0, 12)}-${Date.now()}.mjs`);
    writeFileSync(out, code);
    const { mod, createElement } = (await import(pathToFileURL(out).href)) as {
      mod: Record<string, unknown>;
      createElement: (type: unknown, props: unknown) => unknown;
    };
    // Each edit is a new module (ESM caches by URL); drop the previous copy.
    const previous = this.lastBundle.get(file);
    if (previous) rmSync(previous, { force: true });
    this.lastBundle.set(file, out);
    // The React layer loads only for a module email: `react` is an optional
    // peer, so help and JSON previews must work without it.
    const { fromJsx } = await import("../react");
    const component = pickComponent(mod);
    if (!component) throw new Error(`${basename(file)} has no default export or exported component.`);
    const props = (component as { PreviewProps?: unknown }).PreviewProps ?? {};
    const doc = fromJsx(createElement(component, props) as Parameters<typeof fromJsx>[0]);
    // The files the email is built from (its own components too), so an edit
    // to any of them reloads the preview.
    const inputs = Object.keys(result.metafile?.inputs ?? {})
      .filter((p) => !p.includes("node_modules") && !p.startsWith("<"))
      .map((p) => resolve(this.projectRoot, p));
    return { doc, inputs: inputs.length ? inputs : [file] };
  }
}

function pickComponent(mod: Record<string, unknown>): unknown {
  if (typeof mod.default === "function") return mod.default;
  return Object.values(mod).find((v) => typeof v === "function");
}

// Unitpost's send endpoint, the same call the SDKs make.
export async function sendTest(
  input: { to: string; subject: string; html: string; text: string },
  env: NodeJS.ProcessEnv,
  doFetch: typeof fetch = fetch,
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const apiKey = env.UNITPOST_API_KEY;
  const from = env.UNITPOST_FROM;
  if (!apiKey || !from) {
    return { ok: false, error: "Set UNITPOST_API_KEY and UNITPOST_FROM (an address on a verified domain) to send a test." };
  }
  const base = (env.UNITPOST_BASE_URL || "https://www.unitpost.com").replace(/\/+$/, "");
  let res: Response;
  try {
    res = await doFetch(`${base}/api/v1/email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": randomUUID(),
      "User-Agent": "unitpost-email-dev",
    },
    body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html, text: input.text }),
    });
  } catch (err) {
    return { ok: false, error: `Couldn't reach ${base}: ${(err as Error).message}` };
  }
  const body = (await res.json().catch(() => null)) as { id?: string; error?: { message?: string }; message?: string } | null;
  if (!res.ok) return { ok: false, error: body?.error?.message ?? body?.message ?? `Send failed (HTTP ${res.status}).` };
  return { ok: true, id: body?.id ?? null };
}

export type DevServer = { url: string; port: number; close: () => Promise<void> };

export async function startDevServer(options: DevServerOptions = {}): Promise<DevServer> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const root = resolve(cwd, options.dir ?? "emails");
  if (!existsSync(root)) throw new Error(`No emails folder at ${root}. Pass one: unitpost-email dev <folder>`);
  const env = options.env ?? process.env;
  const loader = new EmailLoader(findProjectRoot(cwd));
  const clients = new Set<ServerResponse>();
  const watchers = new Map<string, FSWatcher>();

  const broadcast = () => {
    for (const res of clients) res.write("data: change\n\n");
  };
  let timer: NodeJS.Timeout | null = null;
  const changed = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(broadcast, 60);
  };
  const watchPath = (path: string, recursive = false) => {
    if (watchers.has(path)) return;
    try {
      watchers.set(path, watch(path, { recursive }, changed));
    } catch {
      // A platform without recursive watch: the page still reloads on refresh.
    }
  };
  watchPath(root, true);

  const resolveEmail = (id: string | null): string | null => {
    if (!id) return null;
    const file = resolve(root, id);
    if (!file.startsWith(root + sep) || !existsSync(file)) return null;
    return file;
  };

  const preview = async (id: string): Promise<EmailPreview | null> => {
    const file = resolveEmail(id);
    if (!file) return null;
    try {
      const { doc, inputs } = await loader.load(file);
      for (const input of inputs) if (!input.startsWith(root + sep)) watchPath(input);
      // Variables with a fallback show it; the rest stay as {{tokens}}.
      const { values } = resolveVariables(doc);
      const html = renderToHtml(doc, values);
      return { id, html, text: renderToText(doc, values), hints: lintEmailDesign(doc), bytes: Buffer.byteLength(html), error: null };
    } catch (err) {
      const e = err as Error & { errors?: { text: string }[] };
      const detail = e.errors?.map((x) => x.text).join("\n");
      return { id, html: "", text: "", hints: [], bytes: 0, error: detail || e.stack || String(err) };
    }
  };

  // The addresses this server answers to. Listening on 127.0.0.1 doesn't stop
  // a page on another site from reaching it through DNS rebinding (its name
  // re-resolved to 127.0.0.1, sending its own Host), so every request must
  // name a loopback host and this port, and a send must come from one of them.
  let trustedHosts = new Set<string>();

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(body));
    };
    if (!trustedHosts.has(String(req.headers.host ?? "").toLowerCase())) {
      json(403, { error: "Forbidden" });
      return;
    }
    try {
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(DEV_UI_HTML);
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/emails") {
        json(200, { emails: listEmails(root), canSend: Boolean(env.UNITPOST_API_KEY && env.UNITPOST_FROM) });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/email") {
        const result = await preview(url.searchParams.get("id") ?? "");
        if (!result) json(404, { error: "Not found" });
        else json(200, result);
        return;
      }
      if (req.method === "GET" && url.pathname === "/events") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
        res.write(": connected\n\n");
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/send") {
        // Only this page may send: a cross-site form post must not spend the
        // developer's API key.
        const origin = String(req.headers.origin ?? "").toLowerCase();
        if (
          !origin.startsWith("http://") ||
          !trustedHosts.has(origin.slice("http://".length)) ||
          !String(req.headers["content-type"]).startsWith("application/json")
        ) {
          json(403, { error: "Forbidden" });
          return;
        }
        const body = JSON.parse(await readBody(req)) as { id?: string; to?: string };
        const result = await preview(body.id ?? "");
        if (!result || result.error) {
          json(400, { error: result?.error ?? "Not found" });
          return;
        }
        const to = String(body.to ?? "").trim();
        if (!/^[^\s@]+@[^\s@]+$/.test(to)) {
          json(400, { error: "Enter one email address." });
          return;
        }
        const sent = await sendTest(
          { to, subject: `[Preview] ${basename(result.id).replace(/\.[^.]+$/, "")}`, html: result.html, text: result.text },
          env,
          options.fetch,
        );
        json(sent.ok ? 200 : 400, sent);
        return;
      }
      json(404, { error: "Not found" });
    } catch (err) {
      json(500, { error: (err as Error).message });
    }
  });

  const port = await listen(server, options.port ?? 3030);
  trustedHosts = new Set(["127.0.0.1", "localhost", "[::1]"].map((h) => `${h}:${port}`));
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    close: async () => {
      if (timer) clearTimeout(timer);
      for (const w of watchers.values()) w.close();
      for (const res of clients) res.end();
      await new Promise<void>((done) => server.close(() => done()));
    },
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((done, fail) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 64 * 1024) {
        fail(new Error("Request too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => done(Buffer.concat(chunks).toString("utf8") || "{}"));
    req.on("error", fail);
  });
}

async function listen(server: Server, first: number): Promise<number> {
  for (let port = first; port < first + 20 || first === 0; port++) {
    const ok = await new Promise<boolean>((done) => {
      const onError = (err: NodeJS.ErrnoException) => {
        server.off("listening", onListening);
        if (err.code === "EADDRINUSE") done(false);
        else throw err;
      };
      const onListening = () => {
        server.off("error", onError);
        done(true);
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, "127.0.0.1");
    });
    if (ok) {
      const addr = server.address();
      return typeof addr === "object" && addr ? addr.port : port;
    }
    if (first === 0) break;
  }
  throw new Error(`No free port from ${first} to ${first + 19}.`);
}
