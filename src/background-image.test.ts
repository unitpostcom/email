// Section backgroundImage and Row insetX (0.6.0): optional, additive props.
// A document without them must render byte-for-byte as before (golden.json
// pins every sample and layout); these tests pin what the props add.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createElement as h } from "react";

import { parseTsxDocument, printTsx } from "./codec";
import { lintEmailDesign } from "./design-lint";
import { Column, Email, Heading, Row, Section, fromJsx } from "./react";
import { renderToHtml, resolveVariables } from "./render";
import { docToTiptap, tiptapToDoc } from "./tiptap";
import { EmailDocumentSchema, type EmailDocument } from "./schema";

const PHOTO = "https://images.example.com/peaks.jpg?w=1072&h=640&fit=crop";

const doc = (blocks: unknown[], theme: Record<string, unknown> = { bodyPadding: 0, contentWidth: 600 }): EmailDocument =>
  EmailDocumentSchema.parse({ theme, blocks });

/** Blocks without their ids: parseTsx assigns fresh ones, by design. */
const noIds = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(noIds) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== "id").map(([k, x]) => [k, noIds(x)])) : v;

const heroSection = (extra: Record<string, unknown> = {}) => ({
  type: "section",
  id: "hero",
  backgroundColor: "#1e3a5f",
  paddingX: 32,
  paddingY: 56,
  children: [{ type: "heading", id: "h", level: 1, text: "Above the clouds", color: "#ffffff" }],
  ...extra,
});

describe("Section backgroundImage", () => {
  test("a section without one renders exactly as it did", () => {
    const plain = renderToHtml(doc([heroSection()]));
    assert.doesNotMatch(plain, /background-image|v:rect|background="/);
  });

  test("the picture goes in the CSS, the background attribute and Outlook VML; the colour in bgcolor and CSS", () => {
    const html = renderToHtml(doc([heroSection({ backgroundImage: { src: PHOTO, size: "cover", position: "top" } })]));
    assert.match(html, /background="https:\/\/images\.example\.com\/peaks\.jpg\?w=1072&amp;h=640&amp;fit=crop"/);
    assert.match(html, /bgcolor="#1e3a5f"/);
    assert.match(html, /background-image:url\('https:\/\/images\.example\.com\/peaks\.jpg\?w=1072&h=640&fit=crop'\)/);
    assert.match(html, /background-size:cover;background-position:top;background-repeat:no-repeat/);
    assert.match(html, /<!--\[if gte mso 9\]><v:rect [^>]*style="width:600px;"><v:fill type="frame" aspect="atleast" origin="0\.5,0" position="0\.5,0" src="[^"]+" color="#1e3a5f" \/>/);
    assert.match(html, /<\/v:textbox><\/v:rect><!\[endif\]-->/);
    // The padding moves inside the VML shape, so Outlook paints under it too.
    assert.match(html, /<v:textbox [^>]*><!\[endif\]--><table [^>]*><tr><td style="padding:56px 32px">/);
  });

  test("a URL can't close url('…') or smuggle a declaration in through an entity", () => {
    const evil = "https://x.example/a.png?q=1')position:fixed&#59top:0;(";
    const html = renderToHtml(doc([heroSection({ backgroundImage: { src: evil } })]));
    const css = html.match(/background-image:url\('([^']*)'\)/);
    assert.ok(css, "the url() stays closed on our own quote");
    assert.doesNotMatch(css[1], /[()'"]/);
    assert.match(css[1], /%27%29position:fixed%26#59top:0%3B%28$/);
    assert.doesNotMatch(html, /position:fixed;/);
  });

  test("characters the style scrubber strips can't rejoin an entity, and a ; stays in the URL", () => {
    const sneaky = "https://x.test/a&{#39&{#41&{#59position:fixed&{#59/&{#42";
    const html = renderToHtml(doc([heroSection({ backgroundImage: { src: sneaky } })]));
    const css = html.match(/background-image:url\('([^']*)'\)/);
    assert.ok(css);
    assert.doesNotMatch(css[1], /&#/);
    assert.doesNotMatch(html, /position:fixed;/);
    const semi = renderToHtml(doc([heroSection({ backgroundImage: { src: "https://cdn.example.com/a;b.png" } })]));
    assert.match(semi, /url\('https:\/\/cdn\.example\.com\/a%3Bb\.png'\)/);
  });

  test("a data: image goes in the background attribute and VML, never a broken CSS url()", () => {
    const data = "data:image/png;base64,iVBORw0KGgo=";
    const html = renderToHtml(doc([heroSection({ backgroundImage: { src: data } })]));
    assert.doesNotMatch(html, /background-image:/);
    assert.match(html, /background="data:image\/png;base64,iVBORw0KGgo="/);
    assert.match(html, /<v:fill [^>]*src="data:image\/png;base64,iVBORw0KGgo="/);
  });

  test("a {{variable}} in the URL is referenced: resolved when supplied, reported when missing", () => {
    const d = doc([{ type: "section", id: "band", children: [heroSection({ backgroundImage: { src: "https://cdn.example.com/{{hero_key}}.jpg" } })] }]);
    assert.deepEqual(resolveVariables(d, {}).missing, ["hero_key"]);
    const { values, missing } = resolveVariables(d, { hero_key: "spring" });
    assert.deepEqual(missing, []);
    assert.match(renderToHtml(d, values), /url\('https:\/\/cdn\.example\.com\/spring\.jpg'\)/);
  });

  test("the VML shape is as wide as the cell it fills: nested inside a padded band, it narrows", () => {
    const html = renderToHtml(doc([{ type: "section", id: "band", paddingX: 32, paddingY: 8, children: [heroSection({ backgroundImage: { src: PHOTO } })] }]));
    assert.match(html, /style="width:536px;"/);
  });

  test("repeat tiles; contain fits the whole picture", () => {
    assert.match(renderToHtml(doc([heroSection({ backgroundImage: { src: PHOTO, repeat: "repeat" } })])), /<v:fill type="tile" src=/);
    assert.match(renderToHtml(doc([heroSection({ backgroundImage: { src: PHOTO, size: "contain" } })])), /aspect="atmost"/);
  });

  test("a src that isn't a safe image URL is dropped and the section renders plain", () => {
    const html = renderToHtml(doc([heroSection({ backgroundImage: { src: "javascript:alert(1)" } })]));
    assert.doesNotMatch(html, /javascript:|v:rect|background="/);
  });

  test("a library image path resolves against the asset host, like an <Image>", () => {
    const html = renderToHtml(doc([heroSection({ backgroundImage: { src: "/img/0b9c2a8e-1111-4222-8333-444455556666" } })]), {}, { assetBaseUrl: "https://assets.example.com" });
    assert.match(html, /background="https:\/\/assets\.example\.com\/img\/0b9c2a8e-1111-4222-8333-444455556666"/);
  });

  test("round-trips through TSX as background-image={{ … }}", () => {
    const d = doc([heroSection({ backgroundImage: { src: PHOTO, size: "cover", position: "bottom right" } })]);
    const tsx = printTsx(d, { document: true });
    assert.match(tsx, /background-image=\{\{ src: "https:\/\/images\.example\.com\/peaks\.jpg\?w=1072&h=640&fit=crop", size: "cover", position: "bottom right", repeat: "no-repeat" \}\}/);
    const back = parseTsxDocument(tsx);
    assert.deepEqual(back.warnings, []);
    assert.deepEqual(noIds(back.doc.blocks[0]), noIds(d.blocks[0]));
  });

  test("React: <Section backgroundImage={{ … }}> carries it", () => {
    const parsed = fromJsx(h(Email, null, h(Section, { backgroundColor: "#1e3a5f", backgroundImage: { src: PHOTO } }, h(Heading, { level: 1 }, "Hi"))) as never) as unknown as EmailDocument;
    const section = parsed.blocks[0] as { backgroundImage?: { src: string; size: string } };
    assert.equal(section.backgroundImage?.src, PHOTO);
    assert.equal(section.backgroundImage?.size, "cover");
  });

  test("lint: a background image needs a background colour behind it", () => {
    const missing = lintEmailDesign(doc([heroSection({ backgroundColor: undefined, backgroundImage: { src: PHOTO } })]));
    assert.ok(missing.some((x) => x.rule === "background-image-fallback" && x.severity === "fix"));
    const set = lintEmailDesign(doc([heroSection({ backgroundImage: { src: PHOTO } })]));
    assert.ok(!set.some((x) => x.rule === "background-image-fallback"));
  });
});

describe("Row insetX", () => {
  const row = (extra: Record<string, unknown> = {}) => ({
    type: "row",
    id: "r",
    backgroundColor: "#eef2ff",
    columns: [
      { type: "column", id: "a", width: 50, children: [{ type: "text", id: "t1", text: "Left" }] },
      { type: "column", id: "b", width: 50, children: [{ type: "text", id: "t2", text: "Right" }] },
    ],
    ...extra,
  });

  test("unset renders as before; set wraps the row in a padded cell", () => {
    const plain = renderToHtml(doc([row()]));
    const inset = renderToHtml(doc([row({ insetX: 32 })]));
    assert.doesNotMatch(plain, /padding:0 32px;/);
    assert.match(inset, /<td style="padding:0 32px;"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" id="r"|<td style="padding:0 32px;"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"[^>]*style="background-color:#eef2ff/);
  });

  test("round-trips through TSX as inset-x and React as insetX", () => {
    const d = doc([row({ insetX: 24 })]);
    const tsx = printTsx(d, { document: true });
    assert.match(tsx, /inset-x=\{24\}/);
    assert.deepEqual(noIds(parseTsxDocument(tsx).doc.blocks[0]), noIds(d.blocks[0]));
    const parsed = fromJsx(h(Email, null, h(Row, { insetX: 24 }, h(Column, { width: 100 }, h(Heading, { level: 2 }, "x")))) as never) as unknown as EmailDocument;
    assert.equal((parsed.blocks[0] as { insetX?: number }).insetX, 24);
  });
});

describe("the visual editor keeps both props", () => {
  test("a section's backgroundImage and a row's insetX survive the editor's TipTap round trip", () => {
    const d = doc([
      heroSection({ backgroundImage: { src: PHOTO, size: "cover", position: "top" } }),
      { type: "row", id: "r", insetX: 32, backgroundColor: "#eef2ff", columns: [{ type: "column", id: "c", width: 100, children: [{ type: "text", id: "t", text: "Hi" }] }] },
    ]);
    const back = tiptapToDoc(docToTiptap(d), d);
    // JSON drops the `content: undefined` keys the conversion adds to text blocks (unrelated to these props).
    assert.deepEqual(JSON.parse(JSON.stringify(noIds(back.blocks))), JSON.parse(JSON.stringify(noIds(d.blocks))));
  });
});
