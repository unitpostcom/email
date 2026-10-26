import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseTsx } from "./codec";
import { lintEmailDesign, type DesignHintRule } from "./design-lint";
import { emailIconUrl, emailPlaceholderUrl } from "./email-assets";
import { SAMPLE_TEMPLATES } from "./samples";
import { SECTION_LAYOUTS } from "./layouts";
import { EmailDocumentSchema } from "./schema";

const doc = (tsx: string, extra: { category?: "marketing" | "transactional"; previewText?: string } = {}) =>
  EmailDocumentSchema.parse({ ...parseTsx(tsx), category: extra.category ?? "transactional", previewText: extra.previewText ?? "A preview line" });
const LAYOUT_RULES = new Set<DesignHintRule>(["spacing-doubled", "tight-spacing", "loose-spacing", "edge-gutter"]);
// Most tests are about copy, colour and structure; spacing has its own tests below.
const rules = (tsx: string, extra?: Parameters<typeof doc>[1]): DesignHintRule[] =>
  lintEmailDesign(doc(tsx, extra)).map((h) => h.rule).filter((r) => !LAYOUT_RULES.has(r));

const GOOD = `<Section padding-x={32} padding-y={28}>
  <Heading level={1}>Welcome to Acme</Heading>
  <Text>Your account is ready.</Text>
  <Button href="https://acme.com/start" margin-bottom={0}>Get started</Button>
</Section>`;

describe("lintEmailDesign", () => {
  test("a clean email has no hints; a Simple or empty one is never linted", () => {
    assert.deepEqual(rules(GOOD), []);
    assert.deepEqual(lintEmailDesign(EmailDocumentSchema.parse({ compositionMode: "simple", blocks: [] })), []);
    assert.deepEqual(lintEmailDesign(EmailDocumentSchema.parse({ blocks: [] })), []);
  });

  test("a button label that fails contrast gets a fix naming the readable colour", () => {
    const hints = lintEmailDesign(doc(GOOD.replace("<Button ", `<Button background-color="#84cc16" text-color="#ffffff" `)));
    const h = hints.find((x) => x.rule === "button-contrast");
    assert.ok(h, JSON.stringify(hints));
    assert.equal(h.severity, "fix");
    assert.match(h.message, /text-color="#18181b"/);
  });

  test("low-contrast text: below 3:1 is a fix, 3–4.5:1 a check, and the fix suggests a shade of the same colour", () => {
    const fix = lintEmailDesign(doc(`<Section><Heading level={1}>Hi</Heading><Text color="#d4d4d8">Faint copy</Text></Section>`)).find((h) => h.rule === "text-contrast");
    assert.equal(fix?.severity, "fix");
    const check = lintEmailDesign(doc(`<Section><Heading level={1}>Hi</Heading><Text color="#16a34a" font-size={13}>PAID</Text></Section>`)).find((h) => h.rule === "text-contrast");
    assert.equal(check?.severity, "check");
    assert.match(check!.message, /use #[0-9a-f]{6}/);
  });

  test("contrast is measured against the band the text sits on", () => {
    assert.deepEqual(rules(`<Section background-color="#18181b"><Heading level={1} color="#ffffff">On dark</Heading><Text color="#d4d4d8">Readable here</Text></Section>`), []);
    assert.ok(rules(`<Section background-color="#18181b"><Heading level={1}>Ink on ink</Heading></Section>`).includes("text-contrast"));
  });

  test("images need real alt text — except our decorative icons beside a label", () => {
    assert.ok(rules(`${GOOD}<Image src="https://acme.com/a.png" alt="" width={200} />`).includes("image-alt"));
    assert.ok(rules(`${GOOD}<Image src="https://acme.com/a.png" alt="Hero" width={200} />`).includes("image-alt"));
    assert.deepEqual(rules(`${GOOD}<Image src="https://acme.com/a.png" alt="The new dashboard with three charts" width={200} />`), []);
    assert.deepEqual(rules(`${GOOD}<Image src="${emailIconUrl("rocket", "soft")}" alt="" width={40} />`), []);
  });

  test("an icon on a background it doesn't show on is a fix naming the other look", () => {
    const onDark = (v: "ink" | "white" | "soft") => `<Section background-color="#18181b"><Heading level={1} color="#ffffff">Hi</Heading><Image src="${emailIconUrl("rocket", v)}" alt="" width={24} /></Section>`;
    const h = lintEmailDesign(doc(onDark("ink"))).find((x) => x.rule === "icon-contrast");
    assert.equal(h?.severity, "fix");
    assert.match(h!.message, /rocket-white\.png/);
    assert.ok(!rules(onDark("white")).includes("icon-contrast"));
    assert.ok(!rules(onDark("soft")).includes("icon-contrast"));
    assert.ok(rules(`${GOOD}<Image src="${emailIconUrl("zap", "white")}" alt="" width={24} />`).includes("icon-contrast"));
    assert.ok(!rules(`${GOOD}<Image src="${emailIconUrl("zap", "ink")}" alt="" width={24} />`).includes("icon-contrast"));
  });

  test("an icon on a band painted by CSS or a bg- class isn't second-guessed (verifier on #1090)", () => {
    const white = `<Image src="${emailIconUrl("rocket", "white")}" alt="" width={24} />`;
    const heading = `<Heading level={1} color="#ffffff">Hi</Heading>`;
    assert.ok(!rules(`<Section custom-css="background-color: #18181b" padding-x={32}>${heading}${white}</Section>`).includes("icon-contrast"));
    assert.ok(!rules(`<Section className="bg-zinc-900" padding-x={32}>${heading}${white}</Section>`).includes("icon-contrast"));
    assert.ok(!rules(`<Row><Column custom-css="background: #18181b linear-gradient(#18181b, #27272a)">${white}</Column></Row><Section>${heading}</Section>`).includes("icon-contrast"));
    assert.ok(!rules(`${GOOD}<Image src="${emailIconUrl("rocket", "white")}" alt="" width={24} custom-css="background-color: #18181b" />`).includes("icon-contrast"));
    // A colour set on a band inside a CSS-painted one is known again.
    assert.ok(rules(`<Section custom-css="background-color: #18181b">${heading}<Section background-color="#ffffff">${white}</Section></Section>`).includes("icon-contrast"));
  });

  test("placeholder links, copy and images are flagged", () => {
    assert.ok(rules(GOOD.replace("https://acme.com/start", "https://example.com")).includes("placeholder-link"));
    assert.ok(rules(GOOD.replace("https://acme.com/start", "#")).includes("placeholder-link"));
    assert.deepEqual(rules(GOOD.replace("https://acme.com/start", "{{cta_url}}")), []);
    assert.ok(rules(GOOD.replace("Your account is ready.", "Lorem ipsum dolor sit amet.")).includes("placeholder-copy"));
    assert.ok(rules(GOOD.replace("Your account is ready.", "Welcome to [Your company]!")).includes("placeholder-copy"));
    const ph = lintEmailDesign(doc(`${GOOD}<Image src="${emailPlaceholderUrl("wide")}" alt="The new inbox" width={536} />`)).find((h) => h.rule === "placeholder-image");
    assert.equal(ph?.severity, "check");
  });

  test("structure: no heading, two H1s, a marketing email with no action, too many buttons, no preview text", () => {
    assert.ok(rules(`<Section><Text>Just text</Text></Section>`).includes("no-heading"));
    assert.ok(rules(`<Section><Heading level={1}>A</Heading><Heading level={1}>B</Heading></Section>`).includes("multiple-h1"));
    assert.ok(rules(`<Section><Heading level={1}>Sale</Heading><Text>No way to act.</Text></Section>`, { category: "marketing" }).includes("no-action"));
    const four = Array.from({ length: 4 }, (_, i) => `<Button href="https://acme.com/${i}">Go ${i}</Button>`).join("");
    assert.ok(rules(`<Section><Heading level={1}>Hi</Heading>${four}</Section>`).includes("too-many-buttons"));
    assert.ok(rules(GOOD, { previewText: "" }).includes("no-preview-text"));
  });

  test("a button added in another shape than the email's buttons is a fix (owner report 2026-10-26)", () => {
    const pill = `<Button href="https://acme.com/start" border-radius={999} inner-padding-x={28}>Get started</Button>`;
    const square = `<Button href="https://cal.com/acme">Book an onboarding call</Button>`;
    const hints = lintEmailDesign(doc(`<Section><Heading level={1}>Hi</Heading>${pill}<Text>Or talk to us.</Text>${pill.replace("Get started", "Start now")}${square}</Section>`));
    const h = hints.find((x) => x.rule === "button-style");
    assert.equal(h?.severity, "fix", JSON.stringify(hints));
    assert.match(h!.message, /"Book an onboarding call" has border-radius=\{\d+\} but "Get started" has border-radius=\{999\}/);
    assert.match(h!.message, /inner-padding-x=\{28\}/);
    // Same shape, same fill: nothing to say.
    assert.ok(!rules(`<Section><Heading level={1}>Hi</Heading>${pill}${pill.replace("Get started", "Start now")}</Section>`).includes("button-style"));
  });

  test("a button in another colour is only a check", () => {
    const hints = lintEmailDesign(doc(`<Section><Heading level={1}>Hi</Heading><Button href="https://a.co" background-color="#4f46e5">One</Button><Button href="https://b.co" background-color="#16a34a">Two</Button></Section>`));
    assert.deepEqual(hints.filter((h) => h.rule === "button-style").map((h) => h.severity), ["check"]);
  });

  test("Markdown in copy and a hand-written unsubscribe line are fixes; a Markdown block is fine", () => {
    assert.ok(rules(GOOD.replace("Your account is ready.", "Your account is **ready**.")).includes("markdown-syntax"));
    assert.ok(rules(`${GOOD}<Link href="{{unsubscribe_url}}">Unsubscribe</Link>`, { category: "marketing" }).includes("footer-in-body"));
    assert.deepEqual(rules(`${GOOD}<Text>Not for you? No hard feelings — you can unsubscribe below.</Text>`, { category: "marketing" }), []);
  });

  test("small text and long centred copy", () => {
    assert.ok(rules(`${GOOD}<Text font-size={10}>Tiny</Text>`).includes("small-text"));
    assert.ok(rules(`${GOOD}<Text align="center">${"A long centred paragraph that keeps going. ".repeat(10)}</Text>`).includes("centered-long-copy"));
  });

  test("a gradient band without a solid fallback colour is a fix", () => {
    assert.ok(rules(`<Section custom-css="background: linear-gradient(135deg, #4f46e5, #312e81)"><Heading level={1} color="#ffffff">Hi</Heading></Section>`).includes("gradient-fallback"));
    assert.deepEqual(
      rules(`<Section background-color="#4f46e5" custom-css="background: #4f46e5 linear-gradient(135deg, #4f46e5, #312e81)"><Heading level={1} color="#ffffff">Hi</Heading></Section>`),
      [],
    );
  });

  test("a gradient shorthand without its own solid colour is a fix (it clears background-color)", () => {
    assert.ok(
      rules(`<Section background-color="#4f46e5" custom-css="background: linear-gradient(135deg, #4f46e5, #312e81)"><Heading level={1} color="#ffffff">Hi</Heading></Section>`).includes("gradient-fallback"),
    );
    assert.deepEqual(
      rules(`<Section background-color="#4f46e5" custom-css="background: rgb(79, 70, 229) linear-gradient(135deg, #4f46e5 0%, #312e81 100%)"><Heading level={1} color="#ffffff">Hi</Heading></Section>`),
      [],
    );
  });

  test("hints are capped and ordered fixes first", () => {
    const messy = `<Section><Text font-size={10} color="#eeeeee">x</Text>${Array.from({ length: 12 }, () => `<Image src="https://acme.com/a.png" alt="" width={10} />`).join("")}</Section>`;
    const hints = lintEmailDesign(doc(messy, { previewText: "" }), { max: 5 });
    assert.equal(hints.length, 5);
    assert.ok(hints.every((h, i) => i === 0 || !(hints[i - 1]!.severity === "check" && h.severity === "fix")));
  });

  // Our own starting points are the model's raw material: none may need a fix.
  test("no built-in sample or layout band needs a fix", () => {
    for (const s of SAMPLE_TEMPLATES) {
      const fixes = lintEmailDesign(s.design).filter((h) => h.severity === "fix");
      assert.deepEqual(fixes, [], `sample ${s.key}: ${fixes.map((f) => f.message).join(" / ")}`);
    }
    for (const l of SECTION_LAYOUTS) {
      const d = EmailDocumentSchema.parse({ previewText: "x", blocks: [{ type: "heading", id: "h", text: "Title", level: 1 }, ...l.build().blocks] });
      // Bands carry sample copy and links on purpose: they're inserted, then rewritten.
      const fixes = lintEmailDesign(d).filter((h) => h.severity === "fix" && h.rule !== "placeholder-link" && h.rule !== "placeholder-copy");
      assert.deepEqual(fixes, [], `layout ${l.key}: ${fixes.map((f) => f.message).join(" / ")}`);
    }
  });
});

describe("lintEmailDesign — variables", () => {
  test("more than six custom variables is a check; self-filling ones don't count", () => {
    const many = Array.from({ length: 7 }, (_, i) => `{{field_${i}}}`).join(" ");
    const hints = lintEmailDesign(doc(`${GOOD}<Text>${many}</Text>`));
    assert.equal(hints.find((h) => h.rule === "variable-heavy")?.severity, "check");
    const builtIns = "{{first_name}} {{last_name}} {{email}} {{company_name}} {{company_address}} {{a}} {{b}} {{c}}";
    assert.ok(!lintEmailDesign(doc(`${GOOD}<Text>${builtIns}</Text>`)).some((h) => h.rule === "variable-heavy"));
  });
});

describe("lintEmailDesign — starter filler", () => {
  test("a sample line from our bands left in an email is a fix; real copy isn't", () => {
    const hints = lintEmailDesign(doc(`${GOOD}<Text>Do the first thing</Text><Text>One line on what gets faster or easier.</Text>`));
    assert.equal(hints.filter((h) => h.rule === "placeholder-copy").length, 2);
    assert.match(hints[0]!.message, /Starter sample copy left in/);
    assert.deepEqual(rules(`${GOOD}<Text>Refills arrive every month, so you never run out.</Text>`), []);
    // Real copy that shares words with a sample title is fine.
    assert.deepEqual(rules(`${GOOD}<Heading level={2}>The biggest update this year: refills every month</Heading>`), []);
  });
});

describe("lintEmailDesign — spacing and email-safe CSS", () => {
  const edge = (tsx: string) =>
    EmailDocumentSchema.parse({ ...parseTsx(tsx), previewText: "x", theme: { bodyPadding: 0 } });
  const layout = (tsx: string) => lintEmailDesign(edge(tsx)).filter((h) => LAYOUT_RULES.has(h.rule) || h.rule === "unsafe-css");
  const band = (inner: string, py = 28) => `<Section padding-x={32} padding-y={${py}}>${inner}</Section>`;

  test("well-spaced bands pass: 28 + 28 between sections, last block without margin", () => {
    assert.deepEqual(layout(band(`<Heading level={1} margin-bottom={0}>Hi</Heading>`) + band(`<Text margin-bottom={0}>Body</Text>`)), []);
  });

  test("sections that touch are flagged; a fix under 12px", () => {
    const hints = layout(band(`<Heading level={1} margin-bottom={0}>Hi</Heading>`, 4) + band(`<Text margin-bottom={0}>Body</Text>`, 4));
    assert.equal(hints.find((h) => h.rule === "tight-spacing")?.severity, "fix");
  });

  test("a spacer stacked on padded sections is flagged as too much space", () => {
    const hints = layout(band(`<Text margin-bottom={0}>A</Text>`) + `<Spacer height={60} />` + band(`<Text margin-bottom={0}>B</Text>`));
    assert.ok(hints.some((h) => h.rule === "loose-spacing"), JSON.stringify(hints));
  });

  test("a last block's margin on top of the section's padding is flagged once", () => {
    const hints = layout(band(`<Text>A</Text>`) + band(`<Text>B</Text>`));
    assert.equal(hints.filter((h) => h.rule === "spacing-doubled").length, 1);
    assert.match(hints.find((h) => h.rule === "spacing-doubled")!.message, /^2 sections end/);
  });

  test("a loose block in an edge-to-edge card touches the card's edges", () => {
    assert.equal(layout(`<Text margin-bottom={0}>Hello</Text>`).find((h) => h.rule === "edge-gutter")?.severity, "fix");
    // A full-width image is fine edge to edge.
    assert.deepEqual(layout(`<Image src="https://acme.com/a.png" alt="A product" width={600} />`), []);
  });

  test("flex, grid, positioning and friends are flagged; table-safe CSS is not", () => {
    for (const css of ["display: flex", "display:grid", "position: absolute", "float: left", "gap: 12px", "transform: rotate(2deg)", "width: calc(100% - 8px)", "color: var(--x)", "margin-top: -8px"]) {
      assert.ok(layout(band(`<Text margin-bottom={0} custom-css="${css}">A</Text>`)).some((h) => h.rule === "unsafe-css" && h.severity === "fix"), css);
    }
    assert.ok(layout(band(`<Text margin-bottom={0} className="flex gap-4">A</Text>`)).some((h) => h.rule === "unsafe-css"));
    for (const css of ["display: inline-block; padding: 4px 10px; border-radius: 999px", "vertical-align: middle; width: 40px", "background: #4f46e5 linear-gradient(135deg, #4f46e5, #312e81)"]) {
      assert.ok(!layout(band(`<Text margin-bottom={0} custom-css="${css}">A</Text>`)).some((h) => h.rule === "unsafe-css"), css);
    }
  });
});
