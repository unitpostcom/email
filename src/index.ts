// @unitpost/email — INTERNAL entry point (workspace-only: platform-app editor
// + mailing engine). This is the FULL surface: the curated public API (see
// `./public`) PLUS editor-only machinery we don't publish to npm — the TipTap
// bridge, document tree-op helpers, and editor diagnostics.
//
// External consumers import the package root (`@unitpost/email`), which resolves
// to `./public`. In-repo code that needs the editor internals imports
// `@unitpost/email/internal` (this file).

// Everything in the published public surface.
export * from "./public";

// Editor-only machinery — intentionally NOT part of the public npm surface.
export * from "./ops";
export * from "./tiptap";
export * from "./diagnostics";
