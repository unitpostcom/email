// Extract the library-image ids embedded in a piece of rendered email HTML.
//
// Library images are served from the asset CDN at the opaque path `/img/{id}`
// (current form, post-2026-06 CDN rework), e.g. `https://assets.unitpost.com/img/{id}`.
// Mail authored BEFORE the rework may instead carry the legacy API byte-proxy
// URL `/api/library-images/{id}/raw`. The rendered HTML carries whichever form
// the engine resolved into the `<img src>`, so we match BOTH here.
//
// We capture these ids AT SEND TIME and persist them onto the message row,
// because a template's `design` is mutable: after a send we can no longer
// reconstruct which images actually went out. The library-image delete guard
// then warns (with a broken-image disclaimer) before removing bytes that an
// already-sent / queued / scheduled message references — recipients fetch those
// bytes from the CDN at OPEN time.
//
// Matching is intentionally permissive on the surrounding URL (any scheme /
// origin / query / fragment) but strict on the id segment (a UUID-shaped token).
// We scan the raw HTML string rather than re-parsing the design so this stays a
// pair of regexes over the exact bytes we shipped.

const IMG_PATH_RE = /\/img\/([0-9a-fA-F-]{8,})\b/g;
const LEGACY_RAW_URL_RE = /\/api\/library-images\/([0-9a-fA-F-]{8,})\/raw\b/g;

// Return the unique set of library-image ids referenced in `html` (both the
// current `/img/{id}` CDN form and the legacy `/api/library-images/{id}/raw`).
// Empty array when none are present (or `html` is empty/undefined).
export function extractLibraryImageIds(html: string | null | undefined): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  for (const match of html.matchAll(IMG_PATH_RE)) {
    if (match[1]) ids.add(match[1]);
  }
  for (const match of html.matchAll(LEGACY_RAW_URL_RE)) {
    if (match[1]) ids.add(match[1]);
  }
  return [...ids];
}
