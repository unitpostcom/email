import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { brandPalette } from "./bands";
import { parseTsxDocument } from "./codec";
import { contrastRatio } from "./color";
import {
  EMAIL_DESIGN_RULES,
  EMAIL_RECIPES,
  EMAIL_RECIPE_KEYS,
  emailDesignGuideMarkdown,
  emailDesignPromptSection,
  emailFontStack,
  getEmailRecipe,
  matchEmailRecipe,
  recipeStarter,
} from "./design-guide";
import { lintEmailDesign } from "./design-lint";
import { EMAIL_ASSETS_BASE, EMAIL_ICONS, EMAIL_ICON_VARIANTS, EMAIL_PLACEHOLDERS } from "./email-assets";
import { getSectionLayout, isThemedLayout } from "./layouts";
import type { Block, EmailDocument } from "./schema";

const here = dirname(fileURLToPath(import.meta.url));

function flat(blocks: Block[]): Record<string, unknown>[] {
  return blocks.flatMap((b) => {
    const r = b as unknown as Record<string, unknown>;
    const kids = [...((r.children as Block[]) ?? []), ...((r.columns as Block[]) ?? [])];
    return [r, ...flat(kids)];
  });
}
const all = (d: EmailDocument) => flat(d.blocks);

const BRANDS = {
  blank: {},
  indigo: { name: "Northwind", accent: "#4F46E5", logo: "/img/0b9c2a8e-1111-4222-8333-444455556666", website: "https://northwind.example" },
  lime: { name: "Fernleaf", accent: "#84cc16", font: "Georgia" },
  yellow: { name: "Sunny", accent: "#facc15" },
} as const;

describe("recipeStarter", () => {
  for (const key of EMAIL_RECIPE_KEYS) {
    for (const [brandName, brand] of Object.entries(BRANDS)) {
      test(`${key} × ${brandName}: round-trips through TSX, lints clean, and is on-brand`, () => {
        const s = recipeStarter(key, brand)!;
        assert.ok(s, key);
        // The agent sends the TSX; what it parses to is what ships.
        const { doc, warnings } = parseTsxDocument(s.tsx);
        assert.deepEqual(warnings, []);
        assert.equal(doc.category, s.recipe.category);
        assert.equal(doc.previewText, s.previewText);
        assert.equal(doc.theme.bodyPadding, 0);
        assert.ok(s.subject.length > 0 && s.subject.length <= 60, s.subject);
        // A starter is a finished shape with sample lines to rewrite: the only
        // hints allowed are those lines (which tell the agent to rewrite them).
        const hints = lintEmailDesign(doc).filter((h) => h.rule !== "placeholder-copy");
        assert.deepEqual(hints, [], JSON.stringify(hints));

        const blocks = all(doc);
        assert.equal(blocks.filter((b) => b.type === "heading" && b.level === 1).length, 1, "exactly one H1");
        // Images: only our hosted assets or the brand's own logo — never an invented URL.
        for (const img of blocks.filter((b) => b.type === "image")) {
          const src = String(img.src);
          assert.ok(src.startsWith(EMAIL_ASSETS_BASE) || src === ("logo" in brand ? brand.logo : undefined), `image src ${src}`);
        }
        // The brand shows: the accent fills the primary button or a band, or (no button by
        // design: codes, newsletters) colours the links and overlines.
        if ("accent" in brand) {
          const p = brandPalette({ accent: brand.accent });
          const fills = blocks.filter((b) => b.type === "button" || b.type === "section" || b.type === "row").map((b) => String(b.backgroundColor ?? "").toLowerCase());
          const hasButton = blocks.some((b) => b.type === "button");
          if (hasButton) assert.ok(fills.includes(p.accent) || fills.includes(p.band), `${key}: no ${p.accent} fill`);
          assert.equal(doc.theme.linkColor, p.accentText);
        }
        // Links come from the brand website when known, otherwise {{variables}} — never example.com.
        const hrefs = blocks.filter((b) => b.type === "button" || b.type === "link").map((b) => String(b.href));
        for (const h of hrefs) assert.ok(/^\{\{\w+\}\}$/.test(h) || h.startsWith("https://northwind.example"), `href ${h}`);
        // Per-recipient links (reset, receipt) stay variables; everything else uses the site.
        if ("website" in brand && hrefs.some((h) => !/^\{\{(reset_url)\}\}$/.test(h))) assert.ok(hrefs.some((h) => h.startsWith(brand.website)), "uses the website");
        // Marketing email never hand-writes the managed footer.
        assert.doesNotMatch(s.tsx, /unsubscribe_url|postal address/i);
      });
    }
  }

  test("with no brand, the sender is a {{company_name}} wordmark and there is no logo image", () => {
    const s = recipeStarter("welcome")!;
    assert.match(s.tsx, /\{\{company_name\}\}/);
    assert.ok(!all(s.document).some((b) => b.type === "image" && !String(b.src).startsWith(EMAIL_ASSETS_BASE)));
  });

  test("a brand logo goes in the header with the brand name as alt", () => {
    const s = recipeStarter("receipt", BRANDS.indigo)!;
    const logo = all(s.document).find((b) => b.type === "image" && b.src === BRANDS.indigo.logo);
    assert.equal(logo?.alt, "Northwind");
  });

  test("unknown keys return null; aliases resolve", () => {
    assert.equal(recipeStarter("nope-not-a-type"), null);
    assert.equal(getEmailRecipe("OTP")?.key, "sign-in-code");
    assert.equal(getEmailRecipe("webinar")?.key, "event-invite");
  });

  test("every recipe's bands are registered, palette-aware layouts", () => {
    for (const r of EMAIL_RECIPES) {
      for (const k of r.bands) {
        assert.ok(getSectionLayout(k), `${r.key}: unknown band ${k}`);
        assert.ok(isThemedLayout(k), `${r.key}: ${k} is not a themed band`);
      }
    }
  });
});

describe("matchEmailRecipe", () => {
  const cases: [string, string | null][] = [
    ["make a welcome email", "welcome"],
    ["Create an onboarding email for new signups", "welcome"],
    ["a receipt", "receipt"],
    ["order confirmation email for my shop", "receipt"],
    ["an email with a one-time code for login", "sign-in-code"],
    ["password reset email", "password-reset"],
    ["send a magic link email template", "password-reset"],
    ["a product launch announcement", "product-launch"],
    ["announce our new feature", "product-launch"],
    ["monthly newsletter", "newsletter"],
    ["a Black Friday sale email, 30% off", "promo"],
    ["win-back email for inactive users", "re-engagement"],
    ["invite people to our webinar", "event-invite"],
    ["something nice", null],
  ];
  for (const [ask, key] of cases) {
    test(`"${ask}" → ${key}`, () => assert.equal(matchEmailRecipe(ask)?.key ?? null, key));
  }
});

describe("emailFontStack", () => {
  test("system stack by default and for fonts email clients won't have", () => {
    assert.match(emailFontStack(), /^-apple-system/);
    assert.match(emailFontStack("Inter"), /^-apple-system/);
  });
  test("a web-safe brand font goes first; a serif brand falls back to the Georgia stack", () => {
    assert.match(emailFontStack("Verdana"), /^Verdana, -apple-system/);
    assert.match(emailFontStack("Trebuchet MS"), /^'Trebuchet MS', /);
    assert.match(emailFontStack("Georgia"), /^Georgia, 'Times New Roman'/);
    assert.match(emailFontStack("Playfair Display"), /^Georgia/);
  });
});

describe("the guide's own text", () => {
  test("EMAIL_DESIGN.md is generated from design-guide.ts (run `npm run guide:write -w @unitpost/email`)", () => {
    const committed = readFileSync(join(here, "..", "EMAIL_DESIGN.md"), "utf8");
    assert.equal(committed, emailDesignGuideMarkdown());
  });

  test("the prompt section carries every core rule and every recipe, and stays compact", () => {
    const p = emailDesignPromptSection();
    for (const r of EMAIL_RECIPES) assert.match(p, new RegExp(`${r.key} \\(${r.category}${r.categoryQuestion ? " or marketing — ask: " : "\\)"}`));
    // A type whose category is a real question carries the question itself.
    assert.match(p, /welcome \(transactional or marketing — ask: Is it sent when someone creates an account/);
    const core = EMAIL_DESIGN_RULES.flatMap((s) => s.rules.filter((r) => r.core));
    assert.ok(core.length >= 15, `core rules: ${core.length}`);
    assert.ok(p.length < 9000, `prompt section is ${p.length} chars`);
    assert.doesNotMatch(p, /`/);
  });

  test("the guide names no vendor and quotes no stock-photo host", () => {
    const md = emailDesignGuideMarkdown();
    assert.doesNotMatch(md, /unsplash\.com|images\.pexels|pixabay\.com\/get/i);
  });
});

describe("hosted email assets", () => {
  const pub = join(here, "..", "..", "..", "apps", "web", "public", "email-assets");
  test("every icon variant and placeholder in the catalog exists as a PNG (render-email-assets.mts)", () => {
    for (const name of Object.keys(EMAIL_ICONS)) {
      for (const v of EMAIL_ICON_VARIANTS) assert.ok(existsSync(join(pub, "icons", `${name}-${v}.png`)), `${name}-${v}.png`);
    }
    for (const name of Object.keys(EMAIL_PLACEHOLDERS)) assert.ok(existsSync(join(pub, "placeholders", `${name}.png`)), name);
    assert.ok(existsSync(join(pub, "LICENSE.md")), "the Lucide licence notice ships with the icons");
  });

  test("starter colours that sit on the band read on it", () => {
    for (const accent of ["#4F46E5", "#84cc16", "#facc15", "#000000"]) {
      const p = brandPalette({ accent });
      assert.ok(contrastRatio(p.onBandMuted, p.band)! >= 4.5);
    }
  });
});
