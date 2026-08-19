import assert from "node:assert/strict";
import { test } from "node:test";

import { compileClasses, rulesToCss } from "./tw-compile";
import { cssToUtilities } from "./util";
import { parseDocument } from "./schema";
import { renderToHtml } from "./render";
import { parseTsx, printTsx } from "./codec";

// --- compileClasses: inlinable utilities -----------------------------------

test("inlinable utilities compile to a flat declaration map", () => {
  const { inline, rules, unknown, className } = compileClasses(
    "p-4 text-white bg-blue-600 rounded-lg",
  );
  assert.equal(inline["padding"], "16px");
  assert.equal(inline["color"], "#ffffff");
  assert.equal(inline["background-color"], "#2563eb");
  assert.equal(inline["border-radius"], "8px");
  assert.deepEqual(rules, []);
  assert.deepEqual(unknown, []);
  assert.equal(className, "");
});

test("later utilities win over earlier on the same property", () => {
  const { inline } = compileClasses("p-2 p-8");
  assert.equal(inline["padding"], "32px");
});

test("arbitrary values are supported", () => {
  const { inline } = compileClasses("text-[13px] rounded-[10px] text-[#abcdef]");
  assert.equal(inline["font-size"], "13px");
  assert.equal(inline["border-radius"], "10px");
  assert.equal(inline["color"], "#abcdef");
});

test("unknown utilities are collected, not thrown", () => {
  const { unknown, inline } = compileClasses("p-4 not-a-real-class grid-flow-row");
  assert.equal(inline["padding"], "16px");
  assert.deepEqual(unknown, ["not-a-real-class", "grid-flow-row"]);
});

// --- compileClasses: responsive / pseudo (hoisted) --------------------------

test("responsive + pseudo utilities hoist to rules with a generated class", () => {
  const compiled = compileClasses("text-base sm:hidden hover:underline");
  // base utility stays inline:
  assert.equal(compiled.inline["font-size"], "16px");
  // a class is generated so the hoisted selectors can target the element:
  assert.match(compiled.className, /^tw-/);
  assert.equal(compiled.rules.length, 2);

  const css = rulesToCss(compiled.rules);
  assert.match(css, /@media only screen and \(max-width:600px\)/);
  assert.match(css, /display:none;/);
  assert.match(css, /:hover\{text-decoration:underline;\}/);
});

test("identical className inputs produce a stable generated class", () => {
  const a = compileClasses("sm:hidden");
  const b = compileClasses("sm:hidden");
  assert.equal(a.className, b.className);
});

// --- Renderer precedence: className < schema props < customCss --------------

test("explicit schema style props win over compiled className", () => {
  // Text block with an EXPLICIT color set should beat a className color util.
  const doc = parseDocument({
    version: 5,
    blocks: [
      {
        type: "text",
        id: "t1",
        text: "Hi",
        align: "left",
        fontSize: 16,
        color: "#111111",
        className: "text-red-500",
      },
    ],
  });
  const html = renderToHtml(doc);
  assert.match(html, /color:#111111/);
  assert.doesNotMatch(html, /#ef4444/);
});

test("className color beats the theme DEFAULT when no explicit prop is set", () => {
  // No explicit `color` on the block → className `text-red-500` should win over
  // the theme's default text color (locked precedence: theme < className).
  const doc = parseDocument({
    version: 5,
    blocks: [
      {
        type: "text",
        id: "t1",
        text: "Hi",
        align: "left",
        fontSize: 16,
        className: "text-red-500",
      },
    ],
  });
  const html = renderToHtml(doc);
  assert.match(html, /color:#ef4444/);
});

test("document className hoisted rules land in <head><style>", () => {
  const doc = parseDocument({
    version: 5,
    className: "sm:hidden",
    blocks: [{ type: "text", id: "t1", text: "hi", align: "left" }],
  });
  const html = renderToHtml(doc);
  assert.match(html, /<style[^>]*>[\s\S]*max-width:600px[\s\S]*<\/style>/);
});

// --- cssToUtilities ---------------------------------------------------------

test("cssToUtilities converts known declarations and keeps leftovers", () => {
  const { utilities, leftover } = cssToUtilities(
    "padding: 16px; text-align: center; letter-spacing: 0.5px;",
  );
  assert.match(utilities, /p-4/);
  assert.match(utilities, /text-center/);
  // letter-spacing has no curated util here → stays as leftover CSS:
  assert.match(leftover, /letter-spacing/);
});

// --- Codec round-trip: className survives parse/print -----------------------

test("codec round-trips className on blocks", () => {
  const doc = parseDocument({
    version: 5,
    blocks: [
      {
        type: "text",
        id: "t1",
        text: "Hello",
        align: "left",
        className: "text-lg font-bold sm:hidden",
      },
    ],
  });
  const tsx = printTsx(doc);
  assert.match(tsx, /className="text-lg font-bold sm:hidden"/);
  const back = parseTsx(tsx);
  assert.equal(back.blocks[0].className, "text-lg font-bold sm:hidden");
});

test("codec accepts class= and tw= aliases and normalizes to className", () => {
  const fromClass = parseTsx('<Text class="text-lg">Hi</Text>');
  assert.equal(fromClass.blocks[0].className, "text-lg");
  const fromTw = parseTsx('<Text tw="text-lg">Hi</Text>');
  assert.equal(fromTw.blocks[0].className, "text-lg");
});

test("parseTsx preserves base document metadata (theme/category/etc), swapping only blocks", () => {
  // The Code editor round-trips: it re-parses the TSX on every keystroke and
  // feeds the result back as the document. The TSX only encodes the block tree
  // — theme, category, previewText, from, and variables live OUTSIDE the code.
  // Without a base doc, parseTsx would reset those to schema defaults, silently
  // wiping the user's body background (→ white) and category (→ transactional).
  const base = parseDocument({
    version: 1,
    category: "marketing",
    from: "hi@acme.test",
    previewText: "See what shipped",
    theme: { bodyColor: "#000000", backgroundColor: "#111111", bodyRadius: 12 },
    variables: [{ name: "first_name", type: "string", source: "contact" }],
    blocks: [{ type: "text", id: "old", text: "old body" }],
  });

  const next = parseTsx("<Text>brand new body</Text>", base);

  // Blocks come from the freshly parsed TSX...
  assert.equal(next.blocks.length, 1);
  assert.equal(next.blocks[0].type, "text");
  // ...but ALL non-block metadata is inherited from the base document.
  assert.equal(next.category, "marketing");
  assert.equal(next.from, "hi@acme.test");
  assert.equal(next.previewText, "See what shipped");
  assert.equal(next.theme.bodyColor, "#000000");
  assert.equal(next.theme.backgroundColor, "#111111");
  assert.equal(next.theme.bodyRadius, 12);
  assert.equal(next.variables[0]?.name, "first_name");

  // Without a base, the same code parses to a schema-default document (bodyColor
  // white, category default) — the regression this fix guards against.
  const bare = parseTsx("<Text>brand new body</Text>");
  assert.equal(bare.theme.bodyColor, "#ffffff");
  assert.notEqual(bare.category, "marketing");
});
