import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToHtml } from "./render";
import { parseDocument } from "./schema";
import { SIMPLE_EMAIL_THEME, normalizeSimpleDocument } from "./simple";
import { cssValue } from "./util";

// 2026-10-13: author-controlled style values (a run's colour / font /
// highlight, a block's customCss, the page theme) were interpolated raw into
// style="…", so `red" onmouseover="…` added an event handler to the sent
// email — past sanitizeDesignHtml, which only cleans html blocks. Every
// rendered tag must carry only the attributes the renderer wrote.

const EVIL = 'red" onmouseover="alert(1)';

function handlerAttributes(html: string): string[] {
  const found: string[] = [];
  for (const tag of html.matchAll(/<[a-zA-Z][^>]*>/g)) {
    for (const attr of tag[0].matchAll(/\s([a-zA-Z-]+)=("[^"]*"|'[^']*'|[^\s>]+)/g)) {
      if (attr[1]!.toLowerCase().startsWith("on")) found.push(tag[0]);
    }
  }
  return found;
}

function textWithRunStyle(marks: Record<string, unknown>) {
  return { type: "text", id: "t", text: "hi", marginBottom: 0, content: [{ text: "hi", marks }] };
}

test("cssValue keeps a value inside its attribute and declaration", () => {
  assert.equal(cssValue(EVIL), "red onmouseover=alert(1)");
  assert.equal(cssValue("#cc0000"), "#cc0000");
  assert.equal(cssValue("'Segoe UI', Arial, sans-serif"), "'Segoe UI', Arial, sans-serif");
  assert.equal(cssValue("red;position:fixed"), "redposition:fixed");
});

test("Simple: a run's colour, highlight or font can't add an attribute", () => {
  const doc = parseDocument({
    version: 5,
    compositionMode: "simple",
    theme: SIMPLE_EMAIL_THEME,
    blocks: [textWithRunStyle({ color: EVIL, background: EVIL, fontFamily: EVIL }), { type: "text", id: "l", text: "x", color: EVIL, marginBottom: 0 }],
  });
  assert.deepEqual(handlerAttributes(renderToHtml(doc, {}, { showPoweredBy: false })), []);
});

test("Designed: run styles, customCss and theme colours can't add an attribute", () => {
  const doc = parseDocument({
    version: 5,
    theme: { linkColor: EVIL, backgroundColor: EVIL, fontFamily: EVIL },
    blocks: [
      textWithRunStyle({ color: EVIL, background: EVIL, fontFamily: EVIL, link: "https://x.example" }),
      { type: "text", id: "c", text: "custom", customCss: 'color:red" onclick="x' },
      { type: "button", id: "b", text: "Go", href: "https://x.example", backgroundColor: EVIL, textColor: EVIL },
      { type: "markdown", id: "m", markdown: "[link](https://x.example)" },
    ],
  });
  assert.deepEqual(handlerAttributes(renderToHtml(doc, {}, { showPoweredBy: true })), []);
});

test("the Simple validator stores only real colours", () => {
  const result = normalizeSimpleDocument(
    parseDocument({
      version: 5,
      compositionMode: "simple",
      theme: SIMPLE_EMAIL_THEME,
      blocks: [textWithRunStyle({ color: EVIL, background: "#fff3a0" })],
    }),
  );
  const [line] = result.doc.blocks;
  assert.deepEqual(line!.type === "text" ? line.content : null, [{ text: "hi", marks: { background: "#fff3a0" } }]);
  assert.ok(result.changes.includes("Removed 1 colour value that isn't a colour"));
});
