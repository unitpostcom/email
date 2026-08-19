import assert from "node:assert/strict";
import { test } from "node:test";

import { collectDocumentWarnings } from "./diagnostics";
import { parseDocument } from "./schema";

// Build a minimal valid document with a single block carrying the given fields.
function docWith(block: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return parseDocument({
    blocks: [block],
    ...extra,
  });
}

test("flags unsupported Tailwind classes on a block, naming them", () => {
  const doc = docWith({
    type: "text",
    id: "t1",
    content: [{ text: "Hi" }],
    className: "p-4 flex shadow-lg",
  });
  const warnings = collectDocumentWarnings(doc);
  const w = warnings.find((x) => x.kind === "unknown-classes");
  assert.ok(w, "expected an unknown-classes warning");
  assert.equal(w!.blockId, "t1");
  assert.match(w!.detail, /flex/);
  assert.match(w!.detail, /shadow-lg/);
  // p-4 is supported, so it must NOT appear in the warning.
  assert.doesNotMatch(w!.detail, /p-4/);
});

test("clean document produces no warnings", () => {
  const doc = docWith({
    type: "text",
    id: "t1",
    content: [{ text: "Hi" }],
    className: "p-4 text-white",
  });
  assert.deepEqual(collectDocumentWarnings(doc), []);
});

test("flags unsafe HTML in an html block", () => {
  const doc = docWith({
    type: "html",
    id: "h1",
    html: `<div onclick="alert(1)"><script>evil()</script>ok</div>`,
  });
  const warnings = collectDocumentWarnings(doc);
  const w = warnings.find((x) => x.kind === "unsafe-html");
  assert.ok(w, "expected an unsafe-html warning");
  assert.equal(w!.blockId, "h1");
});

test("marketing email with no unsubscribe reference is NOT flagged (footer enforced)", () => {
  // The compliance footer (with a working unsubscribe) is auto-appended to every
  // marketing email, so a missing {{unsubscribe_url}} is not actionable and must
  // not surface as a warning.
  const doc = docWith(
    { type: "text", id: "t1", content: [{ text: "Sale!" }] },
    { category: "marketing" },
  );
  const w = collectDocumentWarnings(doc).find(
    (x) => x.title === "No unsubscribe link",
  );
  assert.equal(w, undefined);
});

test("walks into row > column > leaf children", () => {
  const doc = docWith({
    type: "row",
    id: "r1",
    columns: [
      {
        type: "column",
        id: "c1",
        children: [
          {
            type: "text",
            id: "t1",
            content: [{ text: "Hi" }],
            className: "grid",
          },
        ],
      },
    ],
  });
  const w = collectDocumentWarnings(doc).find(
    (x) => x.kind === "unknown-classes" && x.blockId === "t1",
  );
  assert.ok(w, "expected nested block class warning");
  assert.match(w!.detail, /grid/);
});

test("flags unsupported classes on the document body className", () => {
  const doc = docWith(
    { type: "text", id: "t1", content: [{ text: "Hi" }] },
    { className: "flex" },
  );
  const w = collectDocumentWarnings(doc).find(
    (x) => x.kind === "unknown-classes" && x.blockId === null,
  );
  assert.ok(w, "expected document-level class warning");
  assert.equal(w!.blockLabel, "Email body");
});
