import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { htmlToBlocks, parseTsx, printTsx } from "./codec";
import { renderToHtml } from "./render";
import { decodeCharacterReferences, escapeCharacterReferences } from "./entities";
import type { ButtonBlock, ImageBlock, LinkBlock, TextBlock } from "./schema";

describe("character references", () => {
  test("named, numeric and accented references decode; unknown ones stay", () => {
    assert.equal(decodeCharacterReferences("Book a call &rarr;"), "Book a call →");
    assert.equal(decodeCharacterReferences("&larr; Back &middot; 50&percnt;"), "← Back · 50&percnt;");
    assert.equal(decodeCharacterReferences("&#8594; &#x2192; &#X2192;"), "→ → →");
    assert.equal(decodeCharacterReferences("Caf&eacute; &Uuml;ber na&iuml;ve &ccedil;a"), "Café Über naïve ça");
    assert.equal(decodeCharacterReferences("&qacute; &#0; &#xFFFFFFF;"), "&qacute; &#0; &#xFFFFFFF;");
    assert.equal(decodeCharacterReferences("Terms & conditions"), "Terms & conditions");
    // Names a plain object inherits are not references (verifier on #1090).
    assert.equal(decodeCharacterReferences("&constructor; &toString; &hasOwnProperty; &__proto__;"), "&constructor; &toString; &hasOwnProperty; &__proto__;");
  });

  test("one pass: an escaped reference is the literal text", () => {
    assert.equal(decodeCharacterReferences("&amp;rarr;"), "&rarr;");
    assert.equal(decodeCharacterReferences(escapeCharacterReferences("&rarr; & &amp;")), "&rarr; & &amp;");
  });
});

describe("codec — references in the TSX dialect decode as in JSX", () => {
  test("a button label with &rarr; renders an arrow (owner report 2026-10-26)", () => {
    const doc = parseTsx(`<Button href="https://cal.com/acme">Book an onboarding call &rarr;</Button>`);
    assert.equal((doc.blocks[0] as ButtonBlock).text, "Book an onboarding call →");
  });

  test("text, links and string attributes decode too", () => {
    const doc = parseTsx(
      [
        `<Text>Tips &amp; tricks &mdash; weekly</Text>`,
        `<Link href="https://acme.com/?a=1&amp;b=2">Read more &raquo;</Link>`,
        `<Image src="https://acme.com/a.png" alt="Tom &amp; Jerry" />`,
      ].join("\n"),
    );
    assert.equal((doc.blocks[0] as TextBlock).text, "Tips & tricks — weekly");
    const link = doc.blocks[1] as LinkBlock;
    assert.equal(link.text, "Read more »");
    assert.equal(link.href, "https://acme.com/?a=1&b=2");
    assert.equal((doc.blocks[2] as ImageBlock).alt, "Tom & Jerry");
  });

  test("text that literally contains a reference survives print → parse", () => {
    const doc = parseTsx(`<Button href="https://x.co">Type &amp;rarr; for an arrow</Button>\n<Text>Use &amp;nbsp; &amp; friends</Text>`);
    assert.equal((doc.blocks[0] as ButtonBlock).text, "Type &rarr; for an arrow");
    const again = parseTsx(printTsx(doc));
    assert.equal((again.blocks[0] as ButtonBlock).text, "Type &rarr; for an arrow");
    assert.equal((again.blocks[1] as TextBlock).text, "Use &nbsp; & friends");
  });

  test("an <Email> attribute decodes once", () => {
    const doc = parseTsx(`<Email preview-text="Save 20% &mdash; and type &amp;rarr;"><Text>Hi</Text></Email>`);
    assert.equal(doc.previewText, "Save 20% — and type &rarr;");
  });
});

describe("HTML import decodes references once (verifier on #1090)", () => {
  test("an escaped reference in imported HTML stays the literal text", () => {
    const { blocks } = htmlToBlocks(`<a href="https://acme.com">&#38;rarr; next</a><pre>&#38;copy; &amp;lt;b&amp;gt;</pre><p>Caf&eacute; &amp; more&nbsp;today</p>`);
    const texts = blocks.map((b) => (b as { text?: string; code?: string }).text ?? (b as { code?: string }).code);
    assert.ok(texts.includes("&rarr; next"), JSON.stringify(texts));
    assert.ok(texts.includes("&copy; &lt;b&gt;"), JSON.stringify(texts));
    assert.ok(texts.includes("Café & more today"), JSON.stringify(texts));
  });

  test("a numeric reference that spells a named one stays literal in paragraphs and headings", () => {
    const { blocks } = htmlToBlocks(
      `<h2>&#38;copy; head</h2><p>&&#114;arr; plain</p><p><b>&&#114;arr;</b> bold</p><p>Hi&#847;&zwnj;&nbsp;there &#60;b&#62;&#8203;</p>`,
    );
    const texts = blocks.map((b) => (b as { text?: string }).text);
    assert.deepEqual(texts, ["&copy; head", "&rarr; plain", "&rarr; bold", "Hi there <b>"]);
    const bold = (blocks[2] as { content?: Array<{ text: string; marks?: { bold?: boolean } }> }).content;
    assert.equal(bold?.[0]?.text, "&rarr;");
    assert.equal(bold?.[0]?.marks?.bold, true);
  });
});

describe("decoded control characters can't smuggle a script URL (verifier on #1090)", () => {
  test("tab, newline, carriage return and a leading control in a javascript: href render as #", () => {
    for (const ref of ["java&#9;script", "java&#10;script", "java&#13;script", "&#1;javascript", "java&#x9;script"]) {
      const html = renderToHtml(parseTsx(`<Button href="${ref}:alert(1)">Go</Button><Link href="${ref}:alert(1)">Go</Link><Image src="https://x.test/a.png" href="${ref}:alert(1)" alt="A" width={10} />`));
      assert.doesNotMatch(html, /script:alert/i, ref);
    }
  });
});
