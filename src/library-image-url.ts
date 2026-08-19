// Single source of truth for the PUBLIC URL shape of a hosted library image.
//
// Image bytes live under an opaque key `img/{id}` — no tenant id in the path,
// so a recipient's email source never leaks one. What we store on an image
// block `src` is the RELATIVE path `/img/{id}` (origin-independent). The
// absolute URL (`<cdn-host>/img/{id}`) is resolved at RENDER time from the
// configured asset base. That indirection is what lets the same document
// render in local preview (relative / same-origin) and in a real send
// (absolute CDN or app origin), and lets the asset host change later
// without rewriting stored templates.
//
// This module is dependency-free (no `server-only`, no Node APIs) so it's
// safe to import from a browser editor, a server route, and a send renderer.

// The opaque, relative public path for an image's bytes. This is what goes into
// an <img src> in the stored design JSON.
export function libraryImagePath(id: string): string {
  return `/img/${id}`;
}

// The canonical, internet-reachable origin that hosted-image paths resolve
// against when NOTHING else is configured on a real SEND (no CDN, only a
// localhost/unset app origin). Passed by send callers (engine fan-out, API/test
// send) as the final fallback to effectiveAssetBase so a local-dev or
// misconfigured send still ships an absolute, loadable `<host>/img/{id}` instead
// of a relative `/img/{id}` (which a recipient's mail client turns into a
// host-less `http:///img/{id}` 404). The app serves `/img/:id` same-origin via a
// rewrite, so this host resolves the bytes even without the CDN. Kept here (not
// in brand.ts) so the dependency-free engine can use it too; mirrors
// FALLBACK_APP_ORIGIN in apps/web/src/lib/brand.ts.
export const PRODUCTION_ASSET_ORIGIN = "https://www.unitpost.com";

// Match the opaque `/img/{id}` path (current form) anywhere in a string, capturing
// the id. The id segment is a UUID-shaped token; we keep the surrounding context
// permissive (any origin prefix / query / fragment) but the path strict.
const IMG_PATH_RE = /\/img\/([0-9a-fA-F-]{8,})\b/;

// LEGACY form, pre-CDN: the API byte-proxy `/api/library-images/{id}/raw`. Still
// matched (extraction + render resolution) so designs/sent mail authored before
// the rework keep working without a migration.
const LEGACY_RAW_PATH_RE = /\/api\/library-images\/([0-9a-fA-F-]{8,})\/raw\b/;

// Resolve a single image-block `src` to its final, sendable URL.
//
// • A relative `/img/{id}` (or legacy `/api/library-images/{id}/raw`) is rewritten
//   to `${assetBaseUrl}/img/{id}` so recipients fetch from the CDN.
// • An ALREADY-absolute URL (http/https/data/protocol-relative), a `{{variable}}`
//   token, or anything we don't recognize is returned UNCHANGED — external CDNs
//   and user-typed URLs must pass through verbatim.
// • When `assetBaseUrl` is empty (e.g. local dev with no CDN) the path is left
//   relative; the dashboard preview is same-origin so it still resolves.
export function resolveImageSrc(src: string, assetBaseUrl: string | undefined): string {
  const value = (src ?? "").trim();
  if (!value) return value;
  // Leave absolute / scheme-relative / data URLs and template variables alone.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) return value;
  if (value.includes("{{")) return value;

  // Sanitize the base: strip trailing slashes AND reject a host-less base
  // (`http://`, `https://`, `http:///`, a bare scheme) that would otherwise
  // produce a broken `http:///img/{id}` URL — unreachable from a recipient's
  // inbox (the Gmail-proxy 404 bug). A base with no usable host → treat as
  // empty (leave the path relative), same as an unconfigured CDN.
  const base = sanitizeAssetBase(assetBaseUrl);
  if (!base) return value;

  const m = value.match(IMG_PATH_RE) ?? value.match(LEGACY_RAW_PATH_RE);
  if (m && m[1]) return `${base}${libraryImagePath(m[1])}`;
  return value;
}

// True when `url` is an absolute http(s) URL with a real, non-empty host. Used
// to reject scheme-only / host-less base URLs (`http://`, `https://`) before we
// build an image src from them. Deliberately permissive about the rest of the
// URL — we only care that there's a host to fetch from.
function hasUsableHost(url: string): boolean {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url);
  return m != null && m[1]!.length > 0;
}

// Normalize an asset base URL: trim, drop trailing slashes, and require a real
// host. Returns "" for anything host-less (a bare scheme, `http://`, etc.) so
// callers fall back to a relative path instead of emitting a broken URL.
function sanitizeAssetBase(raw: string | undefined): string {
  const base = (raw ?? "").trim().replace(/\/+$/, "");
  if (!base) return "";
  return hasUsableHost(base) ? base : "";
}

// Pick the base URL to resolve relative image paths against at RENDER time.
//
// Order of preference:
//   1. The asset CDN (`assetCdnUrl`, e.g. https://assets.unitpost.com) — the
//      canonical, recipient-facing host. Always used when configured.
//   2. The app origin (`appUrl`) AS A SAFETY FALLBACK — but only when it's a real,
//      internet-reachable host. The app serves the same bytes same-origin via the
//      `/img/:id` rewrite, so a recipient can still load the image even if the CDN
//      env var was forgotten in prod. This trades "CDN-optimized" for "not broken".
//   3. `sendFallbackOrigin` (OPTIONAL) — a last-resort reachable host used ONLY by
//      real SEND paths (engine fan-out, API/test send). When the CDN is unset and
//      the app origin is localhost/loopback (local dev), we must NOT leave the
//      path relative: a recipient's mail client turns a relative `/img/{id}` into
//      a HOST-LESS absolute `http:///img/{id}` that 404s (the reported bug). So a
//      send passes the production origin here and images resolve against a real,
//      internet-reachable host even from a local dev send. Preview/editor callers
//      omit it (relative is correct for the same-origin dashboard).
//   4. Empty — leaves the path relative. Only reached when no fallback is given
//      (i.e. the dashboard preview), where same-origin makes relative fine.
//
// Net effect: a SENT email always gets a reachable absolute URL (CDN, real app
// origin, or the send fallback) — never a bare relative path, never localhost,
// never a host-less `http:///`.
export function effectiveAssetBase(
  assetCdnUrl: string | undefined,
  appUrl: string | undefined,
  sendFallbackOrigin?: string | undefined,
): string {
  // The CDN is preferred — but only if it's a real, host-bearing URL. A
  // misconfigured scheme-only value (`http://`) is treated as unset so we fall
  // through to the app origin rather than shipping `http:///img/{id}`.
  const cdn = sanitizeAssetBase(assetCdnUrl);
  if (cdn) return cdn;
  const app = sanitizeAssetBase(appUrl);
  if (app && !isLoopbackOrigin(app)) {
    return app;
  }
  // No CDN and only a localhost/unset app origin. For a real send, resolve
  // against the provided reachable fallback (never ship relative → host-less).
  const fallback = sanitizeAssetBase(sendFallbackOrigin);
  if (fallback && !isLoopbackOrigin(fallback)) return fallback;
  return "";
}

// True for a loopback/localhost origin — unreachable from a recipient's inbox,
// so a real send must never freeze one into an image URL.
function isLoopbackOrigin(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(
    url,
  );
}
