import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EmailDocumentSchema } from "./schema";
import { renderToHtml } from "./render";
import { renderToText } from "./text";
import { renderSimpleHtml, SIMPLE_ALLOWED_TAGS } from "./render-simple";
import { SIMPLE_EMAIL_THEME } from "./simple";

// A Simple email must arrive looking like a message typed in Gmail / Outlook /
// Spark: a bare text/html FRAGMENT the client renders in its own reading pane.
// These tests hold the output to Gmail's exact shapes (Mike, 2026-09-26:
// Spark ↔ Gmail compare) and forbid everything that makes an email look like a
// template.

function doc(blocks: unknown[], overrides: Record<string, unknown> = {}) {
  return EmailDocumentSchema.parse({
    compositionMode: "simple",
    theme: SIMPLE_EMAIL_THEME,
    category: "transactional",
    blocks,
    ...overrides,
  });
}

const t = (text: string, extra: Record<string, unknown> = {}) => ({ type: "text", id: `t${Math.random()}`, text, ...extra });

describe("Simple email — mail-client fragment", () => {
  it("is a bare fragment: no shell, no tables, no width, no background, no font stack, no head CSS", () => {
    const html = renderToHtml(doc([t("Hey yo!"), t(""), t("Second line")]), {}, { showPoweredBy: false });
    assert.equal(html, `<div dir="ltr"><div>Hey yo!</div><div><br></div><div>Second line</div></div>`);
    for (const bad of ["<!doctype", "<html", "<head", "<style", "<table", "max-width", "width=", "background-color", "font-family", "role=\"presentation\""]) {
      assert.ok(!html.includes(bad), `must not contain ${bad}`);
    }
  });

  it("uses Gmail's inline tags: <b> <i> <u> <strike>, span color/size, <a target=_blank>", () => {
    const html = renderSimpleHtml(
      doc([
        {
          type: "text",
          id: "r",
          text: "",
          content: [
            { text: "Hey ", marks: { bold: true } },
            { text: "there", marks: { italic: true, underline: true } },
            { text: " gone", marks: { strike: true } },
            { text: " pink", marks: { color: "#ff00ff", fontSize: 24 } },
            { text: " link", marks: { link: "https://example.com/{{slug}}" } },
          ],
        },
      ]),
      { variables: { slug: "x" } },
    );
    assert.equal(
      html,
      `<div dir="ltr"><div><b>Hey </b><u><i>there</i></u><strike> gone</strike><span style="color:#ff00ff;font-size:24px"> pink</span><a href="https://example.com/x" target="_blank"> link</a></div></div>`,
    );
    assert.ok(!html.includes("<strong>") && !html.includes("<em>"), "Gmail uses <b>/<i>, not <strong>/<em>");
  });

  it("lists are plain <ul>/<ol> with bare <li>; indent is Gmail's 40px margin-left", () => {
    const html = renderSimpleHtml(
      doc([
        { type: "list", id: "l", ordered: false, items: [{ text: "one" }, { text: "two" }] },
        { type: "list", id: "o", ordered: true, items: [{ text: "first" }] },
        t("indented", { padding: { left: 40 } }),
      ]),
    );
    assert.equal(
      html,
      `<div dir="ltr"><ul><li>one</li><li>two</li></ul><ol><li>first</li></ol><div style="margin-left:40px">indented</div></div>`,
    );
  });

  it("a heading is a bold, larger line — not an <h1>", () => {
    const html = renderSimpleHtml(doc([{ type: "heading", id: "h", level: 1, text: "Welcome" }]));
    assert.equal(html, `<div dir="ltr"><div><span style="font-size:large"><b>Welcome</b></span></div></div>`);
  });

  it("only the allowed tag set ever appears", () => {
    const html = renderToHtml(
      doc([{ type: "heading", id: "h", level: 2, text: "Hi" }, t("body"), { type: "list", id: "l", items: [{ text: "a" }] }, { type: "divider", id: "d" }], { category: "marketing" }),
      {},
      { showPoweredBy: true, footerVars: { unsubscribe_url: "https://u.example/x", company_name: "Acme", company_address: "1 Main St" } },
    );
    const tags = [...html.matchAll(/<\/?([a-z0-9]+)/g)].map((m) => m[1]!);
    for (const tag of new Set(tags)) assert.ok((SIMPLE_ALLOWED_TAGS as readonly string[]).includes(tag), `unexpected tag <${tag}>`);
  });

  it("marketing footer is ONE muted text line: sender + Unsubscribe + Sent with Unitpost; transactional has none", () => {
    const marketing = renderToHtml(doc([t("Hi")], { category: "marketing" }), {}, {
      showPoweredBy: true,
      footerVars: { unsubscribe_url: "https://u.example/x", company_name: "Acme", company_address: "1 Main St" },
    });
    assert.match(marketing, /Sent by Acme, 1 Main St/);
    assert.match(marketing, /Unsubscribe/);
    assert.match(marketing, /Sent with <a href="https:\/\/www\.unitpost\.com\?utm_source=email_footer&utm_medium=powered_by_simple"/);
    assert.match(marketing, />Unitpost<\/span><\/a>/);
    assert.ok(!marketing.includes("Powered by"), "the pill copy never appears in Simple");
    const transactional = renderToHtml(doc([t("Hi")]), {}, { showPoweredBy: false });
    assert.equal(transactional, `<div dir="ltr"><div>Hi</div></div>`);
  });

  it("text/plain alternative carries the same lines and the minimal mark", () => {
    const text = renderToText(doc([t("Hey yo!"), t(""), t("Bye")]), {}, { showPoweredBy: true });
    assert.match(text, /Hey yo!/);
    assert.match(text, /Bye/);
    assert.match(text, /Sent with Unitpost/);
    assert.doesNotMatch(text, /Powered by Unitpost/);
  });
});

describe("Sent with Unitpost — cannot be hidden by author CSS, fits any template", () => {
  it("designed shell: the mark has no class/id hook and every visual property is inline !important", async () => {
    const { poweredByHtml, appendPoweredBy } = await import("./render");
    const mark = poweredByHtml({ fontFamily: "Arial", contentWidth: 600 } as never);
    assert.ok(!/class=|id=/.test(mark), "no selector hooks");
    for (const prop of ["display", "visibility", "opacity", "height", "color", "font-size"]) {
      assert.match(mark, new RegExp(`${prop}:[^;"]+ !important`), `${prop} pinned`);
    }
    assert.ok(!mark.includes("background-color:#"), "transparent — no chip background");
    assert.ok(!mark.includes("border:1px"), "no chip border");
    assert.match(mark, /Sent with /);
    assert.doesNotMatch(mark, /Powered by/);
    const html = appendPoweredBy("<html><body><p>hi</p></body></html>");
    assert.ok(html.indexOf("Sent with") < html.indexOf("</body>"), "inserted before </body>");
    assert.ok(appendPoweredBy("<p>fragment</p>").endsWith("</table>"), "appended when there is no body");
  });
  it("the designed renderer no longer exposes a media-query class for the mark", () => {
    const html = renderToHtml(
      EmailDocumentSchema.parse({ compositionMode: "designed", category: "transactional", blocks: [t("x")] }),
      {},
      { showPoweredBy: true },
    );
    assert.ok(!html.includes("ee-pby-wrap"));
    assert.match(html, /Sent with /);
  });
});

describe("textToSimpleDocument — what agents write (Gmail-style text, no Markdown)", () => {
  it("lines, blank lines, lists and inline <b>/<i>/<a> become the fragment; Markdown stays literal", async () => {
    const { textToSimpleDocument } = await import("./simple-text");
    const text = [
      "Hey {{first_name}},",
      "",
      "Quick one — the <b>September update</b> is out:",
      "- Usage alerts at 50/75/90/100%",
      "- Automations meter <i>runs</i>",
      "",
      "1. first",
      "2. second",
      "",
      "Read more: <a href=\"https://unitpost.com/changelog\">changelog</a> — and **this stays literal**",
    ].join("\n");
    const doc = textToSimpleDocument(text, { category: "marketing" });
    assert.equal(doc.compositionMode, "simple");
    const html = renderSimpleHtml(doc, { variables: { first_name: "Sam" } });
    assert.equal(
      html,
      `<div dir="ltr"><div>Hey Sam,</div><div><br></div><div>Quick one — the <b>September update</b> is out:</div><ul><li>Usage alerts at 50/75/90/100%</li><li>Automations meter <i>runs</i></li></ul><div><br></div><ol><li>first</li><li>second</li></ol><div><br></div><div>Read more: <a href="https://unitpost.com/changelog" target="_blank">changelog</a> — and **this stays literal**</div></div>`,
    );
  });
  it("trims leading/trailing blank lines and refuses oversized text", async () => {
    const { textToSimpleDocument } = await import("./simple-text");
    const doc = textToSimpleDocument("\n\nHi\n\n\n");
    assert.equal(doc.blocks.length, 1);
    assert.throws(() => textToSimpleDocument("x".repeat(20_001)), /too long/);
  });
});

// 2026-09-27 report: the pill appeared twice on Designed and on top of Simple's
// line — the engine re-branded HTML the web had already rendered. The mark is
// now idempotent on its URL sentinel in every layer (HTML pill, Simple line,
// text), so no combination of renderer + raw-path can show it twice.
describe("Sent-with mark is idempotent across layers", () => {
  it("appendPoweredBy on an already-branded designed email is a no-op", async () => {
    const { appendPoweredBy, hasPoweredByMark, renderToHtml, EmailDocumentSchema } = await import("./index");
    const d = EmailDocumentSchema.parse({ category: "transactional", blocks: [] });
    const html = renderToHtml(d, {}, { showPoweredBy: true });
    assert.equal(hasPoweredByMark(html), true);
    assert.equal(appendPoweredBy(html), html);
    assert.equal((html.match(/Sent with/g) ?? []).length, 1);
  });
  it("appendPoweredBy on a Simple fragment with its text line is a no-op (no pill on Simple)", async () => {
    const { appendPoweredBy, hasPoweredByMark } = await import("./index");
    const d = doc([t("Testing")], { category: "marketing" });
    const html = renderSimpleHtml(d, { showPoweredBy: true, footer: { companyName: "Work Reactor Inc.", unsubscribeUrl: "https://u.example/x" } });
    assert.equal(hasPoweredByMark(html), true);
    assert.equal(appendPoweredBy(html), html);
    assert.doesNotMatch(html, /<table/);
  });
  it("raw customer HTML gets exactly one mark however many times it passes through", async () => {
    const { appendPoweredBy, appendPoweredByText } = await import("./index");
    const once = appendPoweredBy("<html><body><p>hi</p></body></html>");
    assert.equal(appendPoweredBy(once), once);
    assert.equal((once.match(/Sent with/g) ?? []).length, 1);
    const t = appendPoweredByText("hi");
    assert.equal(appendPoweredByText(t), t);
    assert.equal(t, "hi\n\nSent with Unitpost\n");
  });
  it("renderToText for Simple emits the sentinel too, so a text-only re-append is a no-op", async () => {
    const { renderToText, appendPoweredByText } = await import("./index");
    const d = doc([t("Testing")], { category: "marketing" });
    const text = renderToText(d, {}, { showPoweredBy: true, footerVars: { unsubscribe_url: "https://u.example/x", company_name: "WR" } });
    assert.match(text, /Sent with Unitpost/);
    assert.equal(appendPoweredByText(text), text);
  });
});

// 2026-10-09: "Powered by" read as if Unitpost powered the customer's product,
// and every text part printed the full tracked URL. Every surface now says
// "Sent with Unitpost"; text parts end in that line, words only — no URL,
// no "(unitpost.com)". Plain text cannot embed a link.
describe("Sent with Unitpost — copy and text mark", () => {
  const longUrl = /https?:\/\/www\.unitpost\.com\?utm_/;

  it("every text part ends in the one-line mark, never the tracked URL", async () => {
    const { renderToText, htmlToPlainText, appendPoweredBy, appendPoweredByText, EmailDocumentSchema, POWERED_BY_TEXT } = await import("./index");
    assert.equal(POWERED_BY_TEXT, "Sent with Unitpost");
    const designed = (category: string) => EmailDocumentSchema.parse({ category, blocks: [t("Body")] });
    const footerVars = { unsubscribe_url: "https://u.example/x", company_name: "Acme" };
    const texts = {
      designedTransactional: renderToText(designed("transactional"), {}, { showPoweredBy: true }),
      designedMarketing: renderToText(designed("marketing"), {}, { showPoweredBy: true, footerVars }),
      simpleTransactional: renderToText(doc([t("Body")]), {}, { showPoweredBy: true }),
      simpleMarketing: renderToText(doc([t("Body")], { category: "marketing" }), {}, { showPoweredBy: true, footerVars }),
      rawText: appendPoweredByText("Body"),
      // An html-only API send: the engine derives text from the branded HTML.
      derivedFromRawHtml: htmlToPlainText(appendPoweredBy("<html><body><p>Body</p></body></html>")),
      derivedFromSimple: htmlToPlainText(renderSimpleHtml(doc([t("Body")]), { showPoweredBy: true })),
    };
    for (const [name, text] of Object.entries(texts)) {
      assert.match(text, /Sent with Unitpost$/m, name);
      assert.doesNotMatch(text, longUrl, `${name} prints no tracked URL`);
      assert.doesNotMatch(text, /unitpost\.com/, `${name} prints no domain`);
      assert.doesNotMatch(text, /Powered by/, name);
      assert.equal((text.match(/Sent with Unitpost/g) ?? []).length, 1, `${name} has one mark`);
    }
  });

  it("text parts branded before this change are still recognised (no second mark mid-deploy)", async () => {
    const { appendPoweredByText, hasPoweredByText } = await import("./index");
    const legacy = "hi\n\nPowered by Unitpost\nhttps://www.unitpost.com?utm_source=email_footer&utm_medium=powered_by\n";
    assert.equal(hasPoweredByText(legacy), true);
    assert.equal(appendPoweredByText(legacy), legacy);
  });

  it("Simple's 'Unitpost' link is the footer grey, not white (it vanished on white panes)", () => {
    const html = renderSimpleHtml(doc([t("Hi")]), { showPoweredBy: true });
    assert.doesNotMatch(html, /#ffffff/i);
    assert.match(html, /Sent with <a [^>]*style="color:#888888/);
  });

  it("the mark module is dependency-free (client previews import it directly)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./brand-mark.ts", import.meta.url), "utf8");
    const imports = src.match(/^import .*$/gm) ?? [];
    assert.ok(imports.every((line) => line.startsWith("import type ")), `only type imports: ${imports.join(" | ")}`);
  });
});

