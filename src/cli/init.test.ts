import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { startDevServer } from "./dev-server";
import { DEV_SCRIPT, formatInitResult, initProject } from "./init";

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);

const projects: string[] = [];
after(() => {
  for (const dir of projects) rmSync(dir, { recursive: true, force: true });
});

function project(files: Record<string, string> = {}): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "unitpost-email-init-")));
  projects.push(dir);
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;

test("init: a TypeScript project gets emails/welcome.tsx, the script, and an install line for what's missing", () => {
  const cwd = project({
    "package.json": JSON.stringify({ name: "app", scripts: { build: "tsc" }, dependencies: { react: "^19" } }, null, 2),
    "tsconfig.json": `{ "compilerOptions": { "jsx": "react-jsx" } }`,
  });
  const result = initProject({ cwd });
  assert.equal(result.email, join("emails", "welcome.tsx"));
  assert.equal(result.emailCreated, true);
  assert.equal(result.script, "added");
  assert.deepEqual(result.install, ["npm install @unitpost/email zod", "npm install -D esbuild @types/react"]);
  assert.equal(result.jsxHint, null);
  const email = readFileSync(join(cwd, "emails", "welcome.tsx"), "utf8");
  assert.match(email, /export function WelcomeEmail\(\{ name \}: \{ name: string \}\)/);
  assert.match(email, /WelcomeEmail\.PreviewProps = \{ name: "Ada" \};/);
  const pkg = readJson(join(cwd, "package.json"));
  assert.deepEqual(pkg.scripts, { build: "tsc", [DEV_SCRIPT]: "unitpost-email dev" });
});

test("init: a JavaScript project gets welcome.jsx without type annotations", () => {
  const cwd = project({ "package.json": `{"name":"app"}` });
  const result = initProject({ cwd });
  assert.equal(result.email, join("emails", "welcome.jsx"));
  assert.match(readFileSync(join(cwd, "emails", "welcome.jsx"), "utf8"), /export function WelcomeEmail\(\{ name \}\) \{/);
});

test("init: keeps an existing email and script, and asks to install nothing that's there", () => {
  const cwd = project({
    "package.json": JSON.stringify({
      name: "app",
      scripts: { [DEV_SCRIPT]: "my own" },
      dependencies: { "@unitpost/email": "^0.5.0", react: "^19", zod: "^4" },
      devDependencies: { esbuild: "^0.27.0", typescript: "^5", "@types/react": "^19" },
    }),
    "emails/welcome.tsx": "// mine\n",
  });
  const before = readFileSync(join(cwd, "package.json"), "utf8");
  const result = initProject({ cwd });
  assert.equal(result.emailCreated, false);
  assert.equal(result.script, "kept");
  assert.deepEqual(result.install, []);
  assert.equal(readFileSync(join(cwd, "emails", "welcome.tsx"), "utf8"), "// mine\n");
  assert.equal(readFileSync(join(cwd, "package.json"), "utf8"), before);
});

test("init: a custom folder goes into the script, and package.json keeps its indentation", () => {
  const cwd = project({ "package.json": `{\n\t"name": "app"\n}\n`, "pnpm-lock.yaml": "" });
  const result = initProject({ cwd, dir: "src/mail" });
  assert.equal(result.email, join("src", "mail", "welcome.jsx"));
  assert.equal(readFileSync(join(cwd, "package.json"), "utf8"), `{\n\t"name": "app",\n\t"scripts": {\n\t\t"${DEV_SCRIPT}": "unitpost-email dev src/mail"\n\t}\n}\n`);
  assert.deepEqual(result.install, ["pnpm add @unitpost/email react zod", "pnpm add -D esbuild"]);
  assert.match(formatInitResult(result, "pnpm"), /\n {2}pnpm email:dev\n$/);
});

test("init: without package.json it still writes the email and says how to preview", () => {
  const cwd = project();
  const result = initProject({ cwd });
  assert.equal(result.script, "no-package-json");
  assert.equal(result.emailCreated, true);
  const out = formatInitResult(result, "npm run");
  assert.match(out, /No package\.json here/);
  assert.match(out, /npx @unitpost\/email dev\n$/);
});

test("init: a custom folder without package.json goes into the preview command", () => {
  const cwd = project();
  const out = formatInitResult(initProject({ cwd, dir: "src/mail" }), "npm run");
  assert.match(out, /\n {2}npx @unitpost\/email dev src\/mail\n$/);
});

test("init: a folder a shell could expand is refused, and nothing is written", () => {
  const pkgText = `{"name":"app"}`;
  for (const dir of ["emails/$(touch pwned)", "emails/`touch pwned`", "emails/$HOME", 'a"b', "my emails", "a;b", "a&b", "a|b", "%PATH%", "--port", "/tmp/mail"]) {
    const cwd = project({ "package.json": pkgText });
    assert.throws(() => initProject({ cwd, dir }), /goes into a package\.json script/, dir);
    assert.equal(readFileSync(join(cwd, "package.json"), "utf8"), pkgText, dir);
    assert.deepEqual(readdirSync(cwd), ["package.json"], dir);
  }
});

test("init: in a workspace package, the package manager comes from the workspace root", () => {
  const root = project({ "pnpm-lock.yaml": "", "packages/app/package.json": `{"name":"app"}` });
  const result = initProject({ cwd: join(root, "packages", "app") });
  assert.deepEqual(result.install, ["pnpm add @unitpost/email react zod", "pnpm add -D esbuild"]);
  const named = project({ "package.json": `{"name":"repo","packageManager":"yarn@4.5.0"}`, "app/package.json": `{"name":"app"}` });
  assert.deepEqual(initProject({ cwd: join(named, "app") }).install[0], "yarn add @unitpost/email react zod");
});

test("init: a backslash folder is written with forward slashes", () => {
  const cwd = project({ "package.json": `{"name":"app"}` });
  const result = initProject({ cwd, dir: "src\\mail" });
  assert.equal(result.dir, "src/mail");
  assert.equal(readJson(join(cwd, "package.json")).scripts[DEV_SCRIPT], "unitpost-email dev src/mail");
});

test("init: a tsconfig without jsx gets a hint", () => {
  const cwd = project({ "package.json": `{"name":"app"}`, "tsconfig.json": `{ "compilerOptions": { "strict": true } }` });
  assert.match(initProject({ cwd }).jsxHint ?? "", /"jsx": "react-jsx"/);
});

test("init: the starter email previews in the dev server", async () => {
  const cwd = project({ "package.json": JSON.stringify({ name: "app", type: "module" }) });
  mkdirSync(join(cwd, "node_modules", "@unitpost"), { recursive: true });
  symlinkSync(dirname(require.resolve("react/package.json")), join(cwd, "node_modules", "react"), "dir");
  symlinkSync(PACKAGE_DIR, join(cwd, "node_modules", "@unitpost", "email"), "dir");
  initProject({ cwd });
  const server = await startDevServer({ cwd, port: 0 });
  try {
    const list = (await (await fetch(`${server.url}/api/emails`)).json()) as { emails: { id: string }[] };
    assert.deepEqual(
      list.emails.map((e) => e.id),
      ["welcome.jsx"],
    );
    const preview = (await (await fetch(`${server.url}/api/email?id=welcome.jsx`)).json()) as { html: string; error: string | null };
    assert.equal(preview.error, null);
    assert.match(preview.html, /Welcome, Ada/);
  } finally {
    await server.close();
  }
});

test("init: the CLI runs it and prints the next steps", () => {
  const cwd = project({ "package.json": `{"name":"app"}` });
  // tsx by URL: the throwaway project can't resolve it by name.
  const cli = [import.meta.resolve("tsx"), join(PACKAGE_DIR, "src", "cli", "index.ts")];
  const res = spawnSync(process.execPath, ["--import", cli[0], cli[1], "init"], { cwd, encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /^Created emails[/\\]welcome\.jsx\n/);
  assert.match(res.stdout, /npm install @unitpost\/email react zod/);
  assert.match(res.stdout, /npm run email:dev\n$/);
});

test("init: the CLI refuses a folder a shell could expand", () => {
  const cwd = project({ "package.json": `{"name":"app"}` });
  const cli = [import.meta.resolve("tsx"), join(PACKAGE_DIR, "src", "cli", "index.ts")];
  const res = spawnSync(process.execPath, ["--import", cli[0], cli[1], "init", "emails/$(touch pwned)"], { cwd, encoding: "utf8" });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /letters, digits/);
  assert.deepEqual(readdirSync(cwd), ["package.json"]);
});
