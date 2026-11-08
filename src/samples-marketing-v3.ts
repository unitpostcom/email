// Marketing samples, third set (2026-11-06): the ten original marketing
// samples rebuilt on the openers and sections of the email design system, plus
// four new ones. Research behind it: .audit/email-design-2026-11-06 (one visual
// anchor in the first screen, a different shape for each section, a person
// visible where the type allows). Same keys and variables as the originals, so
// templates cloned from them keep working; the brands, people and numbers are
// fictional sample copy. Category "marketing": the managed footer is added at
// send.
//
// Openers, by template (no two in one gallery group share one):
//   product-announcement  banner (3D art)        waitlist-invite   panel
//   event-invite          event poster (dark)    webinar-recap     banner, left
//   discount-offer        banner (gift photo)    abandoned-cart    headline + product rows
//   re-engagement         soft panel             feedback-survey   spot (icon)
//   case-study            photo over the band    referral          poster
//   seasonal-menu (new)   banner + dish gallery  rewards-poster (new)  poster + progress
//   travel-guide (new)    photo + media rows     webinar-invite (new)  split

import {
  bands,
  band,
  copy,
  FIRST_NAME,
  FOOTER_VARS,
  h2,
  inputs,
  palette,
  peopleColumns,
  productLine,
  progressBar,
  sampleDocument,
  spacer,
  stockAvatar,
  stockCard,
  stockCrop,
  stockPanel,
  stockShaded,
  type SampleTemplate,
} from "./sample-kit";

const ADDRESS = "120 Market St, San Francisco, CA 94103";
const NW = "https://northwind.example";
const NW_CO = { company_name: "Northwind", company_address: ADDRESS };

// ---------------------------------------------------------------------------
// Product announcement: rounded 3D art, a centred headline, three benefits
// ---------------------------------------------------------------------------
const productAnnouncement: SampleTemplate = (() => {
  const p = palette("violet");
  return {
    key: "product-announcement",
    name: "Product announcement",
    category: "marketing",
    subject: "Introducing {{feature_name}}",
    sampleValues: { first_name: "Jules", feature_name: "Smart folders", cta_url: `${NW}/folders`, ...NW_CO },
    design: sampleDocument({
      key: "ann",
      category: "marketing",
      previewText: "Introducing {{feature_name}}: live in your account today, on every plan.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("feature_name", "cta_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerCentered(p, { name: "Northwind" }),
        ...bands.heroBanner(p, {
          image: { src: stockCrop("lavenderCurve", 1072, 600), alt: "A soft lavender curve, the {{feature_name}} launch art" },
          overline: "New in Northwind",
          title: "Say hello to {{feature_name}}",
          lead: "Hi {{first_name}}. Files sort themselves into the right folder as they arrive, and you can see why each one went where it did.",
          cta: { label: "Try {{feature_name}}", href: "{{cta_url}}" },
        }),
        ...bands.iconRows(p, {
          title: "What changes for you",
          rows: [
            { icon: "zap", title: "Live right now", line: "It's on in your account today. Nothing to install or switch on." },
            { icon: "sparkles", title: "Learns from you", line: "Move a file once and every file like it follows." },
            { icon: "users", title: "On every plan", line: "Free and paid workspaces alike, at no extra cost." },
          ],
        }),
        ...bands.signature(p, { line: "Tell us what you think: reply to this email and it reaches the team that built it.", name: "Dana Reyes", role: "Product lead, Northwind", image: stockAvatar("portraitWoman") }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Waitlist invite: a gradient panel, three steps, a nudge
// ---------------------------------------------------------------------------
const waitlistInvite: SampleTemplate = (() => {
  const p = palette("teal");
  return {
    key: "waitlist-invite",
    name: "Waitlist invite",
    category: "marketing",
    subject: "You're off the waitlist",
    sampleValues: { first_name: "Jules", product_name: "Northwind", claim_url: `${NW}/claim`, ...NW_CO },
    design: sampleDocument({
      key: "wait",
      category: "marketing",
      previewText: "Your spot is ready. Claim it in the next few days.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("product_name", "claim_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerWordmark(p, { name: "{{product_name}}" }),
        ...bands.heroPanel(p, {
          label: "You're in",
          title: "Your spot is ready, {{first_name}}",
          lead: "Thanks for waiting. {{product_name}} is ready for you: claim your spot and jump straight in.",
          cta: { label: "Claim my spot", href: "{{claim_url}}" },
          image: { src: stockPanel("mintCubes"), alt: "Mint cubes stacked into a block" },
        }),
        ...bands.steps(p, {
          title: "Your first ten minutes",
          items: [
            { title: "Claim your spot", line: "One click, and your workspace is set up with your email address." },
            { title: "Import what you have", line: "Bring a list over from a CSV, or start from one of the templates." },
            { title: "Send something real", line: "Your first email goes out from our domain while yours verifies." },
          ],
        }),
        ...bands.callout(p, { overline: "Heads up", title: "Spots go out in small batches", body: "If you don't claim yours in the next few days, it passes to the next person on the list." }),
        ...bands.signoff(p, { help: "Questions before you start? Reply to this email.", signature: "The {{product_name}} team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Event invite: a dark event poster with key art, details, three takeaways
// ---------------------------------------------------------------------------
const eventInvite: SampleTemplate = (() => {
  const p = palette("indigo");
  return {
    key: "event-invite",
    name: "Event invite",
    category: "marketing",
    subject: "You're invited: {{event_name}}",
    sampleValues: { first_name: "Jules", event_name: "Design Systems Live", event_date: "Thu 20 Nov, 10:00 PT", register_url: `${NW}/register`, ...NW_CO },
    design: sampleDocument({
      key: "evt",
      category: "marketing",
      previewText: "Free, online, 45 minutes: save your seat for {{event_date}}.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("event_name", "event_date", "register_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerBrand(p, { name: "Northwind" }, { label: "Live session" }),
        ...bands.heroPanel(p, {
          tone: "ink",
          imageFirst: true,
          image: { src: stockPanel("tealSpiral"), alt: "A teal spiral on a dark background, the event's key art" },
          label: "{{event_date}} · Online",
          title: "{{event_name}}",
          lead: "Hi {{first_name}}. 45 minutes on building a design system people actually use, with live Q&A at the end.",
          cta: { label: "Save my seat", href: "{{register_url}}" },
        }),
        ...bands.eventDetails(p, {
          title: "The details",
          rows: [
            { icon: "calendar", label: "When", value: "{{event_date}}, 45 minutes" },
            { icon: "video", label: "Where", value: "Online. The link comes with your registration." },
            { icon: "ticket", label: "Price", value: "Free" },
          ],
          link: { label: "Add it to my calendar →", href: "{{register_url}}" },
        }),
        ...bands.steps(p, {
          tone: "tint",
          title: "You'll leave with",
          items: [
            { title: "A token structure that scales", line: "How three teams name colours and spacing so nobody has to ask." },
            { title: "A review checklist", line: "The twelve checks they run before a component ships." },
            { title: "Answers to your questions", line: "Fifteen minutes of live Q&A with the speakers." },
          ],
        }),
        ...bands.signoff(p, { help: "Can't make it? Register anyway and we'll send you the recording.", signature: "The Northwind team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Webinar recap: the recording as the banner, takeaways, a next step
// ---------------------------------------------------------------------------
const webinarRecap: SampleTemplate = (() => {
  const p = palette("blue");
  return {
    key: "webinar-recap",
    name: "Webinar recap",
    category: "marketing",
    subject: "Thanks for joining: here's the recording",
    sampleValues: { first_name: "Jules", event_name: "Design Systems Live", recording_url: `${NW}/recording`, cta_url: `${NW}/start`, ...NW_CO },
    design: sampleDocument({
      key: "recap",
      category: "marketing",
      previewText: "The full recording, the slides, and the three takeaways in one email.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("event_name", "recording_url", "cta_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerBrand(p, { name: "Northwind" }, { label: "Recording" }),
        ...bands.heroBanner(p, {
          align: "left",
          image: { src: stockCrop("event", 1072, 600), alt: "The speaker on stage in front of the slides", href: "{{recording_url}}" },
          overline: "Recording · 47 min",
          title: "The {{event_name}} recording is ready",
          lead: "Hi {{first_name}}, thanks for coming. The full session is up, slides included, so you can rewatch a part or share it with your team.",
          cta: { label: "Watch the recording", href: "{{recording_url}}" },
        }),
        ...bands.steps(p, {
          tone: "tint",
          title: "The three takeaways",
          items: [
            { title: "Name tokens by job, not by colour", line: "\"text-muted\" survives a rebrand; \"grey-500\" doesn't." },
            { title: "Review components with a checklist", line: "Twelve checks, ten minutes, before anything ships." },
            { title: "Publish the rules where people work", line: "In the editor and the repo, not in a wiki nobody opens." },
          ],
        }),
        ...bands.quote(p, { tone: "plain", quote: "The design system is the checklist, not the Figma file.", name: "Lena Brandt", role: "Design lead, Copperline" }),
        ...bands.ctaContrast(p, { title: "Put it into practice", line: "Start from the token template we showed in the session.", cta: { label: "Open the template", href: "{{cta_url}}" } }),
        ...bands.signoff(p, { help: "Questions we didn't get to? Reply and the speakers will answer them.", signature: "The Northwind team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Discount offer: a gift photo banner, the code card, why now
// ---------------------------------------------------------------------------
const discountOffer: SampleTemplate = (() => {
  const p = palette("rose");
  return {
    key: "discount-offer",
    name: "Discount offer",
    category: "marketing",
    subject: "{{discount}} off: this week only",
    sampleValues: { first_name: "Maya", discount: "20%", promo_code: "THANKS20", shop_url: "https://alderandfinch.example/shop", company_name: "Alder & Finch", company_address: ADDRESS },
    design: sampleDocument({
      key: "disc",
      category: "marketing",
      previewText: "A thank-you: {{discount}} off anything, until Sunday.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("discount", "promo_code", "shop_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerCentered(p, { name: "Alder & Finch" }),
        ...bands.heroBanner(p, {
          image: { src: stockCrop("giftPink", 1072, 600), alt: "A pink gift box tied with a gold ribbon" },
          overline: "Just for you",
          title: "A thank-you, {{first_name}}",
          lead: "You've been with us a year this week. Here's {{discount}} off anything in the shop, until Sunday night.",
        }),
        ...bands.offer(p, {
          overline: "This week only",
          title: "{{discount}} off",
          line: "Use this code at checkout:",
          code: "{{promo_code}}",
          cta: { label: "Shop with {{discount}} off", href: "{{shop_url}}" },
          terms: "Ends Sunday at midnight. One use per customer; not valid on gift cards.",
        }),
        ...bands.trustStrip(p, {
          items: [
            { icon: "truck", label: "Free delivery this week" },
            { icon: "refresh-cw", label: "30-day returns" },
            { icon: "gift", label: "Gift wrap on request" },
          ],
        }),
        ...bands.signoff(p, { help: "Questions about an order? Reply to this email.", signature: "Alder & Finch" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Abandoned cart: the items, the total, one button
// ---------------------------------------------------------------------------
const abandonedCart: SampleTemplate = (() => {
  const p = palette("forest");
  const SHOP = "https://alderandfinch.example";
  return {
    key: "abandoned-cart",
    name: "Abandoned cart",
    category: "marketing",
    subject: "You left something behind",
    sampleValues: { first_name: "Maya", item_name: "Linen crew tee", cart_url: `${SHOP}/cart`, company_name: "Alder & Finch", company_address: ADDRESS },
    design: sampleDocument({
      key: "cart",
      category: "marketing",
      previewText: "Your {{item_name}} and two more are still in your cart.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("item_name", "cart_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerCentered(p, { name: "Alder & Finch" }),
        ...bands.heroHeadline(p, {
          overline: "Still in your cart",
          title: "You left something behind",
          lead: "Hi {{first_name}}, your {{item_name}} and two more are waiting. We've held them for you, but popular sizes do sell out.",
          cta: { label: "Back to my cart", href: "{{cart_url}}" },
        }),
        productLine(p, { image: stockCrop("tee", 128, 128), name: "{{item_name}}", meta: "Sand · Size M", price: "$38" }),
        productLine(p, { image: stockCrop("jacket", 128, 128), name: "Waxed field jacket", meta: "Olive · Size M", price: "$165" }),
        productLine(p, { image: stockCrop("sneakerTan", 128, 128), name: "Canvas low-top", meta: "Tan · Size 9", price: "$72" }),
        spacer(12),
        ...bands.summary(p, { heading: "Your cart", meta: "Held for 48 hours", lines: [{ label: "3 items", value: "$275.00" }, { label: "Delivery", value: "Free" }], total: { label: "Total", value: "$275.00" } }),
        ...bands.buttonBand(p, { cta: { label: "Finish checking out", href: "{{cart_url}}" }, note: "Free delivery and 30-day returns on everything." }),
        ...bands.reviews(p, {
          title: "From people who bought them",
          items: [
            { quote: "Softest tee I own, and it kept its shape after a year of washing.", name: "Dana", meta: "Linen crew tee" },
            { quote: "Proper wax, proper pockets. It's been through two winters.", name: "Marco", meta: "Waxed field jacket" },
          ],
        }),
        ...bands.signoff(p, { help: "Size question? Reply and a person from the shop will answer.", signature: "Alder & Finch" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Re-engagement: a soft panel, what's new, an honest way out
// ---------------------------------------------------------------------------
const reEngagement: SampleTemplate = (() => {
  const p = palette("violet");
  return {
    key: "re-engagement",
    name: "Re-engagement",
    category: "marketing",
    subject: "We miss you",
    sampleValues: { first_name: "Jules", product_name: "Northwind", return_url: `${NW}/app`, ...NW_CO },
    design: sampleDocument({
      key: "reeng",
      category: "marketing",
      previewText: "Here's what's new since you last stopped by, whenever you're ready.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("product_name", "return_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerWordmark(p, { name: "{{product_name}}" }),
        ...bands.heroPanel(p, {
          tone: "wash",
          label: "It's been a while",
          title: "We miss you, {{first_name}}",
          lead: "We've shipped a lot since you last stopped by {{product_name}}. Here are the three changes people notice first.",
          cta: { label: "Come see what's new", href: "{{return_url}}" },
          image: { src: stockPanel("skyBlush"), alt: "A soft blue and pink evening sky" },
        }),
        ...bands.cards(p, {
          items: [
            { icon: "zap", overline: "Faster", title: "Everything opens instantly", line: "Lists, threads and reports load in under a second.", link: { label: "Try it →", href: "{{return_url}}" } },
            { icon: "sparkles", overline: "New", title: "Drafts that write themselves", line: "Describe an email and get a first draft in your brand.", link: { label: "See how →", href: "{{return_url}}" } },
          ],
        }),
        ...bands.signoff(p, { help: "Not for you any more? No hard feelings: you can unsubscribe below, and we'll stop writing.", signature: "The {{product_name}} team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Feedback survey: a spot, one question, a one-tap rating
// ---------------------------------------------------------------------------
const feedbackSurvey: SampleTemplate = (() => {
  const p = palette("amber");
  return {
    key: "feedback-survey",
    name: "Feedback survey",
    category: "marketing",
    subject: "Got a minute? Tell us how we're doing",
    sampleValues: { first_name: "Jules", product_name: "Northwind", survey_url: `${NW}/survey`, ...NW_CO },
    design: sampleDocument({
      key: "survey",
      category: "marketing",
      previewText: "Two minutes, five questions, and every answer is read.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("product_name", "survey_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerCentered(p, { name: "{{product_name}}" }),
        ...bands.heroSpot(p, {
          icon: "message-circle",
          title: "How are we doing?",
          subtitle: "Two minutes, five questions",
          lead: "Hi {{first_name}}, we're deciding what to build next year. Your answers shape that list more than anything else we read.",
          cta: { label: "Take the survey", href: "{{survey_url}}" },
        }),
        ...bands.steps(p, {
          title: "What happens to your answers",
          items: [
            { title: "A person reads every one", line: "Not a dashboard: the product team reads them on Fridays." },
            { title: "We publish what we heard", line: "A summary goes out in January, with what we're changing because of it." },
            { title: "You hear back", line: "Leave your email at the end and we'll tell you when your idea ships." },
          ],
        }),
        ...bands.signoff(p, { help: "Rather just reply? That works too.", signature: "The {{product_name}} team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Customer story: a photo over the brand band, numbers, the quote, the story
// ---------------------------------------------------------------------------
const caseStudy: SampleTemplate = (() => {
  const p = palette("navy");
  return {
    key: "case-study",
    name: "Customer story",
    category: "marketing",
    subject: "How {{customer_name}} did it",
    sampleValues: { first_name: "Jules", product_name: "Northwind", customer_name: "Lumen", story_url: `${NW}/stories/lumen`, ...NW_CO },
    design: sampleDocument({
      key: "case",
      category: "marketing",
      previewText: "40% faster turnaround and full rollout in two weeks. How they did it.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("product_name", "customer_name", "story_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerBrand(p, { name: "{{product_name}}" }, { label: "Customer story" }),
        ...bands.heroPhoto(p, {
          image: { src: stockCrop("teamMeeting", 1200, 640), alt: "The {{customer_name}} team around a table" },
          overline: "Customer story",
          title: "How {{customer_name}} cut turnaround by 40%",
          lead: "Hi {{first_name}}, we sat down with the team at {{customer_name}} to hear what changed, and what they'd do differently.",
        }),
        ...bands.stats(p, {
          items: [
            { value: "40%", label: "faster turnaround" },
            { value: "2 wks", label: "to full rollout" },
            { value: "1 mo", label: "to pay for itself" },
          ],
        }),
        ...bands.quote(p, { quote: "It paid for itself in the first month. We can't imagine going back.", name: "Rafa Moreno", role: "Head of Growth, {{customer_name}}", image: stockAvatar("portraitMan"), serif: true }),
        ...bands.feature(p, {
          overline: "What they did",
          title: "One inbox, three rules, no handoffs",
          body: "{{customer_name}} moved every customer email into one shared inbox, wrote three routing rules, and stopped forwarding threads between teams.",
          bullets: ["Replies go to whoever owns the account.", "Escalations are a tag, not a forward.", "Every thread keeps its full history."],
          link: { label: "Read the full story →", href: "{{story_url}}" },
        }),
        ...bands.signoff(p, { help: "Want the same setup? Reply and we'll walk you through it.", signature: "The {{product_name}} team" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Referral: the deal as a poster, how it works, the link
// ---------------------------------------------------------------------------
const referral: SampleTemplate = (() => {
  const p = palette("emerald");
  return {
    key: "referral",
    name: "Referral invite",
    category: "marketing",
    subject: "Give {{reward}}, get {{reward}}",
    sampleValues: { first_name: "Jules", product_name: "Northwind", reward: "$20", referral_url: `${NW}/refer/jules`, ...NW_CO },
    design: sampleDocument({
      key: "refer",
      category: "marketing",
      previewText: "Share {{product_name}} with a friend and you both get {{reward}}.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("product_name", "reward", "referral_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerCentered(p, { name: "{{product_name}}" }),
        ...bands.heroPoster(p, {
          overline: "Invite a friend",
          title: "Give {{reward}}, get {{reward}}",
          line: "Hi {{first_name}}. When a friend joins with your link, you both get {{reward}} off your next bill.",
          cta: { label: "Share my link", href: "{{referral_url}}" },
        }),
        ...bands.steps(p, {
          title: "How it works",
          items: [
            { title: "Send your link", line: "By email, chat, wherever. It's yours alone." },
            { title: "They sign up", line: "Your friend gets {{reward}} off their first month." },
            { title: "You get {{reward}}", line: "Credited to your account the day they pay. No limit on friends." },
          ],
        }),
        ...bands.signoff(p, { help: "Questions about a referral? Reply to this email.", signature: "The {{product_name}} team", small: "Credit applies to paid plans and can't be exchanged for cash." }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// NEW · Seasonal menu: campaign art, three dishes, the code
// ---------------------------------------------------------------------------
const seasonalMenu: SampleTemplate = (() => {
  const p = palette("terracotta");
  const K = "https://saltandember.example";
  return {
    key: "seasonal-menu",
    name: "Seasonal menu",
    category: "marketing",
    subject: "The autumn menu is here",
    sampleValues: { first_name: "Maya", promo_code: "AUTUMN15", order_url: `${K}/order`, company_name: "Salt & Ember", company_address: ADDRESS },
    design: sampleDocument({
      key: "menu",
      category: "marketing",
      previewText: "Twelve new dishes, and 15% off your first autumn order.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("promo_code", "order_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerStrip(p, { items: ["Free delivery over $30", "Autumn menu from Thursday, Nov 6"] }),
        ...bands.headerCentered(p, { name: "Salt & Ember" }),
        ...bands.heroBanner(p, {
          image: { src: stockCrop("tableSpread", 1072, 600), alt: "A table spread with plates of the new autumn dishes" },
          overline: "New this week",
          title: "The autumn menu is here",
          lead: "Twelve new dishes, slow-cooked and ready in thirty minutes. Here are the three people order first.",
          cta: { label: "See the full menu", href: "{{order_url}}" },
        }),
        ...bands.gallery(p, {
          images: [
            { src: stockCrop("soupChillies", 352, 352), alt: "A bowl of spiced tomato soup with chillies", caption: "Spiced tomato soup · $9" },
            { src: stockCrop("croissants", 352, 352), alt: "Fresh croissants on a tray", caption: "Butter croissants · $4" },
            { src: stockCrop("fruitFlatlay", 352, 352), alt: "Fruit and greens on a white table", caption: "Harvest bowl · $13" },
          ],
        }),
        ...bands.priceList(p, {
          title: "Also new this week",
          items: [
            { name: "Slow-roast squash", line: "Brown butter, sage, toasted seeds.", price: "$14" },
            { name: "Lamb shoulder for two", line: "Six hours in the oven; potatoes and greens.", price: "$32" },
            { name: "Apple and rye crumble", line: "With cold cream.", price: "$7", was: "$9" },
          ],
        }),
        ...bands.offer(p, {
          overline: "Your first autumn order",
          title: "15% off",
          line: "Use this code at checkout:",
          code: "{{promo_code}}",
          cta: { label: "Order now", href: "{{order_url}}" },
          terms: "Valid until 30 November on orders over $25.",
        }),
        ...bands.signoff(p, { help: "Allergies or a big order? Reply and the kitchen will sort it.", signature: "The Salt & Ember kitchen" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// NEW · Rewards poster: a loyalty poster, the balance, two picks
// ---------------------------------------------------------------------------
const rewardsPoster: SampleTemplate = (() => {
  const p = palette("forest");
  const E = "https://embercoffee.example";
  return {
    key: "rewards-poster",
    name: "Rewards weekend",
    category: "marketing",
    subject: "Double stars, this weekend only",
    sampleValues: { first_name: "Sam", stars: "180", app_url: `${E}/app`, company_name: "Ember Coffee", company_address: ADDRESS },
    design: sampleDocument({
      key: "stars",
      category: "marketing",
      previewText: "Every order earns twice the stars, Friday to Sunday. You're 20 away from a free drink.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("stars", "app_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerCentered(p, { name: "Ember Coffee" }, { line: "Ember Rewards" }),
        ...bands.heroPoster(p, {
          overline: "Members only",
          title: "Double stars weekend",
          line: "Every order earns twice the stars, Friday to Sunday, in the shop and in the app.",
          cta: { label: "Order ahead", href: "{{app_url}}" },
        }),
        band([h2("You're close, {{first_name}}", p.ink, { marginBottom: 6 }), copy("{{stars}} of 200 stars. One coffee this weekend gets you a free drink.", p.body, { marginBottom: 0 })], { paddingY: 28 }),
        ...progressBar(p, 90, { label: "{{stars}} stars", value: "200 for a free drink" }),
        ...bands.cards(p, {
          title: "Worth the stars",
          items: [
            { image: { src: stockCard("latteArt"), alt: "A latte with a leaf drawn in the foam" }, overline: "New", title: "Maple oat latte", line: "Our autumn special, made with oat milk and a little maple." },
            { image: { src: stockCard("espressoDark"), alt: "An espresso in a white cup on a dark table" }, overline: "Every morning", title: "Single-origin espresso", line: "A new bean every month; this one is from Huila, Colombia." },
          ],
        }),
        ...bands.signoff(p, { help: "Stars missing from an order? Reply with the receipt and we'll add them.", signature: "Ember Coffee" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// NEW · Travel guide: a photo over the band, two trips in alternating rows, a gallery
// ---------------------------------------------------------------------------
const travelGuide: SampleTemplate = (() => {
  const p = palette("sky");
  const W = "https://wander.example";
  return {
    key: "travel-guide",
    name: "Travel guide",
    category: "marketing",
    subject: "Six mountain huts for this winter",
    sampleValues: { first_name: "Jules", trips_url: `${W}/winter`, company_name: "Wander", company_address: ADDRESS },
    design: sampleDocument({
      key: "travel",
      category: "marketing",
      previewText: "Two we'd book first, four more, and the dates that still have rooms.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("trips_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerCentered(p, { name: "Wander" }, { line: "The winter guide" }),
        ...bands.heroPanel(p, {
          tone: "ink",
          photo: { src: stockShaded("seaOfClouds", 1072, 760), alt: "Mountain peaks above a sea of clouds at dusk" },
          label: "Winter 2026",
          title: "Above the clouds this winter",
          lead: "Hi {{first_name}}. Six mountain huts with rooms left in January, picked by our guides.",
          cta: { label: "See all six", href: "{{trips_url}}" },
        }),
        ...bands.mediaRow(p, {
          image: { src: stockCrop("peakDusk", 496, 372), alt: "A snowy peak at dusk" },
          overline: "Our first pick",
          title: "Refugio Alto, 2,400 m",
          body: "Twelve beds, a wood stove, and the sunrise from the ridge ten minutes away. Two nights from $180.",
          link: { label: "See dates →", href: `${W}/refugio-alto` },
        }),
        ...bands.mediaRow(p, {
          flip: true,
          tone: "tint",
          image: { src: stockCrop("lakeBoat", 496, 372), alt: "A wooden boat on a mountain lake" },
          overline: "For a slower trip",
          title: "Lakehouse Brenta",
          body: "A boat to the door, a sauna on the jetty, and walks that start at breakfast. Three nights from $260.",
          link: { label: "See dates →", href: `${W}/lakehouse-brenta` },
        }),
        ...bands.gallery(p, {
          images: [
            { src: stockCrop("pineRidge", 352, 352), alt: "Pine forest below mountains", caption: "Pine Ridge" },
            { src: stockCrop("valley", 352, 352), alt: "A green valley with a river", caption: "Val Verde" },
            { src: stockCrop("hikersGroup", 352, 352), alt: "Hikers resting below a peak", caption: "Guided weeks" },
          ],
        }),
        ...bands.ctaContrast(p, { title: "January fills first", line: "Rooms for two in January are going fastest.", cta: { label: "Book a hut", href: "{{trips_url}}" } }),
        ...bands.signoff(p, { help: "Not sure which hut suits you? Reply and a guide will help.", signature: "The Wander guides" }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// NEW · Webinar invite: a split hero, the speakers, the agenda
// ---------------------------------------------------------------------------
const webinarInvite: SampleTemplate = (() => {
  const p = palette("violet");
  return {
    key: "webinar-invite",
    name: "Webinar invite",
    category: "marketing",
    subject: "Deliverability in 30 minutes: Thu, Nov 20",
    sampleValues: { first_name: "Jules", event_date: "Thu 20 Nov, 10:00 PT", register_url: `${NW}/webinars/deliverability`, ...NW_CO },
    design: sampleDocument({
      key: "webinar",
      category: "marketing",
      previewText: "What inboxes check, how to pass, and live Q&A. Free, 30 minutes.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("event_date", "register_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerBrand(p, { name: "Northwind" }, { label: "Webinar" }),
        ...bands.heroSplit(p, {
          overline: "Free · 30 minutes",
          title: "Deliverability in 30 minutes",
          lead: "What Gmail and Outlook check before they show your email, and how to pass every time.",
          cta: { label: "Register", href: "{{register_url}}" },
          image: { src: stockCrop("violetRibbon", 432, 432), alt: "A violet ribbon of light" },
        }),
        ...bands.eventDetails(p, {
          title: "When and where",
          rows: [
            { icon: "calendar", label: "When", value: "{{event_date}}" },
            { icon: "video", label: "Where", value: "Online. The link comes with your registration." },
          ],
        }),
        band([h2("Your hosts", p.ink, { marginBottom: 0 })], { paddingY: 0 }),
        spacer(16),
        peopleColumns(p, [
          { image: stockAvatar("portraitWoman"), name: "Ana Lima", role: "Deliverability lead" },
          { image: stockAvatar("portraitMan"), name: "Rafa Moreno", role: "Solutions engineer" },
        ]),
        ...bands.steps(p, {
          tone: "tint",
          title: "The agenda",
          items: [
            { title: "What inboxes check", line: "Authentication, reputation and engagement, in plain words." },
            { title: "A setup you can copy", line: "The DNS records and sending habits that keep you out of spam." },
            { title: "Live Q&A", line: "Bring a real bounce or a real header; we'll read it with you." },
          ],
        }),
        ...bands.signoff(p, { help: "Can't make it live? Register and we'll send the recording.", signature: "The Northwind team" }),
      ],
    }),
  };
})();

/** The ten original marketing samples, rebuilt; they replace the originals by key in samples.ts. */
export const MARKETING_REBUILDS: readonly SampleTemplate[] = [
  productAnnouncement,
  eventInvite,
  discountOffer,
  reEngagement,
  feedbackSurvey,
  waitlistInvite,
  abandonedCart,
  caseStudy,
  webinarRecap,
  referral,
];

/** New in the third set. */
export const MARKETING_V3: readonly SampleTemplate[] = [seasonalMenu, rewardsPoster, travelGuide, webinarInvite];

