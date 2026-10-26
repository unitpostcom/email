import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseTsx, parseTsxDocument, printTsx, htmlToBlocks, TsxParseError } from "./codec";
import { convertTemplateDocument, templateEditor } from "./modes";
import { renderToHtml } from "./render";
import { SAMPLE_TEMPLATES } from "./samples";
import { sanitizeEmailHtml } from "./sanitize";
import { EmailDocumentSchema, type EmailDocument } from "./schema";
import { fromJsx } from "./react";
import { createElement } from "react";
import { Email, Heading, Section, Text } from "./react";

const BODY = `<Section padding-x={24}>
  <Heading level={1}>October, shipped</Heading>
  <Text>Hello {{first_name}}, here is what's new.</Text>
  <Button href="{{cta_url}}">Read more</Button>
</Section>`;

const BRANDED = `<Email background-color="#f5f5f4" body-color="#ffffff" content-width={560} body-padding={0} body-radius={16} body-border-width={1} body-border-color="#e7e5e4" text-color="#191c1f" category="marketing" preview-text="What's new &amp; next">
${BODY}
</Email>`;

describe("<Email> document element (TSX)", () => {
  test("sets the theme, preview text and category in one parse", () => {
    const { doc, warnings } = parseTsxDocument(BRANDED);
    assert.deepEqual(warnings, []);
    assert.equal(doc.theme.backgroundColor, "#f5f5f4");
    assert.equal(doc.theme.contentWidth, 560);
    assert.equal(doc.theme.bodyRadius, 16);
    assert.equal(doc.theme.bodyPadding, 0);
    assert.deepEqual(doc.theme.bodyBorder, { width: 1, color: "#e7e5e4" });
    assert.equal(doc.category, "marketing");
    assert.equal(doc.previewText, "What's new & next");
    assert.equal(doc.blocks.length, 1);
    assert.equal(doc.blocks[0].type, "section");
  });

  // Verifier on #1036: a read's tsx sent back must parse to the same email.
  test("preview text with < > & \" prints and parses back unchanged", () => {
    const doc = parseTsx(BODY);
    const previewText = `Save > spend, "now" & <later>`;
    const printed = printTsx({ ...doc, previewText }, { document: true });
    const again = parseTsxDocument(printed);
    assert.deepEqual(again.warnings, []);
    assert.equal(again.doc.previewText, previewText);
    // The same blocks (ids are fresh per parse), nothing spilled into the body.
    assert.equal(printTsx(again.doc), printTsx(doc));
  });

  test("overrides only what it names; the rest of the base theme stays", () => {
    const base = EmailDocumentSchema.parse({ theme: { linkColor: "#ff0000", contentWidth: 640 }, category: "transactional" });
    const doc = parseTsx(`<Email content-width={480}>${BODY}</Email>`, base);
    assert.equal(doc.theme.contentWidth, 480);
    assert.equal(doc.theme.linkColor, "#ff0000");
    assert.equal(doc.category, "transactional");
  });

  test("without <Email> a fragment parses against the base exactly as before", () => {
    const base = EmailDocumentSchema.parse({ theme: { bodyColor: "#000000" } });
    assert.equal(parseTsx(BODY, base).theme.bodyColor, "#000000");
  });

  test("unknown attributes and invalid values are dropped and reported, never fatal", () => {
    const { doc, warnings } = parseTsxDocument(`<Email bg="#000" content-width="wide" category="promo">${BODY}</Email>`);
    assert.equal(doc.theme.contentWidth, 600);
    assert.equal(doc.category, "transactional");
    assert.equal(warnings.length, 3);
    assert.match(warnings.join("\n"), /no `bg` attribute/);
    assert.match(warnings.join("\n"), /`content-width` value isn't valid/);
    assert.match(warnings.join("\n"), /`category` must be/);
  });

  test("a theme object literal works too", () => {
    const doc = parseTsx(`<Email theme={{ bodyColor: "#fafafa", bodyRadius: 8 }}>${BODY}</Email>`);
    assert.equal(doc.theme.bodyColor, "#fafafa");
    assert.equal(doc.theme.bodyRadius, 8);
  });

  test("an unclosed outermost <Email> is an actionable error", () => {
    assert.throws(() => parseTsx(`<Email>${BODY}`), TsxParseError);
  });

  // Backward compatibility: <Email> is only the document element when it is
  // the outermost element. Anywhere else it parses exactly as before ADR-0099.
  test("an <Email> that isn't the outermost element parses exactly as before", () => {
    const inCode = `<Section><Code>import { Email } from "@unitpost/email/react";\n<Email bodyRadius={16}>…</Email></Code></Section>`;
    const doc = parseTsx(inCode);
    assert.equal(doc.theme.bodyRadius, 0);
    const code = (doc.blocks[0] as { children: { type: string; code?: string }[] }).children[0];
    assert.equal(code.type, "code");
    assert.match(code.code!, /<Email bodyRadius=\{16\}>…<\/Email>/);
    // A stray tag after the blocks stays raw HTML, as it always did.
    const stray = parseTsx(`${BODY}</Email>`);
    assert.equal(stray.blocks.at(-1)!.type, "html");
    const later = parseTsx(`${BODY}<Email body-radius={16}></Email>`);
    assert.equal(later.theme.bodyRadius, 0);
    assert.equal(later.blocks.at(-1)!.type, "html");
  });

  test("printTsx({ document: true }) round-trips the whole design", () => {
    for (const sample of SAMPLE_TEMPLATES) {
      const doc = EmailDocumentSchema.parse({ ...sample.design, previewText: `Quote " and & in "${sample.key}"` });
      const printed = printTsx(doc, { document: true });
      assert.match(printed, /^<Email /);
      const again = parseTsx(printed);
      assert.deepEqual(again.theme, doc.theme, sample.key);
      assert.equal(again.previewText, doc.previewText, sample.key);
      assert.equal(again.category, doc.category, sample.key);
      assert.equal(printTsx(again), printTsx(doc), sample.key);
    }
  });

  test("printTsx without options still prints the bare block list (the Code tab)", () => {
    const doc = parseTsx(BRANDED);
    assert.doesNotMatch(printTsx(doc), /<Email/);
  });
});

describe("<Email> document element (React)", () => {
  test("fromJsx reads the same settings from props", () => {
    const doc = fromJsx(
      createElement(
        Email,
        { backgroundColor: "#f5f5f4", bodyRadius: 16, bodyBorderWidth: 1, category: "marketing", previewText: "Hi" },
        createElement(Section, null, createElement(Heading, { level: 1 }, "Hello"), createElement(Text, null, "Body")),
      ),
    );
    assert.equal(doc.theme.backgroundColor, "#f5f5f4");
    assert.equal(doc.theme.bodyRadius, 16);
    assert.deepEqual(doc.theme.bodyBorder, { width: 1 });
    assert.equal(doc.category, "marketing");
    assert.equal(doc.previewText, "Hi");
    assert.equal(doc.blocks[0].type, "section");
    // Same document as the TSX dialect.
    const tsx = parseTsx(`<Email background-color="#f5f5f4" body-radius={16} body-border-width={1} category="marketing" preview-text="Hi"><Section><Heading level={1}>Hello</Heading><Text>Body</Text></Section></Email>`);
    assert.deepEqual(doc.theme, tsx.theme);
  });
});

describe("body border", () => {
  test("a bordered card switches to the separate table model and draws a rounded stroke", () => {
    const html = renderToHtml(parseTsx(BRANDED), {}, { showPoweredBy: false });
    const card = /<table[^>]*class="ee-body"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? "";
    assert.match(card, /border-collapse:separate/);
    assert.match(card, /border:1px solid #e7e5e4/);
    assert.match(card, /border-radius:16px/);
  });

  test("no border leaves the card exactly as before (collapse, no stroke)", () => {
    const html = renderToHtml(parseTsx(BODY), {}, { showPoweredBy: false });
    const card = /<table[^>]*class="ee-body"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? "";
    assert.match(card, /border-collapse:collapse/);
    assert.doesNotMatch(card, /(^|;)border:/);
  });

  test("a document className border renders exactly as before (only bodyBorder switches models)", () => {
    const html = renderToHtml(parseTsx(`<Email className="border rounded-2xl">${BODY}</Email>`), {}, { showPoweredBy: false });
    const card = /<table[^>]*class="ee-body[^"]*"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? "";
    assert.match(card, /border-collapse:collapse/);
  });

  test("every sample renders byte-identically to its pre-ADR-0099 shape (no bodyBorder → unchanged card)", () => {
    for (const sample of SAMPLE_TEMPLATES) {
      const html = renderToHtml(EmailDocumentSchema.parse(sample.design), {}, { showPoweredBy: false });
      assert.doesNotMatch(html, /border-collapse:separate/, sample.key);
    }
  });
});

describe("sanitizer", () => {
  test("a whole email's <title> never becomes body text", () => {
    const { html } = sanitizeEmailHtml("<html><head><title>October Wrapped</title></head><body><p>Hi</p></body></html>");
    assert.doesNotMatch(html, /October Wrapped/);
    assert.match(html, /<p>Hi<\/p>/);
  });
});

describe("template editors", () => {
  const design = parseTsx(BRANDED);
  const code = EmailDocumentSchema.parse({ blocks: [{ type: "html", id: "h", html: "<table width=\"600\"><tr><td><h1>Hi</h1></td></tr></table>" }] });
  const simple = EmailDocumentSchema.parse({ compositionMode: "simple", blocks: [{ type: "text", id: "t", text: "Hi there" }] });

  test("templateEditor tells simple, design and code apart", () => {
    assert.equal(templateEditor(simple), "simple");
    assert.equal(templateEditor(design), "design");
    assert.equal(templateEditor(code), "code");
    assert.equal(templateEditor(EmailDocumentSchema.parse({ blocks: [] })), "design");
    assert.equal(templateEditor(null), "design");
  });

  test("same editor in, same document out", () => {
    assert.equal(convertTemplateDocument(design, "design").doc, design);
  });

  test("Simple -> Design keeps every line, no warnings", () => {
    const { doc, warnings } = convertTemplateDocument(simple, "design");
    assert.equal(templateEditor(doc), "design");
    assert.deepEqual(warnings, []);
    assert.equal(doc.blocks.length, simple.blocks.length);
  });

  test("Design -> Code renders the same email as HTML, keeps variables, no doubled footer or preview", () => {
    const { doc, warnings } = convertTemplateDocument(design, "code");
    assert.equal(templateEditor(doc), "code");
    assert.equal(warnings.length, 1);
    const html = (doc.blocks[0] as { html: string }).html;
    assert.match(html, /\{\{first_name\}\}/);
    assert.match(html, /href="\{\{cta_url\}\}"/);
    assert.doesNotMatch(html, /unsubscribe/i);
    assert.doesNotMatch(html, /What's new/);
    // Category and preview text stay on the document: added once, at send.
    assert.equal(doc.category, "marketing");
    assert.equal(doc.previewText, design.previewText);
    // The shell steps aside around it.
    assert.equal(doc.theme.bodyPadding, 0);
    assert.equal(doc.theme.bodyRadius, 0);
  });

  // Verifier on #1036: the conversion renders without an asset host, so a
  // library image's src stays `/img/{id}`; the send's render resolves it.
  test("Design -> Code keeps library images loadable at send", () => {
    const id = "6a210000-6a21-425c-a627-708f1986a4e3";
    const withImage = parseTsx(`<Section><Image src="/img/${id}" alt="Logo" /></Section>`);
    const { doc } = convertTemplateDocument(withImage, "code");
    assert.match((doc.blocks[0] as { html: string }).html, new RegExp(`src="/img/${id}"`));
    const sent = renderToHtml(doc, {}, { assetBaseUrl: "https://assets.unitpost.com" });
    assert.match(sent, new RegExp(`src="https://assets\\.unitpost\\.com/img/${id}"`));
    assert.doesNotMatch(sent, /src="\/img\//);
    // The same-origin preview (no asset host) is unchanged.
    assert.match(renderToHtml(doc), new RegExp(`src="/img/${id}"`));
  });

  test("Code -> Design rebuilds what maps and says what didn't", () => {
    const { doc, warnings } = convertTemplateDocument(convertTemplateDocument(design, "code").doc, "design");
    assert.equal(templateEditor(doc), "design");
    const types = doc.blocks.map((b) => b.type);
    assert.ok(types.includes("heading"));
    assert.ok(types.includes("button"));
    assert.match(warnings.join("\n"), /Rebuilt \d+ parts/);
  });

  test("Code that maps to nothing stays Code, with a warning", () => {
    const opaque = EmailDocumentSchema.parse({ blocks: [{ type: "html", id: "h", html: "<video src=x></video>" }] });
    const { doc, warnings } = convertTemplateDocument(opaque, "design");
    assert.equal(doc, opaque);
    assert.match(warnings[0], /stays in Code/);
  });

  test("Design -> Simple flattens with plain-language warnings", () => {
    const { doc, warnings } = convertTemplateDocument(design, "simple");
    assert.equal(templateEditor(doc), "simple");
    assert.ok(warnings.some((w) => /button/.test(w)));
    assert.ok(warnings.some((w) => /heading/.test(w)));
  });

  test("Code -> Simple keeps the words", () => {
    const { doc } = convertTemplateDocument(code, "simple");
    assert.equal(templateEditor(doc), "simple");
    assert.ok(doc.blocks.some((b) => b.type === "text" && b.text.includes("Hi")));
  });
});

describe("htmlToBlocks", () => {
  test("maps semantic HTML to components and keeps the rest as Html", () => {
    const r = htmlToBlocks(
      `<h2 style="text-align:center">Title</h2><p>Hello <b>you</b>&nbsp;there</p><ul><li>One</li><li>Two</li></ul>` +
        `<p><a href="https://x.test" style="background-color:#111;color:#fff;padding:8px">Go</a></p><hr><img src="https://x.test/a.png" alt="A" width="200"><video></video>`,
    );
    const byType = (t: string) => r.blocks.filter((b) => b.type === t);
    assert.equal((byType("heading")[0] as { align: string }).align, "center");
    assert.equal((byType("text")[0] as { text: string }).text, "Hello you there");
    assert.equal(byType("list").length, 1);
    assert.equal((byType("button")[0] as { backgroundColor: string }).backgroundColor, "#111");
    assert.equal(byType("divider").length, 1);
    assert.equal((byType("image")[0] as { width: number }).width, 200);
    assert.equal(r.kept, 1);
  });

  test("an element holding several images, or an image and copy, is kept as Html: nothing is dropped", () => {
    // Verifier on #1036: an image-only paragraph with two images became one
    // Image block and the second image was dropped without a warning.
    const two = `<p><a href="https://x.test/a"><img src="https://x.test/a.png" alt="A"></a><img src="https://x.test/b.png" alt="B"></p>`;
    const r = htmlToBlocks(two);
    assert.equal(r.blocks.filter((b) => b.type === "image").length, 0);
    assert.equal(r.kept, 1);
    const kept = JSON.stringify(r.blocks);
    assert.ok(kept.includes("a.png") && kept.includes("b.png"), "both images survive");
    // An image beside copy is kept too: a Text block can't hold it.
    const mixed = htmlToBlocks(`<p>Hello <img src="https://x.test/logo.png" alt="Logo"></p><h2>Title <img src="https://x.test/i.png"></h2>`);
    // (Adjacent kept elements share one Html block.)
    assert.deepEqual(mixed.blocks.map((b) => b.type), ["html"]);
    assert.equal(mixed.kept, 2);
    assert.ok(JSON.stringify(mixed.blocks).includes("logo.png") && JSON.stringify(mixed.blocks).includes("Hello"));
    // One image in a paragraph or a link still becomes an Image block.
    const one = htmlToBlocks(`<p><a href="https://x.test/a"><img src="https://x.test/a.png" alt="A"></a></p>`);
    assert.deepEqual(one.blocks.map((b) => b.type), ["image"]);
    assert.equal((one.blocks[0] as { href?: string }).href, "https://x.test/a");
  });

  test("a whole email's head never becomes copy", () => {
    const r = htmlToBlocks("<!doctype html><html><head><title>T</title><style>p{}</style></head><body><p>Body</p></body></html>");
    assert.deepEqual(r.blocks.map((b) => (b as { text?: string }).text), ["Body"]);
  });
});

// Every design surface agrees: an <Email> TSX design printed for read-back and
// parsed again renders byte-identically.
test("read-back TSX re-renders identically", () => {
  const doc: EmailDocument = parseTsx(BRANDED);
  const again = parseTsx(printTsx(doc, { document: true }));
  const strip = (h: string) => h.replace(/data-block-id="[^"]*"/g, "");
  assert.equal(strip(renderToHtml(again, {}, { showPoweredBy: false })), strip(renderToHtml(doc, {}, { showPoweredBy: false })));
});
