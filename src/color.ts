// Colour helpers for email design: WCAG contrast, the label colour that reads
// on a background, same-hue shades that reach a contrast target, and light
// tints of a brand colour. Shared by the design lint (design-lint.ts) and the
// brand palette that themes layout bands (layouts.ts → brandPalette), so "does
// this read?" is answered the same way when we build an email and when we
// check one. Output is always 6-digit hex: classic Outlook rejects 3-digit hex
// and rgba() in colour attributes.

export type Rgb = [number, number, number];

const NAMED: Record<string, string> = { white: "#ffffff", black: "#000000" };

/** #rgb / #rrggbb / rgb(r,g,b) / white / black → [r,g,b] 0–255, else null. */
export function parseColor(input: string | undefined | null): Rgb | null {
  if (!input) return null;
  let c = input.trim().toLowerCase();
  if (c in NAMED) c = NAMED[c]!;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(c);
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.split("").map((x) => x + x).join("") : hex[1]!;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(c);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n))) as Rgb;
  return null;
}

export function toHex(rgb: readonly number[]): string {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Normalise any readable colour to 6-digit hex; unreadable input comes back unchanged. */
export function normalizeHex(input: string): string {
  const c = parseColor(input);
  return c ? toHex(c) : input;
}

export function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio (1–21), or null when either colour can't be read. */
export function contrastRatio(a: string | undefined | null, b: string | undefined | null): number | null {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return null;
  const [hi, lo] = [relativeLuminance(ca), relativeLuminance(cb)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** True when the colour is dark enough that light text belongs on it. */
export function isDark(color: string): boolean {
  const c = parseColor(color);
  return c ? relativeLuminance(c) < 0.18 : false;
}

/** The label colour (white or near-black ink) that reads best on `background`. */
export function readableTextOn(background: string, ink = "#18181b"): string {
  const onWhite = contrastRatio(background, "#ffffff") ?? 0;
  const onInk = contrastRatio(background, ink) ?? 0;
  return onWhite >= onInk ? "#ffffff" : ink;
}

/** Mix `a` toward `b` by `t` (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return a;
  return toHex(ca.map((v, i) => v + (cb[i]! - v) * t));
}

/**
 * The same hue pushed toward black (on a light background) or white (on a
 * dark one) until it reaches `target` contrast, so a brand colour that's too
 * light for small text gets a darker shade of itself rather than grey.
 */
export function shadeToContrast(fg: string, bg: string, target = 4.5): string {
  const b = parseColor(bg);
  if (!parseColor(fg) || !b) return fg;
  if ((contrastRatio(fg, bg) ?? 0) >= target) return normalizeHex(fg);
  const toward = relativeLuminance(b) > 0.4 ? "#000000" : "#ffffff";
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const shade = mix(fg, toward, t);
    if ((contrastRatio(shade, bg) ?? 0) >= target) return shade;
  }
  return toward;
}
