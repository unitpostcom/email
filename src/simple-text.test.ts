import assert from "node:assert/strict";
import { test } from "node:test";

import { renderSimpleHtml } from "./render-simple";
import type { Block } from "./schema";
import { normalizeSimpleDocument } from "./simple";
import { SIMPLE_TEXT_GUIDE, parseSimpleInline, parseSimpleText } from "./simple-text";

type TextLine = Extract<Block, { type: "text" }>;

test("every composer style is expressible: colour, highlight, size, font, alignment, image, <br>", () => {
  const { doc, warnings } = parseSimpleText(
    [
      '<div style="text-align:center"><b><span style="font-size:24px">Big news</span></b></div>',
      "",
      'Hi {{first_name}}, this is <span style="color:#cc0000; background-color:#fff3a0">important</span>.',
      'In <span style="font-family:Georgia">Georgia</span> and <span style="font-size:13px">small</span>.',
      "Line one<br>line two",
      '<div align="right"><a href="https://x.example"><img src="/img/0f8fad5b-d9cb-469f-a165-70867728950e" alt="Chart" width="400"></a></div>',
    ].join("\n"),
  );
  assert.deepEqual(warnings, []);
  const [title, , body, fonts, br, image] = doc.blocks;
  assert.equal((title as TextLine).align, "center");
  assert.deepEqual((title as TextLine).content, [{ text: "Big news", marks: { bold: true, fontSize: 24 } }]);
  assert.deepEqual((body as TextLine).content, [
    { text: "Hi {{first_name}}, this is " },
    { text: "important", marks: { color: "#cc0000", background: "#fff3a0" } },
    { text: "." },
  ]);
  assert.deepEqual((fonts as TextLine).content?.[1], { text: "Georgia", marks: { fontFamily: "Georgia, 'Times New Roman', serif" } });
  assert.deepEqual((fonts as TextLine).content?.[3], { text: "small", marks: { fontSize: 13 } });
  assert.equal((br as TextLine).text, "Line one\nline two");
  assert.equal(image!.type, "image");
  if (image!.type === "image") {
    assert.equal(image.src, "/img/0f8fad5b-d9cb-469f-a165-70867728950e");
    assert.equal(image.alt, "Chart");
    assert.equal(image.href, "https://x.example");
    assert.equal(image.width, 400);
    assert.equal(image.align, "right");
  }
  // What the text format produces is already a clean Simple document.
  assert.equal(normalizeSimpleDocument(doc).changed, false);
});

test("sizes snap to Gmail's; named sizes work; bold via font-weight", () => {
  const runs = parseSimpleInline(
    '<span style="font-size:20px">a</span><span style="font-size:large">b</span><span style="font-weight:700">c</span>',
  );
  // Neighbouring text with identical styling is one run.
  assert.deepEqual(runs, [
    { text: "ab", marks: { fontSize: 18 } },
    { text: "c", marks: { bold: true } },
  ]);
});

test("TSX, headings and block HTML are removed with a warning — never sent as literal markup", () => {
  const { doc, warnings } = parseSimpleText(
    ["<Section>", "<Text>Hi there</Text>", "<Spacer height={16} />", "</Section>", "<h1>Welcome</h1>", "<p>Body copy</p>"].join("\n"),
  );
  const text = doc.blocks.map((b) => (b.type === "text" ? b.text : b.type)).filter(Boolean);
  assert.deepEqual(text, ["Hi there", "Welcome", "Body copy"]);
  const html = renderSimpleHtml(doc);
  assert.ok(!/<(section|text|spacer|h1|p)\b/i.test(html), html);
  assert.ok(warnings.some((w) => w.startsWith("Removed <Section>: TSX components are for Designed emails")));
  assert.ok(warnings.some((w) => w.startsWith("Removed <h1>: a Simple email has no headings")));
  assert.ok(warnings.some((w) => w.startsWith("Removed <p> tags")));
});

test("unknown CSS, bad colours and off-menu fonts are dropped with a warning", () => {
  const warnings: string[] = [];
  const runs = parseSimpleInline(
    '<span style="color:expression(alert(1)); padding:8px; font-family:Comic Sans MS">x</span>',
    (w) => warnings.push(w),
  );
  assert.deepEqual(runs, [{ text: "x" }]);
  assert.ok(warnings.some((w) => w.startsWith('Ignored the colour "expression(alert(1))"')));
  assert.ok(warnings.some((w) => w.startsWith('Ignored CSS "padding"')));
  assert.ok(warnings.some((w) => w.startsWith('Removed the font "Comic Sans MS"')));
});

test("an unsendable image src is reported (its alt text is what goes out)", () => {
  const { doc, warnings } = parseSimpleText('<img src="https://images.unsplash.example/x.jpg" alt="ok">\n<img src="http://insecure.example/a.png" alt="A">');
  assert.equal(doc.blocks.length, 2);
  assert.ok(warnings.some((w) => w.startsWith('The image "http://insecure.example/a.png" can\'t be sent')));
  assert.equal(warnings.length, 1);
});

test("Markdown stays literal (decided 2026-09-26) but is called out", () => {
  const { doc, warnings } = parseSimpleText("# Hello\n**bold** and [a link](https://x.example)");
  assert.equal((doc.blocks[0] as TextLine).text, "# Hello");
  assert.equal((doc.blocks[1] as TextLine).text, "**bold** and [a link](https://x.example)");
  assert.equal(warnings.length, 3);
});

test("tag-shaped text that isn't HTML stays as text", () => {
  assert.deepEqual(parseSimpleInline("Reply with <your name> & we'll <b>call</b>"), [
    { text: "Reply with <your name> & we'll " },
    { text: "call", marks: { bold: true } },
  ]);
});

test("the guide names every supported construct and the unsupported ones", () => {
  for (const needle of ["<b>", "<a href", "<span style=", "text-align:center", "<img src=", "{{variables}}", "NOT SUPPORTED", "Markdown", "headings"]) {
    assert.ok(SIMPLE_TEXT_GUIDE.includes(needle), needle);
  }
});

test("a lone mention of a tag stays as written; only paired, self-closing or void tags are markup", () => {
  const { doc, warnings } = parseSimpleText("The paragraph tag is <p>.\nUse <h1> for titles in HTML, not here.");
  assert.deepEqual(
    doc.blocks.map((b) => (b.type === "text" ? b.text : b.type)),
    ["The paragraph tag is <p>.", "Use <h1> for titles in HTML, not here."],
  );
  assert.deepEqual(warnings, []);
  // …while real markup is still removed: paired across lines, self-closing.
  const markup = parseSimpleText("<Section>\nHi\n<Spacer height={8} />\n</Section>");
  assert.deepEqual(markup.doc.blocks.map((b) => (b.type === "text" ? b.text : b.type)).filter(Boolean), ["Hi"]);
});

test("entities in attribute values are decoded once: query strings survive the round trip", () => {
  const { doc } = parseSimpleText(
    '<a href="https://x.example/go?a=1&amp;b=2"><img src="https://cdn.example/i.png?w=400&amp;sig=abc" alt="Tom &amp; Jerry"></a>\n' +
      'See <a href="https://x.example/p?x=1&amp;y=2">the page</a>',
  );
  const [image, line] = doc.blocks;
  assert.equal(image!.type === "image" ? image.src : null, "https://cdn.example/i.png?w=400&sig=abc");
  assert.equal(image!.type === "image" ? image.href : null, "https://x.example/go?a=1&b=2");
  assert.equal(image!.type === "image" ? image.alt : null, "Tom & Jerry");
  const html = renderSimpleHtml(doc);
  assert.ok(html.includes('src="https://cdn.example/i.png?w=400&amp;sig=abc"'), html);
  assert.ok(html.includes('href="https://x.example/go?a=1&amp;b=2"'), html);
  assert.ok(html.includes('href="https://x.example/p?x=1&amp;y=2"'), html);
  assert.ok(!html.includes("&amp;amp;"), html);
  assert.equal(line!.type === "text" ? line.content?.[1]?.marks?.link : null, "https://x.example/p?x=1&y=2");
});

test("pairing is positional: a closing tag elsewhere doesn't turn a lone mention into markup", () => {
  const { doc } = parseSimpleText("Example: <p>Hello</p>\nThe <p> tag on its own stays.\n<Section>\nHi\n</Section>");
  assert.deepEqual(
    doc.blocks.map((b) => (b.type === "text" ? b.text : b.type)).filter(Boolean),
    ["Example: Hello", "The <p> tag on its own stays.", "Hi"],
  );
});
