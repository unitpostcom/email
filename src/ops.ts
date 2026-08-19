import type {
  Block,
  ColumnBlock,
  EmailDocument,
  LeafBlock,
  RowBlock,
  SectionBlock,
  SectionChild,
} from "./schema";
import { LEAF_BLOCK_TYPES } from "./schema";

// Pure, immutable operations on the canonical document tree. Used by the visual
// builder (and available to any consumer) so tree edits stay consistent across
// arbitrary nesting: body > Section* (recursive) and body > Row > Column > leaf.

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const LEAF_SET = new Set<string>(LEAF_BLOCK_TYPES);
export function isLeafType(type: string): boolean {
  return LEAF_SET.has(type);
}

export function appendBlock(doc: EmailDocument, block: Block): EmailDocument {
  return { ...doc, blocks: [...doc.blocks, block] };
}

// ---------------------------------------------------------------------------
// Recursive find / update / remove
// ---------------------------------------------------------------------------

// Find a block by id anywhere in the tree (top-level, nested section child,
// or row > column > child). Returns the node (a copy is NOT made).
export function findBlock(
  doc: EmailDocument,
  id: string,
): Block | ColumnBlock | null {
  return findInList(doc.blocks, id);
}

function findInList(
  list: Array<Block | ColumnBlock | SectionChild>,
  id: string,
): Block | ColumnBlock | null {
  for (const b of list) {
    const hit = findInNode(b, id);
    if (hit) return hit;
  }
  return null;
}

function findInNode(
  node: Block | ColumnBlock | SectionChild,
  id: string,
): Block | ColumnBlock | null {
  if (node.id === id) return node as Block | ColumnBlock;
  if (node.type === "section") {
    return findInList(node.children, id);
  }
  if (node.type === "row") {
    for (const col of node.columns) {
      if (col.id === id) return col;
      const hit = findInList(col.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

// Update a block by id, merging `patch`. Recurses through every container.
export function updateBlock(
  doc: EmailDocument,
  id: string,
  patch: Record<string, unknown>,
): EmailDocument {
  return { ...doc, blocks: doc.blocks.map((b) => updateNode(b, id, patch)) };
}

function updateNode<T extends { id: string; type: string }>(
  node: T,
  id: string,
  patch: Record<string, unknown>,
): T {
  if (node.id === id) return { ...clone(node), ...patch };
  if (node.type === "section") {
    const s = node as unknown as SectionBlock;
    return {
      ...s,
      children: s.children.map((c) => updateNode(c, id, patch)),
    } as unknown as T;
  }
  if (node.type === "row") {
    const r = node as unknown as RowBlock;
    return {
      ...r,
      columns: r.columns.map((col) =>
        col.id === id
          ? ({ ...clone(col), ...patch } as ColumnBlock)
          : {
              ...col,
              children: col.children.map((c) => updateNode(c, id, patch)),
            },
      ),
    } as unknown as T;
  }
  return node;
}

// Remove a block by id from anywhere in the tree.
export function removeBlock(doc: EmailDocument, id: string): EmailDocument {
  return { ...doc, blocks: removeFromList(doc.blocks, id) as Block[] };
}

function removeFromList<T extends { id: string; type: string }>(
  list: T[],
  id: string,
): T[] {
  return list
    .filter((b) => b.id !== id)
    .map((b) => removeWithin(b, id));
}

function removeWithin<T extends { id: string; type: string }>(
  node: T,
  id: string,
): T {
  if (node.type === "section") {
    const s = node as unknown as SectionBlock;
    return {
      ...s,
      children: removeFromList(s.children as SectionChild[], id),
    } as unknown as T;
  }
  if (node.type === "row") {
    const r = node as unknown as RowBlock;
    return {
      ...r,
      columns: r.columns.map((col) => ({
        ...col,
        children: col.children.filter((c) => c.id !== id),
      })),
    } as unknown as T;
  }
  return node;
}

// ---------------------------------------------------------------------------
// Append helpers (kept for back-compat with existing callers)
// ---------------------------------------------------------------------------

// Add a leaf or nested section to a section's children.
export function appendToSection(
  doc: EmailDocument,
  sectionId: string,
  child: SectionChild,
): EmailDocument {
  return {
    ...doc,
    blocks: doc.blocks.map((b) => appendToSectionNode(b, sectionId, child)),
  };
}

function appendToSectionNode<T extends { id: string; type: string }>(
  node: T,
  sectionId: string,
  child: SectionChild,
): T {
  if (node.type === "section") {
    const s = node as unknown as SectionBlock;
    if (s.id === sectionId) {
      return { ...s, children: [...s.children, child] } as unknown as T;
    }
    return {
      ...s,
      children: s.children.map((c) =>
        appendToSectionNode(c, sectionId, child),
      ),
    } as unknown as T;
  }
  return node;
}

// Add a leaf block to a specific column (within a row).
export function appendToColumn(
  doc: EmailDocument,
  columnId: string,
  child: LeafBlock,
): EmailDocument {
  const blocks = doc.blocks.map((b) => {
    if (b.type !== "row") return b;
    return {
      ...b,
      columns: b.columns.map((col) =>
        col.id === columnId
          ? { ...col, children: [...col.children, child] }
          : col,
      ),
    } satisfies RowBlock;
  });
  return { ...doc, blocks };
}

// ---------------------------------------------------------------------------
// Move (the heart of drag-and-drop)
// ---------------------------------------------------------------------------

// Where a moved node should land. `containerId` is "root" for the top-level
// body, or the id of a Section / Column. `index` is the position within that
// container's child list.
export type MoveTarget = {
  containerId: string | "root";
  index: number;
};

// Move a top-level block from one index to another (reorder). Thin wrapper over
// moveNode for back-compat with existing callers.
export function moveBlock(
  doc: EmailDocument,
  from: number,
  to: number,
): EmailDocument {
  if (from === to || from < 0 || to < 0) return doc;
  const blocks = [...doc.blocks];
  if (from >= blocks.length || to >= blocks.length) return doc;
  const [moved] = blocks.splice(from, 1);
  blocks.splice(to, 0, moved);
  return { ...doc, blocks };
}

// Container kind for a given id ("root" or the node type), used to validate a
// proposed drop.
function containerKind(
  doc: EmailDocument,
  containerId: string | "root",
): "root" | "section" | "column" | null {
  if (containerId === "root") return "root";
  const node = findBlock(doc, containerId);
  if (!node) return null;
  if (node.type === "section") return "section";
  if (node.type === "column") return "column";
  return null;
}

// Is `maybeAncestorId` an ancestor of (or equal to) `nodeId`? Used to reject
// dropping a container into its own descendant (which would orphan the tree).
function isSelfOrDescendant(
  node: Block | ColumnBlock,
  targetId: string,
): boolean {
  if (node.id === targetId) return true;
  if (node.type === "section") {
    return node.children.some((c) => isSelfOrDescendant(c, targetId));
  }
  if (node.type === "row") {
    return node.columns.some(
      (col) =>
        col.id === targetId ||
        col.children.some((c) => isSelfOrDescendant(c, targetId)),
    );
  }
  return false;
}

// Validate whether `node` may be dropped into a container of the given kind.
//   - root:    any top-level block (section, row, or leaf)
//   - section: leaf blocks OR sections (no rows; keep rows top-level)
//   - column:  leaf blocks only (no containers inside a column)
function canDrop(
  node: Block | ColumnBlock,
  kind: "root" | "section" | "column",
): boolean {
  if (node.type === "column") return false; // columns never move independently
  if (kind === "root") return true;
  if (kind === "section") return node.type === "section" || isLeafType(node.type);
  if (kind === "column") return isLeafType(node.type);
  return false;
}

// Move a node (by id) to a target container + index. Returns the doc unchanged
// if the move is invalid (wrong container kind, or dropping into own subtree).
export function moveNode(
  doc: EmailDocument,
  sourceId: string,
  target: MoveTarget,
): EmailDocument {
  const node = findBlock(doc, sourceId);
  if (!node || node.type === "column") return doc;

  const kind = containerKind(doc, target.containerId);
  if (!kind) return doc;
  if (!canDrop(node, kind)) return doc;

  // Reject dropping a container into itself or a descendant.
  if (
    target.containerId !== "root" &&
    isSelfOrDescendant(node, target.containerId)
  ) {
    return doc;
  }

  // Detach a deep copy so we don't share references after re-inserting.
  const detached = clone(node) as Block;
  const without = removeBlock(doc, sourceId);
  return insertInto(without, target, detached);
}

function insertInto(
  doc: EmailDocument,
  target: MoveTarget,
  node: Block,
): EmailDocument {
  if (target.containerId === "root") {
    const blocks = [...doc.blocks];
    const idx = clampIndex(target.index, blocks.length);
    blocks.splice(idx, 0, node);
    return { ...doc, blocks };
  }
  return {
    ...doc,
    blocks: doc.blocks.map((b) => insertIntoNode(b, target, node)),
  };
}

function insertIntoNode<T extends { id: string; type: string }>(
  current: T,
  target: MoveTarget,
  node: Block,
): T {
  if (current.type === "section") {
    const s = current as unknown as SectionBlock;
    if (s.id === target.containerId) {
      const children = [...s.children];
      const idx = clampIndex(target.index, children.length);
      children.splice(idx, 0, node as SectionChild);
      return { ...s, children } as unknown as T;
    }
    return {
      ...s,
      children: s.children.map((c) => insertIntoNode(c, target, node)),
    } as unknown as T;
  }
  if (current.type === "row") {
    const r = current as unknown as RowBlock;
    return {
      ...r,
      columns: r.columns.map((col) => {
        if (col.id !== target.containerId) return col;
        const children = [...col.children];
        const idx = clampIndex(target.index, children.length);
        children.splice(idx, 0, node as LeafBlock);
        return { ...col, children };
      }),
    } as unknown as T;
  }
  return current;
}

function clampIndex(index: number, length: number): number {
  if (index < 0) return 0;
  if (index > length) return length;
  return index;
}
