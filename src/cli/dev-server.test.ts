import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import * as nodeModule from "node:module";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { parseTsx } from "../codec";
import { listEmails, sendTest, startDevServer, type DevServer } from "./dev-server";

// A throwaway project: react and this package linked into node_modules, the
// way they'd be installed, and an emails/ folder.
const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);

let project: string;
let server: DevServer;
const sent: { url: string; init: RequestInit }[] = [];

before(async () => {
  project = realpathSync(mkdtempSync(join(tmpdir(), "unitpost-email-dev-")));
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "demo", type: "module" }));
  mkdirSync(join(project, "node_modules", "@unitpost"), { recursive: true });
  symlinkSync(dirname(require.resolve("react/package.json")), join(project, "node_modules", "react"), "dir");
  symlinkSync(PACKAGE_DIR, join(project, "node_modules", "@unitpost", "email"), "dir");
  const emails = join(project, "emails");
  mkdirSync(join(emails, "_parts"), { recursive: true });
  writeFileSync(
    join(emails, "_parts", "footer.tsx"),
    `import { Text } from "@unitpost/email/react";\nexport function Footer() { return <Text>Thanks, the team</Text>; }\n`,
  );
  writeFileSync(
    join(emails, "welcome.tsx"),
    `import { Section, Heading, Button } from "@unitpost/email/react";
import { Footer } from "./_parts/footer";
export default function Welcome({ name }: { name: string }) {
  return (
    <Section>
      <Heading>Welcome, {name}</Heading>
      <Button href="https://example.com/start">Get started</Button>
      <Footer />
    </Section>
  );
}
Welcome.PreviewProps = { name: "Ada" };
`,
  );
  // A CommonJS helper whose require() of a package stays a runtime call.
  writeFileSync(join(emails, "_parts", "greeting.cjs"), `module.exports = (name) => require("react").version ? "Hi " + name : "";\n`);
  writeFileSync(
    join(emails, "plain.js"),
    `import { createElement as h } from "react";\nimport { Text } from "@unitpost/email/react";\nimport greeting from "./_parts/greeting.cjs";\nexport default function Plain() { return h(Text, null, greeting("Grace")); }\n`,
  );
  writeFileSync(join(emails, "broken.tsx"), `export default function Broken() { return <Section>; }\n`);
  writeFileSync(join(emails, "receipt.json"), JSON.stringify(parseTsx(`<Section><Text>Paid $42</Text></Section>`)));
  writeFileSync(join(emails, "welcome.test.tsx"), `export {};\n`);
  writeFileSync(join(emails, "notes.md"), "# not an email\n");

  server = await startDevServer({
    cwd: project,
    port: 0,
    env: { UNITPOST_API_KEY: "up_test_key", UNITPOST_FROM: "Acme <hi@acme.test>" },
    fetch: (async (url: string, init: RequestInit) => {
      sent.push({ url, init });
      return new Response(JSON.stringify({ id: "em_123" }), { status: 200 });
    }) as typeof fetch,
  });
});

after(async () => {
  await server?.close();
  if (project) rmSync(project, { recursive: true, force: true });
});

const get = async (path: string) => {
  const res = await fetch(server.url + path);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

test("listEmails: modules and JSON documents, minus partials, tests and other files", () => {
  assert.deepEqual(
    listEmails(join(project, "emails")).map((e) => e.id),
    ["broken.tsx", "plain.js", "receipt.json", "welcome.tsx"],
  );
});

test("dev server: renders a React email with its PreviewProps and its imported parts", async () => {
  const { status, body } = await get("/api/email?id=welcome.tsx");
  assert.equal(status, 200);
  assert.equal(body.error, null);
  assert.match(String(body.html), /Welcome, Ada/);
  assert.match(String(body.html), /Thanks, the team/);
  assert.match(String(body.text), /Get started/);
  assert.ok(!String(body.html).includes("powered_by"), "the library never brands a preview");
  assert.ok(Array.isArray(body.hints));
});

test("dev server: renders a JSON EmailDocument", async () => {
  const { body } = await get("/api/email?id=receipt.json");
  assert.match(String(body.html), /Paid \$42/);
});

test("dev server: a build error comes back as the email's error, not a crash", async () => {
  const { status, body } = await get("/api/email?id=broken.tsx");
  assert.equal(status, 200);
  assert.ok(String(body.error).length > 0);
  assert.equal(body.html, "");
});

test("dev server: ids can't leave the emails folder", async () => {
  assert.equal((await get("/api/email?id=../package.json")).status, 404);
  assert.equal((await get("/api/email?id=%2Fetc%2Fpasswd")).status, 404);
});

test("dev server: lists emails and says whether Send test is set up", async () => {
  const { body } = await get("/api/emails");
  assert.equal(body.canSend, true);
  assert.equal((body.emails as unknown[]).length, 4);
});

test("dev server: Send test only from its own page, through the Unitpost send endpoint", async () => {
  const post = (headers: Record<string, string>, body: unknown) =>
    fetch(server.url + "/api/send", { method: "POST", headers, body: JSON.stringify(body) });

  const crossSite = await post({ "Content-Type": "application/json", Origin: "https://evil.example" }, { id: "welcome.tsx", to: "a@b.co" });
  assert.equal(crossSite.status, 403);
  assert.equal(sent.length, 0);

  const origin = server.url;
  const badTo = await post({ "Content-Type": "application/json", Origin: origin }, { id: "welcome.tsx", to: "not an address" });
  assert.equal(badTo.status, 400);

  const ok = await post({ "Content-Type": "application/json", Origin: origin }, { id: "welcome.tsx", to: "ada@example.com" });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, id: "em_123" });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, "https://www.unitpost.com/api/v1/email");
  const headers = sent[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer up_test_key");
  assert.ok(headers["Idempotency-Key"]);
  const payload = JSON.parse(String(sent[0].init.body)) as Record<string, string>;
  assert.equal(payload.from, "Acme <hi@acme.test>");
  assert.equal(payload.to, "ada@example.com");
  assert.equal(payload.subject, "[Preview] welcome");
  assert.match(payload.html, /Welcome, Ada/);
});

test("sendTest: without UNITPOST_API_KEY / UNITPOST_FROM it explains what to set", async () => {
  const result = await sendTest({ to: "a@b.co", subject: "s", html: "<p>x</p>", text: "x" }, {});
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /UNITPOST_API_KEY/);
});

test("dev server: an edit to an email tells the page to reload", { timeout: 10_000 }, async () => {
  const res = await fetch(server.url + "/events");
  const reader = res.body!.getReader();
  await reader.read(); // ": connected"
  writeFileSync(join(project, "emails", "receipt.json"), JSON.stringify(parseTsx(`<Section><Text>Paid $43</Text></Section>`)));
  // File events can arrive late (macOS batches them), so an event from the
  // setup writes may come first: wait until one shows the edit.
  for (;;) {
    const { value, done } = await reader.read();
    assert.equal(done, false);
    assert.match(new TextDecoder().decode(value), /data: change/);
    if (/Paid \$43/.test(String((await get("/api/email?id=receipt.json")).body.html))) break;
  }
  await reader.cancel();
});

test("dev server: a CommonJS helper's require() works inside an email", async () => {
  const { body } = await get("/api/email?id=plain.js");
  assert.equal(body.error, null);
  assert.match(String(body.html), /Hi Grace/);
});

// fetch() won't set Host, so these go through node:http.
function raw(path: string, headers: Record<string, string>, method = "GET", body?: string): Promise<number> {
  const { port } = new URL(server.url);
  return new Promise((done, fail) => {
    const req = request({ host: "127.0.0.1", port, path, method, headers }, (res) => {
      res.resume();
      done(res.statusCode ?? 0);
    });
    req.on("error", fail);
    req.end(body);
  });
}

test("dev server: DNS rebinding — a request naming another host is refused", async () => {
  const { port } = new URL(server.url);
  assert.equal(await raw("/api/email?id=welcome.tsx", { Host: `attacker.example:${port}` }), 403);
  assert.equal(await raw("/", { Host: "attacker.example" }), 403);
  assert.equal(await raw("/api/emails", { Host: `localhost:${port}` }), 200);
  const before = sent.length;
  const status = await raw(
    "/api/send",
    { Host: `attacker.example:${port}`, Origin: `http://attacker.example:${port}`, "Content-Type": "application/json" },
    "POST",
    JSON.stringify({ id: "welcome.tsx", to: "victim@example.com" }),
  );
  assert.equal(status, 403);
  // Trusted Host but a foreign Origin: still no send.
  assert.equal(
    await raw(
      "/api/send",
      { Host: `127.0.0.1:${port}`, Origin: `http://attacker.example:${port}`, "Content-Type": "application/json" },
      "POST",
      JSON.stringify({ id: "welcome.tsx", to: "victim@example.com" }),
    ),
    403,
  );
  assert.equal(sent.length, before);
});

// `react` is an optional peer: help and JSON previews must work without it.
// Node 20 (the public repo's CI) has no module.registerHooks; skip there.
test(
  "dev server: starts and previews JSON without react installed",
  { skip: !("registerHooks" in nodeModule) && "needs module.registerHooks (Node 22.15+)" },
  () => {
    const devServer = new URL("./dev-server.ts", import.meta.url).href;
    const dir = join(project, "no-react");
    mkdirSync(join(dir, "emails"), { recursive: true });
    writeFileSync(join(dir, "package.json"), "{}");
    writeFileSync(join(dir, "emails", "r.json"), JSON.stringify(parseTsx(`<Section><Text>No React here</Text></Section>`)));
    const script = `
      import { registerHooks } from "node:module";
      registerHooks({
        resolve(specifier, context, next) {
          if (specifier === "react" || specifier.startsWith("react/")) throw new Error("react is not installed");
          return next(specifier, context);
        },
      });
      const { startDevServer } = await import(${JSON.stringify(devServer)});
      const server = await startDevServer({ cwd: ${JSON.stringify(dir)}, port: 0, env: {} });
      const body = await (await fetch(server.url + "/api/email?id=r.json")).json();
      await server.close();
      console.log(JSON.stringify({ error: body.error, ok: body.html.includes("No React here") }));
    `;
    const run = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout.trim().split("\n").pop()!), { error: null, ok: true });
  },
);
