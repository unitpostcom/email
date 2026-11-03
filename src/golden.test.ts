import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement as h, type ReactElement } from "react";

import { parseTsx, parseTsxDocument } from "./codec";
import { SECTION_LAYOUTS } from "./layouts";
import {
  Button,
  Code,
  Column,
  Divider,
  Email,
  Heading,
  Html,
  Image,
  Link,
  List,
  Markdown,
  Row,
  Section,
  Spacer,
  Text,
  fromJsx,
  render,
} from "./react";
import { renderToHtml, type RenderOptions } from "./render";
import { SAMPLE_TEMPLATES } from "./samples";
import { EmailDocumentSchema, type EmailDocument } from "./schema";
import { renderToText } from "./text";

// Golden renders. A change to the HTML a published document renders to is a
// breaking change (CHANGELOG.md), so every sample template, every layout and
// the parity fixtures below are pinned by a hash of their HTML and plain text.
//
// A failure means rendered output changed. If the change is intended: bump the
// version as a breaking change, say what renders differently in CHANGELOG.md,
// and run `npm run golden:update`. The new output of each changed render is
// written to `.golden/` (git-ignored) so it can be diffed against a build from
// before the change.

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_FILE = join(HERE, "golden.json");
const OUT_DIR = join(HERE, "..", ".golden");
const UPDATE = process.env.UPDATE_GOLDEN === "1";

const VARS = {
  first_name: "Ada",
  product_name: "Acme",
  cta_url: "https://example.com/start",
  company_name: "Acme Inc.",
  company_address: "1 Main St, Springfield",
  unsubscribe_url: "https://example.com/unsubscribe",
};

// ---------------------------------------------------------------------------
// Parity fixtures: one email written twice, as React and as a TSX string. The
// two must give the same document and the same HTML, for every component.
// ---------------------------------------------------------------------------

type Fixture = { name: string; tsx: string; react: ReactElement };

const FIXTURES: Fixture[] = [
  {
    name: "email-section-heading-text-button",
    tsx: `<Email backgroundColor="#f5f5f4" bodyColor="#ffffff" contentWidth={560} bodyRadius={16} previewText="Welcome aboard">
  <Section paddingY={32}>
    <Heading level={1}>Welcome, {{first_name}}</Heading>
    <Text>Thanks for signing up to <strong>{{product_name}}</strong>. <em>Confirm</em> your <a href="https://example.com/a">email</a>.</Text>
    <Button href="{{cta_url}}">Confirm email</Button>
  </Section>
</Email>`,
    react: h(
      Email,
      { backgroundColor: "#f5f5f4", bodyColor: "#ffffff", contentWidth: 560, bodyRadius: 16, previewText: "Welcome aboard" },
      h(
        Section,
        { paddingY: 32 },
        h(Heading, { level: 1 }, "Welcome, {{first_name}}"),
        h(
          Text,
          null,
          "Thanks for signing up to ",
          h("strong", null, "{{product_name}}"),
          ". ",
          h("em", null, "Confirm"),
          " your ",
          h("a", { href: "https://example.com/a" }, "email"),
          ".",
        ),
        h(Button, { href: "{{cta_url}}" }, "Confirm email"),
      ),
    ),
  },
  {
    name: "row-column-image-link",
    tsx: `<Row columnGap={8}>
    <Column width={50}>
      <Image src="https://example.com/logo.png" alt="Logo" width={120} />
    </Column>
    <Column width={50}>
      <Link href="https://example.com/reset?u={{user_id}}">Reset password</Link>
    </Column>
  </Row>`,
    react: h(
      Row,
      { columnGap: 8 },
      h(Column, { width: 50 }, h(Image, { src: "https://example.com/logo.png", alt: "Logo", width: 120 })),
      h(Column, { width: 50 }, h(Link, { href: "https://example.com/reset?u={{user_id}}" }, "Reset password")),
    ),
  },
  {
    name: "list-divider-spacer",
    tsx: `<Section>
  <List ordered>
    <li>Set up your sending domain</li>
    <li>Import your <strong>contacts</strong></li>
  </List>
  <Divider />
  <Spacer height={24} />
</Section>`,
    react: h(
      Section,
      null,
      h(
        List,
        { ordered: true },
        h("li", null, "Set up your sending domain"),
        h("li", null, "Import your ", h("strong", null, "contacts")),
      ),
      h(Divider, null),
      h(Spacer, { height: 24 }),
    ),
  },
  {
    name: "markdown-code-html",
    tsx: `<Section>
  <Markdown>**Welcome!** Here's _what's new_ this week. [See all](https://example.com)</Markdown>
  <Code>npm install @unitpost/email</Code>
  <Link href='https://example.com/docs'>Read the docs</Link>
  <p>Raw <b>HTML</b></p>
</Section>`,
    react: h(
      Section,
      null,
      h(Markdown, null, "**Welcome!** Here's _what's new_ this week. [See all](https://example.com)"),
      h(Code, null, "npm install @unitpost/email"),
      h(Link, { href: "https://example.com/docs" }, "Read the docs"),
      h(Html, { html: "<p>Raw <b>HTML</b></p>" }),
    ),
  },
  {
    name: "classname-customcss",
    tsx: `<Section className="bg-stone-100 px-8 py-6">
  <Heading level={2} className="text-2xl font-semibold text-indigo-600">Your receipt</Heading>
  <Text customCss="letter-spacing: 0.01em;" align="center">Paid {{amount}}</Text>
  <Button className="bg-black text-white rounded-full" href="https://example.com/receipt">View receipt</Button>
</Section>`,
    react: h(
      Section,
      { className: "bg-stone-100 px-8 py-6" },
      h(Heading, { level: 2, className: "text-2xl font-semibold text-indigo-600" }, "Your receipt"),
      h(Text, { customCss: "letter-spacing: 0.01em;", align: "center" }, "Paid {{amount}}"),
      h(Button, { className: "bg-black text-white rounded-full", href: "https://example.com/receipt" }, "View receipt"),
    ),
  },
];

// Block ids are random per parse; the HTML never carries them.
function withoutIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIds);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => k !== "id")
        .map(([k, v]) => [k, withoutIds(v)]),
    );
  }
  return value;
}

function stringDocument(tsx: string): EmailDocument {
  return tsx.trimStart().startsWith("<Email") ? parseTsxDocument(tsx).doc : parseTsx(tsx);
}

for (const f of FIXTURES) {
  test(`parity: ${f.name} — React and the TSX string give the same email`, () => {
    const fromString = stringDocument(f.tsx);
    const fromReact = fromJsx(f.react);
    assert.deepEqual(withoutIds(fromReact), withoutIds(fromString));
    assert.equal(render(f.react, VARS), renderToHtml(fromString, VARS));
  });
}

// ---------------------------------------------------------------------------
// Pinned renders.
// ---------------------------------------------------------------------------

type Render = { name: string; html: string; text: string };

function renderAll(): Render[] {
  const out: Render[] = [];
  const add = (name: string, doc: EmailDocument, options: RenderOptions = {}) => {
    out.push({ name, html: renderToHtml(doc, VARS, options), text: renderToText(doc, VARS, options) });
  };
  for (const s of SAMPLE_TEMPLATES) add(`sample/${s.key}`, s.design);
  // Opt-in variants of one sample: dark mode, and the platform's brand mark.
  const welcome = SAMPLE_TEMPLATES.find((s) => s.key === "welcome") ?? SAMPLE_TEMPLATES[0];
  add("variant/welcome-dark-mode", { ...welcome.design, theme: { ...welcome.design.theme, darkMode: "auto" } });
  add("variant/welcome-powered-by", welcome.design, { showPoweredBy: true });
  for (const l of SECTION_LAYOUTS) {
    add(`layout/${l.key}`, EmailDocumentSchema.parse({ blocks: l.build().blocks }));
  }
  for (const f of FIXTURES) add(`parity/${f.name}`, stringDocument(f.tsx));
  return out;
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

test("golden: rendered HTML and text match golden.json", () => {
  const renders = renderAll();
  const actual: Record<string, { html: string; text: string }> = {};
  for (const r of renders) actual[r.name] = { html: hash(r.html), text: hash(r.text) };

  if (UPDATE) {
    writeFileSync(GOLDEN_FILE, `${JSON.stringify(actual, null, 2)}\n`);
    return;
  }

  const expected = JSON.parse(readFileSync(GOLDEN_FILE, "utf8")) as typeof actual;
  const changed = renders.filter(
    (r) => expected[r.name]?.html !== actual[r.name].html || expected[r.name]?.text !== actual[r.name].text,
  );
  const removed = Object.keys(expected).filter((name) => !(name in actual));
  if (changed.length) {
    for (const r of changed) {
      const file = join(OUT_DIR, r.name);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(`${file}.html`, r.html);
      writeFileSync(`${file}.txt`, r.text);
    }
  }
  assert.deepEqual(
    { changed: changed.map((r) => r.name), removed },
    { changed: [], removed: [] },
    "Rendered output changed (new output in packages/email/.golden/). " +
      "If intended: it's a breaking change — note it in CHANGELOG.md and run `npm run golden:update`.",
  );
});
