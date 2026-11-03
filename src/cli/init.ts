import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

// `npx @unitpost/email init [folder]`: set a project up for the library.
//
// Writes one starter email the preview server can show, adds an `email:dev`
// script, and prints the install command for whatever the project is
// missing. It never overwrites a file or a script that is already there, and
// it installs nothing itself: the command it prints uses the project's own
// package manager, so the lockfile stays the developer's to change.

export type InitOptions = {
  /** Folder for emails, relative to `cwd`. Default "emails". */
  dir?: string;
  cwd?: string;
};

export type InitResult = {
  /** The emails folder as written into the script (forward slashes). */
  dir: string;
  /** The starter email, relative to `cwd`. */
  email: string;
  /** False when a file was already there and was kept. */
  emailCreated: boolean;
  /** "added", "kept" (a script of that name exists) or "no-package-json". */
  script: "added" | "kept" | "no-package-json";
  /** Install commands for missing packages; empty when nothing is missing. */
  install: string[];
  /** Set when a tsconfig.json doesn't turn JSX on, so the editor would flag the email. */
  jsxHint: string | null;
};

export const DEV_SCRIPT = "email:dev";

const RUNTIME_DEPS = ["@unitpost/email", "react", "zod"];
const DEV_DEPS = ["esbuild"];

export function initProject(options: InitOptions = {}): InitResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const dir = safeFolder(options.dir ?? "emails");
  const pkgPath = join(cwd, "package.json");
  const pkgText = existsSync(pkgPath) ? readFileSync(pkgPath, "utf8") : null;
  const pkg = pkgText === null ? null : (JSON.parse(pkgText) as Record<string, unknown>);
  const deps = { ...asRecord(pkg?.dependencies), ...asRecord(pkg?.devDependencies) };

  const typescript = existsSync(join(cwd, "tsconfig.json")) || "typescript" in deps;
  const emailPath = join(cwd, dir, typescript ? "welcome.tsx" : "welcome.jsx");
  const emailCreated = !existsSync(emailPath);
  if (emailCreated) {
    mkdirSync(join(cwd, dir), { recursive: true });
    writeFileSync(emailPath, starterEmail(typescript));
  }

  let script: InitResult["script"] = "no-package-json";
  if (pkg && pkgText !== null) {
    const scripts = asRecord(pkg.scripts);
    if (DEV_SCRIPT in scripts) {
      script = "kept";
    } else {
      pkg.scripts = { ...scripts, [DEV_SCRIPT]: devCommand("unitpost-email dev", dir) };
      writeFileSync(pkgPath, JSON.stringify(pkg, null, detectIndent(pkgText)) + "\n");
      script = "added";
    }
  }

  const pm = packageManager(cwd);
  const missing = RUNTIME_DEPS.filter((name) => !(name in deps));
  // React ships no type declarations, so a TypeScript starter needs them.
  const missingDev = [...DEV_DEPS, ...(typescript ? ["@types/react"] : [])].filter((name) => !(name in deps));
  const install: string[] = [];
  if (missing.length) install.push(`${pm.add} ${missing.join(" ")}`);
  if (missingDev.length) install.push(`${pm.addDev} ${missingDev.join(" ")}`);

  let jsxHint: string | null = null;
  const tsconfigPath = join(cwd, "tsconfig.json");
  if (existsSync(tsconfigPath) && !/"jsx"\s*:/.test(readFileSync(tsconfigPath, "utf8"))) {
    jsxHint = 'Add "jsx": "react-jsx" to compilerOptions in tsconfig.json so your editor reads the email\'s JSX.';
  }

  return { dir, email: relative(cwd, emailPath), emailCreated, script, install, jsxHint };
}

export function formatInitResult(result: InitResult, run: string): string {
  const lines = [
    result.emailCreated ? `Created ${result.email}` : `Kept ${result.email} (already there)`,
    result.script === "added"
      ? `Added the "${DEV_SCRIPT}" script to package.json`
      : result.script === "kept"
        ? `Kept the "${DEV_SCRIPT}" script in package.json (already there)`
        : "No package.json here, so no script was added (run npm init first to add one)",
  ];
  if (result.jsxHint) lines.push("", result.jsxHint);
  lines.push("", "Next:");
  for (const command of result.install) lines.push(`  ${command}`);
  lines.push(result.script === "no-package-json" ? `  ${devCommand("npx @unitpost/email dev", result.dir)}` : `  ${run} ${DEV_SCRIPT}`);
  return lines.join("\n") + "\n";
}

type PackageManager = { add: string; addDev: string; run: string };

const PACKAGE_MANAGERS: Record<string, PackageManager> = {
  npm: { add: "npm install", addDev: "npm install -D", run: "npm run" },
  pnpm: { add: "pnpm add", addDev: "pnpm add -D", run: "pnpm" },
  yarn: { add: "yarn add", addDev: "yarn add -D", run: "yarn" },
  bun: { add: "bun add", addDev: "bun add -d", run: "bun run" },
};

const LOCKFILES: [string, string][] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["package-lock.json", "npm"],
];

// The nearest folder, from `cwd` up, that names a package manager (the
// `packageManager` field) or holds a lockfile: in a workspace package the
// lockfile is at the workspace root. npm when none does.
export function packageManager(cwd: string): PackageManager {
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const field = (JSON.parse(readFileSync(pkgPath, "utf8")) as { packageManager?: unknown }).packageManager;
        const name = typeof field === "string" ? field.split("@")[0] : "";
        if (name in PACKAGE_MANAGERS) return PACKAGE_MANAGERS[name];
      } catch {
        // An unreadable package.json above the project says nothing; keep looking.
      }
    }
    const lock = LOCKFILES.find(([file]) => existsSync(join(dir, file)));
    if (lock) return PACKAGE_MANAGERS[lock[1]];
    if (dirname(dir) === dir) return PACKAGE_MANAGERS.npm;
  }
}

function starterEmail(typescript: boolean): string {
  const props = typescript ? "{ name }: { name: string }" : "{ name }";
  return `import { Section, Heading, Text, Button } from "@unitpost/email/react";

export function WelcomeEmail(${props}) {
  return (
    <Section>
      <Heading>Welcome, {name}</Heading>
      <Text>Thanks for signing up. Confirm your email to get started.</Text>
      <Button href="https://example.com/confirm">Confirm email</Button>
    </Section>
  );
}

// The props the preview server renders this email with.
WelcomeEmail.PreviewProps = { name: "Ada" };
`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

// Keep package.json's own indentation (two spaces, four, or a tab).
function detectIndent(text: string): string | number {
  const match = /^[{[]\r?\n([ \t]+)/.exec(text);
  return match ? match[1] : 2;
}

// The folder ends up in a package.json script, which a shell runs, and no
// quoting is safe in both sh and cmd.exe. So accept only a plain relative
// path: letters, digits and . _ - / @ + (a backslash is read as a slash), and
// refuse anything a shell could expand ($, backticks, quotes, spaces, ;, &, …).
// A relative path also means init and the script's `dev` find the same folder.
export function safeFolder(input: string): string {
  const dir = input.replaceAll("\\", "/");
  if (!/^[\w.@+/-]+$/.test(dir) || dir.startsWith("-") || dir.startsWith("/")) {
    throw new Error(
      `Use a relative folder made of letters, digits and . _ - / @ + (got ${JSON.stringify(input)}): it goes into a package.json script, which a shell runs.`,
    );
  }
  return dir;
}

function devCommand(command: string, dir: string): string {
  return dir === "emails" ? command : `${command} ${dir}`;
}
