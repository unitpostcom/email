import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectHtmlBackground,
  detectHtmlLayoutWidth,
  fitImportedHtml,
  importedHtmlThemeOverrides,
  isImportedWholeEmail,
  isWholeEmailHtml,
  widenThemeToFit,
} from "./html-import.ts";
import { renderToHtml } from "./render.ts";
import { EmailDocumentSchema } from "./schema.ts";
import { BRAND_THEME } from "./samples.ts";

// Shaped like the AI-written newsletter that was cropped in the editor: a full
// document, a body backdrop, a 100% outer wrap with gutters, a 640px card, and
// media queries that mention other widths.
const NEWSLETTER = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width">
<style>
  body { margin: 0; padding: 0; }
  @media only screen and (max-width: 640px) { .outer-wrap { padding-left: 12px !important; } .card { width: 100% !important; } }
  .hero-map img { width: 180px !important; }
</style></head>
<body style="background-color:#F4F4F5;margin:0;padding:0;font-family:Inter,sans-serif">
<!--[if mso]><table width="800"><tr><td><![endif]-->
<table class="outer-wrap" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#F4F4F5;padding:24px 24px">
  <tr><td align="center">
    <table class="card" width="640" style="max-width:640px;background:#ffffff;border-radius:12px">
      <tr><td style="padding:32px"><img src="https://example.com/hero.png" width="1280" style="width:576px">THIS WEEK IN SRI LANKAN BUILDING.</td></tr>
    </table>
  </td></tr>
</table></body></html>`;

describe("detectHtmlLayoutWidth", () => {
  it("takes the widest fixed layout width, ignoring media queries, comments and images", () => {
    assert.equal(detectHtmlLayoutWidth(NEWSLETTER), 640);
  });

  it("reads width attributes and inline width / max-width on layout tags", () => {
    assert.equal(detectHtmlLayoutWidth(`<div style="max-width:720px;margin:0 auto">x</div>`), 720);
    assert.equal(detectHtmlLayoutWidth(`<table width=560><tr><td>x</td></tr></table>`), 560);
    assert.equal(detectHtmlLayoutWidth(`<td style="width: 480px">x</td>`), 480);
  });

  it("reads em / rem at 16px (a JSX framework's container is max-width:37.5em)", () => {
    assert.equal(detectHtmlLayoutWidth(`<table style="max-width:37.5em;width:100%"><tr><td>x</td></tr></table>`), 600);
    assert.equal(detectHtmlLayoutWidth(`<div style="max-width: 40rem">x</div>`), 640);
  });

  it("ignores min-width, percentages and implausible sizes", () => {
    assert.equal(detectHtmlLayoutWidth(`<table style="min-width:900px" width="100%"><tr><td>x</td></tr></table>`), null);
    assert.equal(detectHtmlLayoutWidth(`<table width="120"><tr><td>x</td></tr></table>`), null);
    assert.equal(detectHtmlLayoutWidth(`<table width="4000"><tr><td>x</td></tr></table>`), null);
  });
});

describe("importedHtmlThemeOverrides: gutter only around a wrapped card", () => {
  it("a bare fixed-width table gets exactly its width (stays centered)", () => {
    assert.equal(importedHtmlThemeOverrides(`<table width="600"><tr><td>x</td></tr></table>`)?.contentWidth, 600);
  });

  it("a 37.5em container from a JSX email framework (the outermost table) gets exactly 600", () => {
    const re = `<!DOCTYPE html><html><body style="background-color:#f6f9fc"><table align="center" width="100%" style="max-width:37.5em;background-color:#ffffff"><tbody><tr><td><table width="100%" style="padding:0 48px"><tbody><tr><td>Hi</td></tr></tbody></table></td></tr></tbody></table></body></html>`;
    const o = importedHtmlThemeOverrides(re);
    assert.equal(o?.contentWidth, 600);
    assert.equal(o?.backgroundColor, "#f6f9fc");
  });
});

describe("detectHtmlBackground", () => {
  it("prefers the <body> backdrop, lower-cased", () => {
    assert.equal(detectHtmlBackground(NEWSLETTER), "#f4f4f5");
  });

  it("falls back to the first full-width table's bgcolor", () => {
    assert.equal(
      detectHtmlBackground(`<table width="100%" bgcolor="#0B0B0F"><tr><td><table width="600"></table></td></tr></table>`),
      "#0b0b0f",
    );
  });

  it("normalizes opaque rgb() to hex", () => {
    assert.equal(detectHtmlBackground(`<body style="background-color:rgb(240, 240, 240)">`), "#f0f0f0");
    assert.equal(detectHtmlBackground(`<body style="background:rgb(1 2 3)">`), "#010203");
    assert.equal(detectHtmlBackground(`<body style="background:rgba(0,0,0,0.5)">`), null);
  });

  it("only trusts hex / rgb values (the result is written into style attributes)", () => {
    assert.equal(detectHtmlBackground(`<body style="background:url(x);background-color:red">`), null);
    assert.equal(detectHtmlBackground(`<body bgcolor="#zzz">`), null);
    assert.equal(detectHtmlBackground(`<body style="background:rgb(300,0,0)">`), null);
  });
});

describe("isWholeEmailHtml", () => {
  it("recognises a document shell or a fixed-width layout table", () => {
    assert.equal(isWholeEmailHtml(NEWSLETTER), true);
    assert.equal(isWholeEmailHtml(`<table width="600"><tr><td>hi</td></tr></table>`), true);
  });

  it("leaves snippets alone", () => {
    assert.equal(isWholeEmailHtml(`<p>Hello <strong>there</strong></p>`), false);
    assert.equal(isWholeEmailHtml(`<table width="100%"><tr><td>a</td><td>b</td></tr></table>`), false);
  });
});

describe("importedHtmlThemeOverrides", () => {
  it("steps the shell aside for a whole email: its width + gutter, its backdrop, no padding or radius", () => {
    assert.deepEqual(importedHtmlThemeOverrides(NEWSLETTER), {
      bodyPadding: 0,
      bodyPaddingSides: undefined,
      bodyRadius: 0,
      contentWidth: 688,
      backgroundColor: "#f4f4f5",
      bodyColor: "#f4f4f5",
    });
  });

  it("returns null for a snippet", () => {
    assert.equal(importedHtmlThemeOverrides(`<p>Just a paragraph</p>`), null);
  });

  it("fits our OWN rendered email (what the MCP guide tells agents to POST)", () => {
    const ours = renderToHtml(
      EmailDocumentSchema.parse({ blocks: [{ type: "text", id: "t", text: "Hi" }] }),
    );
    const o = importedHtmlThemeOverrides(ours);
    assert.ok(o);
    assert.equal(o.contentWidth, 648); // its 600px paper + gutter
    assert.equal(o.bodyRadius, 0);
  });
});

describe("isImportedWholeEmail", () => {
  it("is true only for a body that is exactly one whole-email Html block", () => {
    assert.equal(isImportedWholeEmail({ blocks: [{ type: "html", id: "h", html: NEWSLETTER }] as never }), true);
    assert.equal(
      isImportedWholeEmail({
        blocks: [
          { type: "html", id: "h", html: NEWSLETTER },
          { type: "text", id: "t", text: "x" },
        ] as never,
      }),
      false,
    );
    assert.equal(isImportedWholeEmail({ blocks: [{ type: "html", id: "h", html: "<p>x</p>" }] as never }), false);
  });
});

describe("renderer: bodyPadding 0 is edge-to-edge (as the canvas shows it)", () => {
  it("emits no padding on the body cell, not the 24px default", () => {
    const html = renderToHtml(
      EmailDocumentSchema.parse({
        theme: { bodyPadding: 0 },
        blocks: [{ type: "text", id: "t", text: "Hi" }],
      }),
    );
    const bodyCell = html.match(/class="ee-body[^"]*"[^>]*>\s*<tr><td style="([^"]*)"/)?.[1];
    assert.equal(bodyCell, "padding:0");
  });

  it("still pads 24px when bodyPadding is left at its default", () => {
    const html = renderToHtml(EmailDocumentSchema.parse({ blocks: [{ type: "text", id: "t", text: "Hi" }] }));
    const bodyCell = html.match(/class="ee-body[^"]*"[^>]*>\s*<tr><td style="([^"]*)"/)?.[1];
    assert.equal(bodyCell, "padding:24px");
  });
});

const doc = (blocks: unknown[], theme: Record<string, unknown> = BRAND_THEME) =>
  EmailDocumentSchema.parse({ theme, blocks });
const htmlDoc = (html: string, theme?: Record<string, unknown>) => doc([{ type: "html", id: "h", html }], theme);
const WIDE = NEWSLETTER.replaceAll("640", "720");

describe("fitImportedHtml", () => {
  it("fits a fresh import (no previous document)", () => {
    const out = fitImportedHtml(htmlDoc(NEWSLETTER));
    assert.equal(out.theme.contentWidth, 688);
    assert.equal(out.theme.bodyPadding, 0);
    assert.equal(out.theme.bodyRadius, 0);
    assert.equal(out.theme.backgroundColor, "#f4f4f5");
  });

  it("returns the same object for a snippet, a designed body, or an unchanged body", () => {
    const snippet = htmlDoc("<p>Hi</p>");
    assert.equal(fitImportedHtml(snippet), snippet);
    const designed = doc([{ type: "text", id: "t", text: "Hi" }]);
    assert.equal(fitImportedHtml(designed, designed), designed);
    const fitted = fitImportedHtml(htmlDoc(NEWSLETTER));
    assert.equal(fitImportedHtml(fitted, fitted), fitted);
  });

  it("fits a whole email pasted over a designed body", () => {
    const before = doc([{ type: "text", id: "t", text: "Hi" }]);
    assert.equal(fitImportedHtml(htmlDoc(NEWSLETTER), before).theme.contentWidth, 688);
  });

  it("follows edits to the email's own width while the theme is still the auto-fit", () => {
    const fitted = fitImportedHtml(htmlDoc(NEWSLETTER));
    const edited = { ...fitted, blocks: htmlDoc(WIDE).blocks };
    assert.equal(fitImportedHtml(edited, fitted).theme.contentWidth, 768);
  });

  it("moves only the width on an edit, never re-deriving colors (stored HTML has no <body>)", () => {
    const fitted = fitImportedHtml(htmlDoc(NEWSLETTER));
    const sanitizedEdit = WIDE.replace(/<body[^>]*>/, "").replace("</body>", "");
    const out = fitImportedHtml({ ...fitted, blocks: htmlDoc(sanitizedEdit).blocks }, fitted);
    assert.equal(out.theme.contentWidth, 768);
    assert.equal(out.theme.backgroundColor, "#f4f4f5");
    assert.equal(out.theme.bodyColor, "#f4f4f5");
  });

  it("re-fits fully (backdrop too) when another email is pasted over an untouched fit", () => {
    const fitted = fitImportedHtml(htmlDoc(NEWSLETTER));
    const dark = `<!DOCTYPE html><html><body bgcolor="#0B0B0F"><table width="100%"><tr><td align="center"><table width="600"><tr><td>x</td></tr></table></td></tr></table></body></html>`;
    const out = fitImportedHtml({ ...fitted, blocks: htmlDoc(dark).blocks }, fitted);
    assert.equal(out.theme.contentWidth, 648);
    assert.equal(out.theme.backgroundColor, "#0b0b0f");
  });

  it("never overrides a width set by hand", () => {
    const fitted = fitImportedHtml(htmlDoc(NEWSLETTER));
    const byHand = { ...fitted, theme: { ...fitted.theme, contentWidth: 900 } };
    const edited = { ...byHand, blocks: htmlDoc(WIDE).blocks };
    assert.equal(fitImportedHtml(edited, byHand), edited);
  });

  it("leaves a template imported before the auto-fit alone (Fit is the way out)", () => {
    const legacy = htmlDoc(NEWSLETTER);
    const edited = { ...legacy, blocks: htmlDoc(WIDE).blocks };
    assert.equal(fitImportedHtml(edited, legacy).theme.contentWidth, 560);
  });

  it("does not touch a body with more than the one Html block", () => {
    const fitted = fitImportedHtml(htmlDoc(NEWSLETTER));
    const more = { ...fitted, blocks: [...fitted.blocks, { type: "text", id: "t", text: "x" }] } as typeof fitted;
    assert.equal(fitImportedHtml(more, fitted), more);
  });
});

describe("widenThemeToFit", () => {
  it("steps a legacy imported email's shell aside instead of only widening", () => {
    // 560 paper, 40px padding: the 688px email needs 768 at today's padding.
    const t = widenThemeToFit(htmlDoc(NEWSLETTER), 768);
    assert.equal(t.bodyPadding, 0);
    assert.equal(t.bodyRadius, 0);
    assert.equal(t.contentWidth, 688);
    assert.equal(t.backgroundColor, "#f4f4f5");
  });

  it("then just widens, once the shell is out of the way", () => {
    const fitted = fitImportedHtml(htmlDoc(NEWSLETTER));
    assert.equal(widenThemeToFit(fitted, 740).contentWidth, 740);
  });

  it("only widens a designed body, clamped to 320–1200", () => {
    const designed = doc([{ type: "text", id: "t", text: "Hi" }]);
    const t = widenThemeToFit(designed, 700);
    assert.deepEqual({ ...t, contentWidth: 560 }, designed.theme);
    assert.equal(t.contentWidth, 700);
    assert.equal(widenThemeToFit(designed, 5000).contentWidth, 1200);
  });
});
