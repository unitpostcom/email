import type { EmailDocument, Theme } from "./schema";

// IMPORTED WHOLE-EMAIL HTML — the author already built the whole email.
//
// HTML pasted into Code mode, or sent as `html` to the API / MCP, often is a
// complete email (often AI-written, or our own render): its own backdrop,
// centered card, fixed width and gutters. It lands as ONE Html block inside our
// designed shell, a `contentWidth` paper with padding and (on BRAND_THEME) a
// radius whose overflow:hidden clips. A 640px email in a 560px / 40px-padded /
// rounded paper was cropped in the editor and clipped by clients that honor
// overflow, and our own rendered HTML got a second shell. Resend sends the HTML
// as-is.
//
// So when the body IS a whole email, the shell steps aside: the email's own
// width (+ a gutter), its own backdrop color when it declares one, no padding,
// no radius. Applied at import (API/MCP create + html PATCH, Code-mode paste);
// the editor's Width control stays the override.

const MIN_LAYOUT_WIDTH = 320;
export const MAX_IMPORTED_WIDTH = 1200;
// Room for the outer gutter an email puts around its card when the card sits
// in a full-width wrapper (outer cell padding we can't measure statically).
// Extra width only widens the email's own backdrop around a centered card.
const GUTTER = 48;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function stripNonLayout(html: string): string {
  // Media queries (in <style>) describe OTHER widths; comments hold MSO
  // conditionals and dead markup.
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
}

function styleOf(tag: string): string {
  const style = tag.match(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
  return style ? (style[2] ?? style[3] ?? "") : "";
}

// The fixed widths each layout element (table, td, th, div, center) declares,
// in document order: `width="640"`, `width:640px`, `max-width:640px`, and
// em/rem at 16px (react-email's Container is `max-width:37.5em`). Images are
// not layout (a 2x retina image's width attribute is not the email's width);
// values outside 320–1200px are ignored. null for a tag with no fixed width.
function layoutWidths(html: string): (number | null)[] {
  const out: (number | null)[] = [];
  for (const tag of stripNonLayout(html).matchAll(/<(?:table|td|th|div|center)\b[^>]*>/gi)) {
    const t = tag[0];
    const widths: number[] = [];
    const attr = t.match(/\swidth\s*=\s*["']?(\d{3,4})(?:px)?["']?(?=[\s>/])/i);
    if (attr) widths.push(Number(attr[1]));
    for (const m of styleOf(t).matchAll(/(?:^|[;\s])(?:max-)?width\s*:\s*(\d+(?:\.\d+)?)(px|r?em)\b/gi)) {
      const n = Number(m[1]);
      widths.push(Math.round(m[2]!.toLowerCase() === "px" ? n : n * 16));
    }
    const usable = widths.filter((w) => w >= MIN_LAYOUT_WIDTH && w <= MAX_IMPORTED_WIDTH);
    out.push(usable.length ? Math.max(...usable) : null);
  }
  return out;
}

/**
 * The widest fixed width the HTML lays itself out at (see layoutWidths), or
 * null when nothing is fixed (a fluid email).
 */
export function detectHtmlLayoutWidth(html: string): number | null {
  const usable = layoutWidths(html).filter((w): w is number => w !== null);
  return usable.length ? Math.max(...usable) : null;
}

// "#abc" / "rgb(1, 2, 3)" / "rgb(1 2 3)" / opaque rgba → lower-case hex.
function toHex(value: string): string | null {
  const v = value.trim();
  if (HEX.test(v)) return v.toLowerCase();
  const rgb = v.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i);
  if (!rgb) return null;
  if (rgb[4] !== undefined && rgb[4] !== "1" && rgb[4] !== "100%") return null;
  const parts = [rgb[1], rgb[2], rgb[3]].map(Number);
  if (parts.some((n) => n > 255)) return null;
  return `#${parts.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The email's own backdrop color: on <body> (style or bgcolor), else on the
 * first full-width table. Only a hex or rgb() value is taken, normalized to
 * hex — it is written into style attributes, so nothing else is trusted.
 */
export function detectHtmlBackground(html: string): string | null {
  const body = stripNonLayout(html);
  const pick = (tag: string | undefined): string | null => {
    if (!tag) return null;
    const fromCss = styleOf(tag).match(/(?:^|[;\s])background(?:-color)?\s*:\s*(#[0-9a-f]{3,8}\b|rgba?\([^)]*\))/i)?.[1];
    const fromAttr = tag.match(/\sbgcolor\s*=\s*["']?(#[0-9a-f]{3,8})\b/i)?.[1];
    return (fromCss && toHex(fromCss)) || (fromAttr && toHex(fromAttr)) || null;
  };
  const fromBody = pick(body.match(/<body\b[^>]*>/i)?.[0]);
  if (fromBody) return fromBody;
  const fullWidthTable = [...body.matchAll(/<table\b[^>]*>/gi)]
    .map((m) => m[0])
    .find((t) => /\swidth\s*=\s*["']?100%|width\s*:\s*100%/i.test(t));
  return pick(fullWidthTable);
}

/**
 * Is this a whole email rather than a snippet? A document shell (doctype /
 * <html> / <body>) or a fixed-width layout table. A paragraph or a small table
 * in an otherwise designed email is not.
 */
export function isWholeEmailHtml(html: string): boolean {
  if (/<!doctype\b|<html[\s>]|<body[\s>]/i.test(html)) return true;
  return /<table\b/i.test(html) && detectHtmlLayoutWidth(html) !== null;
}

/**
 * Theme overrides that let a whole imported email render as authored, or null
 * when the HTML is a snippet (the designed shell stays as it is). The width
 * is the email's own, plus a gutter only when its card sits inside a wrapper
 * (a bare `<table width="600">` gets exactly 600, so it stays centered).
 */
export function importedHtmlThemeOverrides(html: string): Partial<Theme> | null {
  if (!isWholeEmailHtml(html)) return null;
  const widths = layoutWidths(html);
  const usable = widths.filter((w): w is number => w !== null);
  const width = usable.length ? Math.max(...usable) : null;
  const wrapped = widths[0] !== width;
  const background = detectHtmlBackground(html);
  return {
    bodyPadding: 0,
    bodyPaddingSides: undefined,
    bodyRadius: 0,
    ...(width ? { contentWidth: Math.min(MAX_IMPORTED_WIDTH, width + (wrapped ? GUTTER : 0)) } : {}),
    // Paper and backdrop both take the email's backdrop, so the shell is
    // invisible around it.
    ...(background ? { backgroundColor: background, bodyColor: background } : {}),
  };
}

/** The document's body is exactly one Html block holding a whole email. */
export function isImportedWholeEmail(doc: Pick<EmailDocument, "blocks">): boolean {
  return wholeEmailHtml(doc) !== null;
}

function wholeEmailHtml(doc: Pick<EmailDocument, "blocks">): string | null {
  const [only, ...rest] = doc.blocks;
  return rest.length === 0 && only?.type === "html" && isWholeEmailHtml(only.html) ? only.html : null;
}

const FIT_KEYS = ["contentWidth", "bodyPadding", "bodyRadius", "backgroundColor", "bodyColor"] as const;
const SHAPE_KEYS = ["contentWidth", "bodyPadding", "bodyRadius"] as const;

function carries(theme: Theme, fit: Partial<Theme>, keys: readonly (keyof Theme)[]): boolean {
  return !theme.bodyPaddingSides && keys.every((k) => !(k in fit) || theme[k] === fit[k]);
}

type Fittable = Pick<EmailDocument, "blocks" | "theme">;

/**
 * Fit the shell to a whole imported email as a document's body changes: a
 * paste or edit in the editor (Code, or the Html block in Design), a design
 * re-authored by the assistant, a fresh import (`previous` null).
 *
 * When the body BECOMES a whole email, the full fit applies (width, no
 * padding or radius, its backdrop). While it stays one, an edit follows only
 * while the shell is still the auto-fit: fully (colors too) when the theme is
 * exactly the previous fit, e.g. another email pasted over the first; the
 * width only when just the shape matches, since stored HTML is sanitized,
 * which drops <body> and with it the backdrop the import captured. Anything
 * the author set by hand (a Width change, a template imported before this
 * existed) wins. Returns `next` itself when nothing changes.
 */
export function fitImportedHtml<T extends Fittable>(next: T, previous?: Fittable | null): T {
  const html = wholeEmailHtml(next);
  if (html === null) return next;
  const fit = importedHtmlThemeOverrides(html);
  if (!fit) return next;
  const prevHtml = previous ? wholeEmailHtml(previous) : null;
  if (previous && prevHtml !== null) {
    if (prevHtml === html) return next;
    const prevFit = importedHtmlThemeOverrides(prevHtml);
    if (!prevFit) return next;
    // Untouched auto-fit, colors included (same session as the paste): a
    // different email pasted over it is a new import — fit it fully.
    if (carries(previous.theme, prevFit, FIT_KEYS)) {
      return carries(next.theme, fit, FIT_KEYS) ? next : { ...next, theme: { ...next.theme, ...fit } };
    }
    if (!carries(previous.theme, prevFit, SHAPE_KEYS)) return next;
    if (fit.contentWidth === undefined || fit.contentWidth === next.theme.contentWidth) return next;
    return { ...next, theme: { ...next.theme, contentWidth: fit.contentWidth } };
  }
  if (carries(next.theme, fit, FIT_KEYS)) return next;
  return { ...next, theme: { ...next.theme, ...fit } };
}

/**
 * The editor's "Fit" when content is wider than the email: `needed` is the
 * width the measured content takes at the current padding. A whole imported
 * email still sitting in the padded, rounded shell (imported before the
 * auto-fit, or squeezed by hand) gets the shell stepped aside like a fresh
 * import; otherwise, or once it is stepped aside, the width grows to fit.
 */
export function widenThemeToFit(doc: Fittable, needed: number): Theme {
  const theme = doc.theme;
  const clamp = (n: number) => Math.min(MAX_IMPORTED_WIDTH, Math.max(MIN_LAYOUT_WIDTH, Math.round(n)));
  const html = wholeEmailHtml(doc);
  const fit = html === null ? null : importedHtmlThemeOverrides(html);
  const steppedAside = theme.bodyRadius === 0 && theme.bodyPadding === 0 && !theme.bodyPaddingSides;
  if (!fit || steppedAside) return { ...theme, contentWidth: clamp(needed) };
  const sides = theme.bodyPaddingSides;
  const padX = sides ? (sides.left ?? 0) + (sides.right ?? 0) : theme.bodyPadding * 2;
  return { ...theme, ...fit, contentWidth: clamp(Math.max(fit.contentWidth ?? 0, needed - padX)) };
}
