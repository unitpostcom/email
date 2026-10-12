import assert from "node:assert/strict";
import { createElement as h, Fragment } from "react";
import { test } from "node:test";
import {
  Button,
  Code,
  Column,
  Heading,
  List,
  Markdown,
  Row,
  Section,
  Text,
  fromJsx,
  render,
} from "./react";
import { parseTsx } from "./codec";
import { renderToHtml } from "./render";

test("fromJsx maps catalog components to a document", () => {
  const doc = fromJsx(
    h(
      Section,
      { paddingY: 32 },
      h(Heading, { level: 1 }, "Hi {{first_name}}"),
      h(Text, null, "Welcome to {{product_name}}."),
      h(Button, { href: "{{cta_url}}" }, "Get started"),
    ),
  );
  assert.equal(doc.blocks.length, 1);
  const section = doc.blocks[0];
  assert.equal(section.type, "section");
  if (section.type !== "section") return;
  assert.equal(section.children.length, 3);
  assert.equal(section.children[0]?.type, "heading");
  assert.equal(
    section.children[0] && "text" in section.children[0]
      ? section.children[0].text
      : "",
    "Hi {{first_name}}",
  );
  assert.equal(section.children[1]?.type, "text");
  assert.equal(section.children[2]?.type, "button");
});

test("render produces HTML through the existing renderer", () => {
  const html = render(
    h(Heading, { level: 1, className: "text-2xl" }, "Welcome"),
    {},
  );
  assert.match(html, /Welcome/);
  assert.match(html, /<table/i);
});

test("user function components expand", () => {
  function Welcome() {
    return h(Heading, { level: 2 }, "Hello");
  }
  const doc = fromJsx(h(Welcome, null));
  assert.equal(doc.blocks[0]?.type, "heading");
});

test("fromJsx maps borderRadius onto nested border.radius", () => {
  const doc = fromJsx(
    h(Section, { borderRadius: 12, paddingY: 8 }, h(Text, null, "Card")),
  );
  const section = doc.blocks[0];
  assert.equal(section?.type, "section");
  if (section?.type !== "section") return;
  assert.equal(section.border?.radius, 12);
});

test("Fragment flattens", () => {
  const doc = fromJsx(
    h(Fragment, null, h(Text, null, "A"), h(Text, null, "B")),
  );
  assert.equal(doc.blocks.length, 2);
});

test("Row requires Column children", () => {
  assert.throws(
    () => fromJsx(h(Row, null, h(Text, null, "nope"))),
    /Column/,
  );
  const doc = fromJsx(
    h(
      Row,
      null,
      h(Column, { width: 50 }, h(Text, null, "L")),
      h(Column, { width: 50 }, h(Text, null, "R")),
    ),
  );
  assert.equal(doc.blocks[0]?.type, "row");
});

test("List host reads <li> children as items", () => {
  const doc = fromJsx(
    h(List, { ordered: true }, h("li", null, "first"), h("li", null, "second {{name}}")),
  );
  const block = doc.blocks[0]!;
  assert.equal(block.type, "list");
  if (block.type !== "list") return;
  assert.equal(block.ordered, true);
  assert.deepEqual(block.items.map((i) => i.text), ["first", "second {{name}}"]);
});

test("inline <a>, <strong> and <span style> become marked runs", () => {
  const doc = fromJsx(
    h(
      Text,
      null,
      "Read the ",
      h("a", { href: "https://example.com/docs", style: { color: "#71717a" } }, "docs"),
      " or ",
      h("strong", null, "reply"),
      ".",
    ),
  );
  const block = doc.blocks[0]!;
  assert.equal(block.type, "text");
  if (block.type !== "text") return;
  assert.equal(block.text, "Read the docs or reply.");
  assert.deepEqual(block.content, [
    { text: "Read the " },
    { text: "docs", marks: { link: "https://example.com/docs", color: "#71717a" } },
    { text: " or " },
    { text: "reply", marks: { bold: true } },
    { text: "." },
  ]);
});

test("inline formatting renders the same as the TSX dialect", () => {
  const jsx = render(
    h(
      Section,
      null,
      h(Text, null, h("a", { href: "https://example.com" }, "Blog"), " · ", h("em", null, "Help")),
    ),
  );
  const tsx = renderToHtml(
    parseTsx(`<Section><Text><a href="https://example.com">Blog</a> · <em>Help</em></Text></Section>`),
  );
  assert.equal(jsx, tsx);
  assert.match(jsx, /<a href="https:\/\/example\.com"/);
});

test("plain text stays unformatted (no content runs)", () => {
  const block = fromJsx(h(Heading, null, "Hi ", "Ada")).blocks[0]!;
  assert.equal(block.type, "heading");
  if (block.type !== "heading") return;
  assert.equal(block.text, "Hi Ada");
  assert.equal(block.content, undefined);
});

test("multi-line Markdown and Code keep their newlines and dedent", () => {
  const doc = fromJsx(
    h(
      Section,
      null,
      h(Markdown, null, `
        **1. First step** — do this.

        **2. Second step** — then this.
      `),
      h(Code, null, `
        npm install @unitpost/email
        npm run build
      `),
    ),
  );
  const section = doc.blocks[0]!;
  assert.equal(section.type, "section");
  if (section.type !== "section") return;
  const [md, code] = section.children;
  assert.equal(md?.type === "markdown" && md.markdown, "**1. First step** — do this.\n\n**2. Second step** — then this.");
  assert.equal(code?.type === "code" && code.code, "npm install @unitpost/email\nnpm run build");
});

test("List items keep inline formatting", () => {
  const block = fromJsx(
    h(List, null, h("li", null, h("strong", null, "Fast"), " setup"), h("li", null, "Plain")),
  ).blocks[0]!;
  assert.equal(block.type, "list");
  if (block.type !== "list") return;
  assert.deepEqual(block.items, [
    { text: "Fast setup", content: [{ text: "Fast", marks: { bold: true } }, { text: " setup" }] },
    { text: "Plain" },
  ]);
});
