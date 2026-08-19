// Build the workspace marketing-footer fragment from branding fields.
//
// WHY THIS LIVES HERE (not only in the web app): the editor preview derives the
// footer LIVE from branding, but the mailing engine used to render a STORED
// `MarketingFooter.design` snapshot. Those drifted — Brand Kit / branding PATCH
// could update the accent while the snapshot kept an old (or seeded grey/black)
// link color. Recipients then saw a different footer than the editor.
//
// The engine and the web app both call `buildMarketingFooterFragment` so the
// HTML that ships is the same function of branding the locked canvas shows.
// The DB snapshot remains a cache (synced on branding writes) for readers that
// still load it; send paths should prefer this builder.

import { MARKETING_FOOTER_BAND_PADDING_Y } from "./schema";
import { parseFragment, type ComponentFragment } from "./schema";

export const MARKETING_FOOTER_BRANDING_DEFAULTS = {
  footerBg: "#ffffff",
  text: "#18181b",
  accent: "#2563eb",
} as const;

export const MARKETING_FOOTER_COPY_DEFAULTS = {
  intro: "You are receiving this email because you opted in.",
  unsubLabel: "Unsubscribe",
} as const;

export type MarketingFooterBrandingInput = {
  brandFooterBgColor?: string | null;
  brandTextColor?: string | null;
  brandAccentColor?: string | null;
  // Optional CSS font stack (one of FONT_STACKS). Baked onto footer text/link
  // blocks so send HTML doesn't inherit the template body font instead.
  brandFontFamily?: string | null;
  footerIntroText?: string | null;
  footerUnsubLabel?: string | null;
  // Only used in "preview" mode (bake literal company · address). Token mode
  // always emits {{company_name}} · {{company_address}}.
  companyName?: string | null;
  companyAddress?: string | null;
};

const SAFE_DARK = "#18181b";
const SAFE_LIGHT = "#ffffff";

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return 21;
  const la = luminance(ra);
  const lb = luminance(rb);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function contrastText(bg: string): string {
  return contrastRatio(SAFE_LIGHT, bg) >= contrastRatio(SAFE_DARK, bg)
    ? SAFE_LIGHT
    : SAFE_DARK;
}

/** Prefer `color` on `bg` when readable; else the best dark/light fallback. */
export function readableOn(color: string, bg: string, min = 4.5): string {
  return contrastRatio(color, bg) >= min ? color : contrastText(bg);
}

/**
 * Whether the "Powered by Unitpost" pill should render.
 *
 * Protected workspaces (`isProtected: true`, used for the platform's own
 * system mail) ALWAYS show the mark — they can hold hide-branding
 * entitlements, but branded system/transactional mail must keep the mark.
 * Customer workspaces suppress it only when both the stored preference and
 * the plan entitlement say so.
 *
 * Keep this as the single rule for engine send paths, test-send, editor
 * previews, and the public unsubscribe page so none of them can drift.
 *
 * `isProtected` is trusted as-is here — callers must only pass it for
 * workspaces the data layer has already marked protected. A regular
 * customer workspace must never end up with it true and get stuck unable
 * to hide the pill.
 */
export function resolveShowPoweredBy(args: {
  isProtected: boolean;
  brandHideBranding: boolean;
  canRemoveBranding: boolean;
}): boolean {
  if (args.isProtected) return true;
  return !(args.brandHideBranding && args.canRemoveBranding);
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function finePrintColor(textColor: string, bgColor: string): string {
  const fg = hexToRgb(textColor);
  const bg = hexToRgb(bgColor);
  if (!fg || !bg) return "#9ca3af";
  const mix = 0.45;
  const ch = (i: number) =>
    Math.round(fg[i] * (1 - mix) + bg[i] * mix)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

function resolveCopy(
  stored: string | null | undefined,
  fallback: string,
): string {
  const t = stored?.trim();
  return t ? t : fallback;
}

export function footerSurfaceColor(
  branding: Pick<MarketingFooterBrandingInput, "brandFooterBgColor">,
): string {
  return branding.brandFooterBgColor ?? MARKETING_FOOTER_BRANDING_DEFAULTS.footerBg;
}

/**
 * Pure builder: branding fields → marketing footer fragment.
 *
 * - `"tokens"` — keep {{company_name}} / {{company_address}} / use
 *   {{unsubscribe_url}} on the link. Persist + send with this.
 * - `"preview"` — bake company · address as literal text for locked canvases.
 */
export function buildMarketingFooterFragment(
  branding: MarketingFooterBrandingInput,
  mode: "tokens" | "preview",
): ComponentFragment {
  const intro = resolveCopy(
    branding.footerIntroText,
    MARKETING_FOOTER_COPY_DEFAULTS.intro,
  );
  const unsub = resolveCopy(
    branding.footerUnsubLabel,
    MARKETING_FOOTER_COPY_DEFAULTS.unsubLabel,
  );
  const surfaceBg = footerSurfaceColor(branding);
  const textColor = readableOn(
    branding.brandTextColor ?? MARKETING_FOOTER_BRANDING_DEFAULTS.text,
    surfaceBg,
  );
  // Links: slightly lower contrast floor (3:1) so brand accents (greens, etc.)
  // survive on a white band instead of being clamped to near-black — that clamp
  // was a silent WYSIWYG break (editor CSS could still show the raw accent).
  const accent = readableOn(
    branding.brandAccentColor ?? MARKETING_FOOTER_BRANDING_DEFAULTS.accent,
    surfaceBg,
    3,
  );
  const finePrint = finePrintColor(textColor, surfaceBg);
  const fontFamily = branding.brandFontFamily?.trim() || undefined;
  const companyLine =
    mode === "preview"
      ? [branding.companyName, branding.companyAddress]
          .filter((s): s is string => Boolean(s && s.trim()))
          .join(" · ")
      : "{{company_name}} · {{company_address}}";

  return parseFragment({
    blocks: [
      {
        type: "section",
        id: "footer-band",
        backgroundColor: surfaceBg,
        paddingX: 0,
        paddingY: MARKETING_FOOTER_BAND_PADDING_Y,
        children: [
          {
            type: "text",
            id: "f-3",
            align: "center",
            fontSize: 12,
            color: textColor,
            ...(fontFamily ? { fontFamily } : {}),
            className: "text-center text-xs",
            marginBottom: 12,
            text: intro,
          },
          {
            type: "link",
            id: "f-4",
            align: "center",
            fontSize: 12,
            color: accent,
            ...(fontFamily ? { fontFamily } : {}),
            className: "text-center text-xs",
            marginBottom: 12,
            text: unsub,
            href: "{{unsubscribe_url}}",
          },
          ...(companyLine
            ? [
                {
                  type: "text" as const,
                  id: "f-5",
                  align: "center" as const,
                  fontSize: 12,
                  color: finePrint,
                  ...(fontFamily ? { fontFamily } : {}),
                  className: "text-center text-xs",
                  marginBottom: 0,
                  text: companyLine,
                },
              ]
            : []),
        ],
      },
    ],
  });
}
