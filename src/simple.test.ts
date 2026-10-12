import assert from "node:assert/strict";
import { test } from "node:test";

import { docToTiptap, tiptapToDoc } from "./tiptap";
import { renderToHtml } from "./render";
import { renderToText } from "./text";
import { parseDocument } from "./schema";
import {
  designEmailDocument,
  simpleConversionNeedsConfirmation,
  simplifyEmailDocument,
} from "./simple";

test("old documents default to the designed authoring mode", () => {
  const doc = parseDocument({
    version: 4,
    blocks: [{ type: "text", id: "body", text: "Hello" }],
  });

  assert.equal(doc.compositionMode, "designed");
});

test("blank templates can enter Simple mode without a destructive warning", () => {
  const doc = parseDocument({
    version: 5,
    blocks: [{ type: "text", id: "body", text: "" }],
  });

  assert.equal(simpleConversionNeedsConfirmation(doc), false);
});

test("simplifying preserves readable content, variables, and links", () => {
  const designed = parseDocument({
    version: 5,
    previewText: "A useful preview",
    variables: [{ name: "first_name", type: "string", source: "contact" }],
    blocks: [
      {
        type: "section",
        id: "hero",
        backgroundColor: "#111111",
        children: [
          {
            type: "heading",
            id: "heading",
            text: "Hi {{first_name}}",
            content: [
              { text: "Hi " },
              { text: "{{first_name}}", variable: "first_name" },
            ],
          },
          {
            type: "button",
            id: "cta",
            text: "View account",
            href: "https://example.com/account",
          },
          {
            type: "image",
            id: "image",
            src: "https://example.com/hero.png",
            alt: "Product preview",
          },
        ],
      },
    ],
  });

  assert.equal(simpleConversionNeedsConfirmation(designed), true);
  const simple = simplifyEmailDocument(designed);
  assert.equal(simple.compositionMode, "simple");
  assert.equal(simple.previewText, "A useful preview");
  assert.deepEqual(simple.variables, designed.variables);
  // Former blocks are separated by a blank line (the composer's spacing unit
  // replaces the designed margins): heading, blank, link, blank, image.
  // (Until 2026-10-12 the image was flattened to an alt-text line; Simple now
  // keeps images — see render-simple.ts.)
  assert.deepEqual(
    simple.blocks.map((block) => block.type),
    ["heading", "text", "text", "text", "image"],
  );
  const image = simple.blocks[4];
  assert.equal(image?.type === "image" ? image.src : null, "https://example.com/hero.png");
  assert.equal(image?.type === "image" ? image.alt : null, "Product preview");
  assert.equal(simple.blocks[1]?.type === "text" ? simple.blocks[1].text : null, "");
  // Lines stack: no paragraph margin in Simple mode.
  assert.equal(simple.blocks[2]?.type === "text" ? simple.blocks[2].marginBottom : null, 0);
  const link = simple.blocks[2];
  assert.equal(link?.type, "text");
  assert.equal(
    link?.type === "text" ? link.content?.[0]?.marks?.link : undefined,
    "https://example.com/account",
  );

  const returned = designEmailDocument(simple);
  assert.equal(returned.compositionMode, "designed");
  assert.deepEqual(returned.blocks, simple.blocks);
});

test("TipTap edits preserve Simple mode metadata", () => {
  const simple = simplifyEmailDocument(
    parseDocument({
      version: 5,
      blocks: [{ type: "text", id: "body", text: "Hello" }],
    }),
  );
  const roundTrip = tiptapToDoc(docToTiptap(simple), simple);

  assert.equal(roundTrip.compositionMode, "simple");
  assert.equal(roundTrip.blocks[0]?.type, "text");
  assert.equal(
    roundTrip.blocks[0]?.type === "text" ? roundTrip.blocks[0].text : "",
    "Hello",
  );
});

// ---- Paragraphs, line breaks, and blank lines (Gmail-style composing) ------

test("Shift+Enter (hardBreak) round-trips as a newline inside the run and renders <br />", () => {
  const doc = parseDocument({
    version: 5,
    compositionMode: "simple",
    blocks: [
      {
        type: "text",
        id: "a",
        text: "Hi Sam,\nquick one:",
        content: [{ text: "Hi Sam,\nquick one:" }],
      },
    ],
  });
  // → TipTap: the run splits into text / hardBreak / text.
  const pm = docToTiptap(doc);
  const inline = (pm.content[0] as { content: Array<{ type: string; text?: string }> }).content;
  assert.deepEqual(inline.map((n) => n.type), ["text", "hardBreak", "text"]);
  // ← document: folded back into one run with the newline.
  const back = tiptapToDoc(pm, doc);
  const block = back.blocks[0]!;
  assert.equal(block.type, "text");
  if (block.type === "text") {
    // Plain runs collapse to `text` (the codec only keeps `content` when there
    // are marks or variables) — the newline survives either way.
    assert.equal(block.text, "Hi Sam,\nquick one:");
  }
  // HTML keeps it as a soft break; text/plain keeps the newline.
  const html = renderToHtml(back, {}, { showPoweredBy: false });
  // Simple renders the mail-client fragment: Gmail's <br>, not XHTML <br />.
  assert.match(html, /Hi Sam,<br>quick one:/);
  assert.match(renderToText(back, {}, { showPoweredBy: false }), /Hi Sam,\nquick one:/);
});

test("a break inside a bold run stays one bold run", () => {
  const doc = parseDocument({
    version: 5,
    blocks: [
      { type: "text", id: "a", text: "one\ntwo", content: [{ text: "one\ntwo", marks: { bold: true } }] },
    ],
  });
  const back = tiptapToDoc(docToTiptap(doc), doc);
  const block = back.blocks[0]!;
  if (block.type === "text") {
    assert.deepEqual(block.content, [{ text: "one\ntwo", marks: { bold: true } }]);
  }
  assert.match(renderToHtml(back, {}, { showPoweredBy: false }), /<strong>one<br \/>two<\/strong>/);
});

test("an intentionally blank paragraph keeps its line height in HTML", () => {
  const doc = parseDocument({
    version: 5,
    compositionMode: "simple",
    blocks: [
      { type: "text", id: "a", text: "First paragraph." },
      { type: "text", id: "b", text: "" },
      { type: "text", id: "c", text: "Second paragraph." },
    ],
  });
  const html = renderToHtml(doc, {}, { showPoweredBy: false });
  // Simple renders one <div> per line; a blank line is Gmail's <div><br></div>.
  const inner = html.replace(/^<div dir="ltr">/, "").replace(/<\/div>$/, "");
  const lines = inner.match(/<div(?: [^>]*)?>[\s\S]*?<\/div>/g) ?? [];
  assert.equal(lines.length, 3);
  assert.equal(lines[1], "<div><br></div>");
  // A paragraph holding only a dash is content, not a spacer.
  const dash = parseDocument({ version: 5, blocks: [{ type: "text", id: "d", text: "—" }] });
  assert.match(renderToHtml(dash, {}, { showPoweredBy: false }), />—<\/p>/);
});


test("in Simple mode a line typed on the canvas has no paragraph spacing", () => {
  const simple = parseDocument({ version: 5, compositionMode: "simple", blocks: [{ type: "text", id: "a", text: "Hi", marginBottom: 0 }] });
  // A new emailText node from Enter has no `data` yet (ProseMirror default).
  const pm = docToTiptap(simple);
  pm.content.push({ type: "emailText", attrs: { id: "b", data: {} }, content: [{ type: "text", text: "Next line" }] } as never);
  const back = tiptapToDoc(pm, simple);
  const line = back.blocks[1]!;
  assert.equal(line.type, "text");
  if (line.type === "text") assert.equal(line.marginBottom, 0);
  // The Designed editor keeps the schema default.
  const designed = parseDocument({ version: 5, blocks: [{ type: "text", id: "a", text: "Hi" }] });
  const pm2 = docToTiptap(designed);
  pm2.content.push({ type: "emailText", attrs: { id: "b", data: {} }, content: [{ type: "text", text: "Next" }] } as never);
  const back2 = tiptapToDoc(pm2, designed);
  const l2 = back2.blocks[1]!;
  if (l2.type === "text") assert.equal(l2.marginBottom, 16);
});

// ---------------------------------------------------------------------------
// Lists (Simple mode's bulleted / numbered toolbar buttons)
// ---------------------------------------------------------------------------

test("a list block round-trips through TipTap as bulletList/orderedList of text lines", () => {
  const doc = parseDocument({
    version: 5,
    compositionMode: "simple",
    blocks: [
      {
        type: "list",
        id: "l1",
        ordered: true,
        items: [
          { text: "first" },
          { text: "bold second", content: [{ text: "bold", marks: { bold: true } }, { text: " second" }] },
          { text: "hi {{first_name}}", content: [{ text: "hi " }, { text: "{{first_name}}", variable: "first_name" }] },
        ],
      },
    ],
  });
  const pm = docToTiptap(doc);
  const list = pm.content[0] as { type: string; attrs: { id: string }; content: Array<{ type: string; content: Array<{ type: string }> }> };
  assert.equal(list.type, "orderedList");
  assert.equal(list.attrs.id, "l1");
  assert.deepEqual(list.content.map((n) => n.type), ["listItem", "listItem", "listItem"]);
  assert.deepEqual(list.content[0]!.content.map((n) => n.type), ["emailText"]);

  const back = tiptapToDoc(pm, doc);
  const block = back.blocks[0]!;
  assert.equal(block.type, "list");
  if (block.type !== "list") return;
  assert.equal(block.id, "l1");
  assert.equal(block.ordered, true);
  assert.equal(block.items.length, 3);
  assert.equal(block.items[0]!.text, "first");
  assert.equal(block.items[0]!.content, undefined); // plain items stay `text`-only
  assert.deepEqual(block.items[1]!.content, [{ text: "bold", marks: { bold: true } }, { text: " second" }]);
  assert.equal(block.items[2]!.content?.[1]?.variable, "first_name");
  // An explicit/parsed margin is preserved as-is (only NEW lines get 0).
  assert.equal(block.marginBottom, 16);
});

test("a nested list typed in TipTap is flattened into sibling items", () => {
  const base = parseDocument({ version: 5, compositionMode: "simple", blocks: [] });
  const line = (text: string) => ({
    type: "emailText",
    attrs: { id: null, data: { type: "text" } },
    content: [{ type: "text", text }],
  });
  const back = tiptapToDoc(
    {
      type: "doc",
      content: [
        {
          type: "bulletList",
          attrs: { id: "l", data: { type: "list" } },
          content: [
            { type: "listItem", content: [line("a")] },
            {
              type: "listItem",
              content: [
                line("b"),
                {
                  type: "bulletList",
                  attrs: { id: null, data: { type: "list" } },
                  content: [{ type: "listItem", content: [line("b.1")] }],
                },
              ],
            },
            { type: "listItem", content: [line("c")] },
          ],
        },
      ],
    },
    base,
  );
  const block = back.blocks[0]!;
  assert.equal(block.type, "list");
  if (block.type !== "list") return;
  assert.equal(block.ordered, false);
  assert.deepEqual(block.items.map((i) => i.text), ["a", "b", "b.1", "c"]);
  // A list created on the canvas (no stored margin) follows the Simple-mode
  // rule: no block spacing of its own — blank lines do the spacing.
  assert.equal(block.marginBottom, 0);
});

test("list blocks render as inline-styled <ul>/<ol> in HTML and as marker lines in text/plain", () => {
  const doc = parseDocument({
    version: 5,
    compositionMode: "simple",
    blocks: [
      { type: "list", id: "u", ordered: false, items: [{ text: "apples" }, { text: "pears & <plums>" }] },
      { type: "list", id: "o", ordered: true, items: [{ text: "one" }, { text: "two" }] },
    ],
  });
  const html = renderToHtml(doc, {}, { showPoweredBy: false });
  assert.match(html, /<ul[^>]*>\s*<li[^>]*>apples<\/li>\s*<li[^>]*>pears &amp; &lt;plums&gt;<\/li>\s*<\/ul>/);
  assert.match(html, /<ol[^>]*>\s*<li[^>]*>one<\/li>\s*<li[^>]*>two<\/li>\s*<\/ol>/);
  const text = renderToText(doc, {}, { showPoweredBy: false });
  assert.match(text, /• apples\n• pears & <plums>/);
  assert.match(text, /1\. one\n2\. two/);
});

test("list blocks survive Simple → Design → Simple", () => {
  const doc = parseDocument({
    version: 5,
    compositionMode: "simple",
    blocks: [
      { type: "text", id: "t", text: "Shopping:" },
      { type: "list", id: "l", ordered: false, items: [{ text: "milk" }, { text: "eggs" }] },
    ],
  });
  const designed = designEmailDocument(doc);
  const simple = simplifyEmailDocument(designed);
  const lists = simple.blocks.filter((b) => b.type === "list");
  assert.equal(lists.length, 1);
  const list = lists[0]!;
  if (list.type !== "list") return;
  assert.deepEqual(list.items.map((i) => i.text), ["milk", "eggs"]);
});

test("an indent (left padding) survives Design → Simple and does not trigger the Simplify warning", () => {
  const designed = parseDocument({
    version: 5,
    compositionMode: "designed",
    theme: simplifyEmailDocument(parseDocument({ version: 5, blocks: [] })).theme,
    blocks: [
      { type: "text", id: "a", text: "plain" },
      { type: "text", id: "b", text: "indented", padding: { left: 80 } },
      { type: "heading", id: "h", text: "Title", level: 2, padding: { left: 40 } },
    ],
  });
  assert.equal(simpleConversionNeedsConfirmation(designed), false);
  const simple = simplifyEmailDocument(designed);
  // (simplify puts a blank spacer line between former blocks.)
  const [a, , b, , h] = simple.blocks;
  assert.equal(a!.type === "text" && a.padding, undefined);
  assert.deepEqual(b!.type === "text" ? b.padding : null, { left: 80 });
  assert.deepEqual(h!.type === "heading" ? h.padding : null, { left: 40 });
  // Rendered HTML carries the indent as padding on the line.
  const html = renderToHtml(simple, {}, { showPoweredBy: false });
  // Gmail expresses indent as margin-left in 40px steps.
  assert.match(html, /margin-left:80px/);
});

// ---------------------------------------------------------------------------
// Images (2026-10-12): a newsletter author pastes screenshots into a plain,
// reads-as-text Simple email. Simple keeps image blocks instead of flattening
// them to an alt-text line.
// ---------------------------------------------------------------------------

test("simplifying keeps an image's src, alt, link and width, and drops the designed frame styling", () => {
  const designed = parseDocument({
    version: 5,
    blocks: [
      {
        type: "image",
        id: "img",
        src: "/img/6f1c2e9a-1111-4222-8333-944455556666",
        alt: "Genetics table",
        href: "https://example.com/report",
        width: 420,
        height: 300,
        borderRadius: 12,
        objectFit: "cover",
        backgroundColor: "#eeeeee",
        customCss: "opacity:.5",
        align: "left",
      },
      // An empty placeholder (no picture yet) still flattens to its words.
      { type: "image", id: "empty", src: "", alt: "Logo goes here" },
    ],
  });
  // Frame styling would be lost, so switching still asks first.
  assert.equal(simpleConversionNeedsConfirmation(designed), true);
  const simple = simplifyEmailDocument(designed);
  assert.deepEqual(simple.blocks.map((b) => b.type), ["image", "text", "text"]);
  const image = simple.blocks[0]!;
  assert.equal(image.type, "image");
  if (image.type !== "image") return;
  assert.deepEqual(
    { src: image.src, alt: image.alt, href: image.href, width: image.width, align: image.align, marginBottom: image.marginBottom },
    {
      src: "/img/6f1c2e9a-1111-4222-8333-944455556666",
      alt: "Genetics table",
      href: "https://example.com/report",
      width: 420,
      align: "left",
      marginBottom: 0,
    },
  );
  for (const gone of ["height", "borderRadius", "objectFit", "backgroundColor", "customCss"] as const) {
    assert.equal(image[gone], undefined, `${gone} is designed-only`);
  }
  const placeholder = simple.blocks[2]!;
  assert.equal(placeholder.type === "text" ? placeholder.text : null, "Logo goes here");
});

test("a plain image no longer makes Simple ask before converting", () => {
  const designed = parseDocument({
    version: 5,
    theme: simplifyEmailDocument(parseDocument({ version: 5, blocks: [] })).theme,
    blocks: [
      { type: "text", id: "a", text: "Here is the table:" },
      { type: "image", id: "i", src: "https://example.com/table.png", alt: "Table" },
    ],
  });
  assert.equal(simpleConversionNeedsConfirmation(designed), false);
});

test("a Simple image round-trips through the composer (TipTap) unchanged", () => {
  const doc = parseDocument({
    version: 5,
    compositionMode: "simple",
    blocks: [
      { type: "text", id: "a", text: "Before", marginBottom: 0 },
      {
        type: "image",
        id: "img",
        src: "/img/6f1c2e9a-1111-4222-8333-944455556666",
        alt: "Genetics table",
        width: 400,
        href: "https://example.com/report",
        align: "left",
        marginBottom: 0,
      },
      { type: "image", id: "fit", src: "https://example.com/fit.png", alt: "", align: "left", marginBottom: 0 },
      { type: "text", id: "b", text: "After", marginBottom: 0 },
    ],
  });
  const pm = docToTiptap(doc);
  assert.deepEqual(pm.content.map((n) => n.type), ["emailText", "emailImage", "emailImage", "emailText"]);
  assert.equal((pm.content[1]!.attrs as { data: { width?: number } }).data.width, 400);
  // Compared as JSON, like the editor's own echo check (absent vs undefined keys).
  const json = (value: unknown) => JSON.parse(JSON.stringify(value));
  assert.deepEqual(json(tiptapToDoc(pm, doc)), json(doc));

  // An image node the composer just inserted (no margin in its data yet)
  // reads back as a Simple line with no block spacing; no width = best fit.
  pm.content.splice(1, 0, {
    type: "emailImage",
    attrs: { id: "new", data: { type: "image", src: "https://example.com/new.png", alt: "New", align: "left" } },
  });
  const back = tiptapToDoc(pm, doc);
  const inserted = back.blocks[1]!;
  assert.equal(inserted.type, "image");
  if (inserted.type === "image") {
    assert.equal(inserted.marginBottom, 0);
    assert.equal(inserted.width, undefined);
  }
});

test("Simple images survive Simple → Design → Simple", () => {
  const doc = parseDocument({
    version: 5,
    compositionMode: "simple",
    blocks: [{ type: "image", id: "i", src: "https://example.com/a.png", alt: "A", width: 240, align: "left", marginBottom: 0 }],
  });
  const again = simplifyEmailDocument(designEmailDocument(doc));
  assert.deepEqual(again.blocks, doc.blocks);
});
