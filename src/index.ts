// @unitpost/email — INTERNAL entry point (workspace-only: platform-app editor
// + mailing engine). This is the FULL surface: the curated public API (see
// `./public`) PLUS editor-only machinery we don't publish to npm — the TipTap
// bridge, document tree-op helpers, and editor diagnostics.
//
// External npm consumers import `@unitpost/email`, which resolves to `./public`
// (built to dist/). In-repo apps import the same package name — workspace
// `exports["."]` and tsconfig paths point at THIS file, so they get the full
// surface without switching to the npm tarball or the `/internal` subpath.

// Everything in the published public surface.
export * from "./public";

// Editor-only machinery — intentionally NOT part of the public npm surface.
export * from "./ops";
export * from "./tiptap";
export * from "./diagnostics";
