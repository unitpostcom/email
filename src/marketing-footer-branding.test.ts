import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDocument } from "./schema";
import { renderToHtml } from "./render";
import {
  buildMarketingFooterFragment,
  readableOn,
  resolveShowPoweredBy,
} from "./marketing-footer-branding";

function marketingDoc() {
  return parseDocument({
    version: 1,
    category: "marketing",
    from: "hi@acme.test",
    previewText: "",
    theme: {},
    variables: [],
    blocks: [{ type: "text", id: "t1", text: "Hello" }],
  });
}

test("buildMarketingFooterFragment puts the brand accent on the unsubscribe <a>", () => {
  const accent = "#16a34a"; // Work Reactor–style green; readable on white
  const footer = buildMarketingFooterFragment(
    {
      brandAccentColor: accent,
      brandTextColor: "#18181b",
      brandFooterBgColor: "#ffffff",
      footerUnsubLabel: "Manage email preferences",
    },
    "tokens",
  );
  const html = renderToHtml(
    marketingDoc(),
    { unsubscribe_url: "https://example.test/u" },
    { marketingFooter: footer, showPoweredBy: false },
  );
  assert.match(html, /Manage email preferences/);
  const expected = readableOn(accent, "#ffffff", 3);
  assert.match(
    html,
    new RegExp(
      `<a href="https://example\\.test/u"[^>]*style="[^"]*color:${expected}[^"]*"`,
    ),
  );
});

test("preview and tokens modes share the same accent on the link block", () => {
  const accent = "#0ea5e9";
  const tokens = buildMarketingFooterFragment(
    { brandAccentColor: accent },
    "tokens",
  );
  const preview = buildMarketingFooterFragment(
    {
      brandAccentColor: accent,
      companyName: "Acme",
      companyAddress: "1 Main",
    },
    "preview",
  );
  const linkTokens = tokens.blocks[0];
  const linkPreview = preview.blocks[0];
  assert.equal(linkTokens?.type, "section");
  assert.equal(linkPreview?.type, "section");
  if (linkTokens?.type !== "section" || linkPreview?.type !== "section") return;
  const a = linkTokens.children.find((c) => c.type === "link");
  const b = linkPreview.children.find((c) => c.type === "link");
  assert.ok(a && a.type === "link");
  assert.ok(b && b.type === "link");
  if (a?.type === "link" && b?.type === "link") {
    assert.equal(a.color, b.color);
    assert.equal(a.color, readableOn(accent, "#ffffff", 3));
  }
});

test("brandFontFamily is baked onto footer text and link blocks", () => {
  const font = 'Georgia, "Times New Roman", Times, serif';
  const footer = buildMarketingFooterFragment(
    {
      brandAccentColor: "#16a34a",
      brandFontFamily: font,
    },
    "tokens",
  );
  const html = renderToHtml(
    marketingDoc(),
    { unsubscribe_url: "https://example.test/u" },
    { marketingFooter: footer, showPoweredBy: false },
  );
  assert.match(html, /font-family:Georgia/);
});

test("resolveShowPoweredBy: protected workspaces always show the pill", () => {
  assert.equal(
    resolveShowPoweredBy({
      isProtected: true,
      brandHideBranding: true,
      canRemoveBranding: true,
    }),
    true,
  );
});

test("resolveShowPoweredBy: customers suppress only when entitled + opted out", () => {
  assert.equal(
    resolveShowPoweredBy({
      isProtected: false,
      brandHideBranding: true,
      canRemoveBranding: true,
    }),
    false,
  );
  assert.equal(
    resolveShowPoweredBy({
      isProtected: false,
      brandHideBranding: true,
      canRemoveBranding: false,
    }),
    true,
  );
  assert.equal(
    resolveShowPoweredBy({
      isProtected: false,
      brandHideBranding: false,
      canRemoveBranding: true,
    }),
    true,
  );
});
