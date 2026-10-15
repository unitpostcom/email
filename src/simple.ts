import {
  EmailDocumentSchema,
  FONT_STACKS,
  HeadingBlockSchema,
  ImageBlockSchema,
  ListBlockSchema,
  TextBlockSchema,
  ThemeSchema,
  type Block,
  type EmailDocument,
  type HeadingBlock,
  type ImageBlock,
  type InlineMark,
  type InlineRun,
  type LeafBlock,
  type ListBlock,
  type SectionChild,
  type TextBlock,
} from "./schema";
import { htmlToPlainText } from "./text";
import { newBlockId } from "./blocks";

// Ceiling for a Simple email's text (characters, all lines together). Gmail
// clips messages whose HTML exceeds ~102 KB; our Simple markup runs roughly 2-3x
// the text length, so 20k characters (~3,500 words) stays well clear of that
// and is already far longer than any sensible "simple" email.
export const SIMPLE_EMAIL_MAX_CHARS = 20_000;

export const SIMPLE_EMAIL_THEME = ThemeSchema.parse({
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  textColor: "#1f1f1f",
  backgroundColor: "#ffffff",
  bodyColor: "#ffffff",
  linkColor: "#1155cc",
  contentWidth: 640,
  bodyPadding: 24,
  bodyRadius: 0,
});

function linkedRuns(text: string, href: string): InlineRun[] {
  return [{ text, marks: href && href !== "#" ? { link: href } : undefined }];
}

function plainTextBlock(
  text: string,
  options: {
    id?: string;
    content?: InlineRun[];
    align?: "left" | "center" | "right";
    // Left padding is the composer's "indent" (40px steps); keep it so a
    // Designed indent survives and a Simple indent round-trips.
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
  } = {},
) {
  const indent = options.padding?.left;
  return TextBlockSchema.parse({
    type: "text",
    id: options.id ?? newBlockId(),
    text,
    ...(options.content?.length ? { content: options.content } : {}),
    align: options.align ?? "left",
    ...(indent ? { padding: { left: indent } } : {}),
    // Mail-client model: lines stack; spacing is blank lines, not margins.
    marginBottom: 0,
  });
}

function plainTextBlocks(
  value: string,
  options: {
    id: string;
    align?: "left" | "center" | "right";
  },
): Block[] {
  return value
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) =>
      plainTextBlock(line, {
        id: index === 0 ? options.id : newBlockId(),
        align: options.align,
      }),
    );
}

function markdownToSimpleText(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, "$1$2")
    .replace(/\*([^*]+)\*|_([^_]+)_/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function flattenLeaf(block: LeafBlock): Block[] {
  switch (block.type) {
    case "text":
      return [
        plainTextBlock(block.text, {
          id: block.id,
          content: block.content,
          align: block.align,
          padding: block.padding,
        }),
      ];
    case "list":
      // Lists are first-class in the composer; keep them (stacked, no margin).
      return [{ ...block, marginBottom: 0 }];
    case "heading":
      return [
        HeadingBlockSchema.parse({
          type: "heading",
          id: block.id,
          text: block.text,
          ...(block.content?.length ? { content: block.content } : {}),
          level: block.level,
          align: block.align,
          ...(block.padding?.left ? { padding: { left: block.padding.left } } : {}),
          marginBottom: 0,
        }),
      ];
    case "button":
    case "link":
      return [
        plainTextBlock(block.text, {
          id: block.id,
          content: linkedRuns(block.text, block.href),
          align: block.align,
        }),
      ];
    case "image": {
      // Images are first-class in Simple (2026-10-12): an author pastes a
      // screenshot into a plain, reads-as-text email, exactly as in Gmail. Keep
      // what the fragment can carry (src, alt, link, a px width, the line's
      // alignment); the designed frame styling (height, fit, radius, border,
      // background, margins, custom CSS) is layout and goes.
      if (block.src.trim()) return [simpleImageBlock(block)];
      // No image picked yet (an empty designed placeholder): keep its words.
      const label = block.alt.trim() || (block.href ? "Open image" : "");
      if (!label) return [];
      return [
        plainTextBlock(label, {
          id: block.id,
          content: block.href ? linkedRuns(label, block.href) : undefined,
          align: block.align,
        }),
      ];
    }
    case "divider":
      return [plainTextBlock("———", { id: block.id })];
    case "spacer":
      return [];
    case "markdown":
      return plainTextBlocks(markdownToSimpleText(block.markdown), {
        id: block.id,
        align: block.align,
      });
    case "code":
      return plainTextBlocks(block.code, { id: block.id });
    case "html":
      return plainTextBlocks(htmlToPlainText(block.html), { id: block.id });
  }
}

function simpleImageBlock(block: ImageBlock): Block {
  return ImageBlockSchema.parse({
    type: "image",
    id: block.id,
    src: block.src,
    alt: block.alt,
    ...(block.href ? { href: block.href } : {}),
    ...(block.width ? { width: block.width } : {}),
    align: block.align,
    // Lines stack; spacing is blank lines, not margins (as for text).
    marginBottom: 0,
  });
}

// An image Simple keeps exactly as it is: it has a source and none of the
// designed frame styling that simplifying drops.
function isSimpleImage(block: ImageBlock): boolean {
  return Boolean(
    block.src.trim() &&
      !block.height &&
      !block.borderRadius &&
      !block.border &&
      !block.objectFit &&
      !block.backgroundColor &&
      !block.margin &&
      !block.padding &&
      !block.customCss &&
      !block.className &&
      !block.componentRef,
  );
}

function flattenNode(block: Block | SectionChild): Block[] {
  if (block.type === "section") return block.children.flatMap(flattenNode);
  if (block.type === "row") {
    return block.columns.flatMap((column) => column.children.flatMap(flattenLeaf));
  }
  return flattenLeaf(block);
}

export function isSimpleEmailDocument(doc: EmailDocument): boolean {
  return doc.compositionMode === "simple";
}

/**
 * Convert a designed document into the constrained Simple-email subset. Copy,
 * headings, inline emphasis, links, images (src, alt, link, width), variables,
 * envelope metadata, and category survive; layout containers, buttons, raw
 * HTML, and custom styling are flattened to readable text/link equivalents.
 */
export function simplifyEmailDocument(doc: EmailDocument): EmailDocument {
  const kept = doc.blocks.flatMap(flattenNode).filter((block) => {
    if (block.type === "text" || block.type === "heading") {
      return block.text.trim().length > 0 || Boolean(block.content?.length);
    }
    if (block.type === "list") return block.items.length > 0;
    if (block.type === "image") return block.src.trim().length > 0;
    return false;
  });
  // Designed blocks carried their own margins; in the composer model spacing is
  // a blank line, so put one between former blocks (never two in a row, never
  // at the ends) so the converted message still breathes.
  const blocks: Block[] = [];
  kept.forEach((block, i) => {
    blocks.push(block);
    if (i < kept.length - 1) blocks.push(plainTextBlock(""));
  });

  // Finish with the Simple-mode validator so a converted email is exactly what
  // a save stores (no heading the save would then turn into a bold line).
  return normalizeSimpleDocument(
    EmailDocumentSchema.parse({
      ...doc,
      compositionMode: "simple",
      theme: SIMPLE_EMAIL_THEME,
      className: undefined,
      blocks,
    }),
  ).doc;
}

export function designEmailDocument(doc: EmailDocument): EmailDocument {
  return EmailDocumentSchema.parse({ ...doc, compositionMode: "designed" });
}

export function simpleConversionNeedsConfirmation(doc: EmailDocument): boolean {
  if (doc.compositionMode === "simple" || !hasMeaningfulContent(doc.blocks)) {
    return false;
  }
  return doc.blocks.some(
    (block) =>
      block.type !== "text" &&
      block.type !== "heading" &&
      block.type !== "list" &&
      !(block.type === "image" && isSimpleImage(block)),
  ) ||
    doc.className != null ||
    JSON.stringify(doc.theme) !== JSON.stringify(SIMPLE_EMAIL_THEME) ||
    doc.blocks.some((block) => {
      if (block.type !== "text" && block.type !== "heading") return false;
      // Left padding is a plain indent (the composer sets it too) — not a
      // reason to warn. Any OTHER padding side is designer styling.
      const otherPadding =
        block.padding &&
        (block.padding.top != null || block.padding.right != null || block.padding.bottom != null);
      return Boolean(
        block.className ||
          block.customCss ||
          otherPadding ||
          block.margin ||
          block.color ||
          block.fontFamily ||
          block.lineHeight ||
          block.letterSpacing ||
          block.fontWeight,
      );
    });
}

function hasMeaningfulContent(blocks: Block[]): boolean {
  return blocks.some((block) => {
    if (block.type === "section") {
      return block.children.some((child) => hasMeaningfulSectionChild(child));
    }
    if (block.type === "row") {
      return block.columns.some((column) =>
        column.children.some((child) => hasMeaningfulLeaf(child)),
      );
    }
    return hasMeaningfulLeaf(block);
  });
}

function hasMeaningfulSectionChild(child: SectionChild): boolean {
  if (child.type === "section") {
    return child.children.some((nested) => hasMeaningfulSectionChild(nested));
  }
  return hasMeaningfulLeaf(child);
}

function hasMeaningfulLeaf(block: LeafBlock): boolean {
  switch (block.type) {
    case "text":
    case "heading":
    case "button":
    case "link":
      return block.text.trim().length > 0;
    case "list":
      return block.items.some((i) => i.text.trim().length > 0);
    case "image":
      return Boolean(block.src.trim() || block.alt.trim());
    case "divider":
    case "spacer":
      return true;
    case "markdown":
      return block.markdown.trim().length > 0;
    case "code":
      return block.code.trim().length > 0;
    case "html":
      return block.html.trim().length > 0;
  }
}

// ---------------------------------------------------------------------------
// SIMPLE-MODE VALIDATOR
// ---------------------------------------------------------------------------
// A Simple email holds exactly what the Simple composer (the template editor's
// Gmail-style toolbar, simple-toolbar.tsx) can show and edit, and nothing else:
//
//   lines (left / centre / right, 40px indent steps) and blank lines between
//   them · bold · italic · underline · strikethrough · text colour · highlight ·
//   Gmail's sizes (Small 13 / Normal / Large 18 / Huge 24 px) · a FONT_STACKS
//   font · links · bulleted / numbered lists · images (src, alt, link, width,
//   line alignment) · {{variables}}.
//
// No headings, sections, columns, spacers, buttons, dividers, raw HTML,
// Markdown/code blocks, page theme or per-block styling. A Simple document can
// still arrive with those — Ask Unit / an API caller writing Designed TSX into a
// Simple template (2026-10-13: a <Section> of copy + <Spacer>s sent as an empty
// email), a document saved before this validator, a hand-built JSON design.
// So every write of a Simple document runs normalizeSimpleDocument, the editor
// runs it when it opens one, and the Simple renderer expands what it cannot
// draw (expandSimpleBlocks) instead of dropping it.

const NATIVE_SIMPLE_BLOCKS: ReadonlySet<Block["type"]> = new Set(["text", "heading", "list", "image", "divider"]);

/** A colour a Simple email may carry: hex, rgb()/rgba(), or a CSS colour name. */
const SIMPLE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*){2,3}\)|[a-zA-Z]{3,20})$/;
export function isSimpleColor(value: string | undefined): value is string {
  return typeof value === "string" && SIMPLE_COLOR_RE.test(value.trim());
}

/** Gmail's text sizes in px. "Normal" is no size at all. */
export const SIMPLE_TEXT_SIZES = { small: 13, large: 18, huge: 24 } as const;

function isBlankLine(block: Block | undefined): boolean {
  return Boolean(
    block &&
      block.type === "text" &&
      !block.text.trim() &&
      !block.content?.some((run) => run.text.trim()),
  );
}

function hasLineContent(block: Block): boolean {
  if (block.type === "text" || block.type === "heading") {
    return block.text.trim().length > 0 || Boolean(block.content?.some((run) => run.text.trim()));
  }
  if (block.type === "list") return block.items.length > 0;
  if (block.type === "image") return block.src.trim().length > 0;
  return false;
}

/**
 * The Simple renderer's guard: every block a Simple email cannot draw
 * (a section or row, a button or link block, Markdown / code / raw HTML) is
 * expanded into its lines, and a spacer becomes a blank line, so its content is
 * sent instead of silently vanishing. Lines that are already Simple are returned
 * untouched (the same array when nothing needs expanding), so a clean document
 * renders byte for byte as before.
 */
export function expandSimpleBlocks(blocks: Block[]): Block[] {
  if (blocks.every((block) => NATIVE_SIMPLE_BLOCKS.has(block.type))) return blocks;
  const out: Block[] = [];
  const blank = () => {
    if (out.length && !isBlankLine(out[out.length - 1])) out.push(plainTextBlock(""));
  };
  // A designed block carried its own margins; once flattened, its lines are
  // set apart from the next line by one blank line (never two, never at the
  // ends) — the same spacing simplifyEmailDocument gives a converted email.
  let separateNext = false;
  for (const block of blocks) {
    if (NATIVE_SIMPLE_BLOCKS.has(block.type)) {
      if (separateNext && !isBlankLine(block)) blank();
      separateNext = false;
      out.push(block);
      continue;
    }
    if (block.type === "spacer") {
      blank();
      separateNext = false;
      continue;
    }
    const lines = flattenNode(block).filter(hasLineContent);
    if (!lines.length) continue;
    blank();
    lines.forEach((line, i) => {
      if (i > 0) blank();
      out.push(line);
    });
    separateNext = true;
  }
  return out;
}

// ----- the report ---------------------------------------------------------

type Tally = Map<string, number>;

function bump(tally: Tally, key: string, by = 1) {
  tally.set(key, (tally.get(key) ?? 0) + by);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

// Every block below the top level that a Simple email can't carry, counted for
// the report (expandSimpleBlocks itself only looks at the top level).
function tallyForeign(blocks: Array<Block | SectionChild | LeafBlock>, tally: Tally) {
  for (const block of blocks) {
    switch (block.type) {
      case "section":
        bump(tally, "section");
        tallyForeign(block.children, tally);
        break;
      case "row":
        bump(tally, "row");
        for (const column of block.columns) tallyForeign(column.children, tally);
        break;
      case "spacer":
      case "button":
      case "link":
      case "markdown":
      case "code":
      case "html":
        bump(tally, block.type);
        break;
      default:
        break;
    }
  }
}

const REPORT_LINES: Array<[key: string, line: (n: number) => string]> = [
  ["section", (n) => `Flattened ${plural(n, "layout section")} into plain lines`],
  ["row", (n) => `Flattened ${plural(n, "column row")} into plain lines`],
  ["spacer", (n) => `Removed ${plural(n, "spacer")} (a Simple email is spaced with blank lines)`],
  ["button", (n) => `Turned ${plural(n, "button")} into ${n === 1 ? "a text link" : "text links"}`],
  ["link", (n) => `Turned ${plural(n, "link block")} into ${n === 1 ? "a text link" : "text links"}`],
  ["heading", (n) => `Turned ${plural(n, "heading")} into bold ${n === 1 ? "line" : "lines"}`],
  ["divider", (n) => `Turned ${plural(n, "divider")} into a "———" line`],
  ["markdown", (n) => `Turned ${plural(n, "Markdown block")} into plain lines (Markdown isn't rendered)`],
  ["code", (n) => `Turned ${plural(n, "code block")} into plain lines`],
  ["html", (n) => `Turned ${plural(n, "raw HTML block")} into plain lines`],
  ["imageFrame", (n) => `Removed designed frame styling from ${plural(n, "image")} (height, fit, radius, border, background)`],
  ["size", (n) => `Snapped ${plural(n, "text size")} to Gmail's Small / Normal / Large / Huge`],
  ["font", (n) => `Removed ${plural(n, "font")} that isn't in the font menu`],
  ["color", (n) => `Removed ${plural(n, "colour value")} that ${n === 1 ? "isn't a colour" : "aren't colours"}`],
  ["blockStyle", (n) => `Removed per-line styling a Simple email can't carry from ${plural(n, "line")} (line height, letter spacing, margins, padding, custom CSS)`],
  ["theme", () => "Reset the page style (Simple emails use the reader's own background, width and font)"],
];

// ----- inline runs ----------------------------------------------------------

/** Snap a px size to Gmail's sizes; undefined means "Normal" (no size). */
export function snapSimpleTextSize(px: number | undefined): number | undefined {
  if (px == null || !Number.isFinite(px)) return undefined;
  if (px <= 14) return SIMPLE_TEXT_SIZES.small;
  if (px <= 16) return undefined;
  if (px <= 20) return SIMPLE_TEXT_SIZES.large;
  return SIMPLE_TEXT_SIZES.huge;
}

function firstFamily(stack: string): string {
  return (stack.split(",")[0] ?? "").trim().replace(/^['"]|['"]$/g, "").toLowerCase();
}

/** A font the composer's font menu offers (matched by its first family), or undefined. */
export function simpleFontStack(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const exact = FONT_STACKS.find((font) => font.value === value);
  if (exact) return exact.value;
  const family = firstFamily(value);
  return FONT_STACKS.find((font) => firstFamily(font.value) === family || font.label.toLowerCase() === family)?.value;
}

type InheritedStyle = Pick<InlineMark, "bold" | "color" | "fontSize" | "fontFamily">;

function cleanRuns(
  runs: InlineRun[] | undefined,
  inherited: InheritedStyle,
  tally: Tally,
): InlineRun[] | undefined {
  if (!runs?.length) return runs;
  return runs.map((run) => {
    const source: InlineMark = { ...inherited, ...(run.marks ?? {}) };
    const marks: InlineMark = {};
    if (source.bold) marks.bold = true;
    if (source.italic) marks.italic = true;
    if (source.underline) marks.underline = true;
    if (source.strike) marks.strike = true;
    if (source.link) marks.link = source.link;
    if (isSimpleColor(source.color)) marks.color = source.color.trim();
    else if (source.color) bump(tally, "color");
    if (isSimpleColor(source.background)) marks.background = source.background.trim();
    else if (source.background) bump(tally, "color");
    const size = snapSimpleTextSize(source.fontSize);
    if (size != null) marks.fontSize = size;
    if (run.marks?.fontSize != null && run.marks.fontSize !== size) bump(tally, "size");
    const font = simpleFontStack(source.fontFamily);
    if (font) marks.fontFamily = font;
    if (run.marks?.fontFamily && !font) bump(tally, "font");
    const next: InlineRun = { text: run.text };
    if (Object.keys(marks).length) next.marks = marks;
    if (run.variable) next.variable = run.variable;
    return next;
  });
}

// Block-level typography the composer can't set on a line moves onto the
// line's runs (where the composer CAN show it) instead of being lost.
function inheritedFrom(
  block: Pick<TextBlock, "color" | "fontFamily" | "fontWeight"> & { fontSize?: number },
  defaultSize: number | undefined,
  tally: Tally,
): InheritedStyle {
  const style: InheritedStyle = {};
  if (block.color) style.color = block.color;
  const weight = block.fontWeight == null ? NaN : Number(block.fontWeight);
  if (block.fontWeight === "bold" || block.fontWeight === "bolder" || weight >= 600) style.bold = true;
  if (block.fontSize != null && block.fontSize !== defaultSize) {
    style.fontSize = block.fontSize;
    if (snapSimpleTextSize(block.fontSize) !== block.fontSize) bump(tally, "size");
  }
  if (block.fontFamily) {
    style.fontFamily = block.fontFamily;
    if (!simpleFontStack(block.fontFamily)) bump(tally, "font");
  }
  return style;
}

function runsOf(text: string, content: InlineRun[] | undefined, inherited: InheritedStyle): InlineRun[] | undefined {
  if (content?.length) return content;
  // Plain text only needs runs when there is block styling to carry.
  return Object.keys(inherited).length && text ? [{ text }] : undefined;
}

function plainOf(runs: InlineRun[] | undefined, fallback: string): string {
  return runs?.length ? runs.map((run) => run.text).join("") : fallback;
}

function indentOf(block: { padding?: { left?: number } }): { padding: { left: number } } | Record<string, never> {
  const left = block.padding?.left;
  return left && left > 0 ? { padding: { left } } : {};
}

function hasDroppedLineStyle(block: TextBlock | HeadingBlock | ListBlock): boolean {
  const padding = block.padding;
  return Boolean(
    ("lineHeight" in block && block.lineHeight != null) ||
      ("letterSpacing" in block && block.letterSpacing != null) ||
      block.margin ||
      (padding && (padding.top != null || padding.right != null || padding.bottom != null)) ||
      block.customCss ||
      block.className ||
      block.componentRef,
  );
}

// A designed line's space below it becomes one blank line — the only spacing a
// Simple email has. Composer lines carry none (marginBottom 0).
function hasSpaceBelow(block: Block): boolean {
  if (block.type !== "text" && block.type !== "heading" && block.type !== "image") return false;
  return (block.margin?.bottom ?? block.marginBottom ?? 0) > 0;
}

const HEADING_SIZE: Record<HeadingBlock["level"], number | undefined> = {
  1: SIMPLE_TEXT_SIZES.huge,
  2: SIMPLE_TEXT_SIZES.large,
  3: undefined,
  4: undefined,
};

function cleanLine(block: Block, tally: Tally): Block | null {
  switch (block.type) {
    case "text": {
      if (hasDroppedLineStyle(block)) bump(tally, "blockStyle");
      const inherited = inheritedFrom(block, TextBlockSchema.shape.fontSize.parse(undefined), tally);
      const runs = cleanRuns(runsOf(block.text, block.content, inherited), inherited, tally);
      return TextBlockSchema.parse({
        type: "text",
        id: block.id,
        text: plainOf(runs, block.text),
        ...(runs?.length ? { content: runs } : {}),
        align: block.align,
        ...indentOf(block),
        marginBottom: 0,
      });
    }
    case "heading": {
      // Gmail has no headings: a title is a bold line at Large / Huge.
      bump(tally, "heading");
      if (hasDroppedLineStyle(block)) bump(tally, "blockStyle");
      const inherited: InheritedStyle = {
        ...inheritedFrom({ ...block, fontWeight: undefined }, undefined, tally),
        bold: true,
      };
      if (inherited.fontSize == null && HEADING_SIZE[block.level] != null) inherited.fontSize = HEADING_SIZE[block.level];
      const runs = cleanRuns(block.content?.length ? block.content : block.text ? [{ text: block.text }] : undefined, inherited, tally);
      return TextBlockSchema.parse({
        type: "text",
        id: block.id,
        text: plainOf(runs, block.text),
        ...(runs?.length ? { content: runs } : {}),
        align: block.align,
        ...indentOf(block),
        marginBottom: 0,
      });
    }
    case "list": {
      if (hasDroppedLineStyle(block)) bump(tally, "blockStyle");
      const inherited = inheritedFrom({ ...block, fontWeight: undefined }, ListBlockSchema.shape.fontSize.parse(undefined), tally);
      return ListBlockSchema.parse({
        type: "list",
        id: block.id,
        ordered: block.ordered,
        items: block.items.map((item) => {
          const runs = cleanRuns(runsOf(item.text, item.content, inherited), inherited, tally);
          return runs?.length ? { text: plainOf(runs, item.text), content: runs } : { text: item.text };
        }),
        ...indentOf(block),
        marginBottom: 0,
      });
    }
    case "image": {
      if (!block.src.trim()) return flattenLeaf(block)[0] ?? null;
      if (!isSimpleImage(block)) bump(tally, "imageFrame");
      return simpleImageBlock(block);
    }
    case "divider":
      bump(tally, "divider");
      return plainTextBlock("———", { id: block.id });
    default:
      // expandSimpleBlocks already turned everything else into lines.
      return null;
  }
}

function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameJson(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ra = a as Record<string, unknown>;
    const rb = b as Record<string, unknown>;
    const ka = Object.keys(ra).filter((k) => ra[k] !== undefined);
    const kb = Object.keys(rb).filter((k) => rb[k] !== undefined);
    return ka.length === kb.length && ka.every((k) => sameJson(ra[k], rb[k]));
  }
  return false;
}

export type SimpleNormalization = {
  /** The Simple-only document (the input object itself when nothing changed). */
  doc: EmailDocument;
  /** Whether anything at all changed, including silent clean-ups. */
  changed: boolean;
  /** What a person would notice, in plain words — for API / assistant replies and editor notices. */
  changes: string[];
};

/**
 * The Simple-mode validator. Returns the document reduced to what a Simple
 * email can carry (see the block comment above), plus a plain-language list of
 * what was flattened or removed. Idempotent; a designed document is returned
 * as is. Nothing readable is dropped: containers and buttons flatten to lines
 * and links, headings become bold Large/Huge lines, block typography moves onto
 * the line's text, a designed line's margin becomes a blank line.
 */
export function normalizeSimpleDocument(doc: EmailDocument): SimpleNormalization {
  if (doc.compositionMode !== "simple") return { doc, changed: false, changes: [] };
  const tally: Tally = new Map();
  tallyForeign(doc.blocks, tally);

  const expanded = expandSimpleBlocks(doc.blocks);
  const blocks: Block[] = [];
  expanded.forEach((block, i) => {
    const line = cleanLine(block, tally);
    if (!line) return;
    blocks.push(line);
    const next = expanded[i + 1];
    if (next && hasSpaceBelow(block) && !isBlankLine(next) && !isBlankLine(line)) {
      blocks.push(plainTextBlock(""));
    }
  });

  if (!sameJson(doc.theme, SIMPLE_EMAIL_THEME) || doc.className != null) bump(tally, "theme");

  const next = EmailDocumentSchema.parse({
    ...doc,
    theme: SIMPLE_EMAIL_THEME,
    className: undefined,
    blocks,
  });
  if (sameJson(next, doc)) return { doc, changed: false, changes: [] };
  const changes = REPORT_LINES.flatMap(([key, line]) => {
    const n = tally.get(key);
    return n ? [line(n)] : [];
  });
  return { doc: next, changed: true, changes };
}

/** True when a Simple document already holds only what a Simple email can carry. */
export function isNormalizedSimpleDocument(doc: EmailDocument): boolean {
  return !normalizeSimpleDocument(doc).changed;
}

/**
 * A stored template design's KIND — "simple" (the editor's Simple tab, authored
 * as `text`) or "designed" (Design / Code tabs, authored as components / HTML).
 * Accepts the raw stored JSON; anything that isn't a Simple document is designed.
 */
export function templateKind(design: unknown): "simple" | "designed" {
  return design && typeof design === "object" && (design as { compositionMode?: unknown }).compositionMode === "simple"
    ? "simple"
    : "designed";
}
