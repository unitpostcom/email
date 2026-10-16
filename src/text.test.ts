import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ComponentFragmentSchema,
  parseDocument,
} from "./schema";
import { htmlToPlainText, renderToText } from "./text";

test("renderToText keeps copy, resolved variables, and link destinations", () => {
  const doc = parseDocument({
    version: 5,
    category: "transactional",
    blocks: [
      {
        type: "heading",
        id: "heading",
        text: "Hello {{first_name}}",
      },
      {
        type: "text",
        id: "body",
        text: "Review your proposal",
        content: [
          { text: "Review your " },
          {
            text: "proposal",
            marks: {
              bold: true,
              link: "https://example.com/proposals/{{proposal_id}}",
            },
          },
        ],
      },
      {
        type: "button",
        id: "button",
        text: "Open account",
        href: "https://example.com/account",
      },
    ],
  });

  assert.equal(
    renderToText(
      doc,
      { first_name: "Sam", proposal_id: "p-42" },
      { showPoweredBy: false },
    ),
    [
      "Hello Sam",
      "Review your proposal (https://example.com/proposals/p-42)",
      "Open account\nhttps://example.com/account",
    ].join("\n\n"),
  );
});
test("renderToText appends the same resolved marketing compliance content", () => {
  const doc = parseDocument({
    version: 5,
    category: "marketing",
    blocks: [{ type: "text", id: "body", text: "Monthly update" }],
  });
  const marketingFooter = ComponentFragmentSchema.parse({
    blocks: [
      {
        type: "section",
        id: "footer",
        children: [
          {
            type: "text",
            id: "company",
            text: "{{company_name}} · {{company_address}}",
          },
          {
            type: "link",
            id: "unsubscribe",
            text: "Unsubscribe",
            href: "{{unsubscribe_url}}",
          },
        ],
      },
    ],
  });

  assert.equal(
    renderToText(doc, {}, {
      marketingFooter,
      footerVars: {
        company_name: "Acme",
        company_address: "1 Main Street",
        unsubscribe_url: "https://example.com/unsubscribe/token",
      },
      showPoweredBy: false,
    }),
    [
      "Monthly update",
      "Acme · 1 Main Street",
      "Unsubscribe (https://example.com/unsubscribe/token)",
    ].join("\n\n"),
  );
});

test("htmlToPlainText removes markup without losing paragraphs and links", () => {
  assert.equal(
    htmlToPlainText(
      '<p>Hello <strong>Sam</strong>.</p><p><a href="https://example.com">Open account</a></p>',
    ),
    "Hello Sam.\nOpen account (https://example.com)",
  );
});

test("htmlToPlainText cannot crash on an out-of-range numeric entity", () => {
  assert.doesNotThrow(() => htmlToPlainText("<p>&#999999999999;</p>"));
});

// The derived text alternative is what a recipient reads when their client
// prefers text/plain. Anything invisible in the HTML variant must not become
// visible here — the classic leak is the hidden inbox preheader, which would
// otherwise land as the first line of the email.
test("htmlToPlainText drops document metadata and hidden preheaders", () => {
  const html = [
    "<!DOCTYPE html><html><head><title>Your receipt</title>",
    "<style>.x{color:red}</style></head><body>",
    '<span style="display:none;font-size:1px;max-height:0;overflow:hidden">Preheader snippet&nbsp;&zwnj;</span>',
    '<div class="preheader" style="display:none !important;visibility:hidden;">Another hidden preheader</div>',
    '<div style="mso-hide:all">Outlook-only hidden</div>',
    '<p aria-hidden="true">aria hidden</p>',
    "<h1>Thanks, Sam!</h1>",
    "</body></html>",
  ].join("");
  assert.equal(htmlToPlainText(html), "Thanks, Sam!");
});

test("htmlToPlainText separates table cells and ignores tracking pixels", () => {
  const html = [
    "<table><tr><td>Subtotal</td><td>$10</td></tr><tr><td>Tax</td><td>$1</td></tr></table>",
    '<img src="https://track.example.com/open.gif" width="1" height="1" alt="">',
    '<img src="https://cdn.example.com/spacer.gif" width="1" height="20">',
  ].join("");
  assert.equal(htmlToPlainText(html), "Subtotal $10\nTax $1");
});

// Gmail renders an inline image as "[image: <alt>]" in its text/plain part; a
// linked image keeps the destination the same way a text link does.
test("htmlToPlainText renders images with alt as Gmail-style placeholders", () => {
  const html = [
    '<p><img src="https://cdn.example.com/logo.png" alt="Acme  Logo" width="120"></p>',
    '<p><a href="https://acme.com"><img src="https://cdn.example.com/hero.png" alt="See what&#39;s new"></a></p>',
    '<p><img src="https://cdn.example.com/hidden.png" alt="Hidden" style="display:none"></p>',
  ].join("");
  assert.equal(
    htmlToPlainText(html),
    "[image: Acme Logo]\n[image: See what's new] (https://acme.com)",
  );
});

test("renderToText renders image blocks with the same placeholder convention", () => {
  const doc = parseDocument({
    version: 5,
    category: "transactional",
    blocks: [
      { type: "image", id: "a", src: "https://cdn.example.com/logo.png", alt: "{{brand}} logo" },
      { type: "image", id: "b", src: "https://cdn.example.com/x.png", alt: "Open", href: "https://example.com" },
      { type: "image", id: "c", src: "https://cdn.example.com/pixel.gif", alt: "" },
    ],
  });
  assert.equal(
    renderToText(doc, { brand: "Acme" }, { showPoweredBy: false }),
    "[image: Acme logo]\n\n[image: Open] (https://example.com)",
  );
});

// System emails render with links: false: every body link keeps its words and
// drops its URL. The marketing footer and the powered-by line are untouched.
const linkedDoc = parseDocument({
  version: 5,
  category: "transactional",
  blocks: [
    {
      type: "text",
      id: "body",
      text: "Review your proposal",
      content: [
        { text: "Review your " },
        { text: "proposal", marks: { link: "https://example.com/p/{{id}}" } },
      ],
    },
    { type: "button", id: "button", text: "Open account", href: "https://example.com/account" },
    { type: "button", id: "bare", text: "", href: "https://example.com/bare" },
    { type: "link", id: "link", text: "Read the docs", href: "https://example.com/docs" },
    { type: "image", id: "image", src: "https://cdn.example.com/x.png", alt: "Open", href: "https://example.com" },
    { type: "markdown", id: "md", markdown: "Next: [Add a domain](https://example.com/domains)" },
  ],
});

test("renderToText with links: false prints labels and no URLs", () => {
  assert.equal(
    renderToText(linkedDoc, { id: "p-42" }, { showPoweredBy: false, links: false }),
    [
      "Review your proposal",
      "Open account",
      "Read the docs",
      "[image: Open]",
      "Next: Add a domain",
    ].join("\n\n"),
  );
});

test('renderToText with links: "action" prints a button as one labeled line and no other URL', () => {
  assert.equal(
    renderToText(linkedDoc, { id: "p-42" }, { showPoweredBy: false, links: "action" }),
    [
      "Review your proposal",
      "Open account: https://example.com/account",
      "https://example.com/bare",
      "Read the docs",
      "[image: Open]",
      "Next: Add a domain",
    ].join("\n\n"),
  );
});

test("renderToText keeps link destinations by default", () => {
  const expected = [
    "Review your proposal (https://example.com/p/p-42)",
    "Open account\nhttps://example.com/account",
    "https://example.com/bare",
    "Read the docs (https://example.com/docs)",
    "[image: Open] (https://example.com)",
    "Next: Add a domain (https://example.com/domains)",
  ].join("\n\n");
  assert.equal(renderToText(linkedDoc, { id: "p-42" }, { showPoweredBy: false }), expected);
  assert.equal(
    renderToText(linkedDoc, { id: "p-42" }, { showPoweredBy: false, links: true }),
    expected,
  );
});

test("renderToText with links: false leaves the marketing footer and powered-by line as they are", () => {
  const doc = parseDocument({
    version: 5,
    category: "marketing",
    blocks: [{ type: "link", id: "body", text: "Shop", href: "https://example.com/shop" }],
  });
  const marketingFooter = ComponentFragmentSchema.parse({
    blocks: [{ type: "link", id: "unsubscribe", text: "Unsubscribe", href: "{{unsubscribe_url}}" }],
  });
  const options = {
    marketingFooter,
    footerVars: { unsubscribe_url: "https://example.com/unsubscribe/token" },
  };
  const withLinks = renderToText(doc, {}, options);
  const withoutLinks = renderToText(doc, {}, { ...options, links: false });
  assert.equal(withoutLinks, withLinks.replace("Shop (https://example.com/shop)", "Shop"));
  assert.match(withoutLinks, /Unsubscribe \(https:\/\/example\.com\/unsubscribe\/token\)/);
});

test("htmlToPlainText keeps visible content that merely mentions display", () => {
  // A style that is not actually hiding (opacity 0.9, max-height 0.5em) and
  // prose containing the word "hidden" must survive.
  const html =
    '<p style="opacity:0.9;max-height:0.5em">Visible</p><p>Nothing is hidden here.</p>';
  assert.equal(htmlToPlainText(html), "Visible\nNothing is hidden here.");
});
