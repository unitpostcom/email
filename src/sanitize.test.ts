import assert from "node:assert/strict";
import { test } from "node:test";

import {
  sanitizeEmailHtml,
  hasForbiddenHtml,
  safeUrl,
  safeImageUrl,
  sanitizeDesignHtml,
} from "./sanitize";

test("strips <script> tags and their contents", () => {
  const { html, report, changed } = sanitizeEmailHtml(
    '<p>Hi</p><script>alert(1)</script>',
  );
  assert.equal(html.includes("script"), false);
  assert.equal(html.includes("alert(1)"), false);
  assert.equal(html.includes("Hi"), true);
  assert.equal(report.tags.has("script"), true);
  assert.equal(changed, true);
});

test("strips event-handler attributes", () => {
  const { html, report } = sanitizeEmailHtml(
    '<img src="https://x.test/a.png" onerror="steal()">',
  );
  assert.equal(/onerror/i.test(html), false);
  assert.equal(report.attributes.has("onerror"), true);
});

test("neutralizes javascript: links", () => {
  const { html } = sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>');
  assert.equal(/javascript:/i.test(html), false);
});

test("removes iframe/object/embed and their contents", () => {
  const { html, report } = sanitizeEmailHtml(
    '<iframe src="https://evil.test"></iframe><object data="x"></object>',
  );
  assert.equal(/iframe|object/i.test(html), false);
  assert.equal(report.tags.has("iframe"), true);
});

test("keeps email-safe tags and attributes", () => {
  const input =
    '<table><tr><td style="color:#333"><a href="https://ok.test" title="t">Link</a></td></tr></table>';
  const { html, changed } = sanitizeEmailHtml(input);
  assert.equal(html.includes("<table>"), true);
  assert.equal(html.includes('href="https://ok.test"'), true);
  assert.equal(html.includes("color:#333"), true);
  assert.equal(changed, false);
});

test("cleans dangerous inline CSS but keeps safe declarations", () => {
  const { html } = sanitizeEmailHtml(
    '<div style="color:red;background:url(javascript:alert(1))">x</div>',
  );
  assert.equal(/javascript:/i.test(html), false);
  assert.equal(html.includes("color:red"), true);
});

test("idempotent on clean html (empty report)", () => {
  const input = "<p>Hello <strong>world</strong></p>";
  const { changed, report } = sanitizeEmailHtml(input);
  assert.equal(changed, false);
  assert.equal(report.tags.size, 0);
});

test("keeps <style> blocks with @media responsive CSS (M1)", () => {
  const input =
    "<style>@media (max-width:600px){.col{width:100%!important}} .btn{color:#fff}</style>" +
    '<table class="col"><tr><td class="btn">Hi</td></tr></table>';
  const { html, changed } = sanitizeEmailHtml(input);
  assert.equal(html.includes("<style>"), true);
  assert.equal(html.includes("@media (max-width:600px)"), true);
  assert.equal(html.includes("width:100%!important"), true);
  assert.equal(html.includes(".btn{color:#fff}"), true);
  assert.equal(changed, false);
});

test("sanitizes dangerous CSS inside <style> but keeps the block + safe rules", () => {
  const input =
    "<style>@import url('https://evil.test/x.css'); " +
    ".a{color:red;background:url(javascript:alert(1))} " +
    ".b{behavior:url(x.htc)} " +
    "@media print{.c{display:none}}</style><p>body</p>";
  const { html, report, changed } = sanitizeEmailHtml(input);
  assert.equal(html.includes("<style>"), true);
  // Dangerous bits gone.
  assert.equal(/@import/i.test(html), false);
  assert.equal(/javascript:/i.test(html), false);
  assert.equal(/behavior\s*:/i.test(html), false);
  // Safe rules kept.
  assert.equal(html.includes("color:red"), true);
  assert.equal(html.includes("@media print"), true);
  assert.equal(html.includes("display:none"), true);
  assert.equal(report.styles.size > 0, true);
  assert.equal(changed, true);
});

test("neutralizes a premature </style> inside a style block", () => {
  const input = "<style>.x{color:red} </style><script>alert(1)</script>";
  const { html } = sanitizeEmailHtml(input);
  // The injected </style> + <script> must not survive as live markup.
  assert.equal(/<script/i.test(html), false);
  assert.equal(html.includes("alert(1)"), false);
});

test("hasForbiddenHtml ignores a clean <style> but flags dangerous CSS", () => {
  assert.equal(
    hasForbiddenHtml("<style>@media screen{.a{color:red}}</style><p>x</p>"),
    false,
  );
  assert.equal(
    hasForbiddenHtml("<style>.a{background:url(javascript:alert(1))}</style>"),
    true,
  );
});

test("hasForbiddenHtml detects scripts/handlers/unsafe urls", () => {
  assert.equal(hasForbiddenHtml("<script>x</script>"), true);
  assert.equal(hasForbiddenHtml('<a href="javascript:1">x</a>'), true);
  assert.equal(hasForbiddenHtml('<div onclick="x">y</div>'), true);
  assert.equal(hasForbiddenHtml("<p>clean</p>"), false);
});

test("safeUrl allows safe schemes, blocks javascript:", () => {
  assert.equal(safeUrl("https://x.test"), "https://x.test");
  // A browser removes tabs / newlines anywhere and C0 controls at the ends
  // before reading the scheme (verifier on #1090).
  assert.equal(safeUrl("java\tscript:alert(1)"), "#");
  assert.equal(safeUrl("java\nscr\ript:alert(1)"), "#");
  assert.equal(safeUrl("\u0001 javascript:alert(1)"), "#");
  assert.equal(safeUrl(" https://x.test/a\tb "), "https://x.test/ab");
  assert.equal(safeUrl("mailto:a@b.test"), "mailto:a@b.test");
  assert.equal(safeUrl("/relative/path"), "/relative/path");
  assert.equal(safeUrl("#anchor"), "#anchor");
  assert.equal(safeUrl("{{cta_url}}"), "{{cta_url}}");
  assert.equal(safeUrl("javascript:alert(1)"), "#");
  assert.equal(safeUrl("vbscript:msgbox(1)"), "#");
  assert.equal(safeUrl("data:text/html,<script>1</script>"), "#");
});

test("safeImageUrl permits data:image but not data:text/html", () => {
  assert.equal(
    safeImageUrl("data:image/png;base64,iVBOR"),
    "data:image/png;base64,iVBOR",
  );
  assert.equal(safeImageUrl("data:text/html,<script>1</script>"), "#");
  assert.equal(safeImageUrl("https://x.test/a.png"), "https://x.test/a.png");
});

test("sanitizeDesignHtml cleans html blocks anywhere in the tree", () => {
  const design = {
    blocks: [
      { type: "html", id: "h1", html: '<p>ok</p><script>bad()</script>' },
      {
        type: "row",
        id: "r1",
        columns: [
          {
            type: "column",
            id: "c1",
            width: 100,
            children: [
              {
                type: "html",
                id: "h2",
                html: '<a href="javascript:x()">link</a>',
              },
            ],
          },
        ],
      },
      {
        type: "section",
        id: "s1",
        children: [
          { type: "html", id: "h3", html: '<div onclick="x">nested</div>' },
        ],
      },
    ],
  };
  const { design: clean, changed, report } = sanitizeDesignHtml(design);
  const json = JSON.stringify(clean);
  assert.equal(/script|javascript:|onclick/i.test(json), false);
  assert.equal(json.includes("ok"), true);
  assert.equal(json.includes("nested"), true);
  assert.equal(changed, true);
  assert.equal(report.tags.has("script"), true);
});

test("sanitizeDesignHtml leaves clean designs unchanged", () => {
  const design = {
    blocks: [{ type: "html", id: "h1", html: "<p>safe</p>" }],
  };
  const { changed } = sanitizeDesignHtml(design);
  assert.equal(changed, false);
});

// V140: the <style> placeholder must not be forgeable, and a <style> block can
// never be re-injected inside an attribute value.
test("a forged style placeholder in an attribute can't produce a live handler (V140)", () => {
  const input =
    '<style>" onerror="alert(1)" x="</style><img src=x alt="unitpoststyleblockplaceholderx7f3a0endx7f3a">';
  const { html } = sanitizeEmailHtml(input);
  // The CSS stays raw text inside its own <style>; the img attributes are intact.
  assert.equal(/<img[^>]*\sonerror=/i.test(html), false);
  assert.match(html, /<img src="x" alt="unitpoststyleblockplaceholderx7f3a0endx7f3a" \/>/);
  assert.equal(sanitizeEmailHtml(html).html, html);
});

test("a <style> block written inside an attribute value is dropped, not re-injected (V140)", () => {
  const input = '<img src=x alt="<style>" onerror="alert(1)" x="</style>">';
  const { html } = sanitizeEmailHtml(input);
  assert.equal(html.includes("onerror"), false);
  assert.equal(html, '<img src="x" alt="" />');
});

test("style blocks still come back at text positions, in order", () => {
  const input = "<p>a</p><style>.a{color:red}</style><p>b</p><style>.b{color:blue}</style>";
  const { html } = sanitizeEmailHtml(input);
  assert.equal(html, input);
});

// Verifier on #1381: adjacent placeholders ran together under a greedy nonce
// pattern, so neither stylesheet came back and placeholder text leaked.
test("adjacent <style> blocks both survive, and no placeholder text is left", () => {
  const { html } = sanitizeEmailHtml("<style>.a{color:red}</style><style>.b{color:blue}</style><p>x</p>");
  assert.match(html, /\.a\s*\{\s*color:\s*red/);
  assert.match(html, /\.b\s*\{\s*color:\s*blue/);
  assert.equal(html.includes("unitpoststyle"), false);
});
