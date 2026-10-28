// TEXT → SIMPLE DOCUMENT — how agents (Unit, the API, MCP, the Skill) author a
// Simple email. They hand us what a person would type into Gmail: lines of
// text, blank lines between paragraphs, "- " / "1. " list markers, and — for
// styling — the same small set of inline HTML Gmail's composer produces. NO
// Markdown: `**bold**` stays literal, exactly as it would in Gmail / Outlook /
// Spark (decided 2026-09-26). The result renders through render-simple.ts as
// the mail-client fragment.
//
//   Hey {{first_name}},
//
//   Quick one — the <b>September update</b> is out:
//   - Usage alerts at 50/75/90/100%
//   - Automations meter <i>runs</i>
//
//   Read more: <a href="https://unitpost.com/changelog">changelog</a>
//
// The grammar covers everything the Simple composer's toolbar can do
// (SIMPLE_TEXT_GUIDE spells it out for every AI surface); anything else —
// headings, <p>/<table>, TSX components, unknown CSS — is removed and reported
// as a warning instead of shipping as literal markup. Variables ({{first_name}})
// are kept as text — the renderer interpolates them.

import {
  EmailDocumentSchema,
  ImageBlockSchema,
  ListBlockSchema,
  TextBlockSchema,
  type Block,
  type EmailDocument,
  type InlineMark,
  type InlineRun,
} from "./schema";
import { newBlockId } from "./blocks";
import { renderSimpleHtml } from "./render-simple";
import {
  SIMPLE_EMAIL_MAX_CHARS,
  SIMPLE_EMAIL_THEME,
  SIMPLE_TEXT_SIZES,
  isSimpleColor,
  simpleFontStack,
  snapSimpleTextSize,
} from "./simple";

export type SimpleTextOptions = {
  previewText?: string;
  category?: "transactional" | "marketing";
};

/**
 * The Simple-email `text` format, stated once for every AI-facing surface
 * (Ask Unit's tools, the MCP tools, the Skill, API error messages). A parity
 * test holds the Skill and the tool descriptions to it.
 */
export const SIMPLE_TEXT_GUIDE = [
  "SIMPLE EMAIL `text` FORMAT — write what a person types into Gmail; it sends as a bare mail-client fragment that reads like a personal email (no layout, no brand band, the reader's own font and background).",
  "SUPPORTED (everything the Simple editor can do):",
  "- Lines: one line per line; a blank line between paragraphs (blank lines are the ONLY spacing).",
  '- Lists: "- " (or "* ") bullets and "1. " numbers, one item per line.',
  '- Inline: <b>bold</b>, <i>italic</i>, <u>underline</u>, <s>strike</s>, <a href="https://…">link</a>, <br> for a line break inside a line.',
  `- Colour / highlight / size / font: <span style="color:#cc0000; background-color:#fff3a0; font-size:${SIMPLE_TEXT_SIZES.large}px; font-family:Georgia">…</span>. Sizes snap to Gmail's Small ${SIMPLE_TEXT_SIZES.small}px / Normal / Large ${SIMPLE_TEXT_SIZES.large}px / Huge ${SIMPLE_TEXT_SIZES.huge}px; fonts: Arial, Helvetica, Verdana, Tahoma, Trebuchet MS, Georgia, Times New Roman, Courier New. A title is just <b><span style="font-size:${SIMPLE_TEXT_SIZES.huge}px">…</span></b> on its own line.`,
  '- Alignment: wrap ONE whole line in <div style="text-align:center">…</div> (or right).',
  '- Images: <img src="/img/{id}" alt="…" width="400"> alone on its own line (optionally inside <a href>); src is a library /img/{id} or an https:// URL — never invent one.',
  "- {{variables}} anywhere, e.g. Hi {{first_name}},",
  "NOT SUPPORTED (removed, and reported back as a warning — switch the template to Design for these): headings (<h1>…), sections / columns / spacers / buttons / dividers, TSX components (<Section>, <Text>, <Button>…), <p>/<div>/<table>/<ul>, any other CSS, Markdown (**bold**, [link](url), # Heading stay literal), and a hand-written footer (marketing emails get one plain line — sender · Unsubscribe · Sent with Unitpost — at send time).",
  `Max ${SIMPLE_EMAIL_MAX_CHARS.toLocaleString("en-US")} characters.`,
].join("\n");

export type SimpleTextResult = {
  doc: EmailDocument;
  /** What was removed or couldn't be used, in plain words (deduplicated). */
  warnings: string[];
};

// ----- markup recognition -----------------------------------------------------

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*?)?)\s*(\/?)>/g;
const ATTR_RE = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

// Real HTML elements (and the @unitpost/email TSX components). A tag-shaped
// token that is neither — "<your name>" — is ordinary text and stays.
const HTML_ELEMENTS = new Set(
  (
    "a abbr address article aside b bdi bdo big blockquote body br button caption center cite code col colgroup " +
    "dd del details dfn div dl dt em fieldset figcaption figure font footer form h1 h2 h3 h4 h5 h6 head header hr " +
    "html i iframe img input ins kbd label legend li link main mark meta nav ol p pre q s samp script section " +
    "small span strike strong style sub summary sup table tbody td tfoot th thead title tr tt u ul var video"
  ).split(" "),
);
const TSX_COMPONENTS = new Set(
  "Section Row Column Text Heading Button Link Image Divider Spacer List Markdown Code Html Email Body Container Preview".split(" "),
);

// Attribute values are HTML: decode entities once here (`?a=1&amp;b=2` is the
// URL `?a=1&b=2`), so the renderer's own escaping doesn't double-encode a src,
// href or alt into a different URL / text (verifier on #879).
function attrsOf(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const m of raw.matchAll(ATTR_RE)) out[m[1]!.toLowerCase()] = unescape((m[2] ?? m[3] ?? m[4] ?? "").trim());
  return out;
}

const NAMED_SIZES: Record<string, number> = {
  small: SIMPLE_TEXT_SIZES.small,
  "x-small": SIMPLE_TEXT_SIZES.small,
  medium: 16,
  large: SIMPLE_TEXT_SIZES.large,
  "x-large": SIMPLE_TEXT_SIZES.huge,
  "xx-large": SIMPLE_TEXT_SIZES.huge,
};

type Warn = (message: string) => void;

function marksFromStyle(style: string, warn: Warn): InlineMark {
  const marks: InlineMark = {};
  for (const decl of style.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const value = decl.slice(i + 1).trim().replace(/\s*!important$/i, "");
    if (!prop || !value) continue;
    if (prop === "color" || prop === "background-color" || prop === "background") {
      if (!isSimpleColor(value)) {
        warn(`Ignored the colour "${value}" — use a hex like #cc0000.`);
        continue;
      }
      if (prop === "color") marks.color = value;
      else marks.background = value;
    } else if (prop === "font-size") {
      const px = /^(\d+(?:\.\d+)?)px$/i.exec(value);
      const n = px ? Number(px[1]) : NAMED_SIZES[value.toLowerCase()];
      if (n == null) {
        warn(`Ignored font-size "${value}" — use ${SIMPLE_TEXT_SIZES.small}px, ${SIMPLE_TEXT_SIZES.large}px or ${SIMPLE_TEXT_SIZES.huge}px.`);
        continue;
      }
      const size = snapSimpleTextSize(n);
      if (size != null) marks.fontSize = size;
    } else if (prop === "font-family") {
      const font = simpleFontStack(value);
      if (font) marks.fontFamily = font;
      else warn(`Removed the font "${value}" — it isn't in the font menu.`);
    } else if (prop === "font-weight") {
      if (/^(bold|bolder|[6-9]00)$/i.test(value)) marks.bold = true;
    } else if (prop === "font-style") {
      if (/^italic$/i.test(value)) marks.italic = true;
    } else if (prop === "text-decoration" || prop === "text-decoration-line") {
      if (/underline/i.test(value)) marks.underline = true;
      if (/line-through/i.test(value)) marks.strike = true;
    } else {
      warn(`Ignored CSS "${prop}" — a Simple email only takes colour, highlight, size and font.`);
    }
  }
  return marks;
}

function unescape(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

function unsupportedTag(tag: string, warn: Warn) {
  if (TSX_COMPONENTS.has(tag)) {
    warn(`Removed <${tag}>: TSX components are for Designed emails — a Simple email is plain lines.`);
  } else if (/^h[1-6]$/i.test(tag)) {
    warn(`Removed <${tag}>: a Simple email has no headings — use <b> with a Large/Huge <span style="font-size:…">.`);
  } else if (tag.toLowerCase() === "img") {
    warn("Removed an <img> inside a line — put each image alone on its own line.");
  } else {
    warn(`Removed <${tag.toLowerCase()}> tags (kept their text) — not part of a Simple email.`);
  }
}

// The inline tags the format understands; everything else is either removed
// (when it is clearly markup) or left as the text it is.
const SUPPORTED_INLINE = new Set(["b", "strong", "i", "em", "u", "ins", "s", "strike", "del", "br", "a", "span"]);
// Elements that never take a closing tag — always markup when they appear.
const VOID_ELEMENTS = new Set(["img", "hr", "input", "meta", "link", "col"]);

/**
 * Start offsets of the tags in `text` that are paired AS MARKUP: an opening tag
 * with a matching closing tag after it (stack order, so `<p>…</p>` pairs and a
 * `<Section>` pairs with its `</Section>` lines later), and that closing tag.
 */
function pairedTagOffsets(text: string): Set<number> {
  const open = new Map<string, number[]>();
  const paired = new Set<number>();
  for (const m of text.matchAll(TAG_RE)) {
    const name = m[2]!.toLowerCase();
    if (m[1] !== "/") {
      if (m[4] !== "/") open.set(name, [...(open.get(name) ?? []), m.index!]);
      continue;
    }
    const starts = open.get(name);
    const start = starts?.pop();
    if (start !== undefined) {
      paired.add(start);
      paired.add(m.index!);
    }
  }
  return paired;
}

// Is this tag occurrence markup (to interpret or remove) rather than text?
function isMarkupTag(m: RegExpMatchArray, paired: Set<number>): boolean {
  const name = m[2]!;
  const tag = name.toLowerCase();
  if (!HTML_ELEMENTS.has(tag) && !TSX_COMPONENTS.has(name)) return false;
  return SUPPORTED_INLINE.has(tag) || m[4] === "/" || VOID_ELEMENTS.has(tag) || paired.has(m.index!);
}

// Escape every tag-shaped token that is NOT markup, so the line parser reads
// it as the text it is: a lone mention — "The paragraph tag is <p>." — stays as
// written, while `<p>…</p>`, a self-closing `<Spacer />` or an `<img>` are
// still markup (verifier on #879).
function escapeLiteralTags(text: string): string {
  const paired = pairedTagOffsets(text);
  let out = "";
  let last = 0;
  for (const m of text.matchAll(TAG_RE)) {
    const name = m[2]!;
    if (!HTML_ELEMENTS.has(name.toLowerCase()) && !TSX_COMPONENTS.has(name)) continue;
    if (isMarkupTag(m, paired)) continue;
    out += text.slice(last, m.index) + "&lt;";
    last = m.index! + 1;
  }
  return out + text.slice(last);
}

/**
 * Parse one line's inline markup into runs. Supported: <b>/<strong>, <i>/<em>,
 * <u>, <s>/<strike>/<del>, <a href>, <span style> (colour, highlight, size,
 * font), <br>. Other HTML tags / TSX components are removed (their text stays)
 * and reported via `warn` when they are clearly markup — paired in `paired`
 * (default: within this line), self-closing, or a void element; otherwise, like
 * anything that only looks like a tag ("<your name>"), they stay as text.
 */
export function parseSimpleInline(
  line: string,
  warn: Warn = () => {},
  // parseSimpleText has already escaped the non-markup tags of the WHOLE text
  // (pairs can span lines); a standalone call decides within the line.
  opts: { literalsEscaped?: boolean } = {},
): InlineRun[] {
  const paired = opts.literalsEscaped ? null : pairedTagOffsets(line);
  const runs: InlineRun[] = [];
  const state = { bold: 0, italic: 0, underline: 0, strike: 0, link: undefined as string | undefined };
  const spans: InlineMark[] = [];
  let last = 0;
  const push = (raw: string) => {
    if (!raw) return;
    const text = unescape(raw);
    const marks: InlineMark = {};
    if (state.bold) marks.bold = true;
    if (state.italic) marks.italic = true;
    if (state.underline) marks.underline = true;
    if (state.strike) marks.strike = true;
    if (state.link) marks.link = state.link;
    for (const span of spans) Object.assign(marks, span);
    const prev = runs[runs.length - 1];
    if (prev && JSON.stringify(prev.marks ?? {}) === JSON.stringify(marks)) {
      prev.text += text;
      return;
    }
    runs.push(Object.keys(marks).length ? { text, marks } : { text });
  };
  const toggle = (key: "bold" | "italic" | "underline" | "strike", closing: boolean) => {
    state[key] = Math.max(0, state[key] + (closing ? -1 : 1));
  };
  for (const m of line.matchAll(TAG_RE)) {
    const name = m[2]!;
    const tag = name.toLowerCase();
    if (!HTML_ELEMENTS.has(tag) && !TSX_COMPONENTS.has(name)) continue; // plain text
    if (paired && !isMarkupTag(m, paired)) continue; // a lone mention of a tag stays as written
    push(line.slice(last, m.index));
    last = m.index! + m[0].length;
    const closing = m[1] === "/";
    if (tag === "b" || tag === "strong") toggle("bold", closing);
    else if (tag === "i" || tag === "em") toggle("italic", closing);
    else if (tag === "u" || tag === "ins") toggle("underline", closing);
    else if (tag === "s" || tag === "strike" || tag === "del") toggle("strike", closing);
    else if (tag === "br") push("\n");
    else if (tag === "a") {
      state.link = closing ? undefined : attrsOf(m[3]).href?.trim() || undefined;
    } else if (tag === "span") {
      if (closing) spans.pop();
      else if (m[4] !== "/") spans.push(marksFromStyle(attrsOf(m[3]).style ?? "", warn));
    } else if (!closing || TSX_COMPONENTS.has(name)) {
      unsupportedTag(name, warn);
    }
  }
  push(line.slice(last));
  return runs;
}

const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const NUMBER_RE = /^\s*\d+[.)]\s+(.*)$/;
const ALIGN_LINE_RE =
  /^\s*<div\s+(?:style\s*=\s*["']\s*text-align\s*:\s*(left|center|right)\s*;?\s*["']|align\s*=\s*["']?(left|center|right)["']?)\s*>([\s\S]*)<\/div>\s*$/i;
const IMAGE_LINE_RE = /^\s*(?:<a(\s[^<>]*)>\s*)?<img(\s[^<>]*?)\s*\/?>\s*(?:<\/a>)?\s*$/i;
// A src the Simple renderer can send: a hosted library image, an https URL, or
// a {{variable}} that becomes one.
const SENDABLE_SRC_RE = /^(?:https:\/\/[^\s/?#@\\]+|\/img\/[0-9a-fA-F-]{8,}|\{\{\s*[\w.]+\s*\}\})/;

function markdownWarnings(line: string, warn: Warn) {
  if (/\*\*[^*\n]+\*\*|__[^_\n]+__/.test(line)) warn("Markdown **bold** isn't rendered — use <b>…</b>.");
  if (/\[[^\]\n]+\]\((?:https?:|mailto:|\/|\{\{)/.test(line)) warn('Markdown [links](url) aren\'t rendered — use <a href="…">…</a>.');
  if (/^\s{0,3}#{1,6}\s+\S/.test(line)) warn('Markdown "# headings" aren\'t rendered — a Simple email has no headings; use a bold Large/Huge line.');
}

function imageBlock(attrsRaw: string, linkRaw: string | undefined, align: "left" | "center" | "right", warn: Warn): Block {
  const attrs = attrsOf(attrsRaw);
  const src = (attrs.src ?? "").trim();
  if (!SENDABLE_SRC_RE.test(src)) {
    warn(`The image "${src || "(no src)"}" can't be sent — use a library /img/{id} or an https:// URL (its alt text is sent instead).`);
  }
  const width = attrs.width ? Math.round(Number.parseFloat(attrs.width)) : NaN;
  const href = linkRaw ? attrsOf(linkRaw).href?.trim() : undefined;
  return ImageBlockSchema.parse({
    type: "image",
    id: newBlockId(),
    src,
    alt: attrs.alt ?? "",
    ...(href ? { href } : {}),
    ...(Number.isFinite(width) && width > 0 ? { width } : {}),
    align,
    marginBottom: 0,
  });
}

/**
 * Convert typed text into a Simple document, with warnings for anything that
 * isn't part of a Simple email. Consecutive "- " lines become one bulleted list,
 * "1. " lines one numbered list; an <img> alone on a line is an image; every
 * other line is a line; a blank line is a blank line (Gmail's Enter-twice).
 * Never parses Markdown.
 */
export function parseSimpleText(text: string, options: SimpleTextOptions = {}): SimpleTextResult {
  if (text.length > SIMPLE_EMAIL_MAX_CHARS) {
    throw new Error(`Simple email text is too long (${text.length} > ${SIMPLE_EMAIL_MAX_CHARS} characters).`);
  }
  const warnings = new Set<string>();
  const warn: Warn = (message) => warnings.add(message);
  // Pairs are found over the WHOLE text (a TSX <Section> opens on one line and
  // closes on another); tags that aren't markup are escaped to stay as text.
  const lines = escapeLiteralTags(text.replace(/\r\n?/g, "\n")).split("\n");
  const blocks: Block[] = [];
  let list: { ordered: boolean; items: InlineRun[][] } | null = null;
  const flushList = () => {
    if (!list) return;
    blocks.push(
      ListBlockSchema.parse({
        type: "list",
        id: newBlockId(),
        ordered: list.ordered,
        items: list.items.map((content) => ({ text: content.map((r) => r.text).join(""), content })),
        // Lines stack in a Simple email (the composer's lists carry no margin).
        marginBottom: 0,
      }),
    );
    list = null;
  };
  for (const raw of lines) {
    markdownWarnings(raw, warn);
    const bullet = BULLET_RE.exec(raw);
    const number = bullet ? null : NUMBER_RE.exec(raw);
    if (bullet || number) {
      const ordered = Boolean(number);
      const content = parseSimpleInline((bullet ?? number)![1]!, warn, { literalsEscaped: true });
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push(content);
      continue;
    }
    flushList();
    const aligned = ALIGN_LINE_RE.exec(raw);
    const align = ((aligned?.[1] ?? aligned?.[2])?.toLowerCase() ?? "left") as "left" | "center" | "right";
    const body = aligned ? aligned[3]! : raw;
    const image = IMAGE_LINE_RE.exec(body);
    if (image) {
      blocks.push(imageBlock(image[2] ?? "", image[1], align, warn));
      continue;
    }
    const content = parseSimpleInline(body.trimEnd(), warn, { literalsEscaped: true });
    blocks.push(
      TextBlockSchema.parse({
        type: "text",
        id: newBlockId(),
        text: content.map((r) => r.text).join(""),
        ...(content.length ? { content } : {}),
        align,
        marginBottom: 0,
      }),
    );
  }
  flushList();
  // Trim leading/trailing blank lines — a compose box ends where the text ends.
  while (blocks.length && isBlankLine(blocks[0]!)) blocks.shift();
  while (blocks.length && isBlankLine(blocks[blocks.length - 1]!)) blocks.pop();

  const doc = EmailDocumentSchema.parse({
    compositionMode: "simple",
    theme: SIMPLE_EMAIL_THEME,
    category: options.category ?? "transactional",
    previewText: options.previewText ?? "",
    blocks,
  });
  return { doc, warnings: [...warnings] };
}

/** parseSimpleText without the warnings. */
export function textToSimpleDocument(text: string, options: SimpleTextOptions = {}): EmailDocument {
  return parseSimpleText(text, options).doc;
}

function isBlankLine(b: Block): boolean {
  return b.type === "text" && b.text.trim() === "" && !(b.content && b.content.some((r) => r.text.trim()));
}

// ----- SIMPLE DOCUMENT → TEXT --------------------------------------------------
// The inverse of parseSimpleText, so a Simple template reads back in the format
// it is written in (the API's `text`; parity audit IC-11). Prints what the
// format carries: lines with their inline styles and alignment, lists, images.
// simpleDocumentText answers only when the printed text parses back to the
// same email, so sending a read back never changes a template unasked.

// Only text the parser would read as markup or as an entity is escaped: a tag
// it knows, an entity it decodes. Everything else stays as written.
function escapeSimpleText(s: string): string {
  return s
    .replace(/&(?=(?:lt|gt|quot|#39|nbsp|amp);)/g, "&amp;")
    .replace(/<(?=\/?([a-zA-Z][a-zA-Z0-9]*))/g, (lt, _m, offset: number, whole: string) => {
      const name = /^<\/?([a-zA-Z][a-zA-Z0-9]*)/.exec(whole.slice(offset))?.[1] ?? "";
      return HTML_ELEMENTS.has(name.toLowerCase()) || TSX_COMPONENTS.has(name) ? "&lt;" : lt;
    });
}

function escapeSimpleAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function printSimpleRun(run: InlineRun): string {
  if (!run.text) return "";
  let s = escapeSimpleText(run.text).replace(/\n/g, "<br>");
  const m = run.marks ?? {};
  const style = [
    m.color ? `color:${m.color}` : "",
    m.background ? `background-color:${m.background}` : "",
    m.fontSize ? `font-size:${m.fontSize}px` : "",
    m.fontFamily ? `font-family:${m.fontFamily}` : "",
  ].filter(Boolean);
  if (style.length) s = `<span style="${escapeSimpleAttr(style.join("; "))}">${s}</span>`;
  if (m.strike) s = `<s>${s}</s>`;
  if (m.underline) s = `<u>${s}</u>`;
  if (m.italic) s = `<i>${s}</i>`;
  if (m.bold) s = `<b>${s}</b>`;
  if (m.link) s = `<a href="${escapeSimpleAttr(m.link)}">${s}</a>`;
  return s;
}

function printSimpleRuns(text: string, content: InlineRun[] | undefined): string {
  const runs = content?.length ? content : [{ text }];
  const line = runs.map(printSimpleRun).join("");
  // The parser trims a line's end; a space there survives inside a bare span.
  return line.replace(/[ \t]+$/, (ws) => `<span>${ws}</span>`);
}

function alignLine(line: string, align: string | undefined): string {
  return align === "center" || align === "right" ? `<div style="text-align:${align}">${line}</div>` : line;
}

/**
 * A Simple document as the `text` format, or null when it holds a block the
 * format has no line for (a heading, a button, a section). The result may
 * still lose something (an indent); simpleDocumentText checks that.
 */
export function printSimpleText(doc: EmailDocument): string | null {
  const lines: string[] = [];
  for (const block of doc.blocks) {
    if (block.type === "text") {
      let line = printSimpleRuns(block.text, block.content);
      // A line that starts like a list item would come back as one.
      if (BULLET_RE.test(line) || NUMBER_RE.test(line)) line = `<span>${line}</span>`;
      lines.push(alignLine(line, block.align));
    } else if (block.type === "list") {
      block.items.forEach((item, i) => {
        lines.push(`${block.ordered ? `${i + 1}.` : "-"} ${printSimpleRuns(item.text, item.content)}`);
      });
    } else if (block.type === "image") {
      const attrs = [`src="${escapeSimpleAttr(block.src)}"`, `alt="${escapeSimpleAttr(block.alt)}"`];
      if (block.width) attrs.push(`width="${block.width}"`);
      const img = `<img ${attrs.join(" ")}>`;
      lines.push(alignLine(block.href ? `<a href="${escapeSimpleAttr(block.href)}">${img}</a>` : img, block.align));
    } else {
      return null;
    }
  }
  return lines.join("\n");
}

/**
 * A Simple template's body as `text`, or null when that text would not give
 * back the same email (it renders differently once parsed again), e.g. an
 * indented line or a block the format has no line for.
 */
export function simpleDocumentText(doc: EmailDocument): string | null {
  const text = printSimpleText(doc);
  if (text === null || text.length > SIMPLE_EMAIL_MAX_CHARS) return null;
  try {
    const again = parseSimpleText(text, { category: doc.category, previewText: doc.previewText }).doc;
    return renderSimpleHtml(again) === renderSimpleHtml(doc) ? text : null;
  } catch {
    return null;
  }
}
