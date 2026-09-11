import {
  EmailDocumentSchema,
  HeadingBlockSchema,
  TextBlockSchema,
  ThemeSchema,
  type Block,
  type EmailDocument,
  type InlineRun,
  type LeafBlock,
  type SectionChild,
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
 * headings, inline emphasis, links, variables, envelope metadata, and category
 * survive; layout containers, images, buttons, raw HTML, and custom styling are
 * flattened to readable text/link equivalents.
 */
export function simplifyEmailDocument(doc: EmailDocument): EmailDocument {
  const kept = doc.blocks.flatMap(flattenNode).filter((block) => {
    if (block.type === "text" || block.type === "heading") {
      return block.text.trim().length > 0 || Boolean(block.content?.length);
    }
    if (block.type === "list") return block.items.length > 0;
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

  return EmailDocumentSchema.parse({
    ...doc,
    compositionMode: "simple",
    theme: SIMPLE_EMAIL_THEME,
    className: undefined,
    blocks,
  });
}

export function designEmailDocument(doc: EmailDocument): EmailDocument {
  return EmailDocumentSchema.parse({ ...doc, compositionMode: "designed" });
}

export function simpleConversionNeedsConfirmation(doc: EmailDocument): boolean {
  if (doc.compositionMode === "simple" || !hasMeaningfulContent(doc.blocks)) {
    return false;
  }
  return doc.blocks.some(
    (block) => block.type !== "text" && block.type !== "heading" && block.type !== "list",
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
