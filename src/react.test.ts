import assert from "node:assert/strict";
import { createElement as h, Fragment } from "react";
import { test } from "node:test";
import {
  Button,
  Column,
  Heading,
  List,
  Row,
  Section,
  Text,
  fromJsx,
  render,
} from "./react";

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
