import assert from "node:assert/strict";
import { test } from "node:test";

import { parseTsx } from "./codec";
import { renderToHtml } from "./render";
import { renderSimpleHtml } from "./render-simple";
import { parseDocument, type Block, type EmailDocument } from "./schema";
import {
  SIMPLE_EMAIL_THEME,
  expandSimpleBlocks,
  isNormalizedSimpleDocument,
  normalizeSimpleDocument,
  snapSimpleTextSize,
  simpleFontStack,
} from "./simple";
import { textToSimpleDocument } from "./simple-text";

function simple(blocks: unknown[], extra: Record<string, unknown> = {}): EmailDocument {
  return parseDocument({ version: 5, compositionMode: "simple", theme: SIMPLE_EMAIL_THEME, blocks, ...extra });
}

function lines(doc: EmailDocument): string[] {
  return doc.blocks.map((b) => (b.type === "text" ? b.text : `[${b.type}]`));
}

// The 2026-10-13 incident: Ask Unit wrote Designed TSX (one <Section> of copy
// with <Spacer>s) into a Simple template. The editor showed it; the Simple
// renderer dropped the section, so the email arrived with only the footer.
const INCIDENT_TSX = `<Section>
  <Text>Hi {{first_name}},</Text>
  <Spacer height={16} />
  <Text>I'm the founder here, and I just wanted to personally welcome you.</Text>
  <Spacer height={16} />
  <Text>If you have any questions, <strong>you can reply directly to this email</strong>.</Text>
  <Spacer height={32} />
  <Text>Best,
Mike</Text>
  <Text>Founder</Text>
</Section>`;

test("the incident: a <Section> written into a Simple template renders its copy, not an empty email", () => {
  const doc = parseTsx(INCIDENT_TSX, textToSimpleDocument("x"));
  assert.equal(doc.compositionMode, "simple");
  assert.deepEqual(doc.blocks.map((b) => b.type), ["section"]);
  const html = renderToHtml(doc, { first_name: "Mike" }, { showPoweredBy: true });
  assert.match(html, /<div>Hi Mike,<\/div>/);
  assert.match(html, /<b>you can reply directly to this email<\/b>/);
  assert.match(html, /<div>Founder<\/div>/);
});

test("the incident: normalizing gives the lines the Simple composer can show, spaced by blank lines", () => {
  const doc = parseTsx(INCIDENT_TSX, textToSimpleDocument("x"));
  const result = normalizeSimpleDocument(doc);
  assert.equal(result.changed, true);
  assert.deepEqual(lines(result.doc), [
    "Hi {{first_name}},",
    "",
    "I'm the founder here, and I just wanted to personally welcome you.",
    "",
    "If you have any questions, you can reply directly to this email.",
    "",
    // JSX whitespace: the newline inside <Text> collapses to a space.
    "Best, Mike",
    "",
    "Founder",
  ]);
  assert.ok(result.doc.blocks.every((b) => b.type === "text" && b.marginBottom === 0));
  assert.deepEqual(result.changes, [
    "Flattened 1 layout section into plain lines",
    "Removed 3 spacers (a Simple email is spaced with blank lines)",
  ]);
});

test("expandSimpleBlocks returns the same array for a clean Simple document (render unchanged)", () => {
  const doc = textToSimpleDocument("Hi\n\n- a\n- b\n\n<b>Bye</b>");
  assert.equal(expandSimpleBlocks(doc.blocks), doc.blocks);
});

test("expandSimpleBlocks turns a top-level spacer into one blank line and keeps native lines as they are", () => {
  const doc = simple([
    { type: "text", id: "a", text: "A", marginBottom: 0 },
    { type: "spacer", id: "s", height: 24 },
    { type: "spacer", id: "s2", height: 24 },
    { type: "text", id: "b", text: "B", marginBottom: 0 },
  ]);
  const out = expandSimpleBlocks(doc.blocks);
  assert.deepEqual(out.map((b) => (b.type === "text" ? b.text : b.type)), ["A", "", "B"]);
  assert.equal(out[0], doc.blocks[0]);
});

test("a clean Simple document is returned as the same object, unchanged", () => {
  const doc = textToSimpleDocument("Hey {{first_name}},\n\nQuick one — <b>bold</b> and <a href=\"https://x.example\">a link</a>.\n- one\n- two");
  const result = normalizeSimpleDocument(doc);
  assert.equal(result.changed, false);
  assert.equal(result.doc, doc);
  assert.deepEqual(result.changes, []);
  assert.equal(isNormalizedSimpleDocument(doc), true);
});

test("a JSON round-trip (how the DB returns it) is still clean", () => {
  const doc = parseDocument(JSON.parse(JSON.stringify(textToSimpleDocument("A\n\nB"))));
  assert.equal(normalizeSimpleDocument(doc).changed, false);
});

test("a designed document is not touched", () => {
  const doc = parseDocument({ version: 5, blocks: [{ type: "spacer", id: "s", height: 10 }] });
  const result = normalizeSimpleDocument(doc);
  assert.equal(result.doc, doc);
  assert.equal(result.changed, false);
});

test("normalizing is idempotent", () => {
  const once = normalizeSimpleDocument(parseTsx(INCIDENT_TSX, textToSimpleDocument("x"))).doc;
  const twice = normalizeSimpleDocument(once);
  assert.equal(twice.changed, false);
  assert.equal(twice.doc, once);
});

test("headings become bold lines at Gmail's Huge / Large sizes; h3/h4 are bold at Normal", () => {
  const result = normalizeSimpleDocument(
    simple([
      { type: "heading", id: "h1", level: 1, text: "Welcome", align: "center" },
      { type: "heading", id: "h2", level: 2, text: "Section", marginBottom: 0 },
      { type: "heading", id: "h3", level: 3, text: "Small", marginBottom: 0 },
    ]),
  );
  const [h1, , h2, h3] = result.doc.blocks as Array<Extract<Block, { type: "text" }>>;
  assert.equal(h1!.type, "text");
  assert.equal(h1!.align, "center");
  assert.deepEqual(h1!.content, [{ text: "Welcome", marks: { bold: true, fontSize: 24 } }]);
  assert.deepEqual(h2!.content, [{ text: "Section", marks: { bold: true, fontSize: 18 } }]);
  assert.deepEqual(h3!.content, [{ text: "Small", marks: { bold: true } }]);
  // h1 kept its designed margin as a blank line; the others had none.
  assert.deepEqual(lines(result.doc), ["Welcome", "", "Section", "Small"]);
  assert.ok(result.changes.includes("Turned 3 headings into bold lines"));
});

test("buttons become text links, dividers a ——— line, Markdown / HTML their plain text", () => {
  const result = normalizeSimpleDocument(
    simple([
      { type: "button", id: "b", text: "Get started", href: "https://x.example/start" },
      { type: "divider", id: "d" },
      { type: "markdown", id: "m", markdown: "**Hello** [there](https://x.example)" },
      { type: "html", id: "h", html: "<p>Raw <b>html</b></p>" },
    ]),
  );
  const [button] = result.doc.blocks as Array<Extract<Block, { type: "text" }>>;
  assert.deepEqual(button!.content, [{ text: "Get started", marks: { link: "https://x.example/start" } }]);
  assert.ok(lines(result.doc).includes("———"));
  assert.ok(lines(result.doc).includes("Hello there (https://x.example)"));
  assert.ok(lines(result.doc).includes("Raw html"));
  assert.ok(result.doc.blocks.every((b) => b.type === "text"));
  for (const line of [
    "Turned 1 button into a text link",
    'Turned 1 divider into a "———" line',
    "Turned 1 Markdown block into plain lines (Markdown isn't rendered)",
    "Turned 1 raw HTML block into plain lines",
  ]) {
    assert.ok(result.changes.includes(line), `missing: ${line}\n${result.changes.join("\n")}`);
  }
});

test("rows flatten column by column", () => {
  const result = normalizeSimpleDocument(
    simple([
      {
        type: "row",
        id: "r",
        columns: [
          { type: "column", id: "c1", children: [{ type: "text", id: "l", text: "Left" }] },
          { type: "column", id: "c2", children: [{ type: "text", id: "r2", text: "Right" }] },
        ],
      },
    ]),
  );
  assert.deepEqual(lines(result.doc), ["Left", "", "Right"]);
  assert.ok(result.changes.includes("Flattened 1 column row into plain lines"));
});

test("block typography moves onto the line's text; unsupported per-line styling is removed", () => {
  const result = normalizeSimpleDocument(
    simple([
      {
        type: "text",
        id: "t",
        text: "Muted",
        color: "#666666",
        fontWeight: 700,
        fontSize: 20,
        lineHeight: 1.8,
        customCss: "letter-spacing: 2px",
        marginBottom: 0,
      },
    ]),
  );
  const [line] = result.doc.blocks as Array<Extract<Block, { type: "text" }>>;
  assert.deepEqual(line!.content, [{ text: "Muted", marks: { bold: true, color: "#666666", fontSize: 18 } }]);
  assert.equal(line!.color, undefined);
  assert.equal(line!.lineHeight, undefined);
  assert.equal(line!.customCss, undefined);
  assert.ok(result.changes.some((c) => c.startsWith("Removed per-line styling")));
  assert.ok(result.changes.some((c) => c.startsWith("Snapped 1 text size")));
});

test("run sizes snap to Gmail's sizes; fonts must be in the font menu", () => {
  assert.equal(snapSimpleTextSize(12), 13);
  assert.equal(snapSimpleTextSize(16), undefined);
  assert.equal(snapSimpleTextSize(17), 18);
  assert.equal(snapSimpleTextSize(40), 24);
  assert.equal(simpleFontStack("Georgia"), "Georgia, 'Times New Roman', serif");
  assert.equal(simpleFontStack("'Courier New', monospace"), "'Courier New', Courier, monospace");
  assert.equal(simpleFontStack("Comic Sans MS"), undefined);

  const result = normalizeSimpleDocument(
    simple([
      {
        type: "text",
        id: "t",
        text: "ab",
        marginBottom: 0,
        content: [
          { text: "a", marks: { fontSize: 13, fontFamily: "Comic Sans MS" } },
          { text: "b", marks: { fontSize: 30, italic: true } },
        ],
      },
    ]),
  );
  const [line] = result.doc.blocks as Array<Extract<Block, { type: "text" }>>;
  assert.deepEqual(line!.content, [
    { text: "a", marks: { fontSize: 13 } },
    { text: "b", marks: { italic: true, fontSize: 24 } },
  ]);
  assert.ok(result.changes.includes("Removed 1 font that isn't in the font menu"));
});

test("alignment, indent, variables, links, colours and highlights all survive", () => {
  const doc = simple([
    {
      type: "text",
      id: "t",
      text: "{{first_name}} see this",
      align: "right",
      padding: { left: 40 },
      marginBottom: 0,
      content: [
        { text: "{{first_name}}", variable: "first_name", marks: { bold: true } },
        { text: " see ", marks: { color: "#cc0000", background: "#ffff00" } },
        { text: "this", marks: { link: "{{cta_url}}", underline: true } },
      ],
    },
  ]);
  const result = normalizeSimpleDocument(doc);
  assert.equal(result.changed, false, result.changes.join("\n"));
});

test("images keep src, alt, link, width and alignment; designed frame styling is reported", () => {
  const result = normalizeSimpleDocument(
    simple([
      {
        type: "image",
        id: "i",
        src: "https://cdn.example/a.png",
        alt: "A",
        href: "https://x.example",
        width: 320,
        height: 200,
        borderRadius: 12,
        align: "center",
        marginBottom: 0,
      },
    ]),
  );
  const [image] = result.doc.blocks;
  assert.equal(image!.type, "image");
  if (image!.type !== "image") return;
  assert.equal(image.src, "https://cdn.example/a.png");
  assert.equal(image.width, 320);
  assert.equal(image.align, "center");
  assert.equal(image.height, undefined);
  assert.equal(image.borderRadius, undefined);
  assert.ok(result.changes.some((c) => c.startsWith("Removed designed frame styling from 1 image")));
});

test("the page theme resets to Simple's", () => {
  const doc = simple([{ type: "text", id: "t", text: "Hi", marginBottom: 0 }], {
    theme: { ...SIMPLE_EMAIL_THEME, backgroundColor: "#000000", contentWidth: 800 },
  });
  const result = normalizeSimpleDocument(doc);
  assert.deepEqual(result.doc.theme, SIMPLE_EMAIL_THEME);
  assert.ok(result.changes.some((c) => c.startsWith("Reset the page style")));
});

test("category, preview text, variables and from survive normalizing", () => {
  const doc = parseTsx(INCIDENT_TSX, {
    ...textToSimpleDocument("x", { category: "marketing", previewText: "Hello there" }),
    variables: [{ name: "first_name", type: "string", source: "contact" }],
  });
  const out = normalizeSimpleDocument(doc).doc;
  assert.equal(out.category, "marketing");
  assert.equal(out.previewText, "Hello there");
  assert.deepEqual(out.variables.map((v) => v.name), ["first_name"]);
  assert.equal(out.compositionMode, "simple");
});

test("a normalized document renders the same fragment the expanded original did, minus the empty-section bug", () => {
  const raw = parseTsx(INCIDENT_TSX, textToSimpleDocument("x"));
  const vars = { first_name: "Mike" };
  assert.equal(
    renderSimpleHtml(normalizeSimpleDocument(raw).doc, { variables: vars }),
    renderSimpleHtml(raw, { variables: vars }),
  );
});
