import sanitizeHtmlLib from "sanitize-html";

// ---------------------------------------------------------------------------
// Email HTML safety — forbidden actions + unsafe URL schemes.
//
// The visual editor's `html` block (and any HTML reaching the renderer) is an
// opaque escape hatch. We do NOT let raw, unsanitized markup reach the inbox or
// our own dashboard preview: that's both a deliverability problem (Gmail/Outlook
// strip <script>/JS and spam-flag broken markup) and a stored-XSS surface in the
// canvas/preview.
//
// Policy (see docs/architecture/SECURITY.md §3): allow-list email-safe tags +
// attributes, allow-list URL schemes, and strip everything else. We SANITIZE
// (strip) rather than reject so saving/sending is never blocked; the editor
// surfaces a warning about what was removed. See sanitize-html (the de-facto
// server-side standard) — we configure it for email rather than hand-rolling a
// regex sanitizer (regex sanitizers are trivially bypassable).
// ---------------------------------------------------------------------------

// Tags an email client will actually honor. Structural + text + table + media.
// Notably ABSENT (stripped): script, iframe, object, embed, form, input,
// button, select, textarea, link, meta, base, noscript, template, svg, math,
// audio, video, frame, frameset, applet — i.e. anything scriptable, interactive,
// or external-resource-loading beyond images.
//
// `<style>` is HANDLED SEPARATELY (it is NOT in this list and NOT passed to
// sanitize-html, which can only strip-or-keep its raw text and can't safely
// parse @media/@font-face). We extract <style> blocks first, sanitize the CSS
// (strip expression()/javascript:/behavior:/@import/binding/script-y url()),
// and re-inject them — so responsive marketing CSS (@media queries) survives
// while the XSS vectors inside a stylesheet are neutralized. See M1.
export const EMAIL_ALLOWED_TAGS = [
  "a",
  "abbr",
  "address",
  "area",
  "b",
  "blockquote",
  "br",
  "caption",
  "center",
  "cite",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "font",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "map",
  "mark",
  "ol",
  "p",
  "pre",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strike",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
  "wbr",
] as const;

// URL schemes we permit in href/src-style attributes. `cid:` is for inline
// attachments; relative + anchor URLs are allowed by sanitize-html implicitly.
// Notably ABSENT: javascript:, vbscript:, data: (except images — see below),
// file:, blob:.
export const EMAIL_ALLOWED_SCHEMES = ["http", "https", "mailto", "tel", "cid"];

// Attributes are allowed broadly (presentational HTML email leans on inline
// style + width/height/align/bgcolor/etc.), EXCEPT event handlers. We strip any
// attribute starting with `on` (onclick, onerror, onload, …) and neutralize
// `style` declarations containing `expression(`, `javascript:`, or
// `url(javascript:`. The `*: ["*"]` allow-all is filtered down by the
// `on*`/dangerous-style passes below via sanitize-html transforms.
const STAR_ALLOWED_ATTRS = ["*"];

// sanitize-html expt"" config. We allow a wide attribute surface (presentational
// email) but block scriptable schemes + the data: scheme everywhere except <img>
// (where data: URIs are a legitimate inline-image technique).
function baseOptions(report: SanitizeReport): sanitizeHtmlLib.IOptions {
  return {
    allowedTags: [...EMAIL_ALLOWED_TAGS],
    allowedAttributes: { "*": STAR_ALLOWED_ATTRS },
    allowedSchemes: EMAIL_ALLOWED_SCHEMES,
    allowedSchemesByTag: {
      // Inline images may use data: URIs (and the normal web schemes).
      img: [...EMAIL_ALLOWED_SCHEMES, "data"],
    },
    allowedSchemesAppliedToAttributes: ["href", "src", "cite", "longdesc"],
    // Drop disallowed tags AND their contents for the dangerous, content-bearing
    // ones (script/style/etc.); for everything else, sanitize-html keeps inner
    // text by default. `nonTextTags` lists tags whose contents are also removed.
    nonTextTags: [
      "script",
      "style",
      "textarea",
      "option",
      "noscript",
      "template",
      "iframe",
      "object",
      "embed",
    ],
    disallowedTagsMode: "discard",
    // Allow common presentational protocols-relative URLs and keep relative URLs.
    allowProtocolRelative: true,
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
    // Per-element transform: strip event handlers + neutralize dangerous inline
    // CSS, and record what we removed so the editor can warn.
    transformTags: {
      "*": (tagName, attribs) => {
        const cleaned: Record<string, string> = {};
        for (const [name, value] of Object.entries(attribs)) {
          const lower = name.toLowerCase();
          // Event handlers (onclick, onerror, onload, onmouseover, …).
          if (lower.startsWith("on")) {
            report.attributes.add(name);
            continue;
          }
          // `style` with script-y CSS (IE expression(), behavior:, javascript:).
          if (lower === "style" && DANGEROUS_STYLE.test(value)) {
            report.styles.add(value);
            // Strip only the offending declarations, keep the rest.
            const safe = stripDangerousStyle(value);
            if (safe) cleaned[name] = safe;
            continue;
          }
          cleaned[name] = value;
        }
        return { tagName, attribs: cleaned };
      },
    },
    exclusiveFilter: () => false,
  };
}

const DANGEROUS_STYLE =
  /(?:expression\s*\(|behaviou?r\s*:|javascript\s*:|vbscript\s*:|url\s*\(\s*['"]?\s*(?:javascript|vbscript|data:text\/html))/i;

function stripDangerousStyle(style: string): string {
  return style
    .split(";")
    .filter((decl) => decl.trim() && !DANGEROUS_STYLE.test(decl))
    .join(";")
    .trim();
}

// ---------------------------------------------------------------------------
// <style> block CSS sanitization (M1).
//
// Email clients honor a <style> block for responsive design (@media queries),
// web fonts (@font-face), and pseudo-classes/hover — none of which can be
// expressed as inline style. Previously we stripped <style> entirely, which
// broke responsive marketing email. We now KEEP the block but sanitize the CSS:
// remove the handful of constructs that turn a stylesheet into a script/exfil
// vector, while leaving ordinary (incl. @media/@font-face) rules intact.
//
// We do NOT delegate this to sanitize-html: it treats <style> as opaque text
// (strip-or-keep, gated behind allowVulnerableTags) and cannot parse block CSS.
// A targeted CSS pass is both safer (we own the rules) and preserves @media.
// ---------------------------------------------------------------------------

// Dangerous CSS constructs inside a <style> block. Broader than DANGEROUS_STYLE
// (inline-attr) because a stylesheet can also pull remote/script resources via
// @import and IE/Mozilla behavior bindings:
//   • expression( … )            — legacy IE dynamic CSS (script execution)
//   • behavior: / -ms-behavior   — IE HTC binding (script)
//   • -moz-binding               — Firefox XBL binding (script)
//   • @import                     — pulls a remote stylesheet (exfil/inject)
//   • javascript: / vbscript:     — script URL schemes anywhere in the rule
//   • url( javascript:|vbscript:|data:text/html ) — script-y url() targets
const DANGEROUS_CSS_DECL =
  /(?:expression\s*\(|(?:-(?:ms|moz|webkit)-)?behaviou?r\s*:|-moz-binding\s*:|javascript\s*:|vbscript\s*:|url\s*\(\s*['"]?\s*(?:javascript|vbscript|data:text\/html))/i;
// `@import` is matched separately so we can drop the whole at-rule (including a
// url()/string target) rather than a single declaration.
const CSS_IMPORT_RE = /@import\b[^;{]*;?/gi;
// `</style` (in any casing/spacing) inside the CSS would prematurely close the
// block and let following text escape as markup — neutralize it.
const CSS_STYLE_CLOSE_RE = /<\s*\/\s*style/gi;
// CSS comments can hide payloads from a naive scan; strip them before checking.
const CSS_COMMENT_RE = /\/\*[\s\S]*?\*\//g;

// Sanitize the CSS text of a single <style> block. Returns the cleaned CSS and
// whether anything was removed (so the caller can report it). Keeps @media,
// @font-face, @supports, keyframes, etc.; drops only the dangerous bits.
function sanitizeStyleCss(css: string): { css: string; changed: boolean } {
  const original = css;
  // 1) Strip comments (could conceal `</style` or expression()).
  let out = css.replace(CSS_COMMENT_RE, "");
  // 2) Drop @import at-rules wholesale.
  out = out.replace(CSS_IMPORT_RE, "");
  // 3) Neutralize any premature </style> close.
  out = out.replace(CSS_STYLE_CLOSE_RE, "");
  // 4) Walk declarations and drop the dangerous ones. We split on both `;` and
  //    `}`/`{` boundaries so a single bad declaration inside a rule block is
  //    removed without nuking the surrounding (safe) rules. We re-join with the
  //    original separators by tracking them.
  out = stripDangerousCssDeclarations(out);
  const changed = out !== original;
  return { css: out.trim(), changed };
}

// Remove individual dangerous declarations while preserving CSS structure
// (selectors, braces, @media wrappers). We tokenize on `{`, `}`, and `;` and
// drop only the *declaration* tokens that match DANGEROUS_CSS_DECL, keeping
// selectors and block delimiters so the stylesheet stays well-formed.
function stripDangerousCssDeclarations(css: string): string {
  let result = "";
  let token = "";
  const flush = (sep: string) => {
    // A declaration token is the text since the last separator. Drop it when it
    // carries a dangerous construct; otherwise keep it verbatim.
    if (DANGEROUS_CSS_DECL.test(token)) {
      token = "";
      // Swallow a trailing `;` of a dropped declaration; keep block braces.
      if (sep === ";") return;
    }
    result += token + sep;
    token = "";
  };
  for (const ch of css) {
    if (ch === ";" || ch === "{" || ch === "}") {
      flush(ch);
    } else {
      token += ch;
    }
  }
  if (token) {
    if (!DANGEROUS_CSS_DECL.test(token)) result += token;
  }
  return result;
}

// Match a whole <style ...>…</style> block (case-insensitive, multiline). The
// content group excludes the closing tag. Non-greedy so adjacent blocks don't
// merge.
const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
// A placeholder we swap <style> blocks out for BEFORE sanitize-html runs (so it
// never sees / strips them), then swap back AFTER. sanitize-html strips HTML
// comments, so we use a bare alphanumeric text sentinel (no markup chars, so it
// passes through untouched as a text node) that we replace back verbatim. The
// long random-looking token makes a collision with real body text effectively
// impossible.
const STYLE_PLACEHOLDER = (i: number) =>
  `unitpoststyleblockplaceholderx7f3a${i}endx7f3a`;
const STYLE_PLACEHOLDER_RE = /unitpoststyleblockplaceholderx7f3a(\d+)endx7f3a/g;

// Pull every <style> block out of the HTML, returning the HTML with each block
// replaced by an inert placeholder plus the sanitized CSS for each. The caller
// re-injects after the main sanitize pass so the surrounding markup is cleaned
// by sanitize-html while the (separately-sanitized) stylesheet survives intact.
function extractStyleBlocks(
  html: string,
  report: SanitizeReport,
): { html: string; blocks: string[] } {
  const blocks: string[] = [];
  STYLE_BLOCK_RE.lastIndex = 0;
  const replaced = html.replace(STYLE_BLOCK_RE, (_full, css: string) => {
    const { css: safe, changed } = sanitizeStyleCss(css);
    if (changed) report.styles.add(css);
    const idx = blocks.length;
    // Re-wrap in a clean <style> tag (drop any attributes on the original — a
    // <style> needs none, and dropping them removes another injection surface).
    blocks.push(`<style>${safe}</style>`);
    return STYLE_PLACEHOLDER(idx);
  });
  return { html: replaced, blocks };
}

export type SanitizeReport = {
  // Disallowed tags that were removed (e.g. "script", "iframe").
  tags: Set<string>;
  // Event-handler / disallowed attributes that were stripped (e.g. "onclick").
  attributes: Set<string>;
  // Unsafe URLs that were neutralized (e.g. "javascript:alert(1)").
  urls: Set<string>;
  // Inline style values that contained script-y CSS.
  styles: Set<string>;
};

export type SanitizeResult = {
  html: string;
  report: SanitizeReport;
  // Convenience: true when anything at all was stripped/neutralized.
  changed: boolean;
};

function emptyReport(): SanitizeReport {
  return {
    tags: new Set(),
    attributes: new Set(),
    urls: new Set(),
    styles: new Set(),
  };
}

// Tag/scheme detection for the report: sanitize-html doesn't tell us WHAT it
// removed, so we do a cheap pre-scan for forbidden tags + unsafe URL schemes.
const TAG_RE = /<\/?\s*([a-zA-Z][\w-]*)/g;
const URL_ATTR_RE =
  /(?:href|src|background|cite|longdesc|action|poster|formaction)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const UNSAFE_URL_RE = /^\s*(?:javascript|vbscript|file|blob)\s*:/i;
const DATA_HTML_RE = /^\s*data\s*:\s*text\/html/i;

const ALLOWED_TAG_SET = new Set<string>(
  EMAIL_ALLOWED_TAGS.map((t) => t.toLowerCase()),
);

function scanForRemovals(html: string, report: SanitizeReport): void {
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(html))) {
    const tag = m[1].toLowerCase();
    if (!ALLOWED_TAG_SET.has(tag)) report.tags.add(tag);
  }
  URL_ATTR_RE.lastIndex = 0;
  while ((m = URL_ATTR_RE.exec(html))) {
    const url = m[1] ?? m[2] ?? m[3] ?? "";
    if (UNSAFE_URL_RE.test(url) || DATA_HTML_RE.test(url)) {
      report.urls.add(url.trim());
    }
  }
}

// Sanitize a raw HTML fragment for email. Returns the cleaned HTML plus a report
// of what was stripped (so the editor can warn). Idempotent: sanitizing already-
// clean HTML returns it unchanged with an empty report.
export function sanitizeEmailHtml(input: string): SanitizeResult {
  const report = emptyReport();
  if (!input) return { html: "", report, changed: false };
  // Pull <style> blocks out FIRST (M1): sanitize-html would discard them, but
  // responsive email needs them. We sanitize each block's CSS ourselves and
  // swap in an inert placeholder so sanitize-html only sees the body markup;
  // the cleaned <style> blocks are re-injected after.
  const { html: withoutStyles, blocks } = extractStyleBlocks(input, report);
  // Pre-scan so we can tell the user WHAT was forbidden (sanitize-html only
  // returns the cleaned string).
  scanForRemovals(withoutStyles, report);
  let html = sanitizeHtmlLib(withoutStyles, baseOptions(report));
  // Re-inject the sanitized <style> blocks where their placeholders landed.
  if (blocks.length > 0) {
    html = html.replace(STYLE_PLACEHOLDER_RE, (_m, i: string) => {
      const idx = Number(i);
      return blocks[idx] ?? "";
    });
  }
  const changed =
    html !== input ||
    report.tags.size > 0 ||
    report.attributes.size > 0 ||
    report.urls.size > 0 ||
    report.styles.size > 0;
  return { html, report, changed };
}

// True if a string has any forbidden HTML actions or unsafe URLs. Cheap check
// used to decide whether to surface an editor warning without re-sanitizing.
export function hasForbiddenHtml(input: string): boolean {
  if (!input) return false;
  const report = emptyReport();
  // <style> is no longer forbidden (M1) — we sanitize its CSS rather than
  // reject it. Strip blocks out before the tag scan so a legitimate <style>
  // doesn't read as a removed tag; but DO flag a block whose CSS carries a
  // dangerous construct (it'll be cleaned, which is a change worth surfacing).
  let styleNeedsClean = false;
  const withoutStyles = input.replace(STYLE_BLOCK_RE, (_full, css: string) => {
    if (sanitizeStyleCss(css).changed) styleNeedsClean = true;
    return "";
  });
  if (styleNeedsClean) return true;
  scanForRemovals(withoutStyles, report);
  if (report.tags.size > 0 || report.urls.size > 0) return true;
  // Event handlers / dangerous inline styles.
  if (/\son[a-z]+\s*=/i.test(withoutStyles)) return true;
  if (DANGEROUS_STYLE.test(withoutStyles)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// safeUrl — scheme guard for structured block URLs (button/link/image href+src).
//
// These don't go through sanitize-html (they're single attribute values on tags
// the renderer emits itself), so we guard the scheme directly. Allowed: the
// email schemes, relative paths, anchors, protocol-relative (//host), and our
// own {{variable}} tokens (so authors can template the URL). Anything else
// (javascript:, vbscript:, data:text/html, …) is neutralized to "#".
// ---------------------------------------------------------------------------

const SAFE_URL_SCHEMES = new Set(EMAIL_ALLOWED_SCHEMES);

export function safeUrl(url: string): string {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return trimmed;
  // Template tokens (whole value or leading token) are trusted — resolved later.
  if (/^\{\{\s*[\w.]+\s*\}\}/.test(trimmed)) return trimmed;
  // Relative, root-relative, anchor, query, and protocol-relative URLs are safe.
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("?") ||
    trimmed.startsWith(".")
  ) {
    return trimmed;
  }
  // Has an explicit scheme? Validate it.
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (SAFE_URL_SCHEMES.has(scheme)) return trimmed;
    // data: only allowed for images (handled by the caller passing isImage).
    return "#";
  }
  // No scheme + not obviously relative (e.g. "example.com/x") — leave as-is; the
  // browser/email client treats it as relative, which is harmless.
  return trimmed;
}

// Variant for <img src> where data: image URIs are legitimate.
export function safeImageUrl(url: string): string {
  const trimmed = (url ?? "").trim();
  if (/^\s*data\s*:\s*image\//i.test(trimmed)) return trimmed;
  return safeUrl(trimmed);
}

// ---------------------------------------------------------------------------
// Document/fragment sanitization — used at API ingestion + save so the STORED
// design JSON never carries forbidden HTML (defense-in-depth alongside the
// renderer, which also sanitizes html blocks on the way out). Walks the block
// tree, sanitizing every `html` block's `html` field, and returns the cleaned
// design plus an aggregate report of everything stripped.
//
// Loosely typed (operates on `unknown`) so the same pass works for a full
// EmailDocument and a ComponentFragment without importing their schemas.
// ---------------------------------------------------------------------------

type AnyBlock = Record<string, unknown> & { type?: string };

function sanitizeBlockTree(
  node: unknown,
  report: SanitizeReport,
): unknown {
  if (Array.isArray(node)) {
    return node.map((child) => sanitizeBlockTree(child, report));
  }
  if (!node || typeof node !== "object") return node;
  const block = { ...(node as AnyBlock) };

  if (block.type === "html" && typeof block.html === "string") {
    const result = sanitizeEmailHtml(block.html);
    block.html = result.html;
    mergeReport(report, result.report);
  }

  // Recurse into container children/columns.
  if (Array.isArray(block.children)) {
    block.children = block.children.map((c) => sanitizeBlockTree(c, report));
  }
  if (Array.isArray(block.columns)) {
    block.columns = block.columns.map((c) => sanitizeBlockTree(c, report));
  }
  return block;
}

function mergeReport(into: SanitizeReport, from: SanitizeReport): void {
  for (const t of from.tags) into.tags.add(t);
  for (const a of from.attributes) into.attributes.add(a);
  for (const u of from.urls) into.urls.add(u);
  for (const s of from.styles) into.styles.add(s);
}

export type DesignSanitizeResult = {
  // The design with every html block sanitized (same shape as the input).
  design: unknown;
  report: SanitizeReport;
  changed: boolean;
};

// Sanitize all html blocks inside a document or fragment design. Returns a new
// design object (the input is not mutated) plus an aggregate report.
export function sanitizeDesignHtml(design: unknown): DesignSanitizeResult {
  const report = emptyReport();
  if (!design || typeof design !== "object") {
    return { design, report, changed: false };
  }
  const doc = { ...(design as Record<string, unknown>) };
  if (Array.isArray(doc.blocks)) {
    doc.blocks = (doc.blocks as unknown[]).map((b) =>
      sanitizeBlockTree(b, report),
    );
  }
  const changed =
    report.tags.size > 0 ||
    report.attributes.size > 0 ||
    report.urls.size > 0 ||
    report.styles.size > 0;
  return { design: doc, report, changed };
}

// Flatten a report into a short, human-readable summary for warnings/toasts.
export function summarizeReport(report: SanitizeReport): string | null {
  const parts: string[] = [];
  if (report.tags.size)
    parts.push(`removed ${[...report.tags].map((t) => `<${t}>`).join(", ")}`);
  if (report.attributes.size)
    parts.push(`stripped ${[...report.attributes].join(", ")}`);
  if (report.urls.size) parts.push(`blocked unsafe link(s)`);
  if (report.styles.size) parts.push(`cleaned unsafe inline CSS`);
  return parts.length ? parts.join("; ") : null;
}
