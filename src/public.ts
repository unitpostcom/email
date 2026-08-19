// @unitpost/email — PUBLIC entry point (the surface published to npm).
//
// This is the curated, documented API we support for external consumers: the
// document model + schema, the cross-client HTML renderer, the component
// catalog, the constrained-TSX codec, ready-made samples, and the HTML
// sanitizer. It is deliberately a NARROWER surface than the workspace-internal
// entry (`./internal`) — editor-only machinery (the TipTap bridge, the
// tree-op helpers, and the editor diagnostics) is intentionally NOT exported
// here, so we don't ship (and have to support forever) internal tooling.
//
// Everything re-exported below is stable public API. If you're wiring the
// in-repo template editor, import from `@unitpost/email/internal` instead.

// Document model, schema, defaults, tokens, categories, common enums/types.
export * from "./schema";

// Cross-client HTML renderer + variable resolution (the same code path the
// send engine uses).
export * from "./render";

// Marketing footer derived from workspace branding (editor preview + send
// path share this so link/text/band colors never drift).
export * from "./marketing-footer-branding";

// Constrained-TSX codec: parseTsx / printTsx and their error type.
export * from "./codec";

// Component catalog (metadata + snippets) that documents/tools render from.
export * from "./catalog";

// Ready-to-use sample documents.
export * from "./samples";

// Pre-built section layouts (header/hero/content/columns/CTA/footer bands)
// composed purely from the block primitives above.
export * from "./layouts";

// HTML sanitizer for customer-authored HTML blocks.
export * from "./sanitize";

// Block constructors + empty/parse helpers (createBlock, emptyDocument,
// safeParseDocument, …).
export * from "./blocks";

// Low-level style helpers (FONT_STACKS, inlineStyle, …) and Tailwind → inline
// compilation used by the renderer; useful to advanced consumers.
export * from "./util";
export * from "./tw-compile";

// Hosted-asset URL helpers for library images referenced by documents.
export * from "./library-image-refs";
export * from "./library-image-url";
