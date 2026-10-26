// Hosted email assets Unitpost owns: a curated PNG icon set and neutral image
// placeholders. They give a generated email visual rhythm (feature rows,
// event details, status chips) without inventing image URLs: every URL here
// is ours, stable and safe to hotlink from any inbox.
//
// Icons are Lucide (ISC licence; notice in apps/web/public/email-assets/
// LICENSE.md), the same set the dashboard uses, rasterised to PNG at 2x by
// packages/email/scripts/render-email-assets.mts. PNG, not SVG: Gmail and
// classic Outlook don't render SVG reliably. Each icon ships in four looks:
//   ink   — near-black stroke, transparent (beside text on light backgrounds)
//   white — white stroke, transparent (on dark or brand-coloured bands)
//   soft  — near-black icon on a baked-in light grey chip
//   solid — white icon on a baked-in near-black chip
// The chips are part of the image, so they survive clients that drop cell
// backgrounds and dark-mode inversion (images are never inverted).
//
// Placeholders are neutral grey frames with an image glyph: fine in a draft,
// meant to be replaced. lintEmailDesign flags any left in an email.

export const EMAIL_ASSETS_BASE = "https://www.unitpost.com/email-assets";

export const EMAIL_ICON_VARIANTS = ["ink", "white", "soft", "solid"] as const;
export type EmailIconVariant = (typeof EMAIL_ICON_VARIANTS)[number];

/** Display size (px) of each variant; the PNG is 2x. Chips include their padding. */
export const EMAIL_ICON_SIZE: Record<EmailIconVariant, number> = { ink: 24, white: 24, soft: 40, solid: 40 };

// name → what it's for (the agent picks by meaning, not by glyph name).
export const EMAIL_ICONS = {
  check: "done, included, a confirmed step",
  "circle-check": "success, verified, order confirmed",
  sparkles: "new, magic, AI, highlights",
  zap: "fast, instant, automation",
  rocket: "launch, getting started",
  gift: "gift, reward, referral",
  tag: "price, sale tag",
  percent: "discount",
  "badge-percent": "deal, coupon",
  ticket: "ticket, event pass, voucher",
  "shopping-bag": "order, shop, purchase",
  "shopping-cart": "cart, checkout",
  truck: "shipping, delivery",
  package: "product, package, parcel",
  "credit-card": "payment, billing",
  receipt: "receipt, invoice",
  calendar: "date, schedule",
  "calendar-check": "booking confirmed, RSVP",
  clock: "time, duration, reminder",
  "map-pin": "location, venue, address",
  video: "webinar, video call, recording",
  users: "team, community, attendees",
  "user-plus": "invite, sign-up, new member",
  star: "favourite, rating, premium",
  heart: "thanks, love, wellbeing",
  "shield-check": "security, privacy, protected",
  lock: "password, sign-in, locked",
  "key-round": "access, API key, credentials",
  mail: "email, inbox, newsletter",
  inbox: "messages received",
  send: "send, share",
  bell: "notification, alert",
  "message-circle": "chat, reply, support",
  "chart-column": "stats, report, analytics",
  "trending-up": "growth, results",
  settings: "settings, setup, configure",
  "book-open": "guide, docs, read",
  lightbulb: "tip, idea",
  globe: "worldwide, countries, website",
  download: "download, export, app",
  smartphone: "mobile, SMS, app",
  "refresh-cw": "renewal, update, sync",
  "party-popper": "celebration, milestone, welcome",
  trophy: "achievement, winner",
  headphones: "support, podcast",
  "life-buoy": "help, support",
  "arrow-right": "next, continue",
} as const satisfies Record<string, string>;
export type EmailIconName = keyof typeof EMAIL_ICONS;

export function emailIconUrl(name: EmailIconName, variant: EmailIconVariant = "soft"): string {
  return `${EMAIL_ASSETS_BASE}/icons/${name}-${variant}.png`;
}

export const EMAIL_PLACEHOLDERS = {
  wide: { width: 1200, height: 600, use: "hero or feature image (2:1)" },
  landscape: { width: 1200, height: 900, use: "article or product shot (4:3)" },
  square: { width: 800, height: 800, use: "product tile, grid image (1:1)" },
  avatar: { width: 240, height: 240, use: "person: speaker, author, testimonial (circle)" },
} as const;
export type EmailPlaceholderName = keyof typeof EMAIL_PLACEHOLDERS;

export function emailPlaceholderUrl(name: EmailPlaceholderName): string {
  return `${EMAIL_ASSETS_BASE}/placeholders/${name}.png`;
}

/** True for any URL served from our hosted email-asset set. */
export function isEmailAssetUrl(src: string): boolean {
  return src.startsWith(`${EMAIL_ASSETS_BASE}/`);
}
