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

test("htmlToPlainText keeps visible content that merely mentions display", () => {
  // A style that is not actually hiding (opacity 0.9, max-height 0.5em) and
  // prose containing the word "hidden" must survive.
  const html =
    '<p style="opacity:0.9;max-height:0.5em">Visible</p><p>Nothing is hidden here.</p>';
  assert.equal(htmlToPlainText(html), "Visible\nNothing is hidden here.");
});
