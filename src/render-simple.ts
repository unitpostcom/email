// SIMPLE-EMAIL RENDERER — the mail-client fragment.
//
// A Simple email must land in the inbox looking like a message a person typed
// in Gmail / Outlook / Spark. Those clients do NOT send plain text: they send
// `text/html` whose body is a BARE FRAGMENT — `<div dir="ltr">` with one
// `<div>` per line, `<b>/<i>/<u>`, `<a>`, `<ul>/<ol>`, Gmail's blockquote,
// and inline `color` / `font-size` ONLY where the author set them. No doctype,
// no <head><style>, no wrapper <table>, no width, no background, no font
// stack. The receiving client renders that inside its own reading pane, so it
// inherits the client's font, colour and white background and reads as text.
//
// The designed renderer (render.ts) produces the opposite — a backdrop table,
// a 640px centred content table, a forced font stack, media queries, a
// managed footer and the Powered-by pill — which is why a "Simple" email used
// to arrive looking like a template (Mike, 2026-09-26, Spark ↔ Gmail compare).
//
// Rules, in order of how much they matter:
//  1. Emit EXACTLY the shapes Gmail emits (below). Not "semantically similar" —
//     the same tags and the same inline styles, so every client's stylesheet
//     treats it the way it treats a Gmail message.
//  2. Nothing structural. No tables, no widths, no backgrounds, no fonts.
//  3. The footer is TEXT. Marketing gets one muted line with the unsubscribe
//     link and the sender's name/address (Substack / Superhuman shape);
//     transactional gets nothing. The Powered-by mark, when shown, is one
//     short text link — never the pill.
//  4. The text/plain alternative comes from the same blocks (text.ts).

import type { Block, EmailDocument, InlineRun, ListBlock, TextBlock, HeadingBlock } from "./schema";
import { escapeHtml, interpolate, renderText } from "./util";
import { safeUrl } from "./sanitize";

export type SimpleRenderOptions = {
  variables?: Record<string, string>;
  /** Marketing footer text pieces; omitted / undefined ⇒ no footer line. */
  footer?: {
    unsubscribeUrl?: string;
    companyName?: string;
    companyAddress?: string;
  } | null;
  /** The minimal "Sent with Unitpost" line (resolveShowPoweredBy decides). */
  showPoweredBy?: boolean;
};

// Gmail's exact blockquote shape — clients recognise it as a quote.
const GMAIL_QUOTE_STYLE = "margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex";
// Gmail's indent step (Ctrl+]).
const INDENT_STEP_PX = 40;
// Muted footer text: readable on light and dark reading panes.
const FOOTER_COLOR = "#888888";

/** Inline runs → Gmail-shaped inline HTML: <b>/<i>/<u>/<strike>, <a>, span color/size. */
export function renderSimpleRuns(runs: InlineRun[], variables: Record<string, string>): string {
  return runs
    .map((run) => {
      let html = renderText(run.text, variables).replace(/\n/g, "<br>");
      const m = run.marks ?? {};
      if (m.bold) html = `<b>${html}</b>`;
      if (m.italic) html = `<i>${html}</i>`;
      if (m.underline) html = `<u>${html}</u>`;
      if (m.strike) html = `<strike>${html}</strike>`;
      // Only what the author explicitly set — the client supplies the rest.
      // Gmail emits font-family / color / size on a <span> exactly like this.
      const style = [
        m.fontFamily ? `font-family:${m.fontFamily}` : null,
        m.color ? `color:${m.color}` : null,
        m.background ? `background-color:${m.background}` : null,
        m.fontSize ? `font-size:${m.fontSize}px` : null,
      ]
        .filter(Boolean)
        .join(";");
      if (m.link) {
        const href = escapeHtml(safeUrl(interpolate(m.link, variables)));
        html = `<a href="${href}" target="_blank"${style ? ` style="${style}"` : ""}>${html}</a>`;
      } else if (style) {
        html = `<span style="${style}">${html}</span>`;
      }
      return html;
    })
    .join("");
}

function lineStyle(block: TextBlock | HeadingBlock): string {
  const parts: string[] = [];
  const indent = block.padding?.left;
  if (indent && indent > 0) parts.push(`margin-left:${Math.round(indent / INDENT_STEP_PX) * INDENT_STEP_PX || indent}px`);
  if (block.align && block.align !== "left") parts.push(`text-align:${block.align}`);
  // Explicit author styling only — a default text colour / size is the
  // client's business, exactly like Gmail leaves them off.
  if (block.color) parts.push(`color:${block.color}`);
  return parts.join(";");
}

function renderLine(block: TextBlock, variables: Record<string, string>): string {
  const inner =
    block.content && block.content.length
      ? renderSimpleRuns(block.content, variables)
      : renderText(block.text, variables).replace(/\n/g, "<br>");
  const style = lineStyle(block);
  // A blank line is `<div><br></div>` — Gmail's Enter-twice.
  if (inner.trim() === "") return `<div${style ? ` style="${style}"` : ""}><br></div>`;
  return `<div${style ? ` style="${style}"` : ""}>${inner}</div>`;
}

function renderHeadingLine(block: HeadingBlock, variables: Record<string, string>): string {
  // A "heading" in a Simple email is just a bold line, a little larger — the
  // way you'd make a heading in Gmail (Ctrl+B + font size), not an <h1>.
  const inner =
    block.content && block.content.length
      ? renderSimpleRuns(block.content, variables)
      : renderText(block.text, variables);
  const size = block.level === 1 ? "large" : block.level === 2 ? "medium" : undefined;
  const style = lineStyle(block);
  const body = size ? `<span style="font-size:${size}"><b>${inner}</b></span>` : `<b>${inner}</b>`;
  return `<div${style ? ` style="${style}"` : ""}>${body}</div>`;
}

function renderSimpleList(block: ListBlock, variables: Record<string, string>): string {
  const tag = block.ordered ? "ol" : "ul";
  const items = block.items
    .map((item) => {
      const inner =
        item.content && item.content.length
          ? renderSimpleRuns(item.content, variables)
          : renderText(item.text, variables).replace(/\n/g, "<br>");
      return `<li>${inner.trim() === "" ? "<br>" : inner}</li>`;
    })
    .join("");
  return `<${tag}>${items}</${tag}>`;
}

function renderSimpleBlock(block: Block, variables: Record<string, string>): string {
  switch (block.type) {
    case "text":
      return renderLine(block, variables);
    case "heading":
      return renderHeadingLine(block, variables);
    case "list":
      return renderSimpleList(block, variables);
    case "divider":
      // Gmail has no rule in the plain composer; a thin rule is the closest
      // honest equivalent and still reads as text.
      return `<div><hr style="border:none;border-top:1px solid #cccccc;margin:8px 0"></div>`;
    default: {
      // Anything structural should have been flattened by simplifyEmailDocument.
      // Never emit layout: fall back to the block's text, or nothing.
      const text = "text" in block && typeof (block as { text?: unknown }).text === "string" ? (block as { text: string }).text : "";
      return text.trim() ? `<div>${renderText(text, variables)}</div>` : "";
    }
  }
}

/** Gmail's blockquote wrapper, for quoting a block of lines. Exported for the composer preview. */
export function simpleQuote(innerHtml: string): string {
  return `<blockquote class="gmail_quote" style="${GMAIL_QUOTE_STYLE}">${innerHtml}</blockquote>`;
}

function footerLine(opts: SimpleRenderOptions, variables: Record<string, string>): string {
  const f = opts.footer;
  const pieces: string[] = [];
  if (f) {
    const who = [f.companyName, f.companyAddress].map((s) => (s ? renderText(s, variables) : "")).filter(Boolean).join(", ");
    if (who) pieces.push(`Sent by ${who}`);
    if (f.unsubscribeUrl) {
      const href = escapeHtml(safeUrl(interpolate(f.unsubscribeUrl, variables)));
      pieces.push(`<a href="${href}" target="_blank" style="color:${FOOTER_COLOR}">Unsubscribe</a>`);
    }
  }
  if (opts.showPoweredBy) {
    // "Sent with" stays muted text. Only the word is the link, so a mail
    // client that recolours anchors does not paint the whole phrase.
    pieces.push(
      `Sent with <a href="https://www.unitpost.com?utm_source=email_footer&utm_medium=powered_by_simple" target="_blank" style="color:#ffffff;text-decoration:underline"><span style="color:#ffffff;text-decoration:underline">Unitpost</span></a>`,
    );
  }
  if (pieces.length === 0) return "";
  // One muted line, separated from the body by a blank line — how a human
  // signature block sits. No table, no border, no background.
  return `<div><br></div><div style="color:${FOOTER_COLOR};font-size:12px">${pieces.join(" · ")}</div>`;
}

/**
 * Render a Simple document to the mail-client fragment. Returns HTML with NO
 * document shell — callers hand it to the provider as the text/html part
 * exactly like Gmail does.
 */
export function renderSimpleHtml(doc: EmailDocument, options: SimpleRenderOptions = {}): string {
  const variables = options.variables ?? {};
  const body = doc.blocks.map((b) => renderSimpleBlock(b, variables)).filter(Boolean).join("");
  return `<div dir="ltr">${body}${footerLine(options, variables)}</div>`;
}

/** The exact tags a Simple email may contain — the composer + tests hold to this. */
export const SIMPLE_ALLOWED_TAGS = ["div", "br", "b", "i", "u", "strike", "a", "span", "ul", "ol", "li", "blockquote", "hr"] as const;

/**
 * PREVIEW ONLY. A Simple fragment has no shell by design — in the inbox the
 * client's reading pane supplies font, size, colour and background. A bare
 * <iframe> would instead show browser defaults (Times New Roman, 16px), which
 * is not what the recipient sees. Wrap the fragment in Gmail's reading-pane
 * defaults for our previews / thumbnails. Never used for sending.
 */
export function wrapSimplePreview(fragment: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>` +
    `<body style="margin:0;padding:16px 20px;background:#ffffff;color:#222222;font-family:Arial,Helvetica,sans-serif;font-size:small;line-height:1.5;word-wrap:break-word;">` +
    `${fragment}</body></html>`
  );
}

/** Render for a preview surface: designed docs unchanged, simple docs wrapped in the reading-pane shell. */
export function isSimpleFragment(html: string): boolean {
  return html.startsWith('<div dir="ltr">');
}
