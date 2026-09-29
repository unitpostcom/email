// TEXT → SIMPLE DOCUMENT — how agents (Unit, the API, MCP, the Skill) author a
// Simple email. They hand us what a person would type into Gmail: lines of
// text, blank lines between paragraphs, "- " / "1. " list markers, and — for
// emphasis and links — Gmail's own inline tags <b> <i> <u> <s> <a href>. NO
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
// Variables ({{first_name}}) are kept as text — the renderer interpolates them.

import { EmailDocumentSchema, ListBlockSchema, TextBlockSchema, type Block, type EmailDocument, type InlineRun } from "./schema";
import { newBlockId } from "./blocks";
import { SIMPLE_EMAIL_MAX_CHARS, SIMPLE_EMAIL_THEME } from "./simple";

export type SimpleTextOptions = {
  previewText?: string;
  category?: "transactional" | "marketing";
};

const INLINE_TAG_RE = /<(\/?)(b|strong|i|em|u|s|strike|a)(\s[^>]*)?>/gi;
const HREF_RE = /href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i;

/** Parse Gmail-style inline tags into runs. Unknown tags are kept as literal text. */
export function parseSimpleInline(line: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const state = { bold: false, italic: false, underline: false, strike: false, link: undefined as string | undefined };
  let last = 0;
  const push = (text: string) => {
    if (!text) return;
    const marks: NonNullable<InlineRun["marks"]> = {};
    if (state.bold) marks.bold = true;
    if (state.italic) marks.italic = true;
    if (state.underline) marks.underline = true;
    if (state.strike) marks.strike = true;
    if (state.link) marks.link = state.link;
    runs.push(Object.keys(marks).length ? { text: unescape(text), marks } : { text: unescape(text) });
  };
  for (const m of line.matchAll(INLINE_TAG_RE)) {
    push(line.slice(last, m.index));
    last = m.index! + m[0].length;
    const closing = m[1] === "/";
    const tag = m[2]!.toLowerCase();
    const on = !closing;
    if (tag === "b" || tag === "strong") state.bold = on;
    else if (tag === "i" || tag === "em") state.italic = on;
    else if (tag === "u") state.underline = on;
    else if (tag === "s" || tag === "strike") state.strike = on;
    else if (tag === "a") {
      if (closing) state.link = undefined;
      else {
        const href = m[3] ? HREF_RE.exec(m[3]) : null;
        state.link = href ? (href[1] ?? href[2] ?? "").trim() || undefined : undefined;
      }
    }
  }
  push(line.slice(last));
  return runs;
}

function unescape(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const NUMBER_RE = /^\s*\d+[.)]\s+(.*)$/;

/**
 * Convert typed text into a Simple document. Consecutive "- " lines become one
 * bulleted list, "1. " lines one numbered list; every other line is a line;
 * a blank line is a blank line (Gmail's Enter-twice). Never parses Markdown.
 */
export function textToSimpleDocument(text: string, options: SimpleTextOptions = {}): EmailDocument {
  if (text.length > SIMPLE_EMAIL_MAX_CHARS) {
    throw new Error(`Simple email text is too long (${text.length} > ${SIMPLE_EMAIL_MAX_CHARS} characters).`);
  }
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
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
      }),
    );
    list = null;
  };
  for (const raw of lines) {
    const bullet = BULLET_RE.exec(raw);
    const number = bullet ? null : NUMBER_RE.exec(raw);
    if (bullet || number) {
      const ordered = Boolean(number);
      const content = parseSimpleInline((bullet ?? number)![1]!);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push(content);
      continue;
    }
    flushList();
    const content = parseSimpleInline(raw.trimEnd());
    blocks.push(
      TextBlockSchema.parse({
        type: "text",
        id: newBlockId(),
        text: content.map((r) => r.text).join(""),
        ...(content.length ? { content } : {}),
        align: "left",
        marginBottom: 0,
      }),
    );
  }
  flushList();
  // Trim leading/trailing blank lines — a compose box ends where the text ends.
  while (blocks.length && isBlankLine(blocks[0]!)) blocks.shift();
  while (blocks.length && isBlankLine(blocks[blocks.length - 1]!)) blocks.pop();

  return EmailDocumentSchema.parse({
    compositionMode: "simple",
    theme: SIMPLE_EMAIL_THEME,
    category: options.category ?? "transactional",
    previewText: options.previewText ?? "",
    blocks,
  });
}

function isBlankLine(b: Block): boolean {
  return b.type === "text" && b.text.trim() === "" && !(b.content && b.content.some((r) => r.text.trim()));
}
