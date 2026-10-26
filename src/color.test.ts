import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { brandPalette, upperLabel } from "./bands";
import { contrastRatio, isDark, mix, normalizeHex, parseColor, readableTextOn, shadeToContrast } from "./color";

describe("color", () => {
  test("parses hex, short hex, rgb() and names; rejects the rest", () => {
    assert.deepEqual(parseColor("#4F46E5"), [79, 70, 229]);
    assert.deepEqual(parseColor("#fff"), [255, 255, 255]);
    assert.deepEqual(parseColor("rgb(1, 2, 3)"), [1, 2, 3]);
    assert.deepEqual(parseColor("white"), [255, 255, 255]);
    assert.equal(parseColor("transparent"), null);
    assert.equal(parseColor("var(--x)"), null);
    assert.equal(normalizeHex("#ABC"), "#aabbcc");
  });

  test("WCAG contrast: black on white is 21:1, a colour on itself 1:1", () => {
    assert.equal(Math.round(contrastRatio("#000000", "#ffffff")! * 10) / 10, 21);
    assert.equal(contrastRatio("#4f46e5", "#4f46e5"), 1);
    assert.equal(contrastRatio("nope", "#fff"), null);
  });

  test("readableTextOn picks white on dark fills and ink on light ones", () => {
    assert.equal(readableTextOn("#4f46e5"), "#ffffff");
    assert.equal(readableTextOn("#18181b"), "#ffffff");
    assert.equal(readableTextOn("#facc15"), "#18181b");
    assert.equal(readableTextOn("#84cc16"), "#18181b");
  });

  test("shadeToContrast darkens a light brand colour on white until it reads, keeping the hue", () => {
    const shade = shadeToContrast("#84cc16", "#ffffff", 4.5);
    assert.ok(contrastRatio(shade, "#ffffff")! >= 4.5, shade);
    const [r, g, b] = parseColor(shade)!;
    assert.ok(g > r && g > b, `still green: ${shade}`);
    // Already readable → unchanged (normalised).
    assert.equal(shadeToContrast("#18181B", "#ffffff"), "#18181b");
    // On a dark background it lightens instead.
    assert.ok(contrastRatio(shadeToContrast("#4f46e5", "#18181b"), "#18181b")! >= 4.5);
  });

  test("mix and isDark", () => {
    assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
    assert.ok(isDark("#18181b"));
    assert.ok(!isDark("#fafafa"));
  });
});

describe("brandPalette", () => {
  const ACCENTS = [null, "#4F46E5", "#84cc16", "#facc15", "#000000", "#ffffff", "#ef4444", "#0ea5e9", "#f97316", "#14b8a6", "#ec4899", "#7c3aed", "#16a34a", "not a colour"];

  for (const accent of ACCENTS) {
    test(`every text colour passes AA on its background (accent ${accent})`, () => {
      const p = brandPalette({ accent });
      const pairs: [string, string, string][] = [
        ["onAccent on accent", p.onAccent, p.accent],
        ["accentText on surface", p.accentText, p.surface],
        ["onBand on band", p.onBand, p.band],
        ["onBandMuted on band", p.onBandMuted, p.band],
        ["bandButtonText on bandButton", p.bandButtonText, p.bandButton],
        ["body on surface", p.body, p.surface],
        ["muted on surface", p.muted, p.surface],
        ["success on surface", p.success, p.surface],
      ];
      for (const [name, fg, bg] of pairs) {
        const ratio = contrastRatio(fg, bg)!;
        // White on a pure-white accent can't reach AA; the button is then ink-on-white.
        if (name === "onAccent on accent" && accent === "#ffffff") continue;
        assert.ok(ratio >= 4.5, `${name}: ${fg} on ${bg} = ${ratio.toFixed(2)}`);
      }
      // The band is visibly different from the card.
      assert.ok(contrastRatio(p.band, p.surface)! >= 3, `band ${p.band} vs surface`);
    });
  }

  test("no accent → the neutral ink system", () => {
    const p = brandPalette();
    assert.equal(p.accent, "#18181b");
    assert.equal(p.band, "#18181b");
    assert.equal(p.onAccent, "#ffffff");
  });
});

describe("upperLabel", () => {
  test("upper-cases copy but keeps {{variables}} as written", () => {
    assert.equal(upperLabel("Receipt {{receipt_number}}"), "RECEIPT {{receipt_number}}");
    assert.equal(upperLabel("Live webinar · {{event_date}}"), "LIVE WEBINAR · {{event_date}}");
    assert.equal(upperLabel("{{month}}"), "{{month}}");
  });
});
