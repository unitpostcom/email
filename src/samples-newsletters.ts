// Newsletter samples — the gallery's "Newsletters & digests" group, beyond the
// product update, content digest and founder letter in samples-marketing-v2.ts.
// Each is a different FORMAT, not one layout in several colours:
//
//   newsletter        a company's weekly issue: index, lead story, two more, a
//                     pull quote, quick hits, one button
//   july-newsletter   a compact monthly changelog: numbers, tagged entries,
//                     a fixes list, what's next
//   daily-brief       a text-first daily news brief: section bars, linked
//                     headlines with read times, a sponsor slot, quick links
//   link-roundup      a curated weekly link list: the one to read, numbered
//                     links with sources, quick hits, a tool of the week
//   essay-letter      a long-form essay: serif masthead, byline, sections, a
//                     pull quote, takeaways, an author note
//   community-update  a club or creator update: a photo, the month in numbers,
//                     a member spotlight, upcoming dates, forum threads
//
// The structure follows how well-read newsletters are put together (an index
// up top, the most important item first, short summaries, sponsors marked as
// sponsors, a forward line at the end); the brands, people, links and numbers
// are all fictional sample copy. Built only from the band builders and the
// sample-kit pieces, in the EMAIL_DESIGN.md house style; category "marketing",
// so each one gets the managed compliance footer at send.
//
// "newsletter" and "july-newsletter" keep the keys (and the variables the
// marketing pages fill in) of the original samples they replace.

import {
  bands,
  band,
  briefItems,
  column,
  copy,
  divider,
  FIRST_NAME,
  FOOTER_VARS,
  h1,
  h2,
  image,
  inputs,
  issueIndex,
  link,
  list,
  numberedLink,
  overline,
  palette,
  personRow,
  photoBand,
  pullQuote,
  richList,
  row,
  sampleDocument,
  section,
  sectionBar,
  SERIF,
  small,
  spacer,
  sponsorCard,
  stockAvatar,
  stockBanner,
  stockCrop,
  stockPanel,
  stockThumb,
  stockWide,
  text,
  BAND_GUTTER,
  type BandBlock,
  type BrandPalette,
  type SampleTemplate,
} from "./sample-kit";

const ADDRESS = "120 Market St, San Francisco, CA 94103";

// ---------------------------------------------------------------------------
// Newsletter — a company's weekly issue
// ---------------------------------------------------------------------------
const newsletter = (() => {
  const p = palette("navy");
  const EX = "https://harbor.example";
  return {
    key: "newsletter",
    name: "Newsletter",
    category: "marketing" as const,
    // `{{headline}}` names the lead story in the subject, the contents and the
    // feature, as this slug always has: an API caller that copies it from the
    // library and sends `headline` keeps getting its own (verifier on #1283).
    subject: "{{headline}}",
    sampleValues: { first_name: "Jules", headline: "Plan a quarter in one afternoon", cta_url: `${EX}/templates/quarterly-planning`, company_name: "Harbor", company_address: ADDRESS },
    design: sampleDocument({
      key: "news",
      category: "marketing",
      previewText: "Plus: the planning doc to copy, one team's Friday review, and three small updates.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("headline", "cta_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.heroMasthead(p, {
          name: "{{company_name}} Weekly",
          tagline: "How good teams plan, decide and ship",
          issue: "Issue 18",
          date: "Thursday, Nov 6",
          image: { src: stockCrop("blueRuffle", 1072, 300), alt: "A blue sculpted form on navy, the Weekly's masthead art" },
        }),
        band(
          [
            h1("The planning issue", p.ink, { fontSize: 32, letterSpacing: -0.64 }),
            copy("Hi {{first_name}}. This week: how three teams fit quarterly planning into one afternoon, the doc they all used, and three small things we shipped.", p.body, { marginBottom: 0 }),
          ],
          { paddingY: 28 },
        ),
        ...bands.byline(p, { image: stockAvatar("portraitWoman2"), name: "Rosa Lindqvist, editor", meta: "Thursday, Nov 6 · 12 min read", link: { label: "Read online →", href: `${EX}/weekly/18` } }),
        ...bands.contents(p, {
          items: [
            { title: "{{headline}}", meta: "6 min" },
            { title: "How Copperline runs its Friday review", meta: "4 min" },
            { title: "The planning doc, ready to copy", meta: "2 min" },
            { title: "Quick hits", meta: "three small updates" },
          ],
        }),
        ...bands.feature(p, {
          overline: "The lead · 6 min read",
          title: "{{headline}}",
          image: { src: stockWide("teamTalk"), alt: "A team planning around a table" },
          body: "Three teams told us how they replaced a week of planning meetings with one afternoon. They did the same three things.",
          bullets: [
            "A one-page draft goes out two days ahead, so the meeting is for decisions, not reading.",
            "Each team keeps three goals. Everything else goes on a 'not this quarter' list people can see.",
            "Nobody leaves until every goal has an owner and a date on the screen.",
          ],
          link: { label: "Read the full guide →", href: `${EX}/guides/quarter-in-an-afternoon` },
        }),
        ...bands.storyRows(p, {
          title: "Also this week",
          items: [
            {
              image: stockThumb("teamDesk"),
              alt: "A team at a long desk",
              overline: "Customer story · 4 min",
              title: "How Copperline runs its Friday review",
              line: "A 40-person team closes every week with a 20-minute review: what they look at, and the three numbers they stopped tracking.",
              href: `${EX}/stories/copperline`,
            },
            {
              image: stockThumb("writingHand"),
              alt: "A hand writing in a notebook",
              overline: "Template · 2 min",
              title: "The planning doc, ready to copy",
              line: "The one-page draft from the lead story, with the prompts each team filled in before the meeting.",
              href: "{{cta_url}}",
            },
          ],
        }),
        ...bands.quote(p, {
          quote: "We used to plan for two weeks and remember none of it. Now it takes one afternoon, and the 'not this quarter' list is the part everyone reads.",
          name: "Amara Osei",
          role: "Head of Operations, Copperline",
          image: stockAvatar("portraitWoman"),
          serif: true,
        }),
        band([
          h2("Quick hits", p.ink),
          richList(
            [
              [{ text: "Recurring goals.", bold: true }, " Set a goal to repeat each quarter and it keeps its owners."],
              [{ text: "Calendar export.", bold: true }, " Your plan's dates now show up in any calendar app."],
              [{ text: "Faster boards.", bold: true }, " Boards with 500 or more cards open in under a second."],
            ],
            p.body,
            { marginBottom: 0 },
          ),
        ]),
        ...bands.ctaContrast(p, { title: "Plan your next quarter this week", line: "The one-page doc from the lead story, ready to copy.", cta: { label: "Copy the planning doc", href: "{{cta_url}}" } }),
        ...bands.signature(p, {
          line: "What's the one planning habit your team swears by? Reply and tell me. The best ones go in a future issue.",
          name: "Rosa Lindqvist",
          role: "Editor, {{company_name}} Weekly",
          image: stockAvatar("portraitWoman2"),
        }),
        ...bands.readerLoop(p, { forward: { label: "Get your own copy every Thursday", href: `${EX}/weekly` } }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// July newsletter — a compact monthly changelog
// ---------------------------------------------------------------------------

/** One changelog entry: a tag pill on the left, title, line and link on the right. */
function changelogEntry(p: BrandPalette, c: { tag: string; title: string; body: string; link: { label: string; href: string } }): BandBlock {
  return row(
    [
      column(
        [
          text(c.tag, {
            fontSize: 12,
            fontWeight: "600",
            color: p.accentText,
            marginBottom: 0,
            customCss: `display: inline-block; padding: 3px 10px; border-radius: 999px; background-color: ${p.accentTint}`,
          }),
        ],
        18,
        { paddingX: 0, customCss: "width: 92px; vertical-align: top" },
      ),
      column(
        [
          text(c.title, { fontSize: 17, fontWeight: "600", lineHeight: "1.35", color: p.ink, marginBottom: 6 }),
          text(c.body, { fontSize: 15, lineHeight: "1.6", color: p.body, marginBottom: 8 }),
          link(c.link.label, c.link.href, p.accentText, { fontSize: 14 }),
        ],
        82,
        { paddingX: 0, customCss: "vertical-align: top" },
      ),
    ],
    { paddingX: BAND_GUTTER, paddingY: 14, columnGap: 0, stackOnMobile: false },
  );
}

const julyNewsletter = (() => {
  const p = palette("sky");
  const EX = "https://harbor.example";
  return {
    key: "july-newsletter",
    name: "July newsletter",
    category: "marketing" as const,
    subject: "What we shipped in July",
    sampleValues: { first_name: "Jules", changelog_url: `${EX}/changelog`, company_name: "Harbor", company_address: ADDRESS },
    design: sampleDocument({
      key: "july",
      category: "marketing",
      previewText: "A timeline view, recurring tasks, offline mode and eleven fixes.",
      palette: p,
      variables: [FIRST_NAME, ...inputs("changelog_url"), ...FOOTER_VARS],
      blocks: [
        ...bands.headerWordmark(p, { name: "{{company_name}}" }, { label: "Changelog" }),
        ...bands.heroPanel(p, {
          label: "July 2026",
          title: "Here's what we shipped in July",
          lead: "Hi {{first_name}}, three features and eleven fixes this month. All of it is live in your account today.",
          image: { src: stockPanel("spheresOnBlue"), alt: "Spheres and rings floating on a blue backdrop" },
        }),
        spacer(20),
        ...bands.stats(p, {
          items: [
            { value: "3", label: "new features" },
            { value: "11", label: "fixes" },
            { value: "2×", label: "faster search" },
          ],
        }),
        spacer(14),
        changelogEntry(p, {
          tag: "New",
          title: "Timeline view",
          body: "Every project on one timeline, with the dependencies between tasks drawn in. Drag a bar to move its dates and everything after it moves too.",
          link: { label: "Open the timeline →", href: `${EX}/timeline` },
        }),
        changelogEntry(p, {
          tag: "New",
          title: "Recurring tasks",
          body: "Weekly reports, monthly invoices, quarterly reviews: set one up once and it comes back on schedule with the same checklist.",
          link: { label: "Set one up →", href: `${EX}/help/recurring-tasks` },
        }),
        changelogEntry(p, {
          tag: "Improved",
          title: "Offline mode on mobile",
          body: "Open, edit and tick off tasks with no signal. Your changes sync the moment you're back online.",
          link: { label: "Update the app →", href: `${EX}/mobile` },
        }),
        spacer(14),
        divider(p.border),
        band([
          h2("Fixed and improved", p.ink),
          list(
            [
              "Search finds tasks by their comments, not only their titles.",
              "Due dates follow your time zone when you travel.",
              "Exports include archived projects.",
              "A mention goes to the right person when two names are similar.",
              "The Monday digest no longer arrives twice.",
            ],
            p.body,
            { marginBottom: 8 },
          ),
          small("And six smaller fixes, all in the changelog.", p.muted),
        ]),
        ...bands.callout(p, {
          overline: "Coming in August",
          title: "Workload view",
          body: "See who has too much on before the week starts, and move tasks between people in one drag. It's in beta now: reply to this email to try it early.",
        }),
        ...bands.buttonBand(p, { cta: { label: "Read the full changelog", href: "{{changelog_url}}" } }),
        ...bands.signoff(p, {
          help: "Something you'd like us to build next? Reply to this email. Every reply goes to the product team.",
          signature: "Jun and the {{company_name}} product team",
        }),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Daily brief — a text-first daily news brief
// ---------------------------------------------------------------------------
const dailyBrief = (() => {
  const p = palette("amber");
  const EX = "https://dailybuild.example";
  return {
    key: "daily-brief",
    name: "Daily brief",
    category: "marketing" as const,
    subject: "Why a team merged 14 services back into one",
    sampleValues: { first_name: "Sam", company_name: "The Daily Build", company_address: ADDRESS },
    design: sampleDocument({
      key: "brief",
      category: "marketing",
      previewText: "Plus a 2 kB date library, a spreadsheet hits 1.0, and four quick links. About five minutes.",
      palette: p,
      variables: [FIRST_NAME, ...FOOTER_VARS],
      blocks: [
        ...bands.heroMasthead(p, {
          name: "The Daily Build",
          tagline: "What developers are building, in five minutes",
          issue: "Daily brief",
          date: "Thu, 6 Nov 2026",
          image: { src: stockCrop("colourBlocks", 1072, 240), alt: "Bright stacked blocks, the Daily Build's masthead strip" },
        }),
        band(
          [
            h1("Good morning, {{first_name}}", p.ink, { fontSize: 28, letterSpacing: -0.56, marginBottom: 8 }),
            copy("Five stories, four quick links and one tool for the week. About five minutes of reading.", p.body, { marginBottom: 0 }),
          ],
          { paddingY: 20 },
        ),
        ...issueIndex(p, {
          title: "In today's brief",
          items: [
            ["A 60-person team merges 14 services back into one"],
            ["An open-source spreadsheet reaches 1.0 after six years"],
            ["A date library in 2 kB, and why sign-ups fail at one field"],
            ["Quick links, and a tool that resizes screenshots"],
          ],
        }),
        spacer(12),
        sectionBar(p, "Big stories", "newspaper"),
        briefItems(p, [
          {
            title: "Why a 60-person team merged 14 services back into one",
            href: `${EX}/go/one-app`,
            meta: "8 minute read · Engineering blog",
            summary: "Tallyho, a payments startup, folded its services into a single app. On-call pages fell by two thirds, and a deploy now takes 9 minutes instead of 40.",
          },
          {
            title: "An open-source spreadsheet reaches 1.0 after six years",
            href: `${EX}/go/gridline`,
            meta: "5 minute read · Release notes",
            summary: "Gridline runs in the browser and saves files as plain text you can diff. The stable release reads and writes the common desktop formats.",
          },
        ]),
        ...sponsorCard(p, {
          sponsor: "Quillmark",
          title: "Release notes your customers actually read",
          body: "Write a change once and Quillmark posts it to your site, inside your app and in a monthly email. Free for one product.",
          link: { label: "Try Quillmark →", href: `${EX}/sponsor/quillmark` },
        }),
        spacer(12),
        sectionBar(p, "Engineering & design", "code"),
        briefItems(p, [
          {
            title: "A date library in 2 kB",
            href: `${EX}/go/tock`,
            meta: "3 minute read · Project page",
            summary: "Tock formats, parses and compares dates with no dependencies, using the time-zone data the browser already ships.",
          },
          {
            title: "What a month of failed sign-ups showed one product team",
            href: `${EX}/go/signups`,
            meta: "6 minute read · Case study",
            summary: "Most people who gave up left at the same field: the one asking for a company name. Removing it lifted completed sign-ups by a fifth.",
          },
          {
            title: "Dark mode is not inverted light mode",
            href: `${EX}/go/dark-mode`,
            meta: "7 minute read · Essay",
            summary: "A designer picks dark colours by hand: why pure black tires the eyes, and which greys keep text readable.",
          },
        ]),
        sectionBar(p, "Quick links", "link"),
        band(
          [
            richList(
              [
                [{ text: "The case for boring technology, ten years on", href: `${EX}/go/boring`, bold: true, color: p.ink }, { text: " (9 minute read)", color: p.muted }],
                [{ text: "A visual guide to how browsers paint a page", href: `${EX}/go/paint`, bold: true, color: p.ink }, { text: " (12 minute read)", color: p.muted }],
                [{ text: "Terminal shortcuts that work everywhere", href: `${EX}/go/terminal`, bold: true, color: p.ink }, { text: " (2 minute read)", color: p.muted }],
                [{ text: "Why your laptop fan spins up at 3% CPU", href: `${EX}/go/fans`, bold: true, color: p.ink }, { text: " (5 minute read)", color: p.muted }],
              ],
              p.body,
              { lineHeight: "1.7", marginBottom: 0 },
            ),
          ],
          { paddingY: 24 },
        ),
        ...bands.callout(p, {
          overline: "Tool of the day",
          title: "Shotlist",
          body: "Drop in a folder of screenshots and get them back resized, compressed and named for each app store. It runs on your computer, so nothing is uploaded.",
          link: { label: "Get Shotlist →", href: `${EX}/go/shotlist` },
        }),
        spacer(12),
        divider(p.border),
        band([
          copy("Know someone who'd like this? Forward it to them. If a friend sent it to you, you can get tomorrow's brief in your own inbox.", p.body, { marginBottom: 12 }),
          link("Get The Daily Build →", `${EX}/subscribe`, p.accentText, { marginBottom: 16 }),
          small("Written by Dana Ortiz and Sam Okoro. Reply with tips, corrections or a link we missed.", p.muted),
        ]),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Link roundup — a curated weekly list of links
// ---------------------------------------------------------------------------
const linkRoundup = (() => {
  const p = palette("violet");
  const EX = "https://opentabs.example";
  return {
    key: "link-roundup",
    name: "Link roundup",
    category: "marketing" as const,
    subject: "Ten links worth keeping open this week",
    sampleValues: { first_name: "Jules", company_name: "Open Tabs", company_address: ADDRESS },
    design: sampleDocument({
      key: "tabs",
      category: "marketing",
      previewText: "A checkout teardown, a typeface for tiny screens, and why software gets slower.",
      palette: p,
      variables: [FIRST_NAME, ...FOOTER_VARS],
      blocks: [
        ...bands.heroMasthead(p, { name: "Open Tabs", tagline: "A reading list for people who make software", issue: "No. 112", date: "Nov 6, 2026", serif: true }),
        band(
          [
            h1("Ten links worth keeping open", p.ink, { fontFamily: SERIF, fontWeight: "400", fontSize: 32, letterSpacing: -0.6 }),
            copy("Hi {{first_name}}. This week: a teardown of a checkout page that converts, a typeface drawn for tiny screens, and a long read on why software gets slower every year. Picked by hand, and read in full before they made the list.", p.body, { marginBottom: 0 }),
          ],
          { paddingY: 24 },
        ),
        divider(p.border),
        band([
          overline("01 · The one to read", p.accentText),
          h2("Why software gets slower every year", p.ink, { marginBottom: 16 }),
          image(stockWide("laptopDark"), "A laptop on a dark desk", { width: 536, borderRadius: 12, marginBottom: 18, href: `${EX}/go/slow-software` }),
          copy("An engineer timed the same five tasks on laptops from 2006 to 2026. The machines got forty times faster; opening a document got slower. Where the time goes, with traces you can open yourself.", p.body, { marginBottom: 12 }),
          link("Read the essay (14 min) →", `${EX}/go/slow-software`, p.accentText),
        ]),
        divider(p.border),
        spacer(28),
        band([h2("Worth your time", p.ink, { marginBottom: 8 })], { paddingY: 0 }),
        numberedLink(p, 2, {
          title: "Teardown: a checkout page that converts at 9%",
          href: `${EX}/go/checkout`,
          summary: "Every field, button and line of copy on one shop's checkout, and what each change did to sales.",
          source: "Shopfront Notes · 11 min",
        }),
        numberedLink(p, 3, {
          title: "A typeface drawn for 12-pixel screens",
          href: `${EX}/go/tiny-type`,
          summary: "Why most fonts fall apart on watch faces and dashboards, and the six rules this one follows.",
          source: "Type Desk · 6 min",
        }),
        numberedLink(p, 4, {
          title: "The spreadsheet that runs a 200-person company",
          href: `${EX}/go/spreadsheet`,
          summary: "One finance lead, 31 tabs, no scripts: a tour of a model that has lasted three funding rounds.",
          source: "Operator's Log · 9 min",
        }),
        spacer(4),
        ...sponsorCard(p, {
          sponsor: "Notewell",
          title: "Notes that find their own links",
          body: "Notewell suggests links between your notes as you write, so last month's research turns up when you need it. Free for personal use.",
          link: { label: "Try Notewell →", href: `${EX}/sponsor/notewell` },
        }),
        spacer(4),
        numberedLink(p, 5, {
          title: "How to write an error message people read",
          href: `${EX}/go/errors`,
          summary: "Say what happened, what it means and what to do next, in that order. Twelve before-and-after examples.",
          source: "Plain Interface · 5 min",
        }),
        numberedLink(p, 6, {
          title: "A year of Wednesdays with no meetings",
          href: `${EX}/go/wednesdays`,
          summary: "A 50-person team kept one day a week free of meetings. What it did to shipping, and what crept back.",
          source: "Remote Craft · 7 min",
        }),
        spacer(16),
        divider(p.border),
        band([
          h2("Quick hits", p.ink),
          richList(
            [
              [{ text: "A contrast checker that suggests a passing colour", href: `${EX}/go/contrast`, bold: true, color: p.ink }, { text: " · Colour Lab", color: p.muted }],
              [{ text: "Forty years of airline safety cards, searchable", href: `${EX}/go/safety-cards`, bold: true, color: p.ink }, { text: " · Card Archive", color: p.muted }],
              [{ text: "The clearest explainer on file compression", href: `${EX}/go/compression`, bold: true, color: p.ink }, { text: " · Bits Explained", color: p.muted }],
              [{ text: "The keyboard shortcuts worth learning, on one sheet", href: `${EX}/go/shortcuts`, bold: true, color: p.ink }, { text: " · Keymap", color: p.muted }],
            ],
            p.body,
            { lineHeight: "1.7", marginBottom: 0 },
          ),
        ]),
        ...bands.callout(p, {
          overline: "Tool of the week",
          title: "Tabstash",
          body: "Saves every open tab to a dated list and closes them, so the week starts with an empty browser. Free, and no account.",
          link: { label: "Get Tabstash →", href: `${EX}/go/tabstash` },
        }),
        spacer(12),
        divider(p.border),
        band([
          copy("Found something worth sharing? Reply with the link. I read every one, and the best make the next issue.", p.body, { marginBottom: 12 }),
          copy("Theo", p.body, { marginBottom: 16 }),
          small("Open Tabs comes out every Sunday. If a friend forwarded this to you, you can get your own copy.", p.muted, { marginBottom: 8 }),
          link("Subscribe to Open Tabs →", `${EX}/subscribe`, p.accentText, { fontSize: 14 }),
        ]),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Essay letter — a long-form essay newsletter in a serif
// ---------------------------------------------------------------------------
const essayLetter = (() => {
  const p = palette("terracotta");
  const EX = "https://marlow.example";
  const para = (t: string, extra: BandBlock = {}) => text(t, { fontSize: 17, lineHeight: "1.7", fontFamily: SERIF, color: p.body, marginBottom: 18, ...extra });
  const sub = (t: string) => h2(t, p.ink, { fontFamily: SERIF, fontSize: 24, letterSpacing: -0.3, marginBottom: 12 });
  return {
    key: "essay-letter",
    name: "Essay letter",
    category: "marketing" as const,
    subject: "Raise your prices before you add features",
    sampleValues: { company_name: "Marlow", company_address: ADDRESS },
    design: sampleDocument({
      key: "essay",
      category: "marketing",
      previewText: "Most small products are underpriced. A test that takes an afternoon, and what to watch the week after.",
      palette: p,
      variables: [...FOOTER_VARS],
      blocks: [
        ...bands.heroMasthead(p, { name: "Marlow", tagline: "Essays on running small software companies", issue: "No. 31", date: "6 Nov 2026", serif: true }),
        band(
          [
            h1("Raise your prices before you add features", p.ink, { fontFamily: SERIF, fontSize: 34, letterSpacing: -0.5, marginBottom: 14 }),
            text("Most small products are underpriced. Here is a test that takes one afternoon, and what to watch in the week after you change the number.", { fontSize: 18, lineHeight: "1.5", color: p.muted, marginBottom: 0 }),
          ],
          { paddingY: 32 },
        ),
        ...bands.byline(p, { image: stockAvatar("portraitWoman2"), name: "Iris Okafor", meta: "6 Nov 2026 · 9 min read" }),
        ...photoBand(stockWide("deskFlatlay"), "A pen resting on handwritten notes", { top: 24 }),
        band([
          para("Every founder I talk to has a list of features they're sure will make people pay. Almost none of them have changed their price in two years."),
          para("That's the wrong way round. A feature takes a quarter to build and might move revenue a few percent. A price change takes an afternoon, and for most small products it's the biggest lever nobody has pulled."),
          sub("The afternoon test"),
          para("Pick ten customers who signed up in the last six months. Send each one a single question: if we disappeared tomorrow, what would you use instead, and what would it cost you?"),
          para("You're not asking whether they'd pay more. You're finding out what the alternative costs, which is the ceiling your price sits under. If the answers cluster at three times what you charge, you have room.", { marginBottom: 0 }),
        ]),
        ...pullQuote(p, { quote: "A feature takes a quarter to build. A price change takes an afternoon.", serif: true, paddingY: 4 }),
        band([
          sub("The week after"),
          para("Change the price for new customers only, and tell existing ones they keep theirs. Then watch three numbers for a week:"),
          list(
            [
              "Trial starts. A small dip is normal; a drop of more than a fifth means you went too far.",
              "Trial-to-paid conversion. It usually holds, which surprises everyone.",
              "Replies to the announcement. Count the angry ones. It's rarely more than two.",
            ],
            p.body,
            { fontSize: 17, lineHeight: "1.7", fontFamily: SERIF, marginBottom: 18 },
          ),
          para("If two of the three hold, keep the new price. If they don't, roll it back. You've lost a week, not a quarter.", { marginBottom: 0 }),
        ]),
        band(
          [
            section(
              [
                overline("The short version", p.accentText, { marginBottom: 10 }),
                list(
                  [
                    "Ask ten customers what they'd use instead, and what it costs.",
                    "Raise the price for new sign-ups; leave existing customers where they are.",
                    "Watch trials, conversion and replies for one week, then decide.",
                  ],
                  p.body,
                  { ordered: true, lineHeight: "1.65", marginBottom: 0 },
                ),
              ],
              { backgroundColor: p.accentTint, paddingX: 24, paddingY: 20, border: { width: 1, style: "solid", color: p.accentBorder, radius: 12 } },
            ),
          ],
          { paddingY: 16 },
        ),
        band([
          para("Next issue: how to tell existing customers about a price change, and the one email that keeps them."),
          para("Until then,", { marginBottom: 4 }),
          text("Iris", { fontSize: 18, fontWeight: "700", fontFamily: SERIF, color: p.ink, marginBottom: 20 }),
          small("If this was useful, forward it to one founder who keeps putting off a price change. That's how most readers find Marlow.", p.muted, { marginBottom: 12 }),
          link("Read past essays →", `${EX}/archive`, p.accentText),
        ]),
        divider(p.border),
        spacer(24),
        personRow(p, {
          image: stockAvatar("portraitWoman2"),
          name: "About Iris",
          meta: "Iris Okafor ran pricing at two software companies and now advises small teams. Marlow comes out every other Thursday.",
        }),
        spacer(28),
      ],
    }),
  };
})();

// ---------------------------------------------------------------------------
// Community update — a club's monthly letter to its members
// ---------------------------------------------------------------------------
const communityUpdate = (() => {
  const p = palette("emerald");
  const EX = "https://fernwood.example";
  return {
    key: "community-update",
    name: "Community update",
    category: "marketing" as const,
    subject: "412 of you walked 9,800 km in October",
    sampleValues: { first_name: "Jules", company_name: "Fernwood Trail Club", company_address: ADDRESS },
    design: sampleDocument({
      key: "community",
      category: "marketing",
      previewText: "Plus November's walks, a member who finished every trail on the map, and a call for walk leaders.",
      palette: p,
      variables: [FIRST_NAME, ...FOOTER_VARS],
      blocks: [
        ...bands.headerCentered(p, { name: "Fernwood Trail Club" }, { line: "November club update" }),
        ...bands.heroPhoto(p, {
          image: { src: stockCrop("pineRidge", 1200, 640), alt: "Mountains and pine forest seen from the October ridge walk" },
          overline: "October in numbers",
          title: "412 of you walked 9,800 km in October",
          lead: "Our busiest month since the club started: 23 group walks, 61 first-timers and only one wrong turn (sorry, Thursday group).",
        }),
        band([copy("Hi {{first_name}}. Here's what's coming up in November, and how you can help.", p.body, { marginBottom: 0 })]),
        ...bands.stats(p, {
          items: [
            { value: "412", label: "members walked" },
            { value: "9,800 km", label: "walked together" },
            { value: "61", label: "first walks" },
          ],
        }),
        band(
          [
            overline("Member spotlight", p.accentText),
            h2("Priya has walked every trail on the club map", p.ink),
            copy("All 38 of them, over two years, mostly on Sunday mornings. Her favourite is still the first one she did: the 6 km river loop.", p.body, { marginBottom: 0 }),
          ],
          { paddingY: 28 },
        ),
        ...bands.quote(p, {
          quote: "I joined to get out of the house once a week. Two years later, the Sunday group are the people I'd call if my car broke down.",
          name: "Priya Sethi",
          role: "Member since 2024 · 38 of 38 trails",
          image: stockAvatar("portraitWoman"),
        }),
        ...bands.gallery(p, {
          images: [
            { src: stockCrop("hikersGroup", 352, 352), alt: "A group resting on rocks below a peak", caption: "Ridge loop, Oct 12" },
            { src: stockCrop("valley", 352, 352), alt: "A river valley under mountains", caption: "River loop, Oct 19" },
            { src: stockCrop("seaOfClouds", 352, 352), alt: "Peaks above a sea of clouds at dusk", caption: "Sunrise walk, Oct 26" },
          ],
        }),
        ...bands.eventDetails(p, {
          title: "Walks in November",
          rows: [
            { icon: "calendar", label: "Sat 15 Nov · 08:00", value: "Ridge loop, 12 km. Meet at the north car park." },
            { icon: "calendar", label: "Sun 23 Nov · 09:30", value: "River loop, 6 km. A good first walk; dogs welcome." },
            { icon: "moon", label: "Thu 27 Nov · 18:00", value: "Night walk, 5 km. Bring a head torch; we'll have spares." },
          ],
          link: { label: "See every walk and sign up →", href: `${EX}/walks` },
        }),
        divider(p.border),
        band([
          h2("From the forum", p.ink),
          richList(
            [
              [{ text: "Boots for wet trails under $150?", href: `${EX}/forum/boots`, bold: true, color: p.ink }, { text: " · 34 replies", color: p.muted }],
              [{ text: "Lift share from the east side on Saturdays", href: `${EX}/forum/lifts`, bold: true, color: p.ink }, { text: " · 12 replies", color: p.muted }],
              [{ text: "Photos from the October ridge walk", href: `${EX}/forum/ridge-photos`, bold: true, color: p.ink }, { text: " · 58 photos", color: p.muted }],
            ],
            p.body,
            { lineHeight: "1.7", marginBottom: 0 },
          ),
        ]),
        ...bands.ctaContrast(p, {
          title: "Lead a walk in December",
          line: "You pick the route, we send the map and a first-aid kit. New leaders walk with a volunteer the first time.",
          cta: { label: "Sign up to lead", href: `${EX}/lead` },
        }),
        ...bands.signoff(p, {
          help: "Got photos from a walk? Reply with them and we'll share a few next month.",
          signature: "Ben and the Fernwood volunteers",
          small: "Know someone who'd like a Saturday walk? Forward this to them. Every walk is open to newcomers.",
        }),
      ],
    }),
  };
})();

/** Rebuilt in place of the original samples with these keys (samples.ts keeps their registry position). */
export const NEWSLETTER_REBUILDS: readonly SampleTemplate[] = [newsletter, julyNewsletter];

/** New newsletter formats, appended to the registry. */
export const NEWSLETTERS_V2: readonly SampleTemplate[] = [dailyBrief, linkRoundup, essayLetter, communityUpdate];
