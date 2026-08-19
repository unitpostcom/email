// Tailwind utility compiler for the email renderer.
//
// `className` is the CANONICAL authoring layer: authors write utility classes and we LOWER them to the same
// inline-style output the rest of the renderer emits. Email clients don't
// support external/utility CSS, so:
//
//   • inlinable utilities (no breakpoint / no pseudo) compile to a flat
//     declaration map merged onto the element's `style=` attribute.
//   • responsive (`sm:`) and pseudo (`hover:`) utilities CAN'T be inlined, so
//     they're emitted as scoped rules hoisted into a single <head><style> with
//     an auto-generated class the element also carries. This degrades safely:
//     Outlook ignores them, modern clients honor them.
//
// This is intentionally a CURATED subset (the utilities our editor + samples
// emit), not a full Tailwind engine — the output is fully controlled and
// Outlook-tolerant. Unknown classes are ignored (collected in `unknown` for the
// validator/inspector to surface) rather than throwing, so authoring stays
// forgiving.

import type { Theme } from "./schema";

// A hoisted CSS rule (responsive / pseudo) that can't be inlined. The renderer
// collects these across the whole document and writes them into <head><style>.
export type CssRule = {
  // Full selector, e.g. ".tw-a1b2:hover" or media-wrapped (see `media`).
  selector: string;
  // Declarations as a flat property→value map (kebab-case CSS properties).
  declarations: Record<string, string>;
  // When set, the rule is wrapped in `@media (max-width:Npx){ ... }`.
  media?: number;
};

export type CompiledClasses = {
  // Inlinable declarations to merge onto the element `style=` (kebab CSS props).
  inline: Record<string, string>;
  // A generated class name to ADD to the element when any hoisted rule exists
  // (so the responsive/pseudo selectors target it). Empty when none.
  className: string;
  // Hoisted rules (responsive + pseudo) to place in <head><style>.
  rules: CssRule[];
  // Utilities we didn't recognize (kept for the validator / inspector hints).
  unknown: string[];
};

// Email's only meaningful breakpoint is the ~600px content width; map the `sm:`
// prefix to "small screens" (max-width:600px) which is what mobile stacking
// uses elsewhere in the renderer. This is the email-pragmatic reading of `sm:`.
const MOBILE_BREAKPOINT = 600;

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------

// Tailwind's default spacing scale (rem) expressed in PX (email uses px). Keyed
// by the numeric suffix; `px` is the literal 1px. Covers 0–16 + common values.
const SPACING: Record<string, string> = {
  "0": "0",
  px: "1px",
  "0.5": "2px",
  "1": "4px",
  "1.5": "6px",
  "2": "8px",
  "2.5": "10px",
  "3": "12px",
  "3.5": "14px",
  "4": "16px",
  "5": "20px",
  "6": "24px",
  "7": "28px",
  "8": "32px",
  "9": "36px",
  "10": "40px",
  "11": "44px",
  "12": "48px",
  "14": "56px",
  "16": "64px",
  "20": "80px",
  "24": "96px",
};

// Font-size utilities → px + line-height (Tailwind defaults, px-converted).
const FONT_SIZE: Record<string, { size: string; line: string }> = {
  xs: { size: "12px", line: "16px" },
  sm: { size: "14px", line: "20px" },
  base: { size: "16px", line: "24px" },
  lg: { size: "18px", line: "28px" },
  xl: { size: "20px", line: "28px" },
  "2xl": { size: "24px", line: "32px" },
  "3xl": { size: "30px", line: "36px" },
  "4xl": { size: "36px", line: "40px" },
  "5xl": { size: "48px", line: "1" },
};

const FONT_WEIGHT: Record<string, string> = {
  thin: "100",
  extralight: "200",
  light: "300",
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
  black: "900",
};

const RADIUS: Record<string, string> = {
  none: "0",
  sm: "2px",
  "": "4px", // bare `rounded`
  md: "6px",
  lg: "8px",
  xl: "12px",
  "2xl": "16px",
  "3xl": "24px",
  full: "9999px",
};

// A curated slice of the Tailwind color palette (the families email templates
// reach for). Value is the hex. Keyed "family-shade"; bare families map to 500.
const COLORS: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
  "gray-50": "#f9fafb",
  "gray-100": "#f3f4f6",
  "gray-200": "#e5e7eb",
  "gray-300": "#d1d5db",
  "gray-400": "#9ca3af",
  "gray-500": "#6b7280",
  "gray-600": "#4b5563",
  "gray-700": "#374151",
  "gray-800": "#1f2937",
  "gray-900": "#111827",
  "slate-100": "#f1f5f9",
  "slate-500": "#64748b",
  "slate-700": "#334155",
  "slate-900": "#0f172a",
  "zinc-100": "#f4f4f5",
  "zinc-400": "#a1a1aa",
  "zinc-500": "#71717a",
  "zinc-900": "#18181b",
  "red-500": "#ef4444",
  "red-600": "#dc2626",
  "green-500": "#22c55e",
  "green-600": "#16a34a",
  "blue-50": "#eff6ff",
  "blue-500": "#3b82f6",
  "blue-600": "#2563eb",
  "blue-700": "#1d4ed8",
  "indigo-500": "#6366f1",
  "indigo-600": "#4f46e5",
  "amber-500": "#f59e0b",
  "yellow-400": "#facc15",
};

function resolveColor(token: string): string | undefined {
  if (COLORS[token]) return COLORS[token];
  // Bare family (e.g. "blue") → 500 shade.
  if (COLORS[`${token}-500`]) return COLORS[`${token}-500`];
  // Arbitrary value [#aabbcc] / [rgb(...)] / [hsl(...)] — only treat as a COLOR
  // when the inner value actually looks like a color, so `text-[13px]` (a
  // length) isn't misread as a color by the `text` resolver.
  const arb = /^\[(.+)\]$/.exec(token);
  if (arb) {
    const inner = arb[1].replace(/_/g, " ").trim();
    if (/^(#|rgb|hsl|currentcolor$|transparent$)/i.test(inner)) return inner;
  }
  return undefined;
}

// Arbitrary length value like `[12px]`, `[2rem]`, `[50%]`.
function arbitraryLength(token: string): string | undefined {
  const arb = /^\[(.+)\]$/.exec(token);
  return arb ? arb[1].replace(/_/g, " ") : undefined;
}

// ---------------------------------------------------------------------------
// Single-utility resolver: utility (no variant prefix) → CSS declarations.
// Returns null for unrecognized utilities (collected as `unknown`).
// ---------------------------------------------------------------------------
function resolveUtility(
  util: string,
  theme?: Theme,
): Record<string, string> | null {
  // Split into a "prefix" and a value at the LAST dash that precedes a value,
  // but most utilities are `prefix-value`; handle by known prefixes.
  const dash = util.indexOf("-");
  const head = dash === -1 ? util : util.slice(0, dash);
  const tail = dash === -1 ? "" : util.slice(dash + 1);
  const sp = (t: string) => SPACING[t] ?? arbitraryLength(t);

  switch (head) {
    // Padding ---------------------------------------------------------------
    case "p": {
      const v = sp(tail);
      return v != null ? { padding: v } : null;
    }
    case "px": {
      const v = sp(tail);
      return v != null ? { "padding-left": v, "padding-right": v } : null;
    }
    case "py": {
      const v = sp(tail);
      return v != null ? { "padding-top": v, "padding-bottom": v } : null;
    }
    case "pt": {
      const v = sp(tail);
      return v != null ? { "padding-top": v } : null;
    }
    case "pr": {
      const v = sp(tail);
      return v != null ? { "padding-right": v } : null;
    }
    case "pb": {
      const v = sp(tail);
      return v != null ? { "padding-bottom": v } : null;
    }
    case "pl": {
      const v = sp(tail);
      return v != null ? { "padding-left": v } : null;
    }
    // Margin ----------------------------------------------------------------
    case "m": {
      const v = mSp(tail);
      return v != null ? { margin: v } : null;
    }
    case "mx": {
      if (tail === "auto") return { "margin-left": "auto", "margin-right": "auto" };
      const v = mSp(tail);
      return v != null ? { "margin-left": v, "margin-right": v } : null;
    }
    case "my": {
      const v = mSp(tail);
      return v != null ? { "margin-top": v, "margin-bottom": v } : null;
    }
    case "mt": {
      const v = mSp(tail);
      return v != null ? { "margin-top": v } : null;
    }
    case "mr": {
      const v = mSp(tail);
      return v != null ? { "margin-right": v } : null;
    }
    case "mb": {
      const v = mSp(tail);
      return v != null ? { "margin-bottom": v } : null;
    }
    case "ml": {
      const v = mSp(tail);
      return v != null ? { "margin-left": v } : null;
    }
    // Typography ------------------------------------------------------------
    case "text": {
      // text-{size} | text-{color} | text-left/center/right
      if (tail === "left" || tail === "center" || tail === "right")
        return { "text-align": tail };
      if (FONT_SIZE[tail])
        return {
          "font-size": FONT_SIZE[tail].size,
          "line-height": FONT_SIZE[tail].line,
        };
      const color = resolveColor(tail);
      if (color) return { color };
      const arb = arbitraryLength(tail);
      if (arb) return { "font-size": arb };
      return null;
    }
    case "font": {
      if (FONT_WEIGHT[tail]) return { "font-weight": FONT_WEIGHT[tail] };
      if (tail === "sans" || tail === "serif" || tail === "mono") {
        const stacks: Record<string, string> = {
          sans:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          serif: "Georgia, 'Times New Roman', serif",
          mono: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
        };
        return { "font-family": stacks[tail] };
      }
      return null;
    }
    case "leading": {
      const map: Record<string, string> = {
        none: "1",
        tight: "1.25",
        snug: "1.375",
        normal: "1.5",
        relaxed: "1.625",
        loose: "2",
      };
      if (map[tail]) return { "line-height": map[tail] };
      const arb = arbitraryLength(tail);
      if (arb) return { "line-height": arb };
      return null;
    }
    case "tracking": {
      const map: Record<string, string> = {
        tighter: "-0.05em",
        tight: "-0.025em",
        normal: "0",
        wide: "0.025em",
        wider: "0.05em",
        widest: "0.1em",
      };
      return map[tail] != null ? { "letter-spacing": map[tail] } : null;
    }
    case "italic":
      return util === "italic" ? { "font-style": "italic" } : null;
    case "underline":
      return util === "underline" ? { "text-decoration": "underline" } : null;
    case "uppercase":
    case "lowercase":
    case "capitalize":
      return { "text-transform": head };
    // Colors ----------------------------------------------------------------
    case "bg": {
      const color = resolveColor(tail);
      return color ? { "background-color": color } : null;
    }
    case "border": {
      // border (1px solid currentish), border-{color}, border-{width}
      if (util === "border") return { "border": "1px solid #e4e4e7" };
      const color = resolveColor(tail);
      if (color) return { "border-color": color };
      const w = sp(tail);
      if (w != null) return { "border-width": w, "border-style": "solid" };
      return null;
    }
    // Radius ----------------------------------------------------------------
    case "rounded": {
      const key = util === "rounded" ? "" : tail;
      if (RADIUS[key] != null) return { "border-radius": RADIUS[key] };
      const arb = arbitraryLength(tail);
      if (arb) return { "border-radius": arb };
      return null;
    }
    // Sizing ----------------------------------------------------------------
    case "w": {
      if (tail === "full") return { width: "100%" };
      if (tail === "auto") return { width: "auto" };
      const frac = fraction(tail);
      if (frac != null) return { width: frac };
      const v = sp(tail);
      return v != null ? { width: v } : null;
    }
    case "h": {
      if (tail === "full") return { height: "100%" };
      if (tail === "auto") return { height: "auto" };
      const v = sp(tail);
      return v != null ? { height: v } : null;
    }
    case "max": {
      // max-w-{...}
      if (tail.startsWith("w-")) {
        const t = tail.slice(2);
        if (t === "full") return { "max-width": "100%" };
        const arb = arbitraryLength(t);
        if (arb) return { "max-width": arb };
        const v = sp(t);
        return v != null ? { "max-width": v } : null;
      }
      return null;
    }
    // Display / layout ------------------------------------------------------
    case "block":
      return util === "block" ? { display: "block" } : null;
    case "inline": {
      if (util === "inline") return { display: "inline" };
      if (util === "inline-block") return { display: "inline-block" };
      return null;
    }
    case "hidden":
      return util === "hidden" ? { display: "none" } : null;
    case "opacity": {
      const n = Number(tail);
      if (Number.isFinite(n)) return { opacity: String(n / 100) };
      return null;
    }
    default:
      return null;
  }
}

// Margin spacing also supports negative values (e.g. -mt-2 → handled by caller
// stripping the leading "-"; here we just resolve the magnitude with a sign).
function mSp(tail: string): string | undefined {
  return SPACING[tail] ?? arbitraryLength(tail);
}

// width fractions like 1/2, 2/3, 70/100 → percentage.
function fraction(t: string): string | null {
  const m = /^(\d+)\/(\d+)$/.exec(t);
  if (!m) return null;
  const pct = (Number(m[1]) / Number(m[2])) * 100;
  return `${Math.round(pct * 1000) / 1000}%`;
}

// ---------------------------------------------------------------------------
// Public: compileClasses
// ---------------------------------------------------------------------------
let __ruleCounter = 0;
// Deterministic-ish short hash for a class string so identical className inputs
// reuse the same generated selector within a render (keeps output stable).
function hashClass(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = (h * 33) ^ input.charCodeAt(i);
  return "tw-" + (h >>> 0).toString(36);
}

// Compile a `className` string into inlinable declarations + hoisted rules.
// Variant prefixes supported: `sm:` (≤600px), `hover:`. They can stack
// (e.g. `sm:hover:underline`). Negative margins via leading `-`.
export function compileClasses(
  className: string | undefined,
  theme?: Theme,
): CompiledClasses {
  const result: CompiledClasses = {
    inline: {},
    className: "",
    rules: [],
    unknown: [],
  };
  if (!className || !className.trim()) return result;

  // Group hoisted declarations by (media,pseudo) so we emit one rule each.
  const hoisted = new Map<
    string,
    { media?: number; pseudo?: string; decls: Record<string, string> }
  >();

  for (const raw of className.trim().split(/\s+/)) {
    if (!raw) continue;
    const parts = raw.split(":");
    const util = parts[parts.length - 1];
    const variants = parts.slice(0, -1);

    let media: number | undefined;
    let pseudo: string | undefined;
    let recognizedVariants = true;
    for (const v of variants) {
      if (v === "sm" || v === "max-sm") media = MOBILE_BREAKPOINT;
      else if (v === "hover" || v === "focus" || v === "active") pseudo = v;
      else recognizedVariants = false;
    }

    // Negative margins: leading "-" on the utility (e.g. -mt-2).
    const negative = util.startsWith("-");
    const decls = resolveUtility(negative ? util.slice(1) : util, theme);
    if (!decls || !recognizedVariants) {
      result.unknown.push(raw);
      continue;
    }
    if (negative) {
      for (const k of Object.keys(decls)) {
        const val = decls[k];
        decls[k] = val.startsWith("-") ? val.slice(1) : `-${val}`;
      }
    }

    if (media == null && pseudo == null) {
      // Inlinable — later utilities override earlier on the same property.
      Object.assign(result.inline, decls);
      continue;
    }
    const key = `${media ?? ""}|${pseudo ?? ""}`;
    const bucket = hoisted.get(key) ?? { media, pseudo, decls: {} };
    Object.assign(bucket.decls, decls);
    hoisted.set(key, bucket);
  }

  if (hoisted.size > 0) {
    const cls = hashClass(className.trim());
    result.className = cls;
    for (const { media, pseudo, decls } of hoisted.values()) {
      result.rules.push({
        selector: `.${cls}${pseudo ? `:${pseudo}` : ""}`,
        declarations: decls,
        media,
      });
    }
  }
  return result;
}

// Serialize a list of CssRule into a <style> body (no <style> tag itself).
// Identical selectors are NOT merged (callers dedupe rules upstream); media
// rules are wrapped individually for simplicity and Outlook tolerance.
export function rulesToCss(rules: CssRule[]): string {
  const decl = (d: Record<string, string>) =>
    Object.entries(d)
      .map(([k, v]) => `${k}:${v};`)
      .join("");
  return rules
    .map((r) => {
      const body = `${r.selector}{${decl(r.declarations)}}`;
      return r.media != null
        ? `@media only screen and (max-width:${r.media}px){${body}}`
        : body;
    })
    .join("");
}
