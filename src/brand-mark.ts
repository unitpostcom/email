// THE "SENT WITH UNITPOST" MARK — one source for every surface that shows it:
// the designed renderer (render.ts), the engine's raw API/SMTP path, the text
// renderer, hand-written system mail, and the dashboard previews
// (`@unitpost/email/brand-mark`, monorepo-only). Deliberately dependency-free
// (a type-only import) so a client component can import it without pulling
// in the renderer.

import type { Theme } from "./schema";

// The "Sent with Unitpost" mark pinned at the very bottom of the email, on the
// OUTER backdrop BELOW the body card (a sibling row, not inside the paper):
// muted text + the logo + the wordmark. Links to the marketing site.
// Suppressed only for paid workspaces that turned branding off.
//
// "Sent with", not "Powered by" (2026-10-09): the mark sits inside the
// customer's own email, where "Powered by" read as if Unitpost powered the
// customer's product. "Sent with" says only what we did — delivered it.
/**
 * "Sent with Unitpost" — the mark a workspace shows until it may remove it.
 *
 * HARDENED (2026-09-26): customer templates may carry sanitized <style> blocks,
 * so the mark must not be hideable from author CSS. Therefore:
 *   • no class / id on any element (nothing to select by);
 *   • every visual property is INLINE with !important — inline !important wins
 *     over stylesheet !important, so display/visibility/opacity/height/
 *     colour/size cannot be overridden by a rule;
 *   • transparent: no chip, no border, no background — it sits on whatever the
 *     template's backdrop is (light or dark) in a mid grey that reads on both,
 *     so it "fits into any template" instead of overriding the row's colour.
 * Responsiveness comes from width:100% + max-width (no media-query class).
 */
function escapeStyleAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function poweredByHtml(theme: Pick<Theme, "fontFamily">): string {
  const imp = (css: string) => css.split(";").filter(Boolean).map((d) => `${d.trim()} !important`).join(";");
  // `fontFamily` is a free-text theme value (ThemeSchema: any string) and this
  // markup is also rendered into the dashboard's own document (the editor's
  // brand-mark preview uses innerHTML, not the sandboxed preview iframe), so
  // the value must not be able to close the style attribute. Quotes inside a
  // family name stay valid CSS once the browser decodes the entity; `;` stays
  // inside the attribute and can at most add a CSS declaration, never markup.
  // Substituted AFTER imp(): the escaped value carries `;` (entities) and a
  // theme value may too, and neither must split the declaration list.
  const td = imp("padding:14px 24px 10px;text-align:center;font-family:__FONT__;display:table-cell;visibility:visible;opacity:1;height:auto;overflow:visible").replace(
    "__FONT__",
    () => escapeStyleAttr(theme.fontFamily),
  );
  const a = imp("display:inline-block;visibility:visible;opacity:1;text-decoration:none;color:#8a8a8a;font-size:11px;line-height:1;background:transparent;border:0;padding:0");
  const muted = imp("color:#8a8a8a;font-size:11px;vertical-align:middle;display:inline");
  const mark = imp("color:#8a8a8a;font-size:11px;font-weight:700;letter-spacing:0.02em;vertical-align:middle;display:inline");
  const img = imp("width:12px;height:12px;border-radius:2px;vertical-align:middle;margin-right:4px;display:inline;opacity:0.9");
  return [
    `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="${imp("width:100%;display:table;visibility:visible;opacity:1;height:auto;background:transparent")}"><tr><td style="${td}">`,
    `<a href="https://www.unitpost.com?utm_source=email_footer&utm_medium=powered_by" target="_blank" style="${a}">`,
    `<span style="${muted}">Sent with </span>`,
    // Raster mark (SVG is stripped by Gmail/Outlook), hosted at an absolute URL.
    `<img src="https://www.unitpost.com/web-app-manifest-192x192.png" width="12" height="12" alt="" style="${img}" />`,
    `<span style="${mark}">Unitpost</span>`,
    `</a>`,
    `</td></tr></table>`,
  ].join("");
}

/**
 * Append the mark to CUSTOMER-SUPPLIED HTML (raw `html` sends through the API
 * / SMTP, which never pass through the designed shell). Inserted just before
 * </body> when there is one, else appended — inside a width-fluid, transparent
 * row so it fits the sender's own layout. Same hardened markup as above.
 */
/**
 * Both HTML marks (the designed pill and Simple's "Sent with Unitpost" line)
 * link to a URL carrying this parameter — the one stable thing about them (the
 * pill deliberately has no class/id hooks). Any HTML that already contains it
 * has been branded by our renderer; appending again would show the mark twice
 * (test-send → engine raw path, 2026-09-27 report). The value keeps its old
 * name on purpose: it is invisible, and changing it would break idempotency
 * for HTML rendered before a deploy and still in flight.
 */
export const POWERED_BY_SENTINEL = "utm_medium=powered_by";

export function hasPoweredByMark(html: string): boolean {
  return html.includes(POWERED_BY_SENTINEL);
}

/**
 * Plain-text counterpart of the mark: every text/plain part (designed, Simple,
 * raw text sends, text derived from raw HTML) ends with this one line — the
 * words only. Plain text cannot embed a link (no markup separates link text
 * from destination), and a printed URL or "Unitpost (unitpost.com)" is the
 * shape we never ship (2026-10-09; it printed the full tracked URL before).
 * HTML marks — the pill and Simple's footer — keep "Unitpost" as an embedded
 * link.
 */
export const POWERED_BY_TEXT = "Sent with Unitpost";

/**
 * Whether a text part already ENDS with our mark, so re-appending is a no-op.
 * Only the last non-empty line counts: the mark is always appended as the final
 * line, and a body that merely mentions "Sent with Unitpost" mid-text must
 * still get it (2026-10-09: a dev test email whose body quoted the phrase went
 * out with no mark). Simple's text line ends with it after "· Unsubscribe: …",
 * hence endsWith. Text branded before 2026-10-09 ends with the tracked URL.
 */
export function hasPoweredByText(text: string): boolean {
  const last = text.trimEnd().split("\n").pop()?.trim() ?? "";
  return last.endsWith(POWERED_BY_TEXT) || last.includes(POWERED_BY_SENTINEL);
}

export function appendPoweredByText(text: string): string {
  if (hasPoweredByText(text)) return text;
  return `${text.replace(/\s+$/, "")}\n\n${POWERED_BY_TEXT}\n`;
}

export function appendPoweredBy(html: string, theme: Theme = DEFAULT_MARK_THEME): string {
  // Idempotent: HTML our renderer already branded (pill or Simple line) is
  // returned untouched — the same input can flow through more than one layer.
  if (hasPoweredByMark(html)) return html;
  const row = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width:100% !important;max-width:${theme.contentWidth}px !important;margin:0 auto !important;display:table !important;visibility:visible !important;opacity:1 !important;background:transparent !important"><tr><td style="padding:0 !important">${poweredByHtml(theme)}</td></tr></table>`;
  const i = html.search(/<\/body\s*>/i);
  return i >= 0 ? `${html.slice(0, i)}${row}${html.slice(i)}` : `${html}${row}`;
}

const DEFAULT_MARK_THEME: Theme = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  contentWidth: 600,
} as Theme;
