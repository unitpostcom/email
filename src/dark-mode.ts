// ---------------------------------------------------------------------------
// Dark mode for a Designed email (0.4.0).
//
// Mail clients that honour `prefers-color-scheme` (Apple Mail, iOS Mail,
// Outlook for Mac, some webmail) apply the CSS below when the reader's device
// is dark; Outlook.com's dark mode is reached through its [data-ogsc] /
// [data-ogsb] attribute hooks. Gmail ignores both and applies its own
// inversion, which this can't change.
//
// What changes: the backdrop (.ee-bg), the body card (.ee-body), text whose
// colour is the THEME's text colour (.ee-dm-text), and links in the theme's
// link colour (.ee-dm-link). The renderer only tags text and links that sit on
// the theme's own body card, so copy on a section, row or column with its own
// background keeps its colours (it was chosen against that background).
// Images, buttons and anything given its own colour are never touched.
//
// Opt-in: `theme.darkMode: "auto"` (or `<Email dark-mode="auto">`) turns it
// on. A theme without `darkMode` renders exactly as before 0.4.0, no dark CSS
// and `color-scheme: light dark` (verifier on #1056: on by default it changed
// every existing template sent through /v1, and text given its own dark
// colour went unreadable on the dark card). `"off"` opts a brand out
// explicitly: no dark CSS, and the email declares itself light-only
// (`color-scheme: light`).
// ---------------------------------------------------------------------------

import { contrastRatio, parseColor, shadeToContrast } from "./color";
import type { Theme } from "./schema";

export const DARK_TEXT_CLASS = "ee-dm-text";
export const DARK_LINK_CLASS = "ee-dm-link";
export const DARK_BG_CLASS = "ee-bg";

/**
 * A bg- utility behind a variant (sm:, hover:, …): it applies only at some
 * widths or states, and the dark text colours can't be scoped the same way,
 * so such a block keeps its own (light-mode) text everywhere (render.ts
 * surfaceCtx) and the lint asks for a look (design-lint.ts).
 */
export const CONDITIONAL_BG_RE = /(^|\s)[\w-]+:(?:[\w:-]*:)?bg-(?!(?:transparent|none|inherit|current)(?:\s|$))/;

export type DarkPalette = {
  backgroundColor: string;
  bodyColor: string;
  textColor: string;
  linkColor: string;
};

const DEFAULT_DARK = { backgroundColor: "#0f0f11", bodyColor: "#1c1c1f", textColor: "#ececee" } as const;

export function darkModeEnabled(theme: Pick<Theme, "darkMode">): boolean {
  return theme.darkMode === "auto";
}

/** The dark palette: the theme's darkColors, else derived defaults. */
export function darkPalette(theme: Pick<Theme, "linkColor" | "darkColors">): DarkPalette {
  const o = theme.darkColors ?? {};
  const bodyColor = o.bodyColor ?? DEFAULT_DARK.bodyColor;
  const textColor = o.textColor ?? DEFAULT_DARK.textColor;
  // The light link colour lifted until it reads on the dark card (AA, 4.5:1).
  const linkColor = o.linkColor ?? (parseColor(theme.linkColor) ? shadeToContrast(theme.linkColor, bodyColor, 4.5) : "#8ab4ff");
  return { backgroundColor: o.backgroundColor ?? DEFAULT_DARK.backgroundColor, bodyColor, textColor, linkColor };
}

/** Contrast of the dark palette's text and links on its card (null = unreadable colour). */
export function darkContrast(theme: Pick<Theme, "linkColor" | "darkColors">): { text: number | null; link: number | null } {
  const p = darkPalette(theme);
  return { text: contrastRatio(p.textColor, p.bodyColor), link: contrastRatio(p.linkColor, p.bodyColor) };
}

// Keeps colour syntax only. The slash stays: modern rgb()/hsl() put the alpha
// after it (rgb(28 28 31 / 100%); verifier on #1056). Nothing here can end the
// <style> block or open a comment: "<", "*", ";" and braces are dropped.
const safe = (c: string) => c.replace(/[^#a-zA-Z0-9(),.%/\s-]/g, "");

/** The <style> rules for dark mode ("" when the theme opted out). */
export function darkModeCss(theme: Theme): string {
  if (!darkModeEnabled(theme)) return "";
  const p = darkPalette(theme);
  const bg = `background-color:${safe(p.backgroundColor)} !important;`;
  const card = `background-color:${safe(p.bodyColor)} !important;`;
  const text = `color:${safe(p.textColor)} !important;`;
  const link = `color:${safe(p.linkColor)} !important;`;
  return [
    `:root{color-scheme:light dark;supported-color-schemes:light dark;}`,
    `@media (prefers-color-scheme:dark){`,
    `.${DARK_BG_CLASS}{${bg}}`,
    `.ee-body{${card}}`,
    `.${DARK_TEXT_CLASS}{${text}}`,
    `.${DARK_LINK_CLASS}{${link}}`,
    `}`,
    // Outlook.com dark mode marks recoloured nodes with these attributes.
    `[data-ogsb] .${DARK_BG_CLASS}{${bg}}`,
    `[data-ogsb] .ee-body{${card}}`,
    `[data-ogsc] .${DARK_TEXT_CLASS}{${text}}`,
    `[data-ogsc] .${DARK_LINK_CLASS}{${link}}`,
  ].join("");
}
