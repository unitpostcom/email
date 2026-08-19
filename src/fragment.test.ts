import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFragment } from "./schema";
import { fragmentToTiptap } from "./tiptap";
import { regenerateBlockIds } from "./blocks";

// A fragment with a nested row → columns → children tree, so id regeneration is
// exercised at every depth.
function sampleFragment() {
  return parseFragment({
    blocks: [
      { type: "heading", id: "h-1", text: "Hi" },
      {
        type: "row",
        id: "row-1",
        columns: [
          {
            type: "column",
            id: "col-1",
            width: 50,
            children: [{ type: "text", id: "t-1", text: "Left" }],
          },
          {
            type: "column",
            id: "col-2",
            width: 50,
            children: [{ type: "text", id: "t-2", text: "Right" }],
          },
        ],
      },
    ],
  });
}

test("regenerateBlockIds assigns fresh ids at every depth (deep, non-mutating)", () => {
  const frag = sampleFragment();
  const row = frag.blocks[1] as {
    id: string;
    columns: { id: string; children: { id: string }[] }[];
  };
  const next = regenerateBlockIds(row);

  // Top-level id changed.
  assert.notEqual(next.id, row.id);
  // Column ids changed.
  assert.notEqual(next.columns[0].id, row.columns[0].id);
  assert.notEqual(next.columns[1].id, row.columns[1].id);
  // Nested child ids changed.
  assert.notEqual(next.columns[0].children[0].id, row.columns[0].children[0].id);
  // Original is untouched (pure).
  assert.equal(row.id, "row-1");
  assert.equal(row.columns[0].id, "col-1");
  assert.equal(row.columns[0].children[0].id, "t-1");
});

test("fragmentToTiptap maps every top-level block to a node with a fresh id", () => {
  const frag = sampleFragment();
  const nodes = fragmentToTiptap(frag);

  assert.equal(nodes.length, frag.blocks.length);
  // Heading + row nodes, with ids that differ from the source (fresh).
  const ids = nodes.map((n) => n.attrs?.id as string);
  assert.ok(ids.every((id) => typeof id === "string" && id.length > 0));
  assert.notEqual(ids[0], "h-1");
  assert.notEqual(ids[1], "row-1");
  // Two inserts must not share ids (independent copies).
  const again = fragmentToTiptap(frag);
  assert.notEqual(again[0].attrs?.id, nodes[0].attrs?.id);
});

test("fragmentToTiptap can preserve ids when asked", () => {
  const frag = sampleFragment();
  const nodes = fragmentToTiptap(frag, { freshIds: false });
  assert.equal(nodes[0].attrs?.id, "h-1");
  assert.equal(nodes[1].attrs?.id, "row-1");
});

test("fragmentToTiptap on an empty fragment yields no nodes", () => {
  assert.deepEqual(fragmentToTiptap(parseFragment({ blocks: [] })), []);
});

// --- Component instance link (componentRef) --------------------------------

test("parseDocument round-trips componentRef on a block (instance tag)", async () => {
  const { parseDocument } = await import("./schema");
  const doc = parseDocument({
    blocks: [
      {
        type: "heading",
        id: "h-1",
        text: "Footer",
        componentRef: { id: "cmp_123", name: "Footer" },
      },
    ],
  });
  const ref = (doc.blocks[0] as { componentRef?: { id: string; name: string } })
    .componentRef;
  assert.deepEqual(ref, { id: "cmp_123", name: "Footer" });
});

test("parseDocument round-trips the unlocked editing flag on componentRef", async () => {
  const { parseDocument } = await import("./schema");
  const doc = parseDocument({
    blocks: [
      {
        type: "heading",
        id: "h-1",
        text: "Footer",
        componentRef: { id: "cmp_123", name: "Footer", unlocked: true },
      },
    ],
  });
  const ref = (
    doc.blocks[0] as { componentRef?: { unlocked?: boolean } }
  ).componentRef;
  assert.equal(ref?.unlocked, true);
});

test("blockToFragment strips componentRef from the block and its descendants", async () => {
  const { blockToFragment } = await import("./schema");
  const frag = blockToFragment({
    type: "section",
    id: "s-1",
    componentRef: { id: "cmp_1", name: "Hero" },
    children: [
      {
        type: "text",
        id: "t-1",
        text: "Inner",
        componentRef: { id: "cmp_1", name: "Hero" },
      },
    ],
  });
  const section = frag.blocks[0] as {
    componentRef?: unknown;
    children: { componentRef?: unknown }[];
  };
  assert.equal(section.componentRef, undefined);
  assert.equal(section.children[0].componentRef, undefined);
});

test("stripComponentRefs leaves other fields intact", async () => {
  const { stripComponentRefs } = await import("./schema");
  const out = stripComponentRefs({
    type: "button",
    id: "b-1",
    text: "Go",
    componentRef: { id: "x", name: "y" },
  }) as Record<string, unknown>;
  assert.equal(out.componentRef, undefined);
  assert.equal(out.text, "Go");
  assert.equal(out.id, "b-1");
});
