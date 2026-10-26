import assert from "node:assert/strict";
import { test } from "node:test";

import { rowEmptyShare } from "./blocks";
import { parseTsx } from "./codec";
import { renderToHtml } from "./render";

// 2026-10-26: a single column set to 50% stayed full width, on the canvas and
// in the sent email, because widths were only proportions of the row.

test("columns that leave part of the row empty leave it empty; rounding doesn't", () => {
  assert.equal(rowEmptyShare([{ width: 50 }]), 50);
  assert.equal(rowEmptyShare([{ width: 30 }, { width: 30 }]), 40);
  assert.equal(rowEmptyShare([{ width: 33 }, { width: 33 }, { width: 33 }]), 0);
  assert.equal(rowEmptyShare([{ width: 50 }, { width: 50 }]), 0);
  assert.equal(rowEmptyShare([{ width: 60 }, { width: 60 }]), 0);
  assert.equal(rowEmptyShare([{}, {}]), 0);
  assert.equal(rowEmptyShare([]), 0);
});

test("a half-width column renders next to an empty cell that takes the other half", () => {
  const html = renderToHtml(parseTsx(`<Row column-gap={8}><Column width={50}><Text>Logo</Text></Column></Row>`));
  assert.match(html, /<td class="ee-col" width="50%"[^>]*>[\s\S]*?<\/td><td class="ee-gap"[^>]*>&nbsp;<\/td><td class="ee-gap" width="50%"/);
});

test("a row its columns fill gets no extra cell", () => {
  const html = renderToHtml(parseTsx(`<Row><Column width={50}><Text>A</Text></Column><Column width={50}><Text>B</Text></Column></Row>`));
  assert.doesNotMatch(html, /class="ee-gap" width="/);
});
