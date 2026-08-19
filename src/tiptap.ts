import { newBlockId, regenerateBlockIds } from "./blocks";
import {
  EmailDocumentSchema,
  type Block,
  type ColumnBlock,
  type ComponentFragment,
  type EmailDocument,
  type InlineRun,
  type RowBlock,
  type SectionBlock,
  type SectionChild,
} from "./schema";

// ---------------------------------------------------------------------------
// EmailDocument <-> TipTap JSON bridge.
//
// The visual editor is built on TipTap/ProseMirror, but EmailDocument stays the
// SINGLE SOURCE OF TRUTH (it's what the renderer + send pipeline consume). This
// module converts between the two losslessly so the canvas can edit a TipTap
// document while we persist/render our own model.
//
// Mapping strategy: every block becomes one TipTap node whose `name` is the
// block type and whose attrs carry the block id plus the block's data. Content
// of a block is NOT stored in TipTap inline content (which would force a lossy
// marks<->plain-text mapping); instead each node is a self-contained unit and
// its NodeView edits the data attrs directly. This guarantees an exact round
// trip: tiptapToDoc(docToTiptap(doc)) deep-equals doc — with ONE deliberate
// exception, a SINGLE trailing empty top-level text line, which the canvas keeps
// as its always-present "add your next element here" affordance and which
// tiptapToDoc strips on the way out (authoring-only, never shipped).
//
// Container blocks (section/row/column) carry their children as nested TipTap
// node content so ProseMirror can host in-canvas drag/drop + selection of
// nested nodes.
// ---------------------------------------------------------------------------

// Minimal TipTap/ProseMirror JSON shapes (we avoid importing @tiptap into the
// shared package, which must stay framework-free for the engine).
export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};
export type TiptapDoc = {
  type: "doc";
  content: TiptapNode[];
};

// Node type names used in the TipTap schema. Leaf/atomic nodes embed their data
// in `attrs.data`; containers expose `content`.
export const TIPTAP_NODE_TYPES = {
  doc: "doc",
  section: "emailSection",
  row: "emailRow",
  column: "emailColumn",
  text: "emailText",
  heading: "emailHeading",
  button: "emailButton",
  image: "emailImage",
  divider: "emailDivider",
  link: "emailLink",
  spacer: "emailSpacer",
  markdown: "emailMarkdown",
  code: "emailCode",
  html: "emailHtml",
} as const;

// Map a block `type` to its TipTap node name.
const BLOCK_TO_NODE: Record<string, string> = {
  section: TIPTAP_NODE_TYPES.section,
  row: TIPTAP_NODE_TYPES.row,
  column: TIPTAP_NODE_TYPES.column,
  text: TIPTAP_NODE_TYPES.text,
  heading: TIPTAP_NODE_TYPES.heading,
  button: TIPTAP_NODE_TYPES.button,
  image: TIPTAP_NODE_TYPES.image,
  divider: TIPTAP_NODE_TYPES.divider,
  link: TIPTAP_NODE_TYPES.link,
  spacer: TIPTAP_NODE_TYPES.spacer,
  markdown: TIPTAP_NODE_TYPES.markdown,
  code: TIPTAP_NODE_TYPES.code,
  html: TIPTAP_NODE_TYPES.html,
};
const NODE_TO_BLOCK: Record<string, string> = Object.fromEntries(
  Object.entries(BLOCK_TO_NODE).map(([block, node]) => [node, block]),
);

// `data` holds everything about a block EXCEPT its children/columns (which live
// in TipTap node content). We strip those before stashing so the source of
// truth for nesting is the ProseMirror tree. For text-bearing blocks we also
// strip the editable text field — that lives in the node's inline content so
// ProseMirror handles typing/selection/undo natively — and re-derive it on the
// way back (see textFieldFor / blockFromNode).
function dataAttrs(
  block: Block | ColumnBlock | SectionChild,
): Record<string, unknown> {
  const rest = { ...block } as Record<string, unknown>;
  delete rest.children;
  delete rest.columns;
  const textField = textFieldFor(block.type);
  if (textField) delete rest[textField];
  // Inline runs live in ProseMirror inline content, not in data attrs.
  delete rest.content;
  return rest;
}

// Which block field is edited as inline text content (vs. an attr). These three
// render flowing copy, so they get native inline editing in the canvas.
function textFieldFor(type: string): "text" | "markdown" | null {
  if (type === "text" || type === "heading") return "text";
  if (type === "markdown") return "markdown";
  return null;
}

// ---------------------------------------------------------------------------
// Inline runs <-> ProseMirror inline content (with marks)
// ---------------------------------------------------------------------------
// ProseMirror marks we map to/from our InlineRun marks. Visual color marks use
// TipTap's `textStyle` (color attr) and `highlight` (color attr); structural
// ones are `bold`/`italic`/`underline`/`link`.
type PmMark = { type: string; attrs?: Record<string, unknown> };

function marksToPm(marks: InlineRun["marks"]): PmMark[] {
  if (!marks) return [];
  const out: PmMark[] = [];
  if (marks.bold) out.push({ type: "bold" });
  if (marks.italic) out.push({ type: "italic" });
  if (marks.underline) out.push({ type: "underline" });
  // color + background both live on the single `textStyle` mark.
  if (marks.color || marks.background || marks.fontFamily || marks.fontSize) {
    const attrs: Record<string, unknown> = {};
    if (marks.color) attrs.color = marks.color;
    if (marks.background) attrs.backgroundColor = marks.background;
    if (marks.fontFamily) attrs.fontFamily = marks.fontFamily;
    if (marks.fontSize) attrs.fontSize = `${marks.fontSize}px`;
    out.push({ type: "textStyle", attrs });
  }
  if (marks.link != null)
    out.push({ type: "link", attrs: { href: marks.link } });
  return out;
}

function pmToMarks(pm: PmMark[] | undefined): InlineRun["marks"] | undefined {
  if (!pm || pm.length === 0) return undefined;
  const marks: NonNullable<InlineRun["marks"]> = {};
  for (const m of pm) {
    if (m.type === "bold") marks.bold = true;
    else if (m.type === "italic") marks.italic = true;
    else if (m.type === "underline") marks.underline = true;
    else if (m.type === "textStyle") {
      const c = m.attrs?.color;
      if (typeof c === "string" && c) marks.color = c;
      const bg = m.attrs?.backgroundColor;
      if (typeof bg === "string" && bg) marks.background = bg;
      const ff = m.attrs?.fontFamily;
      if (typeof ff === "string" && ff) marks.fontFamily = ff;
      const fs = m.attrs?.fontSize;
      if (typeof fs === "string" && fs) {
        const px = parseInt(fs, 10);
        if (Number.isFinite(px) && px > 0) marks.fontSize = px;
      } else if (typeof fs === "number" && fs > 0) {
        marks.fontSize = fs;
      }
    } else if (m.type === "highlight") {
      const c = m.attrs?.color;
      if (typeof c === "string" && c) marks.background = c;
    } else if (m.type === "link") {
      const href = m.attrs?.href;
      marks.link = typeof href === "string" ? href : "";
    }
  }
  return Object.keys(marks).length ? marks : undefined;
}

// Build TipTap inline content from a block's runs (preferred) or its plain
// `text`. ProseMirror text nodes carry their string in the top-level `text`
// property (NOT attrs). We also mirror it under attrs.text so readInline can
// recover from either shape. Empty content is allowed (empty textblock).
function inlineContentFor(
  runs: InlineRun[] | undefined,
  plain: string,
): TiptapNode[] {
  if (runs && runs.length) {
    return runs
      .filter((r) => r.variable || r.text.length > 0)
      .map((r) => {
        // A variable run becomes a single inline atom node carrying the name +
        // its styling marks; round-trips back to a variable run in readRuns.
        if (r.variable) {
          const node: TiptapNode = {
            type: "emailVariable",
            attrs: { name: r.variable },
          };
          const marks = marksToPm(r.marks);
          if (marks.length) node.marks = marks;
          return node;
        }
        const node: TiptapNode = {
          type: "text",
          text: r.text,
          attrs: { text: r.text },
        };
        const marks = marksToPm(r.marks);
        if (marks.length) node.marks = marks;
        return node;
      });
  }
  return plain
    ? [{ type: "text", text: plain, attrs: { text: plain } } as TiptapNode]
    : [];
}

// Read inline content back as runs. Concatenated plain text is derived by the
// caller via runsToPlainText.
function readRuns(node: TiptapNode): InlineRun[] {
  return (node.content ?? [])
    .map((c): InlineRun | null => {
      const withText = c as TiptapNode & { text?: string; marks?: PmMark[] };
      // Variable atom -> variable run. `text` mirrors the canonical {{name}}
      // form so the renderer interpolates it and plain consumers keep working.
      if (c.type === "emailVariable") {
        const name =
          typeof c.attrs?.name === "string" ? (c.attrs.name as string) : "";
        if (!name) return null;
        const marks = pmToMarks(withText.marks);
        const run: InlineRun = { text: `{{${name}}}`, variable: name };
        if (marks) run.marks = marks;
        return run;
      }
      const text =
        typeof withText.text === "string"
          ? withText.text
          : typeof c.attrs?.text === "string"
            ? (c.attrs.text as string)
            : "";
      if (!text) return null;
      const marks = pmToMarks(withText.marks);
      return marks ? { text, marks } : { text };
    })
    .filter((r): r is InlineRun => r != null);
}

function runsToPlainText(runs: InlineRun[]): string {
  return runs.map((r) => r.text).join("");
}

// ---------------------------------------------------------------------------
// docToTiptap
// ---------------------------------------------------------------------------

function nodeFromBlock(block: Block | ColumnBlock | SectionChild): TiptapNode {
  const type = BLOCK_TO_NODE[block.type];
  const node: TiptapNode = {
    type,
    attrs: { id: block.id, data: dataAttrs(block) },
  };

  if (block.type === "section") {
    node.content = block.children.map(nodeFromBlock);
  } else if (block.type === "row") {
    node.content = block.columns.map(nodeFromBlock);
  } else if (block.type === "column") {
    node.content = block.children.map(nodeFromBlock);
  } else {
    const textField = textFieldFor(block.type);
    if (textField) {
      if (block.type === "text" || block.type === "heading") {
        const b = block as { content?: InlineRun[]; text?: string };
        node.content = inlineContentFor(b.content, b.text ?? "");
      } else {
        const value = (block as Record<string, unknown>)[textField];
        node.content = inlineContentFor(
          undefined,
          typeof value === "string" ? value : "",
        );
      }
    }
  }
  return node;
}

// Convert an EmailDocument to a TipTap `doc` JSON. Only the block tree is
// represented; theme/variables/previewText/category stay on the EmailDocument
// and are managed outside TipTap (the Document inspector panel).
export function docToTiptap(doc: EmailDocument): TiptapDoc {
  return {
    type: "doc",
    content: doc.blocks.map((b) => nodeFromBlock(b)),
  };
}

// Convert a saved Component FRAGMENT into TipTap nodes ready to insert into a
// host template at the caret. A fragment is a subtree (blocks only — no
// theme/variables), so we map each top-level block exactly as docToTiptap does.
// By default every block (and nested child) gets a FRESH id (`freshIds`), so
// inserting a component never collides with ids already in the host document
// and two inserts of the same component remain independently editable. Pass
// `freshIds: false` only when ids must be preserved (e.g. round-trip tests).
export function fragmentToTiptap(
  fragment: ComponentFragment,
  { freshIds = true }: { freshIds?: boolean } = {},
): TiptapNode[] {
  const blocks = freshIds
    ? fragment.blocks.map((b) => regenerateBlockIds(b))
    : fragment.blocks;
  return blocks.map((b) => nodeFromBlock(b));
}

// True for a top-level empty text node — the shape of the canvas's trailing
// "add your next element" affordance line, which is authoring-only and stripped
// before serialize (see tiptapToDoc). A node counts as empty when it's an
// `emailText` with no inline content at all.
function isEmptyTextNode(node: TiptapNode): boolean {
  return (
    node.type === TIPTAP_NODE_TYPES.text &&
    (node.content == null || node.content.length === 0)
  );
}

// ---------------------------------------------------------------------------
// tiptapToDoc
// ---------------------------------------------------------------------------

function blockFromNode(node: TiptapNode): Block | ColumnBlock | null {
  const blockType = NODE_TO_BLOCK[node.type];
  if (!blockType) return null;

  const attrs = node.attrs ?? {};
  const data = (attrs.data as Record<string, unknown> | undefined) ?? {};
  const id =
    typeof attrs.id === "string" && attrs.id
      ? attrs.id
      : typeof data.id === "string" && data.id
        ? (data.id as string)
        : newBlockId();

  const base = { ...data, type: blockType, id } as Record<string, unknown>;
  const childNodes = node.content ?? [];

  if (blockType === "section") {
    base.children = childNodes
      .map(blockFromNode)
      .filter((b): b is SectionChild => b != null) as SectionChild[];
  } else if (blockType === "row") {
    base.columns = childNodes
      .map(blockFromNode)
      .filter((b): b is ColumnBlock => b != null && b.type === "column");
  } else if (blockType === "column") {
    base.children = childNodes
      .map(blockFromNode)
      .filter((b): b is SectionChild => b != null && b.type !== "column");
  } else {
    const textField = textFieldFor(blockType);
    if (textField) {
      if (blockType === "text" || blockType === "heading") {
        const runs = readRuns(node);
        const plain = runsToPlainText(runs);
        base.text = plain;
        // Keep `content` when there's inline formatting OR any variable atom, so
        // plain paragraphs stay plain (smaller docs, exact round-trip with old
        // data) but styled/variable runs are preserved.
        const needsRuns = runs.some((r) => r.marks || r.variable);
        base.content = needsRuns ? runs : undefined;
      } else {
        base[textField] = runsToPlainText(readRuns(node));
      }
    }
  }

  return base as unknown as Block | ColumnBlock;
}

// Convert a TipTap `doc` back into an EmailDocument. `prevDoc` supplies the
// document-level fields (theme/variables/previewText/category) that aren't
// represented in TipTap. The result is re-parsed through EmailDocumentSchema so
// it is always valid (defaults filled, unknown keys stripped).
export function tiptapToDoc(
  json: TiptapDoc | TiptapNode,
  prevDoc: EmailDocument,
): EmailDocument {
  const content = json.content ?? [];
  // Drop the always-present trailing empty text line(s) the canvas keeps as its
  // "start your next element here" affordance (see EnsureTrailingLine): it's an
  // authoring-only placeholder and must never persist or ship in a sent email
  // (it would render as a stray empty <p> / phantom bottom whitespace). The
  // editor invariant keeps exactly ONE such line, but we defensively strip ALL
  // trailing empty top-level text nodes here. A lone empty doc keeps its single
  // line so the schema still has a block to seed from — real empty lines the
  // author put BETWEEN content are untouched (only the trailing run is removed).
  let end = content.length;
  while (end > 1 && isEmptyTextNode(content[end - 1])) end--;
  const trimmed = end === content.length ? content : content.slice(0, end);
  const blocks = trimmed
    .map(blockFromNode)
    .filter((b): b is Block => b != null && b.type !== "column");

  return EmailDocumentSchema.parse({
    version: prevDoc.version,
    previewText: prevDoc.previewText,
    category: prevDoc.category,
    openTracking: prevDoc.openTracking,
    clickTracking: prevDoc.clickTracking,
    tracking: prevDoc.tracking,
    from: prevDoc.from,
    theme: prevDoc.theme,
    variables: prevDoc.variables,
    className: prevDoc.className,
    blocks,
  });
}

// Internal-only export for tests/consumers that need the node-name maps.
export const __tiptapMaps = { BLOCK_TO_NODE, NODE_TO_BLOCK } as const;
