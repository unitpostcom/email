import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { parseTsx, printTsx, printFragmentTsx, TsxParseError } from "./codec";
import { SECTION_LAYOUTS } from "./layouts";
import { SAMPLE_TEMPLATES } from "./samples";
import type {
  Block,
  ColumnBlock,
  ImageBlock,
  RowBlock,
  SectionBlock,
} from "./schema";

// ---------------------------------------------------------------------------
// Border round-trip — the nested `border` object must survive code mode via
// the flattened border-* scalar attributes.
// ---------------------------------------------------------------------------

describe("codec — nested border <-> scalar border-* attributes", () => {
  test("Section border round-trips through print -> parse", () => {
    const doc = parseTsx(
      `<Section background-color="#fafafa" border-width={1} border-style="solid" border-color="#e4e4e7" border-radius={12}>\n  <Text>Card</Text>\n</Section>`,
    );
    const section = doc.blocks[0] as SectionBlock;
    assert.equal(section.type, "section");
    assert.deepEqual(section.border, {
      width: 1,
      style: "solid",
      color: "#e4e4e7",
      radius: 12,
    });

    // And print it back out — the attributes must reappear.
    const printed = printTsx(doc);
    assert.match(printed, /border-width=\{1\}/);
    assert.match(printed, /border-style="solid"/);
    assert.match(printed, /border-color="#e4e4e7"/);
    assert.match(printed, /border-radius=\{12\}/);

    // Full round-trip: parse the printed source again.
    const again = parseTsx(printed);
    assert.deepEqual((again.blocks[0] as SectionBlock).border, section.border);
  });

  test("radius-only Section border (the tinted-card idiom) round-trips", () => {
    const doc = parseTsx(
      `<Section background-color="#fafafa" border-radius={12}>\n  <Text>Card</Text>\n</Section>`,
    );
    const section = doc.blocks[0] as SectionBlock;
    assert.deepEqual(section.border, { radius: 12 });
    const printed = printTsx(doc);
    assert.match(printed, /border-radius=\{12\}/);
    assert.doesNotMatch(printed, /border-width/);
  });

  test("Row and Column borders round-trip", () => {
    const doc = parseTsx(
      `<Row border-radius={12}>\n  <Column width={50} border-width={1} border-style="solid" border-color="#e4e4e7" border-radius={12}>\n    <Text>Left</Text>\n  </Column>\n  <Column width={50}>\n    <Text>Right</Text>\n  </Column>\n</Row>`,
    );
    const row = doc.blocks[0] as RowBlock;
    assert.deepEqual(row.border, { radius: 12 });
    assert.deepEqual(row.columns[0].border, {
      width: 1,
      style: "solid",
      color: "#e4e4e7",
      radius: 12,
    });
    assert.equal(row.columns[1].border, undefined);

    const again = parseTsx(printTsx(doc));
    const rowAgain = again.blocks[0] as RowBlock;
    assert.deepEqual(rowAgain.border, row.border);
    assert.deepEqual(rowAgain.columns[0].border, row.columns[0].border);
  });

  test("Button border-radius stays the SCALAR borderRadius prop", () => {
    const doc = parseTsx(
      `<Button href="https://example.com" border-radius={9999}>Go</Button>`,
    );
    const button = doc.blocks[0] as Block & { borderRadius: number };
    assert.equal(button.type, "button");
    assert.equal(button.borderRadius, 9999);
    assert.ok(!("border" in button && (button as { border?: unknown }).border));
    assert.match(printTsx(doc), /border-radius=\{9999\}/);
  });

  test("Image border-radius maps to the scalar; width/style/color to the nested border", () => {
    const doc = parseTsx(
      `<Image src="https://example.com/a.png" alt="" width={120} border-radius={10} border-width={1} border-style="solid" border-color="#ddd" />`,
    );
    const image = doc.blocks[0] as ImageBlock;
    assert.equal(image.borderRadius, 10);
    assert.deepEqual(image.border, { width: 1, style: "solid", color: "#ddd" });

    const printed = printTsx(doc);
    const again = parseTsx(printed);
    const imageAgain = again.blocks[0] as ImageBlock;
    assert.equal(imageAgain.borderRadius, 10);
    assert.deepEqual(imageAgain.border, image.border);
  });

  test("non-scalar props (margin/padding boxes) are skipped, never [object Object]", () => {
    const doc = parseTsx(`<Text>Hello</Text>`);
    (doc.blocks[0] as Block & { padding?: object }).padding = {
      top: 4,
      bottom: 4,
    };
    const printed = printTsx(doc);
    assert.doesNotMatch(printed, /\[object Object\]/);
    assert.doesNotMatch(printed, /padding=/);
  });
});

// ---------------------------------------------------------------------------
// Layout fidelity — EVERY pre-built section layout must round-trip through the
// codec: build() -> printFragmentTsx -> parseTsx must reproduce the same block
// structure (modulo ids). This is what lets the AI receive a layout as TSX and
// re-emit it 1:1 through template_set_design.
// ---------------------------------------------------------------------------

// Strip volatile fields (ids are regenerated per build/parse) recursively.
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "id") continue;
      out[k] = normalize(v);
    }
    return out;
  }
  return value;
}

describe("codec — every SECTION_LAYOUT round-trips as TSX", () => {
  for (const layout of SECTION_LAYOUTS) {
    test(`layout "${layout.key}" survives printFragmentTsx -> parseTsx`, () => {
      const fragment = layout.build();
      const tsx = printFragmentTsx(fragment);
      assert.ok(tsx.trim().length > 0, "layout prints non-empty TSX");
      assert.doesNotMatch(tsx, /\[object Object\]/);

      const parsed = parseTsx(tsx);
      assert.equal(
        parsed.blocks.length,
        fragment.blocks.length,
        "same top-level block count",
      );
      for (let i = 0; i < fragment.blocks.length; i++) {
        const original = fragment.blocks[i];
        const roundTripped = parsed.blocks[i];
        assert.equal(roundTripped.type, original.type, `block ${i} type`);
        // Containers: borders and backgrounds must survive (the card idiom).
        if (original.type === "section") {
          const rt = roundTripped as SectionBlock;
          assert.deepEqual(rt.border, original.border, `block ${i} border`);
          assert.equal(
            rt.backgroundColor,
            original.backgroundColor,
            `block ${i} background`,
          );
        }
        if (original.type === "row") {
          const rt = roundTripped as RowBlock;
          assert.equal(rt.columns.length, original.columns.length);
          for (let c = 0; c < original.columns.length; c++) {
            assert.deepEqual(
              rt.columns[c].border,
              original.columns[c].border,
              `block ${i} column ${c} border`,
            );
          }
        }
      }
    });
  }

  test("layouts with inline link runs keep their links through the round-trip", () => {
    // header-logo-nav's links line must come back as runs with link marks, not
    // as flattened plain text (the "plain text with spaces" bug).
    const layout = SECTION_LAYOUTS.find((l) => l.key === "header-logo-nav");
    assert.ok(layout);
    const parsed = parseTsx(printFragmentTsx(layout.build()));
    const row = parsed.blocks[0] as RowBlock;
    const linksColumn = row.columns[1] as ColumnBlock;
    const line = linksColumn.children.find((c) => c.type === "text") as
      | (Block & { content?: { marks?: { link?: string } }[] })
      | undefined;
    assert.ok(line, "links line exists");
    const linkRuns = (line.content ?? []).filter((r) => r.marks?.link);
    assert.equal(linkRuns.length, 3, "three link runs survive");
  });
});

describe("codec — structural parse errors are actionable", () => {
  // These are the exact mistakes an AI author makes most often; the messages
  // must SAY the fix (the design route surfaces them verbatim as 400s that the
  // model self-corrects against, instead of an opaque 500).
  test("a <Row> inside a <Section> names the fix (move it to the top level)", () => {
    assert.throws(
      () =>
        parseTsx(
          '<Section><Row><Column><Text>hi</Text></Column></Row></Section>',
        ),
      (err: Error) =>
        err instanceof TsxParseError &&
        /cannot go inside a <Section>/.test(err.message) &&
        /top level/.test(err.message),
    );
  });

  test("a bare <Column> says to wrap it in a <Row>", () => {
    assert.throws(
      () => parseTsx("<Column><Text>hi</Text></Column>"),
      (err: Error) =>
        err instanceof TsxParseError && /Wrap your columns in a <Row>/.test(err.message),
    );
  });

  test("non-Column content directly in a <Row> says to use a <Column>", () => {
    assert.throws(
      () => parseTsx("<Row><Text>hi</Text></Row>"),
      (err: Error) =>
        err instanceof TsxParseError &&
        /Put content inside a <Column>/.test(err.message),
    );
  });

  test("an unclosed container still throws (named after its tag)", () => {
    assert.throws(
      () => parseTsx("<Section><Text>hi</Text>"),
      (err: Error) =>
        err instanceof TsxParseError && /Unclosed <Section>/.test(err.message),
    );
  });
});

// ---------------------------------------------------------------------------
// Round-trip STABILITY: printTsx -> parseTsx must be an exact identity on the
// stored content, and repeated cycles must never drift it. This guards the
// Code editor (which re-parses the printed TSX on every keystroke) and every
// sample/layout against the indentation-accumulation bug fixed in dedentText:
// markdown/code are whitespace-significant, so the pretty-printer's per-line
// indent must be fully removed again on parse.
// ---------------------------------------------------------------------------

// Compare documents ignoring generated block ids.
function stripIds(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, v) => (key === "id" ? undefined : v)),
  );
}

describe("codec — print -> parse is an identity (no content drift)", () => {
  test("multi-paragraph Markdown content survives a round-trip byte-identically", () => {
    const doc = parseTsx(
      `<Section><Markdown>**1. One** — first.\n\n**2. Two** — second.</Markdown></Section>`,
    );
    const printed = printTsx(doc);
    const again = parseTsx(printed);
    assert.deepEqual(stripIds(again), stripIds(doc));
  });

  test("Code block whitespace (leading indent + newlines) survives a round-trip", () => {
    const code = "function add(a, b) {\n  return a + b;\n}";
    const doc = parseTsx(`<Section><Code>${code}</Code></Section>`);
    const section = doc.blocks[0];
    assert.ok(section.type === "section");
    const block = section.children[0];
    assert.ok(block.type === "code");
    assert.equal(block.code, code);
    const again = parseTsx(printTsx(doc));
    assert.deepEqual(stripIds(again), stripIds(doc));
  });

  test("five print -> parse cycles do not accumulate indentation (editor keystroke loop)", () => {
    let doc = parseTsx(
      `<Section><Markdown>**a**\n\n**b**</Markdown><Code>x = 1\n  y = 2</Code></Section>`,
    );
    const first = stripIds(doc);
    for (let i = 0; i < 5; i++) doc = parseTsx(printTsx(doc), doc);
    assert.deepEqual(stripIds(doc), first);
  });

  test("every SAMPLE_TEMPLATE round-trips through printTsx -> parseTsx unchanged", () => {
    for (const sample of SAMPLE_TEMPLATES) {
      const again = parseTsx(printTsx(sample.design), sample.design);
      assert.deepEqual(
        stripIds(again.blocks),
        stripIds(sample.design.blocks),
        `sample "${sample.key}" drifted through a TSX round-trip`,
      );
    }
  });

  test("markdown blank lines don't grow trailing whitespace across cycles", () => {
    let doc = parseTsx(`<Section><Markdown>para one\n\npara two</Markdown></Section>`);
    for (let i = 0; i < 3; i++) doc = parseTsx(printTsx(doc), doc);
    const section = doc.blocks[0];
    assert.ok(section.type === "section");
    const block = section.children[0];
    assert.ok(block.type === "markdown");
    assert.equal(block.markdown, "para one\n\npara two");
  });
});

// ---------------------------------------------------------------------------
// Graceful handling of the natural-but-imperfect inputs the AI (and hand
// authoring) emit — numeric props written as strings/with units, out-of-range
// or unparseable single attributes, and structural mistakes. A template write
// should coerce or drop just the offending prop (keeping the block) and only
// hard-fail on genuine STRUCTURE errors — with an actionable message, never a
// raw Zod dump. See codec.ts `lenientParse` + schema.ts numeric coercion.
// ---------------------------------------------------------------------------
describe("codec — resilient prop coercion + graceful degradation", () => {
  test("numeric props written as quoted strings coerce to numbers", () => {
    const doc = parseTsx(
      `<Row><Column width="50"><Heading level="2">Hi</Heading><Text fontSize="16">x</Text></Column></Row>`,
    );
    const row = doc.blocks[0] as RowBlock;
    const col = row.columns[0];
    assert.equal(col.width, 50);
    assert.equal(col.children[0].type === "heading" && col.children[0].level, 2);
    assert.equal(
      col.children[1].type === "text" && col.children[1].fontSize,
      16,
    );
  });

  test("CSS px units on numeric props are stripped and coerced", () => {
    const doc = parseTsx(`<Text fontSize="18px" margin-bottom="24px">x</Text>`);
    const t = doc.blocks[0];
    assert.ok(t.type === "text");
    assert.equal(t.fontSize, 18);
    assert.equal(t.marginBottom, 24);
  });

  test("fontWeight tolerates a bare number (equivalent CSS weight)", () => {
    const doc = parseTsx(`<Text font-weight={600}>x</Text>`);
    const t = doc.blocks[0];
    assert.ok(t.type === "text");
    assert.equal(t.fontWeight, "600");
  });

  test("an inline object literal border prop parses (border={{…}})", () => {
    const doc = parseTsx(
      `<Section border={{ width: 1, style: "solid", color: "#000", radius: 12 }}><Text>x</Text></Section>`,
    );
    const s = doc.blocks[0] as SectionBlock;
    assert.deepEqual(s.border, {
      width: 1,
      style: "solid",
      color: "#000",
      radius: 12,
    });
  });

  test("an unparseable single attribute is dropped, not fatal (block survives)", () => {
    // `{12 + 4}` degrades to a string the schema can't accept; `50%`/`2rem` are
    // units we don't model. Each should drop that one prop and keep the block.
    for (const tsx of [
      `<Text fontSize={12 + 4}>keep me</Text>`,
      `<Image src="https://x.com/a.png" width="50%" />`,
      `<Text fontSize="2rem">keep me</Text>`,
    ]) {
      const doc = parseTsx(tsx);
      assert.equal(doc.blocks.length, 1, `block dropped for: ${tsx}`);
      assert.notEqual(doc.blocks[0].type, "html");
    }
  });

  test("out-of-range numeric props fall back to schema defaults", () => {
    // Negative padding + an over-100 column width are invalid; the block keeps
    // its other props and the bad one is refilled from the default.
    const doc = parseTsx(
      `<Row><Column width={9999}><Text margin-bottom={-8}>x</Text></Column></Row>`,
    );
    const row = doc.blocks[0] as RowBlock;
    assert.equal(row.columns[0].width, 50); // default
    const leaf = row.columns[0].children[0];
    assert.equal(leaf.type === "text" && leaf.marginBottom, 16); // default
  });

  test("percentage / rem values are NOT silently misread as px", () => {
    // A width we can't model as px integer is dropped (frame goes full-width),
    // never coerced to a wrong number.
    const doc = parseTsx(`<Image src="x" width="80%" />`);
    const img = doc.blocks[0] as ImageBlock;
    assert.equal(img.width, undefined);
  });

  test("a <Section> nested in a <Column> throws an actionable structural error", () => {
    assert.throws(
      () =>
        parseTsx(
          `<Row><Column width={50}><Section><Text>x</Text></Section></Column></Row>`,
        ),
      (err: unknown) =>
        err instanceof TsxParseError && /only contain leaf blocks/.test(err.message),
    );
  });

  test("structural mistakes still throw readable TsxParseErrors (not Zod dumps)", () => {
    const cases: Array<[string, RegExp]> = [
      [`<Section><Row><Column width={50}><Text>x</Text></Column></Row></Section>`, /Row.*cannot go inside a .*Section/],
      [`<Column width={50}><Text>x</Text></Column>`, /Column.*only valid inside a .*Row/],
      [`<Section><Text>x</Text>`, /Unclosed <Section>/],
      [`<Text>hello`, /Unclosed <Text>/],
    ];
    for (const [tsx, re] of cases) {
      assert.throws(
        () => parseTsx(tsx),
        (err: unknown) => err instanceof TsxParseError && re.test(err.message),
        `expected TsxParseError matching ${re} for: ${tsx}`,
      );
    }
  });

  test("coerced/dropped props round-trip idempotently (editor keystroke loop)", () => {
    let doc = parseTsx(
      `<Section><Text fontSize="16px">Hi</Text></Section>\n<Image src="x" width="50%" />`,
    );
    const first = stripIds(doc);
    for (let i = 0; i < 5; i++) doc = parseTsx(printTsx(doc), doc);
    assert.deepEqual(stripIds(doc), first);
  });
});
