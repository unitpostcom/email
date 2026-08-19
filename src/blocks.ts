import {
  ButtonBlockSchema,
  CodeBlockSchema,
  ColumnBlockSchema,
  DividerBlockSchema,
  HeadingBlockSchema,
  HtmlBlockSchema,
  ImageBlockSchema,
  LinkBlockSchema,
  MarkdownBlockSchema,
  RowBlockSchema,
  SectionBlockSchema,
  SpacerBlockSchema,
  TextBlockSchema,
  type Block,
  type BlockType,
  type ColumnBlock,
} from "./schema";

// Generate a stable-ish unique id for a new block. Uses crypto.randomUUID when
// available (browser + Node 19+), falling back to a timestamp+random string.
export function newBlockId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Create a new empty column (used when constructing a Row).
export function newColumn(width = 50): ColumnBlock {
  return ColumnBlockSchema.parse({ type: "column", id: newBlockId(), width, children: [] });
}

// Create a Row with `count` evenly-sized columns (2–4). Widths are integers
// that sum to 100 (any rounding remainder is added to the last column) so the
// columns fill the row exactly. Used by the inserter's 2/3/4-column options.
export function createRow(count = 2): Block {
  const n = Math.max(1, Math.min(4, Math.round(count)));
  const base = Math.floor(100 / n);
  const widths = Array.from({ length: n }, (_, i) =>
    i === n - 1 ? 100 - base * (n - 1) : base,
  );
  return RowBlockSchema.parse({
    type: "row",
    id: newBlockId(),
    columns: widths.map((w) => newColumn(w)),
  });
}

// Create a new block of the given type with sensible defaults (schema fills the
// rest). Used by the visual builder palette and the editor. `overrides` merges
// caller-provided props over the defaults BEFORE schema validation, so
// `createBlock("heading", { text: "Hello", level: 1 })` works as the docs
// show — invalid overrides fail loudly via the Zod parse rather than being
// silently dropped. `type` and `id` cannot be overridden.
export function createBlock(
  type: BlockType,
  overrides: Record<string, unknown> = {},
): Block {
  const id = newBlockId();
  const withOverrides = (base: Record<string, unknown>) => ({
    ...base,
    ...overrides,
    type,
    id,
  });
  switch (type) {
    case "section":
      return SectionBlockSchema.parse(withOverrides({ children: [] }));
    case "row":
      // A row starts as two equal columns — the common 50/50 layout.
      return RowBlockSchema.parse(
        withOverrides({ columns: (createRow(2) as { columns: ColumnBlock[] }).columns }),
      );
    case "text":
      return TextBlockSchema.parse(
        withOverrides({ text: "Write your message here." }),
      );
    case "heading":
      return HeadingBlockSchema.parse(withOverrides({ text: "Heading" }));
    case "button":
      return ButtonBlockSchema.parse(withOverrides({}));
    case "image":
      return ImageBlockSchema.parse(withOverrides({}));
    case "divider":
      return DividerBlockSchema.parse(withOverrides({}));
    case "link":
      return LinkBlockSchema.parse(withOverrides({}));
    case "spacer":
      return SpacerBlockSchema.parse(withOverrides({}));
    case "markdown":
      return MarkdownBlockSchema.parse(
        withOverrides({ markdown: "Write **markdown** here." }),
      );
    case "code":
      return CodeBlockSchema.parse(withOverrides({}));
    case "html":
      return HtmlBlockSchema.parse(
        withOverrides({ html: "<!-- Paste or write HTML here -->" }),
      );
  }
}

// Deep-clone a block tree assigning a fresh id to EVERY node (the block, its
// row columns, and any nested section/column children). Used when inserting a
// saved Component fragment into a template so the embedded blocks never collide
// with ids already present in the host document — and so two inserts of the same
// component stay independently editable. Pure (no mutation of the input).
export function regenerateBlockIds<T extends Block | ColumnBlock>(block: T): T {
  const next = { ...block, id: newBlockId() } as Record<string, unknown>;
  if (Array.isArray((block as { columns?: unknown }).columns)) {
    next.columns = (block as { columns: ColumnBlock[] }).columns.map((c) =>
      regenerateBlockIds(c),
    );
  }
  if (Array.isArray((block as { children?: unknown }).children)) {
    next.children = (block as { children: (Block | ColumnBlock)[] }).children.map(
      (c) => regenerateBlockIds(c),
    );
  }
  return next as unknown as T;
}

// Human-friendly labels for palette/UI.
export const BLOCK_LABELS: Record<BlockType, string> = {
  section: "Section",
  row: "Columns",
  text: "Text",
  heading: "Heading",
  button: "Button",
  image: "Image",
  divider: "Divider",
  link: "Link",
  spacer: "Spacer",
  markdown: "Markdown",
  code: "Code",
  html: "HTML",
};
