// Marketing samples, second set — the EMAIL_DESIGN.md house style with one
// accent per template, photo-led layouts where the use case wants them, and a
// few deliberate departures (a dark launch, a serif lookbook, a plain letter)
// so the gallery shows range, not one email in ten colours. Every one carries
// the managed compliance footer at render time (category "marketing").

import { DEFAULT_LOGO_URL } from "./sample-kit";
import {
  articleRow,
  bands,
  band,
  button,
  copy,
  DARK_PALETTE,
  divider,
  FIRST_NAME,
  FOOTER_VARS,
  h1,
  h2,
  h3,
  icon,
  image,
  inputs,
  link,
  list,
  numberedStep,
  overline,
  palette,
  peopleColumns,
  photoBand,
  photoBleed,
  planColumns,
  sampleDocument,
  section,
  spacer,
  stockAvatar,
  stockLandscape,
  stockSquare,
  stockWide,
  text,
  tilePair,
  type SampleTemplate,
} from "./sample-kit";

const EX = "https://northwind.example";
const COMPANY = { company_name: "Northwind", company_address: "120 Market St, San Francisco, CA 94103" };

// ---------------------------------------------------------------------------
// Monthly product update — the flagship newsletter: date pill, hero image,
// sections with coloured overlines, images, lists, a "coming soon" card
// ---------------------------------------------------------------------------
const monthlyProductUpdate = (() => {
  const p = palette("ink");
  return {
    key: "monthly-product-update",
    name: "Monthly product update",
    category: "marketing" as const,
    subject: "What we shipped in {{month}}",
    sampleValues: { first_name: "Jules", month: "October", changelog_url: `${EX}/changelog`, ...COMPANY },
    design: sampleDocument({
      key: "monthly",
      category: "marketing",
      previewText: "Automations, a faster inbox, SMS in 40 more countries and what's next.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("month", "changelog_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerBrand(p, { name: "Northwind", logo: DEFAULT_LOGO_URL }, { label: "{{month}} 2026" }),
        band([image(stockWide("teamLaptops"), "The Northwind team at work", { width: 536, borderRadius: 12 })], { paddingY: 0 }),
        band(
          [
            h1("What we shipped in {{month}}", p.ink, { marginBottom: 6 }),
            text("Hi {{first_name}}, the monthly roundup from the Northwind team", { fontSize: 14, lineHeight: "1.45", color: p.muted, marginBottom: 16 }),
            copy("This month automations left beta, the inbox got twice as fast, and texts now reach 40 more countries. Here's everything that landed, plus a look at what's next.", p.body, { marginBottom: 0 }),
          ],
          { paddingY: 24 },
        ),
        divider(p.border),
        band([
          overline("New", "#1d74e2"),
          h2("Automations are out of beta", p.ink, { marginBottom: 16 }),
          image(stockWide("presentation"), "An automation with a trigger, a wait and two branches", { width: 536, borderRadius: 12, marginBottom: 18 }),
          copy("Draw a journey or describe it in a sentence. Triggers, waits, branches and sends, built on the templates you already have.", p.body, { marginBottom: 14 }),
          list(["Start from a sign-up, a tag, a purchase or an API event.", "Branch on opens, clicks and replies.", "Every run is logged, with the exact email each contact got."], p.body, { marginBottom: 20 }),
          button("Build an automation", `${EX}/automations`, p.accent, p.onAccent),
        ]),
        divider(p.border),
        band([
          overline("Inbox", "#008665"),
          h2("Twice as fast, with search that keeps up", p.ink, { marginBottom: 16 }),
          image(stockWide("laptopCode"), "The new inbox with search and filters", { width: 536, borderRadius: 12, marginBottom: 18 }),
          copy("Threads open instantly, search covers every message you've ever received, and filters stick between visits.", p.body, { marginBottom: 14 }),
          list(["Keyboard shortcuts for archive, reply and next.", "Attachments preview inline.", "Block a sender in one click."], p.body, { marginBottom: 20 }),
          link("See what's new in the inbox →", `${EX}/inbox`, p.accentText),
        ]),
        divider(p.border),
        band([
          overline("SMS", "#c2410c"),
          h2("40 more countries, one balance", p.ink, { marginBottom: 12 }),
          copy("Texts now go to 177 countries from the same balance as your email. Sender IDs are free; US and Canadian numbers register in a day.", p.body, { marginBottom: 20 }),
          link("See the country list →", `${EX}/sms/countries`, p.accentText),
        ]),
        band(
          [
            section(
              [
                overline("Coming soon", "#6d28d9"),
                h2("WhatsApp", p.ink, { marginBottom: 12 }),
                copy("Conversations with your customers on the app they already use, from the same inbox and API. Early access opens next month.", p.body, { marginBottom: 12 }),
                link("Join the waitlist →", `${EX}/whatsapp`, "#6d28d9"),
              ],
              { backgroundColor: "#f6f4fc", paddingX: 22, paddingY: 20, border: { width: 1, style: "solid", color: "#ebe6fa", radius: 14 } },
            ),
          ],
          { paddingY: 4 },
        ),
        spacer(20),
        divider(p.border),
        band([
          copy("That's {{month}}. Reply and tell us what you'd like to see next; we read every one.", p.body, { marginBottom: 14 }),
          copy("The Northwind team", p.body, { marginBottom: 12 }),
          link("Read the full changelog →", "{{changelog_url}}", p.accentText),
        ], { paddingY: 24 }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Dark product launch — near-black card, gradient hero, white icons
// ---------------------------------------------------------------------------
const productLaunchDark = (() => {
  const p = DARK_PALETTE;
  return {
    key: "product-launch-dark",
    name: "Product launch (dark)",
    category: "marketing" as const,
    subject: "Introducing {{feature_name}}",
    sampleValues: { first_name: "Jules", feature_name: "Orbit 2.0", cta_url: `${EX}/orbit`, ...COMPANY, company_name: "Orbit" },
    design: sampleDocument({
      key: "launchdark",
      category: "marketing",
      previewText: "{{feature_name}} is here: faster, smarter, and built for how you actually work.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("feature_name", "cta_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerWordmark(p, { name: "Orbit" }, { label: "Launch" }),
        ...bands.heroGradient(p, {
          overline: "Introducing",
          title: "{{feature_name}}",
          lead: "Hi {{first_name}}. Two years of work, one upgrade. Everything you do in Orbit, now faster, with an assistant that does the boring parts.",
          cta: { label: "See what's new", href: "{{cta_url}}" },
        }),
        ...photoBand(stockWide("laptopDark"), "{{feature_name}} on a laptop"),
        spacer(8),
        ...bands.iconRows(p, {
          title: "What's new",
          rows: [
            { icon: "zap", title: "Ten times faster sync", line: "Projects with a million rows open in under a second." },
            { icon: "sparkles", title: "Ask Orbit", line: "Describe what you want in a sentence. It builds the view." },
            { icon: "shield-check", title: "SOC 2 Type II", line: "Audited, with region pinning for EU and US data." },
          ],
        }),
        ...bands.stats(p, {
          items: [
            { value: "10×", label: "faster" },
            { value: "0", label: "migration steps" },
            { value: "every", label: "plan, same price" },
          ],
        }),
        ...bands.ctaContrast(p, {
          title: "It's already in your account",
          line: "Open Orbit and you're on 2.0. Nothing to install, nothing to migrate.",
          cta: { label: "Open Orbit", href: "{{cta_url}}" },
        }),
        ...bands.signoff(p, { help: "Questions? Reply to this email. The team that built it reads every reply.", signature: "The Orbit team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Flash sale — red, a big offer card, four product tiles, a deadline
// ---------------------------------------------------------------------------
const flashSale = (() => {
  const p = palette("red");
  return {
    key: "flash-sale",
    name: "Flash sale",
    category: "marketing" as const,
    subject: "{{discount}} off everything. 48 hours only.",
    sampleValues: { first_name: "Maya", discount: "40%", promo_code: "FLASH40", shop_url: `${EX}/sale`, ends_at: "Sunday at midnight", ...COMPANY, company_name: "Alder & Finch" },
    design: sampleDocument({
      key: "flash",
      category: "marketing",
      previewText: "{{discount}} off the whole store with {{promo_code}}. Ends {{ends_at}}.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("discount", "promo_code", "shop_url", "ends_at"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerBrand(p, { name: "Alder & Finch", logo: DEFAULT_LOGO_URL }, { label: "48 hours" }),
        ...bands.offer(p, {
          overline: "Flash sale",
          title: "{{discount}} off everything",
          line: "Hi {{first_name}}, the whole store, no exclusions. Use the code at checkout before it's gone.",
          code: "{{promo_code}}",
          cta: { label: "Shop the sale", href: "{{shop_url}}" },
          terms: "Ends {{ends_at}}. Can't be combined with other offers.",
        }),
        spacer(8),
        band([h2("Going fastest", p.ink, { marginBottom: 0 })], { paddingY: 0 }),
        spacer(12),
        ...bands.products(p, {
          items: [
            { name: "Court sneaker", price: "$128 → $77", href: "{{shop_url}}", image: stockSquare("sneakerTan") },
            { name: "Over-ear headphones", price: "$199 → $119", href: "{{shop_url}}", image: stockSquare("headphones") },
          ],
        }),
        ...bands.products(p, {
          items: [
            { name: "Field watch", price: "$240 → $144", href: "{{shop_url}}", image: stockSquare("watch") },
            { name: "Travel camera", price: "$560 → $336", href: "{{shop_url}}", image: stockSquare("camera") },
          ],
        }),
        spacer(16),
        ...bands.ctaContrast(p, {
          title: "Ends {{ends_at}}",
          line: "Free shipping on orders over $75, as always.",
          cta: { label: "Shop now with {{promo_code}}", href: "{{shop_url}}" },
        }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// New collection — editorial: serif headings, bleed photo, a two-up grid
// ---------------------------------------------------------------------------
const newCollection = (() => {
  const p = palette("ink");
  const serif = "Georgia, 'Times New Roman', serif";
  return {
    key: "new-collection",
    name: "New collection",
    category: "marketing" as const,
    subject: "The winter collection is here",
    sampleValues: { first_name: "Maya", shop_url: `${EX}/collections/winter`, ...COMPANY, company_name: "Alder & Finch" },
    design: sampleDocument({
      key: "collection",
      category: "marketing",
      previewText: "Wool, linen and leather in eleven new pieces. Made to last, made to be worn.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("shop_url"), ...FOOTER_VARS],
      theme: { bodyRadius: 0 },
      blocks: [
        band([text("ALDER & FINCH", { align: "center", fontSize: 13, fontWeight: "600", letterSpacing: 3, color: p.ink, marginBottom: 0 })], { paddingY: 22 }),
        ...photoBleed(stockWide("storeInterior"), "The winter collection"),
        band(
          [
            overline("Winter 2026", p.muted, { align: "center" }),
            h1("Made for the cold months", p.ink, { align: "center", fontFamily: serif, fontSize: 34, fontWeight: "400", letterSpacing: -0.3, marginBottom: 14 }),
            copy("Eleven new pieces in wool, linen and leather. Cut to be worn every day, built to be worn for years. Hi {{first_name}}, the collection is yours first, before it goes on the site.", p.body, { align: "center", marginBottom: 24 }),
            button("Shop the collection", "{{shop_url}}", p.accent, p.onAccent, { align: "center", borderRadius: 0, innerPaddingX: 28 }),
          ],
          { paddingY: 36 },
        ),
        tilePair(p, [
          { image: stockSquare("jacket"), price: "$280", title: "Wool overshirt", meta: "Camel · Charcoal", href: "{{shop_url}}" },
          { image: stockSquare("knitPoncho"), price: "$120", title: "Knit poncho", meta: "Cream · Oat", href: "{{shop_url}}" },
        ]),
        tilePair(p, [
          { image: stockSquare("derbyTeal"), price: "$160", title: "Suede derby", meta: "Teal · Tobacco", href: "{{shop_url}}" },
          { image: stockSquare("watch"), price: "$240", title: "Field watch", meta: "Steel · Brass", href: "{{shop_url}}" },
        ]),
        spacer(24),
        ...photoBleed(stockWide("cityStreet"), "Worn in the city"),
        band(
          [
            h2("Slow fashion, on purpose", p.ink, { align: "center", fontFamily: serif, fontWeight: "400", marginBottom: 12 }),
            copy("Every piece is made in small runs by two workshops we've worked with for a decade. Repairs are free for life.", p.body, { align: "center", marginBottom: 20 }),
            link("Read about how it's made →", `${EX}/made`, p.ink, { align: "center" }),
          ],
          { paddingY: 36 },
        ),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Back in stock — forest green, one product, scarcity, one button
// ---------------------------------------------------------------------------
const backInStock = (() => {
  const p = palette("forest");
  return {
    key: "back-in-stock",
    name: "Back in stock",
    category: "marketing" as const,
    subject: "It's back: {{product_name}}",
    sampleValues: { first_name: "Maya", product_name: "Field watch, steel", price: "$240", stock_left: "14", product_url: `${EX}/products/field-watch`, ...COMPANY, company_name: "Alder & Finch" },
    design: sampleDocument({
      key: "restock",
      category: "marketing",
      previewText: "You asked us to tell you. {{product_name}} is back, and there aren't many.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("product_name", "price", "stock_left", "product_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerBrand(p, { name: "Alder & Finch", logo: DEFAULT_LOGO_URL }),
        ...bands.heroHeadline(p, {
          overline: "Back in stock",
          title: "{{product_name}} is back",
          lead: "Hi {{first_name}}, you asked us to let you know. It's in stock again as of this morning, in the size you wanted.",
        }),
        band([image(stockWide("watch"), "{{product_name}}", { width: 536, height: 340, objectFit: "cover", borderRadius: 14, href: "{{product_url}}" })], { paddingY: 0 }),
        spacer(20),
        band(
          [
            section(
              [
                text("{{product_name}}", { fontSize: 18, fontWeight: "600", color: p.ink, marginBottom: 4 }),
                text("{{price}} · Free shipping and returns", { fontSize: 14, color: p.muted, marginBottom: 14 }),
                text("Only {{stock_left}} left", { fontSize: 13, fontWeight: "600", color: p.accentText, marginBottom: 18, customCss: `display: inline-block; padding: 4px 10px; border-radius: 999px; background-color: ${p.accentTint}` }),
                button("Buy it now", "{{product_url}}", p.accent, p.onAccent),
              ],
              { backgroundColor: p.tint, paddingX: 24, paddingY: 22, border: { width: 1, style: "solid", color: p.border, radius: 14 } },
            ),
          ],
          { paddingY: 0 },
        ),
        spacer(28),
        ...bands.signoff(p, { help: "Restock alerts are one-off: you'll only hear from us about this item once. Want it held for an hour? Reply and we'll do it.", signature: "The Alder & Finch team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Onboarding tips — blue, day-3 nurture: three numbered things to try
// ---------------------------------------------------------------------------
const onboardingTips = (() => {
  const p = palette("blue");
  return {
    key: "onboarding-tips",
    name: "Onboarding tips",
    category: "marketing" as const,
    subject: "Three things to try this week in {{product_name}}",
    sampleValues: { first_name: "Ada", product_name: "Northwind", app_url: `${EX}/app`, ...COMPANY },
    design: sampleDocument({
      key: "tips",
      category: "marketing",
      previewText: "Day 3. The three features people say they wish they'd found sooner.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("product_name", "app_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerBrand(p, { name: "Northwind", logo: DEFAULT_LOGO_URL }, { label: "Day 3" }),
        ...bands.heroHeadline(p, {
          overline: "Getting started",
          title: "Three things to try this week",
          lead: "Hi {{first_name}}, you've been on {{product_name}} for three days. These are the features people tell us they wish they'd found on day one.",
        }),
        numberedStep(p, 1, "Connect your first integration", "Pull your contacts in from the tools you already use. Two clicks, and they stay in sync."),
        numberedStep(p, 2, "Send a test to yourself", "Open any template, hit Test send, and see exactly what your customers will see on your phone."),
        numberedStep(p, 3, "Invite a teammate", "Everything in {{product_name}} is better with the people you work with. Seats are free on every plan."),
        spacer(16),
        ...bands.callout(p, {
          overline: "Most people's favourite",
          title: "Keyboard shortcuts",
          body: "Press ? anywhere to see them. The ones that stick: C for a new campaign, / to search, and G then I for the inbox.",
        }),
        ...bands.buttonBand(p, { cta: { label: "Open {{product_name}}", href: "{{app_url}}" }, note: "Next week: how to set up your sending domain in ten minutes." }),
        ...bands.signoff(p, { help: "Stuck on something? Reply to this email. A real person on the team answers, usually within the hour.", signature: "Sam, Customer Success" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Content digest — ink, three articles with thumbnails, a reading list
// ---------------------------------------------------------------------------
const contentDigest = (() => {
  const p = palette("ink");
  return {
    key: "content-digest",
    name: "Content digest",
    category: "marketing" as const,
    subject: "This week's reads: deliverability, dark mode, and a pricing teardown",
    sampleValues: { first_name: "Jules", blog_url: `${EX}/blog`, ...COMPANY, company_name: "Fieldnotes" },
    design: sampleDocument({
      key: "digest",
      category: "marketing",
      previewText: "Three pieces worth your time this week, plus what the community is building.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("blog_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerWordmark(p, { name: "Fieldnotes" }, { label: "Issue 42" }),
        band(
          [
            h1("This week's reads", p.ink, { marginBottom: 8 }),
            copy("Hi {{first_name}}. Three pieces worth your time, picked by hand. About twelve minutes all in.", p.body, { marginBottom: 0 }),
          ],
          { paddingY: 24 },
        ),
        divider(p.border),
        spacer(16),
        articleRow(p, { image: stockLandscape("deskFlatlay"), meta: "Deliverability · 5 min", title: "Why your open rate dropped in October (it didn't)", excerpt: "Mail scanners now open everything within seconds. Here's how to tell real opens from robots.", href: "{{blog_url}}/open-rates" }),
        articleRow(p, { image: stockLandscape("codeScreen"), meta: "Design · 4 min", title: "Dark mode email that doesn't invert your logo", excerpt: "Three CSS rules, one PNG trick, and a checklist for the clients that ignore all of it.", href: "{{blog_url}}/dark-mode" }),
        articleRow(p, { image: stockLandscape("teamMeeting"), meta: "Business · 3 min", title: "We cut our prices by a third. Here's the math.", excerpt: "What changed in our costs, what we expected to happen, and what actually happened in the first month.", href: "{{blog_url}}/pricing" }),
        spacer(16),
        divider(p.border),
        band([
          h2("From the community", p.ink, { marginBottom: 12 }),
          list([
            "A Rust SDK, built by a customer, now in the official docs.",
            "A Figma plugin that exports frames straight into a template.",
            "The office hours recording: 40 minutes on sending domains.",
          ], p.body, { marginBottom: 16 }),
          link("See everything on the blog →", "{{blog_url}}", p.accentText),
        ]),
        ...bands.signoff(p, { help: "Read something good this week? Reply with the link and it might make the next issue.", signature: "Nadia, editor" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Conference invite — indigo gradient hero, details, speakers, agenda, offer
// ---------------------------------------------------------------------------
const conferenceInvite = (() => {
  const p = palette("indigo");
  return {
    key: "conference-invite",
    name: "Conference invite",
    category: "marketing" as const,
    subject: "You're invited: {{event_name}}, {{event_date}}",
    sampleValues: { first_name: "Jules", event_name: "Signal 2026", event_date: "4–5 March 2027", register_url: `${EX}/signal`, ...COMPANY, company_name: "Wavelength" },
    design: sampleDocument({
      key: "conf",
      category: "marketing",
      previewText: "Two days, 40 talks, one city. Early-bird tickets until the end of the month.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("event_name", "event_date", "register_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerWordmark(p, { name: "Wavelength" }, { label: "Save the date" }),
        ...bands.heroGradient(p, {
          overline: "{{event_date}} · Lisbon",
          title: "{{event_name}}",
          lead: "Two days on the craft of customer messaging. Forty talks, hands-on workshops, and the people who build the tools you use.",
          cta: { label: "Get your ticket", href: "{{register_url}}" },
        }),
        ...photoBand(stockWide("conference"), "Last year's main stage"),
        spacer(8),
        ...bands.eventDetails(p, {
          title: "The details",
          rows: [
            { icon: "calendar", label: "When", value: "{{event_date}}, 09:00 – 18:00" },
            { icon: "map-pin", label: "Where", value: "Centro Cultural de Belém, Lisbon" },
            { icon: "video", label: "Can't make it?", value: "Every talk is streamed and recorded for ticket holders." },
          ],
        }),
        band([h2("Speakers", p.ink, { marginBottom: 4 })], { paddingY: 0 }),
        peopleColumns(p, [
          { image: stockAvatar("portraitWoman"), name: "Lena Fischer", role: "Head of Growth, Harbor" },
          { image: stockAvatar("portraitMan"), name: "Tomás Reyes", role: "Deliverability, Lumen" },
          { image: stockAvatar("portraitWoman2"), name: "Priya Natarajan", role: "Founder, Fieldnotes" },
        ]),
        spacer(12),
        band([
          h2("What's on", p.ink, { marginBottom: 12 }),
          list([
            "Day 1: deliverability deep dives, the state of dark mode, and a live teardown of ten real campaigns.",
            "Day 2: workshops on automations, SMS compliance in 20 countries, and designing for the inbox.",
            "Both evenings: dinner by the river, on us.",
          ], p.body, { marginBottom: 0 }),
        ]),
        ...bands.offer(p, {
          overline: "Early bird",
          title: "€290",
          line: "Hi {{first_name}}, early-bird pricing is open until the end of the month. Standard tickets are €390.",
          cta: { label: "Register now", href: "{{register_url}}" },
          terms: "Teams of four or more save another 20%.",
        }),
        ...bands.signoff(p, { help: "Want to speak, sponsor, or bring a group? Reply to this email.", signature: "The Wavelength team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Pricing update — teal, a plain explanation and three plan cards
// ---------------------------------------------------------------------------
const pricingUpdate = (() => {
  const p = palette("teal");
  return {
    key: "pricing-update",
    name: "Pricing update",
    category: "marketing" as const,
    subject: "Simpler pricing, lower for most of you",
    sampleValues: { first_name: "Ada", effective_date: "1 January 2027", pricing_url: `${EX}/pricing`, ...COMPANY },
    design: sampleDocument({
      key: "pricing",
      category: "marketing",
      previewText: "Three plans instead of six, unlimited contacts on all of them, from {{effective_date}}.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("effective_date", "pricing_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerBrand(p, { name: "Northwind", logo: DEFAULT_LOGO_URL }, { label: "Pricing" }),
        ...bands.heroHeadline(p, {
          overline: "From {{effective_date}}",
          title: "Simpler pricing, lower for most of you",
          lead: "Hi {{first_name}}. We're going from six plans to three, every plan gets unlimited contacts, and the price per send drops across the board. Nothing changes until {{effective_date}}, and nobody pays more.",
        }),
        planColumns(p, [
          { name: "Free", price: "$0", period: "forever", bullets: ["3,000 sends a month", "Unlimited contacts", "One sending domain"], href: "{{pricing_url}}" },
          { name: "Pro", price: "$29", period: "per month", bullets: ["50,000 sends", "Unlimited domains", "Automations and SMS"], href: "{{pricing_url}}", featured: true },
          { name: "Scale", price: "$199", period: "per month", bullets: ["500,000 sends", "Dedicated IP", "Priority support"], href: "{{pricing_url}}" },
        ]),
        spacer(20),
        ...bands.iconRows(p, {
          title: "What it means for you",
          rows: [
            { icon: "trending-down", title: "Your bill goes down or stays the same", line: "You're on the old Growth plan. On {{effective_date}} you move to Pro at $29, down from $49." },
            { icon: "infinity", title: "Contacts are no longer counted", line: "Import your whole list. You pay for what you send, not who you store." },
            { icon: "calendar-check", title: "Nothing to do", line: "The switch is automatic. Your templates, domains and automations carry over untouched." },
          ],
        }),
        ...bands.buttonBand(p, { cta: { label: "See the new plans", href: "{{pricing_url}}" } }),
        ...bands.signoff(p, { help: "Questions about your specific account? Reply to this email and we'll walk you through your numbers.", signature: "Mike, co-founder" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Holiday greeting — burgundy, a warm photo and a short thank-you
// ---------------------------------------------------------------------------
const holidayGreeting = (() => {
  const p = palette("burgundy");
  return {
    key: "holiday-greeting",
    name: "Holiday greeting",
    category: "marketing" as const,
    subject: "Thank you for a wonderful year",
    sampleValues: { first_name: "Maya", promo_code: "THANKYOU", shop_url: `${EX}/shop`, ...COMPANY, company_name: "Alder & Finch" },
    design: sampleDocument({
      key: "holiday",
      category: "marketing",
      previewText: "A small thank-you from all of us, and our opening hours over the break.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("promo_code", "shop_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerBrand(p, { name: "Alder & Finch", logo: DEFAULT_LOGO_URL }),
        ...photoBleed(stockWide("coffee"), "A warm drink on a winter morning"),
        band(
          [
            overline("Season's greetings", p.accentText, { align: "center" }),
            h1("Thank you, {{first_name}}", p.ink, { align: "center", marginBottom: 14 }),
            copy("This was our best year yet, and it's because of people like you. From the four of us in the workshop and everyone who packed your orders: thank you, and happy holidays.", p.body, { align: "center", marginBottom: 0 }),
          ],
          { paddingY: 32 },
        ),
        ...bands.offer(p, {
          overline: "A little something",
          title: "20% off",
          line: "On anything in the shop until the new year. Our way of saying thanks.",
          code: "{{promo_code}}",
          cta: { label: "Treat yourself", href: "{{shop_url}}" },
        }),
        ...bands.eventDetails(p, {
          title: "Over the break",
          rows: [
            { icon: "store", label: "Shop", value: "Closed 24 Dec to 2 Jan. Online orders ship from 3 Jan." },
            { icon: "message-circle", label: "Support", value: "Replies may take a day or two. We'll get to every one." },
          ],
        }),
        ...bands.signoff(p, { help: "See you in the new year.", signature: "Alder, Finch and the team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// App release — sky, phone screenshot, release notes, two store buttons
// ---------------------------------------------------------------------------
const appRelease = (() => {
  const p = palette("sky");
  return {
    key: "app-release",
    name: "App release notes",
    category: "marketing" as const,
    subject: "Orbit {{version}} is out: offline mode and widgets",
    sampleValues: { first_name: "Jules", version: "4.2", ios_url: `${EX}/ios`, android_url: `${EX}/android`, ...COMPANY, company_name: "Orbit" },
    design: sampleDocument({
      key: "apprelease",
      category: "marketing",
      previewText: "Offline mode, home-screen widgets and a dozen fixes. Update from your app store.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("version", "ios_url", "android_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerBrand(p, { name: "Orbit", logo: DEFAULT_LOGO_URL }, { label: "Version {{version}}" }),
        ...bands.heroHeadline(p, {
          overline: "New release",
          title: "Orbit {{version}} works without a signal",
          lead: "Hi {{first_name}}. Everything you open is now available offline, widgets land on your home screen, and the app starts twice as fast.",
        }),
        ...photoBand(stockWide("gradient3d"), "Orbit {{version}} on a phone", { top: 0 }),
        spacer(8),
        ...bands.iconRows(p, {
          title: "In this release",
          rows: [
            { icon: "battery-charging", title: "Offline mode", line: "Read, edit and queue changes with no connection. They sync when you're back." },
            { icon: "layout-dashboard", title: "Widgets", line: "Today's tasks and your inbox count, on the home screen." },
            { icon: "zap", title: "Faster launch", line: "Cold start in 0.8 s on last year's phones." },
            { icon: "wrench", title: "Fixes", line: "Fourteen of them, including the notification that fired twice." },
          ],
        }),
        band(
          [
            text("Update now", { fontSize: 16, fontWeight: "600", color: p.ink, marginBottom: 12 }),
            button("Download on iOS", "{{ios_url}}", p.ink, "#ffffff", { innerPaddingX: 20 }),
            spacer(10),
            button("Get it on Android", "{{android_url}}", p.ink, "#ffffff", { innerPaddingX: 20 }),
          ],
          { paddingY: 8 },
        ),
        spacer(20),
        ...bands.signoff(p, { help: "Found a bug? Shake your phone inside the app to send us a report with the logs attached.", signature: "The Orbit mobile team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Birthday reward — pink, a gift and a code
// ---------------------------------------------------------------------------
const birthdayReward = (() => {
  const p = palette("pink");
  return {
    key: "birthday-reward",
    name: "Birthday reward",
    category: "marketing" as const,
    subject: "Happy birthday, {{first_name}}. A gift from us.",
    sampleValues: { first_name: "Maya", promo_code: "BDAY-MAYA", expires_at: "30 November", shop_url: `${EX}/shop`, ...COMPANY, company_name: "Alder & Finch" },
    design: sampleDocument({
      key: "bday",
      category: "marketing",
      previewText: "$25 to spend on anything, valid for the whole month.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("promo_code", "expires_at", "shop_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerBrand(p, { name: "Alder & Finch", logo: DEFAULT_LOGO_URL }),
        band(
          [
            icon("party-popper", "soft", { align: "center", marginBottom: 16 }),
            overline("Happy birthday", p.accentText, { align: "center" }),
            h1("It's your day, {{first_name}}", p.ink, { align: "center", marginBottom: 12 }),
            copy("We put $25 on your account to spend on whatever you like. No minimum, and it stacks with sale prices.", p.body, { align: "center", marginBottom: 0 }),
          ],
          { paddingY: 36 },
        ),
        ...bands.offer(p, {
          overline: "Your gift",
          title: "$25 off",
          line: "Use the code at checkout any time before {{expires_at}}.",
          code: "{{promo_code}}",
          cta: { label: "Pick something", href: "{{shop_url}}" },
        }),
        band([h2("A few ideas", p.ink, { marginBottom: 0 })], { paddingY: 0 }),
        spacer(12),
        ...bands.products(p, {
          items: [
            { name: "Linen crew tee", price: "$42", href: "{{shop_url}}", image: stockSquare("tee") },
            { name: "Over-ear headphones", price: "$199", href: "{{shop_url}}", image: stockSquare("headphones") },
          ],
        }),
        spacer(20),
        ...bands.signoff(p, { help: "Have a great one. From all of us at Alder & Finch." }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Founder letter — a plain, personal note. Long copy, one pull quote
// ---------------------------------------------------------------------------
const founderLetter = (() => {
  const p = palette("ink");
  return {
    key: "founder-letter",
    name: "Founder letter",
    category: "marketing" as const,
    subject: "A note on what we're building next",
    sampleValues: { first_name: "Jules", ...COMPANY },
    design: sampleDocument({
      key: "letter",
      category: "marketing",
      previewText: "No product news, no offer. Just where we are and where we're going.",
      palette: p,
      variables: [FIRST_NAME, ...FOOTER_VARS],
      blocks: [
        ...bands.headerWordmark(p, { name: "Northwind" }),
        band(
          [
            h1("A note on what we're building next", p.ink, { fontSize: 24, letterSpacing: -0.4, marginBottom: 20 }),
            copy("Hi {{first_name}},", p.ink, { marginBottom: 16 }),
            copy("Three years ago we started Northwind because sending a receipt from our last company took a week of plumbing. We thought that was silly. It turns out a lot of you did too: this month the ten-thousandth workspace sent its first email.", p.body),
            copy("I want to tell you what we've learned, and what we're going to do about it.", p.body),
            copy("The first thing is that deliverability is the whole product. Nobody cares how nice the editor is if the email lands in spam. So for the next six months, every engineer on the team is working on the sending side: smarter warm-up, per-domain reputation you can see, and a pause that kicks in before a bad list hurts you.", p.body),
            copy("The second is that most of you aren't marketers. You're the one engineer who got handed 'the email stuff'. The product should assume that. Fewer settings, more defaults that are already right.", p.body, { marginBottom: 24 }),
            section(
              [
                text("“The best email tool is the one you set up once and never think about again.”", { fontSize: 19, lineHeight: "1.45", fontFamily: "Georgia, 'Times New Roman', serif", color: p.ink, marginBottom: 0 }),
              ],
              { paddingX: 20, paddingY: 4, customCss: `border-left: 3px solid ${p.ink}` },
            ),
            spacer(24),
            copy("The third is pricing. We charged for contacts because everyone did. We're stopping. From January you pay for what you send, and the free plan gets bigger. There's a separate email about that coming; the short version is that nobody's bill goes up.", p.body),
            copy("That's it. No launch, no offer. If any of this is wrong, reply and tell me. I read every one, and the replies to the last letter changed two things on this list.", p.body, { marginBottom: 24 }),
            copy("Thanks for being here,", p.body, { marginBottom: 4 }),
            text("Mike", { fontSize: 15, fontWeight: "600", color: p.ink, marginBottom: 2 }),
            text("Co-founder, Northwind", { fontSize: 13, color: p.muted, marginBottom: 20 }),
            link("Read the previous letters →", `${EX}/letters`, p.accentText),
          ],
          { paddingY: 24 },
        ),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// New listings — navy, a marketplace digest with photo tiles and a featured one
// ---------------------------------------------------------------------------
const newListings = (() => {
  const p = palette("navy");
  return {
    key: "new-listings",
    name: "New listings digest",
    category: "marketing" as const,
    subject: "6 new places in {{area}} this week",
    sampleValues: { first_name: "Sofia", area: "Lisbon", search_url: `${EX}/search?area=lisbon`, ...COMPANY, company_name: "Keel" },
    design: sampleDocument({
      key: "listings",
      category: "marketing",
      previewText: "Matches for your saved search: 2 bedrooms, under €2,000, near the river.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("area", "search_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerWordmark(p, { name: "Keel" }, { label: "Saved search" }),
        band(
          [
            h1("New in {{area}} this week", p.ink, { marginBottom: 8 }),
            copy("Hi {{first_name}}, six places matched your search: 2 bedrooms, under €2,000 a month, within a 15-minute walk of the river. Here are the best three.", p.body, { marginBottom: 0 }),
          ],
          { paddingY: 24 },
        ),
        band(
          [
            image(stockWide("livingRoom"), "Riverside apartment", { width: 536, height: 300, objectFit: "cover", borderRadius: 12, marginBottom: 14, href: "{{search_url}}" }),
            text("Featured", { fontSize: 12, fontWeight: "600", letterSpacing: 0.72, color: p.accentText, marginBottom: 6 }),
            text("€1,850 / month", { fontSize: 20, fontWeight: "700", color: p.ink, marginBottom: 4 }),
            text("2 bed · 1 bath · 84 m² · Santos, 6 min to the river", { fontSize: 14, color: p.body, marginBottom: 12 }),
            link("View listing →", "{{search_url}}", p.accentText),
          ],
          { paddingY: 0 },
        ),
        spacer(20),
        tilePair(p, [
          { image: stockLandscape("apartment"), price: "€1,600 / month", title: "2 bed · 70 m²", meta: "Alfama · 12 min walk", href: "{{search_url}}" },
          { image: stockLandscape("sofa"), price: "€1,950 / month", title: "2 bed · 92 m²", meta: "Cais do Sodré · 4 min walk", href: "{{search_url}}" },
        ]),
        spacer(8),
        ...bands.buttonBand(p, { cta: { label: "See all 6 matches", href: "{{search_url}}" }, note: "Listings move fast here: the median place is gone in four days." }),
        ...bands.signoff(p, { help: "Too many emails? Set this search to weekly, or pause it from the link in the footer.", signature: "The Keel team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Nonprofit impact — forest green, what the donations did, one ask
// ---------------------------------------------------------------------------
const nonprofitImpact = (() => {
  const p = palette("forest");
  return {
    key: "nonprofit-impact",
    name: "Impact report",
    category: "marketing" as const,
    subject: "What your gift did this year",
    sampleValues: { first_name: "Jules", donate_url: `${EX}/donate`, ...COMPANY, company_name: "Brightside" },
    design: sampleDocument({
      key: "impact",
      category: "marketing",
      previewText: "2,400 trees, 18 hectares and a river that runs clear again. Thank you.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("donate_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerWordmark(p, { name: "Brightside" }, { label: "2026 report" }),
        ...photoBleed(stockWide("valley"), "The Alder valley, replanted"),
        band(
          [
            overline("Your impact", p.accentText),
            h1("Thank you, {{first_name}}. Here's what you did.", p.ink, { marginBottom: 12 }),
            copy("A year ago the Alder valley was bare hillside after the fires. This autumn, with your help, it's green again. These numbers are yours.", p.body, { marginBottom: 0 }),
          ],
          { paddingY: 32 },
        ),
        ...bands.stats(p, {
          items: [
            { value: "2,400", label: "trees planted" },
            { value: "18 ha", label: "restored" },
            { value: "310", label: "volunteers" },
          ],
        }),
        ...bands.feature(p, {
          overline: "On the ground",
          title: "The river runs clear",
          image: { src: stockWide("hiker"), alt: "The Alder river this summer" },
          body: "With the slopes planted, the spring rains stopped washing silt into the river. Trout are back for the first time in six years, and the village downstream is drinking from it again.",
          link: { label: "Read the full report →", href: `${EX}/report` },
        }),
        ...bands.ctaContrast(p, {
          title: "Next year: the north ridge",
          line: "Another 20 hectares, another 3,000 trees. A monthly gift of $10 plants one a week.",
          cta: { label: "Give monthly", href: "{{donate_url}}" },
        }),
        ...bands.signoff(p, { help: "Every dollar you give is tracked to a plot. Reply and we'll send you the coordinates of yours.", signature: "Anna, Brightside" }),
      ],
    }),
  };
})();

export const MARKETING_V2: readonly SampleTemplate[] = [
  monthlyProductUpdate,
  productLaunchDark,
  flashSale,
  newCollection,
  backInStock,
  onboardingTips,
  contentDigest,
  conferenceInvite,
  pricingUpdate,
  holidayGreeting,
  appRelease,
  birthdayReward,
  founderLetter,
  newListings,
  nonprofitImpact,
];

void h3;
void photoBand;
