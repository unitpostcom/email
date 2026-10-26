#!/usr/bin/env node
// Run a workspace's node:test suite: every *.test.ts under src/ (or the dirs
// given). Each workspace's `test` script is
//   node --import tsx ../../tools/node-test.mjs [--exclude <dir>]… [dir]…
//
// Why not `node --test $(find src -name '*.test.ts')` (the old scripts): since
// Node 21 every path after `--test` is a glob, so a Next.js dynamic segment
// like `[id]` reads as a character class and the file silently matches
// nothing (`# tests 0`, exit 0; a backslash escape is read as a path
// separator). CI on Node 20 still ran those files; Node 22 locally did not. `run({ files })` takes literal paths on every Node version, and its
// child processes inherit this process's `--import tsx`.
//
// Guard: every file found must report at least one test of its own, so a file
// the runner cannot see (or that registers nothing) fails the run instead of
// quietly dropping out of the total. A file with no tests still shows up as
// one passing "test" named after the file; that does not count.

import { readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { run } from "node:test";
import { spec, tap } from "node:test/reporters";

const dirs = [];
const excludes = [];
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--exclude") excludes.push(resolve(process.argv[++i]) + sep);
  else dirs.push(process.argv[i]);
}

const files = (dirs.length ? dirs : ["src"])
  .flatMap((dir) => readdirSync(dir, { recursive: true }).map((f) => resolve(dir, f)))
  .filter((f) => f.endsWith(".test.ts") && !f.includes(`${sep}node_modules${sep}`))
  .filter((f) => !excludes.some((x) => f.startsWith(x)))
  .sort();

const reported = new Set();
const stream = run({ files, concurrency: true });
stream.on("test:pass", ({ file, name }) => name !== file && reported.add(file));
stream.on("test:fail", ({ file, name, todo }) => {
  if (name !== file) reported.add(file);
  if (!todo) process.exitCode = 1;
});
stream.on("end", () => {
  const silent = files.filter((f) => !reported.has(f));
  if (!silent.length) return;
  console.error(`\nThese test files reported no tests (not run, or nothing registered):`);
  for (const f of silent) console.error(`  ${relative(process.cwd(), f)}`);
  process.exitCode = 1;
});
stream.compose(process.stdout.isTTY ? spec : tap).pipe(process.stdout);
