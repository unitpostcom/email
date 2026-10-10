import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  EmailDocumentSchema,
  POWERED_BY_SENTINEL,
  appendPoweredBy,
  appendPoweredByText,
  emptyDocument,
  htmlToPlainText,
  renderToHtml,
  renderToText,
} from "./index";
import { SIMPLE_EMAIL_THEME } from "./simple";

// ===========================================================================
// THE BRANDING CONTRACT, for every kind of email we send (2026-10-09).
//
// What a recipient gets at the bottom of an email, by shape:
//   • HTML, designed shell / Code / raw API HTML → the pill: muted "Sent with",
//     the logo, "Unitpost" — one <a> to unitpost.com carrying the sentinel.
//   • HTML, Simple → one subtle text line; "Unitpost" is a grey underlined
//     link. No pill, no logo, no table.
//   • Plain text (every text part, text-only raw sends, text derived from raw
//     HTML) → the words "Sent with Unitpost" as the last line. Never a URL,
//     never "Unitpost (unitpost.com)" — plain text cannot embed a link.
//   • Branding removed (paid + opted out) → nothing at all, in HTML or text.
//   • Whatever path an email takes, at most ONE mark.
//
// The raw-send steps below mirror apps/engine/src/inngest/functions.ts, which
// apps/engine/src/inngest/branding-raw-path.test.ts pins to these helpers.
// ===========================================================================

const UNSUB = "https://u.example/unsub/abc";
const footerVars = { unsubscribe_url: UNSUB, company_name: "Acme Inc", company_address: "1 Main St" };
const t = (id: string, text: string) => ({ type: "text", id, text });

type Shape = "designed" | "code" | "simple";
type Category = "transactional" | "marketing";

function doc(shape: Shape, category: Category) {
  if (shape === "simple") {
    return EmailDocumentSchema.parse({
      compositionMode: "simple",
      theme: SIMPLE_EMAIL_THEME,
      category,
      blocks: [t("a", "Hey Sam,"), t("b", ""), t("c", "BODY-MARKER: your order shipped.")],
    });
  }
  const blocks =
    shape === "code"
      ? [{ type: "html", id: "x", html: "<div><h2>Code</h2><p>BODY-MARKER: hand-written HTML.</p></div>" }]
      : [
          { type: "heading", id: "h", text: "Your order shipped", level: 1 },
          t("p", "BODY-MARKER: on its way."),
          { type: "button", id: "b", text: "Track", href: "https://example.com/track" },
        ];
  return EmailDocumentSchema.parse({ ...emptyDocument(), category, blocks });
}

/** What the engine does to a raw API/SMTP send (see the header). */
function engineRawSend(input: { html?: string; text?: string }, show: boolean) {
  let html = input.html;
  let text = input.text;
  if (show) {
    if (html) html = appendPoweredBy(html);
    if (text) text = appendPoweredByText(text);
  }
  return { html, text: text ?? (html ? htmlToPlainText(html) : undefined) };
}

const marks = (s: string) => (s.match(/Sent with/g) ?? []).length;
const lastLine = (s: string) => s.trim().split("\n").filter((l) => l.trim()).pop() ?? "";

function assertNoMark(html: string | undefined, text: string | undefined, name: string) {
  for (const [part, s] of [["html", html], ["text", text]] as const) {
    if (s === undefined) continue;
    assert.equal(marks(s), 0, `${name} ${part}: no mark when branding is removed`);
    assert.ok(!s.includes(POWERED_BY_SENTINEL), `${name} ${part}: no branding link`);
    assert.ok(!s.includes("web-app-manifest-192x192.png"), `${name} ${part}: no logo`);
  }
}

function assertTextMark(text: string, name: string) {
  assert.equal(marks(text), 1, `${name} text: exactly one mark`);
  assert.match(lastLine(text), /Sent with Unitpost$/, `${name} text: the mark ends the email`);
  assert.doesNotMatch(text, /unitpost\.com|unitpo\.st|https?:\/\/[^\s]*utm_/i, `${name} text: no printed link of ours`);
  assert.doesNotMatch(text, /Powered by/, `${name} text: never "Powered by"`);
}

function assertPill(html: string, name: string) {
  assert.equal(marks(html), 1, `${name} html: exactly one mark`);
  assert.doesNotMatch(html, /Powered by/, `${name} html: never "Powered by"`);
  const link = html.match(new RegExp(`<a [^>]*href="[^"]*${POWERED_BY_SENTINEL}[^"]*"[^>]*>([\\s\\S]*?)</a>`));
  assert.ok(link, `${name} html: the mark is ONE embedded link`);
  assert.match(link![1]!, /Sent with/, `${name} html: link carries "Sent with"`);
  assert.match(link![1]!, /web-app-manifest-192x192\.png/, `${name} html: pill has the logo`);
  assert.match(link![1]!, />Unitpost</, `${name} html: and the wordmark`);
  assert.ok(html.indexOf("BODY-MARKER") < html.indexOf("Sent with"), `${name} html: mark after the body`);
}

function assertSimpleLine(html: string, name: string) {
  assert.equal(marks(html), 1, `${name} html: exactly one mark`);
  assert.doesNotMatch(html, /<table|<img|Powered by/, `${name} html: a text line, not the pill`);
  assert.match(
    html,
    new RegExp(`Sent with <a href="[^"]*${POWERED_BY_SENTINEL}[^"]*"[^>]*style="color:#888888;text-decoration:underline"`),
    `${name} html: "Unitpost" is a grey underlined embedded link`,
  );
  assert.doesNotMatch(html, /#ffffff/i, `${name} html: never white-on-white`);
}

describe("branding contract: templates (designed / Code / Simple × category × branding)", () => {
  for (const shape of ["designed", "code", "simple"] as const) {
    for (const category of ["transactional", "marketing"] as const) {
      for (const show of [true, false]) {
        const name = `${shape} ${category} ${show ? "branded" : "branding removed"}`;
        test(name, () => {
          const d = doc(shape, category);
          const html = renderToHtml(d, {}, { showPoweredBy: show, footerVars });
          const text = renderToText(d, {}, { showPoweredBy: show, footerVars });
          assert.match(html, /BODY-MARKER/);
          assert.match(text, /BODY-MARKER/);

          if (show) {
            if (shape === "simple") assertSimpleLine(html, name);
            else assertPill(html, name);
            assertTextMark(text, name);
            // A layer that re-brands (engine raw path without the flag) adds nothing.
            assert.equal(appendPoweredBy(html), html, `${name}: html re-brand is a no-op`);
            assert.equal(appendPoweredByText(text), text, `${name}: text re-brand is a no-op`);
            // Text derived from the rendered HTML says the same thing.
            assertTextMark(htmlToPlainText(html), `${name} (derived)`);
          } else {
            assertNoMark(html, text, name);
          }

          // Compliance is independent of branding: marketing always unsubscribes.
          if (category === "marketing") {
            assert.ok(html.includes(UNSUB), `${name}: html has the unsubscribe link`);
            assert.ok(text.includes(UNSUB), `${name}: text has the unsubscribe URL`);
          } else {
            assert.ok(!html.includes(UNSUB) && !text.includes(UNSUB), `${name}: no unsubscribe on transactional`);
          }
        });
      }
    }
  }
});

describe("branding contract: raw API / SMTP sends", () => {
  const BODY_HTML = `<!doctype html><html><body><div>BODY-MARKER: raw html</div></body></html>`;
  const FRAGMENT = `<p>BODY-MARKER: fragment, no body tag</p>`;
  const TEXT = "Hi Sam,\n\nBODY-MARKER: raw text\n\nMike";
  const cases: Record<string, { html?: string; text?: string }> = {
    "html with <body>": { html: BODY_HTML },
    "html fragment": { html: FRAGMENT },
    "text only": { text: TEXT },
    "html + text": { html: BODY_HTML, text: TEXT },
  };

  for (const [label, input] of Object.entries(cases)) {
    test(`${label}, branded`, () => {
      const out = engineRawSend(input, true);
      if (out.html) {
        assertPill(out.html, label);
        if (input.html === BODY_HTML) {
          assert.ok(out.html.indexOf("Sent with") < out.html.indexOf("</body>"), `${label}: mark inside </body>`);
        }
      }
      assertTextMark(out.text!, label);
      // The same payload through the pipeline twice still carries one mark.
      const twice = engineRawSend(out, true);
      assert.equal(twice.html, out.html, `${label}: html idempotent`);
      assert.equal(twice.text, out.text, `${label}: text idempotent`);
    });

    test(`${label}, branding removed`, () => {
      const out = engineRawSend(input, false);
      assertNoMark(out.html, out.text, label);
      assert.match(out.text!, /BODY-MARKER/, `${label}: body survives`);
    });
  }

  test("a template rendered by the web (test-send) and handed to the engine is not branded twice", () => {
    // Web renders with branding, sets brandingApplied, the engine skips; even if
    // it did not skip, the helpers recognise our own mark.
    const d = doc("designed", "marketing");
    const html = renderToHtml(d, {}, { showPoweredBy: true, footerVars });
    const text = renderToText(d, {}, { showPoweredBy: true, footerVars });
    const out = engineRawSend({ html, text }, true);
    assert.equal(marks(out.html!), 1);
    assert.equal(marks(out.text!), 1);
  });

  test("text branded before 2026-10-09 (old URL line) is not branded again mid-deploy", () => {
    const legacy = "Hi\n\nPowered by Unitpost\nhttps://www.unitpost.com?utm_source=email_footer&utm_medium=powered_by\n";
    assert.equal(engineRawSend({ text: legacy }, true).text, legacy);
  });
});

// Dev test 2026-10-09: a text-only send whose BODY quoted the phrase "Sent
// with Unitpost" went out with no mark — the idempotency check matched the
// phrase anywhere. Only the last line counts now.
describe("text mark: a mention in the body is not the mark", () => {
  test("raw text that quotes the phrase mid-body still ends with the mark", () => {
    const body = 'Hi Mike,\n\nIt should end with the words "Sent with Unitpost" and no link.\n\nMike';
    const out = engineRawSend({ text: body }, true);
    assert.match(lastLine(out.text!), /^Sent with Unitpost$/);
    assert.equal(engineRawSend(out, true).text, out.text, "and stays idempotent");
  });

  test("a body that ENDS with our line (already branded) is left alone", () => {
    const branded = "Hi\n\nSent with Unitpost\n";
    assert.equal(appendPoweredByText(branded), branded);
  });
});

// Dev test 2026-10-09: the marketing footer read "Unitpost System ·" — the
// company line `{{company_name}} · {{company_address}}` with no address set.
describe("marketing footer company line never dangles a separator", async () => {
  const { buildMarketingFooterFragment } = await import("./marketing-footer-branding");
  const fragment = buildMarketingFooterFragment({}, "tokens");
  const cases: [string, Record<string, string>, string | null][] = [
    ["name only", { company_name: "Unitpost System", company_address: "" }, "Unitpost System"],
    ["address only", { company_name: "", company_address: "1 Main St" }, "1 Main St"],
    ["both", { company_name: "Acme", company_address: "1 Main St" }, "Acme · 1 Main St"],
    ["neither", { company_name: "", company_address: "" }, null],
  ];
  for (const [label, vars, expected] of cases) {
    test(label, () => {
      const html = renderToHtml(doc("designed", "marketing"), {}, {
        showPoweredBy: true,
        marketingFooter: fragment,
        footerVars: { unsubscribe_url: UNSUB, ...vars },
      });
      assert.doesNotMatch(html, />\s*(?:·|&middot;)\s*</, `${label}: no line that is only a separator`);
      assert.doesNotMatch(html, /[A-Za-z0-9]\s*·\s*<\/(?:p|span|a)>/, `${label}: no trailing separator`);
      assert.doesNotMatch(html, /<(?:p|span)[^>]*>\s*·\s*[A-Za-z0-9]/, `${label}: no leading separator`);
      if (expected) assert.ok(html.includes(expected), `${label}: shows "${expected}"`);
    });
  }
});
