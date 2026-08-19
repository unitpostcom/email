// Shared low-level helpers for the renderer and codec.

import { safeUrl } from "./sanitize";

// Escape text destined for HTML body/attribute context.
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Substitute {{ variable }} tokens with values from `variables`. Unknown tokens
// are left as-is so a missing value is visible rather than silently blank.
// Whitespace inside the braces is tolerated: {{ first_name }} === {{first_name}}.
export function interpolate(
  input: string,
  variables: Record<string, string> = {},
): string {
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key)
      ? variables[key]
      : match;
  });
}

// Render text content: interpolate variables, then escape. Order matters —
// interpolate first so injected values are also escaped (no HTML injection via
// variable values).
export function renderText(
  input: string,
  variables: Record<string, string> = {},
): string {
  return escapeHtml(interpolate(input, variables));
}

// Turn a style object into an inline style attribute value. Skips
// null/undefined so callers can pass conditional properties.
export function inlineStyle(
  styles: Record<string, string | number | undefined | null>,
): string {
  return Object.entries(styles)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

// Inline run shape (kept structural here to avoid importing the schema into
// low-level util). Mirrors InlineRun from schema.ts.
export type RenderInlineRun = {
  text: string;
  marks?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    link?: string;
    color?: string;
    background?: string;
    fontFamily?: string;
    fontSize?: number;
  };
};

// Render an array of inline runs to email-safe HTML. Each run's text is
// variable-interpolated then escaped (no injection); marks become nested
// inline tags / inline styles. A linked run wraps in <a>; visual marks add a
// <span style>. Plain runs emit just escaped text. `linkColor` styles links
// when the run doesn't set its own color.
export function renderInlineRuns(
  runs: RenderInlineRun[],
  variables: Record<string, string> = {},
  linkColor?: string,
): string {
  return runs
    .map((run) => {
      let html = renderText(run.text, variables);
      const m = run.marks ?? {};
      if (m.bold) html = `<strong>${html}</strong>`;
      if (m.italic) html = `<em>${html}</em>`;
      if (m.underline) html = `<u>${html}</u>`;
      const spanStyle = inlineStyle({
        color: m.color,
        "background-color": m.background,
        "font-family": m.fontFamily,
        "font-size": m.fontSize ? `${m.fontSize}px` : undefined,
      });
      if (m.link) {
        const href = escapeHtml(safeUrl(interpolate(m.link, variables)));
        const aStyle = inlineStyle({
          color: m.color ?? linkColor,
          "background-color": m.background,
          "font-family": m.fontFamily,
          "font-size": m.fontSize ? `${m.fontSize}px` : undefined,
        });
        html = `<a href="${href}" target="_blank"${
          aStyle ? ` style="${aStyle}"` : ""
        }>${html}</a>`;
      } else if (spanStyle) {
        html = `<span style="${spanStyle}">${html}</span>`;
      }
      return html;
    })
    .join("");
}

// Concatenate run text into a plain string (for the `text` fallback field and
// variable scanning).
export function runsToPlain(runs: RenderInlineRun[]): string {
  return runs.map((r) => r.text).join("");
}

// ---------------------------------------------------------------------------
// CSS → Tailwind utility normalizer.
//
// Lets the editor accept raw CSS (pasted declarations or a `customCss`/`style`
// string) and convert the parts it recognizes into Tailwind utilities "on the
// fly", so authored content converges on the canonical className layer. This is
// best-effort: declarations we can't map cleanly are returned in `leftover` as
// a CSS string the caller keeps in `customCss` (passthrough inline fallback),
// so nothing is silently dropped or changed.
//
// Intentionally conservative — only maps declarations with an exact,
// unambiguous utility (px values on the spacing scale, common alignments/
// weights, width/display). Everything else passes through untouched.
// ---------------------------------------------------------------------------

// Reverse of the compiler's px spacing scale (px value → utility numeric key).
const PX_TO_SPACING: Record<string, string> = {
  "0": "0",
  "1px": "px",
  "2px": "0.5",
  "4px": "1",
  "6px": "1.5",
  "8px": "2",
  "10px": "2.5",
  "12px": "3",
  "14px": "3.5",
  "16px": "4",
  "20px": "5",
  "24px": "6",
  "28px": "7",
  "32px": "8",
  "36px": "9",
  "40px": "10",
  "44px": "11",
  "48px": "12",
  "56px": "14",
  "64px": "16",
};

function normUnit(v: string): string {
  const t = v.trim();
  if (t === "0" || t === "0px") return "0";
  return t;
}

export type CssToUtilitiesResult = {
  // Space-separated Tailwind utilities for the declarations we recognized.
  utilities: string;
  // Remaining CSS declarations we couldn't map (keep as customCss). May be "".
  leftover: string;
};

export function cssToUtilities(css: string): CssToUtilitiesResult {
  const utils: string[] = [];
  const leftover: string[] = [];
  if (!css || !css.trim()) return { utilities: "", leftover: "" };

  for (const decl of css.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) {
      if (decl.trim()) leftover.push(decl.trim());
      continue;
    }
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    const mapped = mapDeclaration(prop, value);
    if (mapped) utils.push(mapped);
    else leftover.push(`${prop}: ${value}`);
  }
  return {
    utilities: utils.join(" "),
    leftover: leftover.length ? leftover.join("; ") : "",
  };
}

function spacingUtil(prefix: string, value: string): string | null {
  const key = PX_TO_SPACING[normUnit(value)];
  if (key != null) return `${prefix}-${key}`;
  // Arbitrary value so it still round-trips through the compiler.
  if (/^-?[\d.]/.test(value)) return `${prefix}-[${value.replace(/\s+/g, "_")}]`;
  return null;
}

function mapDeclaration(prop: string, value: string): string | null {
  switch (prop) {
    case "padding":
      return spacingUtil("p", value);
    case "padding-top":
      return spacingUtil("pt", value);
    case "padding-right":
      return spacingUtil("pr", value);
    case "padding-bottom":
      return spacingUtil("pb", value);
    case "padding-left":
      return spacingUtil("pl", value);
    case "margin":
      return value === "0 auto" ? "mx-auto" : spacingUtil("m", value);
    case "margin-top":
      return spacingUtil("mt", value);
    case "margin-bottom":
      return spacingUtil("mb", value);
    case "margin-left":
      return spacingUtil("ml", value);
    case "margin-right":
      return spacingUtil("mr", value);
    case "text-align":
      return value === "left" || value === "center" || value === "right"
        ? `text-${value}`
        : null;
    case "font-weight": {
      const map: Record<string, string> = {
        "400": "font-normal",
        "500": "font-medium",
        "600": "font-semibold",
        "700": "font-bold",
        normal: "font-normal",
        bold: "font-bold",
      };
      return map[value] ?? null;
    }
    case "font-style":
      return value === "italic" ? "italic" : null;
    case "text-decoration":
      return value.includes("underline") ? "underline" : null;
    case "text-transform":
      return value === "uppercase" ||
        value === "lowercase" ||
        value === "capitalize"
        ? value
        : null;
    case "border-radius": {
      const key = PX_TO_SPACING[normUnit(value)];
      // Map common radii to named utilities; otherwise arbitrary.
      const named: Record<string, string> = {
        "0": "rounded-none",
        "2px": "rounded-sm",
        "4px": "rounded",
        "6px": "rounded-md",
        "8px": "rounded-lg",
        "12px": "rounded-xl",
        "16px": "rounded-2xl",
      };
      if (named[normUnit(value)]) return named[normUnit(value)];
      void key;
      return `rounded-[${value.replace(/\s+/g, "_")}]`;
    }
    case "width":
      return value === "100%" ? "w-full" : spacingUtil("w", value);
    case "max-width":
      return value === "100%" ? "max-w-full" : null;
    case "display": {
      const map: Record<string, string> = {
        block: "block",
        "inline-block": "inline-block",
        inline: "inline",
        none: "hidden",
      };
      return map[value] ?? null;
    }
    default:
      return null;
  }
}
