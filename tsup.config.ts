import { defineConfig } from "tsup";

// Build ONLY the curated public entry (`src/public.ts`) for npm. The
// workspace-internal barrel (`src/index.ts`, which also re-exports the TipTap
// bridge / tree-ops / diagnostics) is intentionally NOT built or shipped — in
// the monorepo those internals are consumed straight from source via the
// `.`/`./internal` source `exports`, and `publishConfig` (in package.json)
// repoints the published `.` at this built public bundle.
export default defineConfig({
  entry: { index: "src/public.ts", react: "src/react.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // zod is a peer, sanitize-html a runtime dep, react is an optional peer for
  // the ./react authoring entry — keep all external.
  external: ["zod", "sanitize-html", "react"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
