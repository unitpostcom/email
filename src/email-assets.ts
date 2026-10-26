// Hosted email assets Unitpost owns: a curated PNG icon set and neutral image
// placeholders. They give a generated email visual rhythm (feature rows,
// event details, status chips) without inventing image URLs: every URL here
// is ours, stable and safe to hotlink from any inbox.
//
// Icons are Lucide (ISC licence; notice in apps/web/public/email-assets/
// LICENSE.md), the same set the dashboard uses, rasterised to PNG at 2x by
// packages/email/scripts/render-email-assets.mts. PNG, not SVG: Gmail and
// classic Outlook don't render SVG reliably. Each icon ships in four looks:
//   ink   — near-black stroke, transparent (beside text on light backgrounds;
//           a dark-mode email swaps it to `white` on the darkened card)
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
  // Added 2026-10-26 (owner: "add as many as reasonable"). Files are permanent
  // once shipped: add names, never rename or remove one.
  // status and feedback
  "check-check": "all done, read, completed",
  "circle-x": "failed, declined, cancelled",
  "circle-alert": "needs attention, action required",
  "triangle-alert": "warning, important notice",
  info: "information, note",
  "circle-help": "question, FAQ",
  "badge-check": "verified, approved, official",
  "thumbs-up": "like, approval, feedback",
  smile: "happy, satisfaction survey",
  vote: "vote, poll, survey",
  // rewards and status
  award: "award, certificate",
  medal: "ranking, top place",
  crown: "VIP, premium tier",
  gem: "exclusive, premium",
  flame: "hot, trending, streak",
  coins: "credits, points, loyalty",
  infinity: "unlimited, forever",
  // people and community
  user: "account, profile",
  "user-check": "verified member, approved",
  contact: "contact details",
  handshake: "partnership, deal, welcome",
  "hand-heart": "charity, donation, care",
  "messages-square": "conversation, community, forum",
  "message-square": "message, comment",
  headset: "support agent, live help",
  megaphone: "announcement, campaign",
  newspaper: "news, press, blog",
  mic: "podcast, talk, speaker",
  presentation: "webinar, demo, talk",
  "graduation-cap": "course, learning, school",
  languages: "languages, translation",
  accessibility: "accessibility",
  // email and contact
  "mail-open": "opened, read email",
  "mail-check": "email confirmed, verified address",
  "at-sign": "email address, handle",
  phone: "phone number",
  "phone-call": "call us",
  "bell-ring": "alert, reminder ringing",
  "share-2": "share",
  link: "link",
  "external-link": "opens a website",
  // time and scheduling
  "calendar-days": "dates, schedule, agenda",
  "calendar-clock": "appointment, scheduled time",
  "calendar-x": "cancelled booking",
  hourglass: "ending soon, waiting",
  timer: "countdown, limited time",
  "alarm-clock": "reminder, deadline",
  repeat: "subscription, recurring",
  "rotate-ccw": "return, refund, undo",
  // money and commerce
  wallet: "wallet, balance, payout",
  banknote: "cash, payment, payout",
  "piggy-bank": "savings",
  landmark: "bank, finance",
  "circle-dollar-sign": "price, cost",
  "dollar-sign": "money, price",
  euro: "euro price",
  "trending-down": "price drop, decrease",
  "ticket-percent": "promo code",
  tags: "pricing, labels",
  store: "store, retail",
  "shopping-basket": "groceries, basket",
  "package-check": "delivered, order complete",
  "package-open": "unboxing, order arrived",
  boxes: "inventory, stock",
  warehouse: "fulfilment, warehouse",
  barcode: "product code, SKU",
  "qr-code": "QR code, scan to open",
  "file-text": "document, terms, contract",
  "file-check": "signed, approved document",
  "clipboard-list": "checklist, to-do",
  "list-checks": "steps, onboarding checklist",
  "pen-line": "sign, write",
  pencil: "edit, update",
  briefcase: "work, jobs, business",
  "building-2": "company, office",
  house: "home, address, real estate",
  // data and product
  "chart-line": "trend, performance",
  "chart-pie": "breakdown, share",
  activity: "activity, live metrics",
  target: "goal, target",
  flag: "milestone",
  bookmark: "saved, bookmarked",
  "layout-dashboard": "dashboard",
  layers: "plans, tiers",
  "sliders-horizontal": "preferences, filters",
  puzzle: "integration, add-on",
  plug: "connect, integration",
  code: "developer, API",
  terminal: "command line, developer",
  database: "data, storage",
  bot: "AI assistant, bot",
  brain: "AI, insights",
  "wand-sparkles": "magic, AI generation",
  wrench: "maintenance, fix",
  eye: "preview, view",
  "eye-off": "privacy, hidden",
  shield: "protection, safety",
  "lock-open": "unlocked, access granted",
  "log-in": "sign in",
  upload: "upload, import",
  "cloud-upload": "backup, sync to cloud",
  laptop: "desktop app, computer",
  monitor: "screen, display",
  camera: "photo, photos",
  image: "gallery, images",
  "circle-play": "watch the video",
  music: "music, playlist",
  palette: "design, branding",
  // travel, food and lifestyle
  plane: "flight, travel",
  luggage: "trip, baggage",
  hotel: "stay, hotel",
  car: "car, ride",
  "train-front": "train, commute",
  bike: "cycling",
  map: "map, directions",
  compass: "explore, discover",
  mountain: "outdoors, adventure",
  utensils: "food, restaurant",
  coffee: "coffee, café, catch-up",
  wine: "drinks, dinner",
  cake: "birthday, anniversary",
  shirt: "fashion, apparel",
  dumbbell: "fitness, workout",
  "heart-pulse": "health, wellness",
  stethoscope: "medical, doctor",
  pill: "pharmacy, medication",
  apple: "nutrition, healthy food",
  "paw-print": "pets",
  // seasons and nature
  sun: "summer, daytime",
  moon: "night, evening",
  snowflake: "winter, holiday season",
  "tree-pine": "holidays, nature",
  leaf: "eco, autumn",
  sprout: "growth, new beginning",
  recycle: "recycling, sustainability",
  umbrella: "insurance, protection",
  "battery-charging": "energy, charging",
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

/** The icon name and look of one of our hosted icon URLs; null for anything else. */
export function parseEmailIconUrl(src: string): { name: string; variant: EmailIconVariant } | null {
  const prefix = `${EMAIL_ASSETS_BASE}/icons/`;
  if (!src.startsWith(prefix)) return null;
  const m = /^([a-z0-9-]+)-(ink|white|soft|solid)\.png$/.exec(src.slice(prefix.length));
  return m ? { name: m[1]!, variant: m[2] as EmailIconVariant } : null;
}

/**
 * The white copy of an `ink` icon: a dark-mode email swaps to it when the
 * reader's mail app darkens the card, where the near-black stroke would vanish
 * (images are never recoloured). Null for every other image.
 */
export function darkModeIconTwin(src: string): string | null {
  const icon = parseEmailIconUrl(src);
  return icon?.variant === "ink" ? `${EMAIL_ASSETS_BASE}/icons/${icon.name}-white.png` : null;
}
