import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseTsx, parseTsxDocument, printTsx } from "./codec";
import { applyDocumentAttrs } from "./document-attrs";
import { contrastRatio } from "./color";
import { darkContrast, darkModeCss, darkPalette } from "./dark-mode";
import { lintEmailDesign } from "./design-lint";
import { renderToHtml } from "./render";
import { EmailDocumentSchema, type Theme } from "./schema";

// Dark mode + Outlook conditionals (0.4.0; audit 2026-10-24 G7). A deliberate
// change to every Designed email's HTML: pinned here so it can't drift.

const TSX = `<Section padding-x={32} padding-y={28}>
  <Heading level={1}>Welcome to Acme</Heading>
  <Text>Your account is ready. <a href="https://acme.com/help">Get help</a></Text>
  <Button href="https://acme.com/start">Get started</Button>
</Section>
<Section background-color="#fef3c7" padding-x={32} padding-y={20}>
  <Text>Offer ends Friday.</Text>
</Section>`;

// Dark mode is opt-in (#1056): these fixtures opt in with darkMode "auto".
const doc = (theme: Partial<Theme> = {}) =>
  EmailDocumentSchema.parse({ ...parseTsx(TSX), category: "transactional", previewText: "Welcome", theme: { ...EmailDocumentSchema.parse({}).theme, darkMode: "auto", ...theme } });
const optedIn = { ...EmailDocumentSchema.parse({}).theme, darkMode: "auto" as const };

describe("dark mode", () => {
  test("a send carries prefers-color-scheme CSS for backdrop, card, theme text and links", () => {
    const html = renderToHtml(doc(), {}, { showPoweredBy: false });
    assert.match(html, /<meta name="color-scheme" content="light dark" \/>/);
    assert.match(html, /@media \(prefers-color-scheme:dark\)\{\.ee-bg\{background-color:#0f0f11 !important;\}\.ee-body\{background-color:#1c1c1f !important;\}\.ee-dm-text\{color:#ececee !important;\}\.ee-dm-link\{color:#[0-9a-f]{6} !important;\}\.ee-dm-hide\{display:none !important;\}\.ee-dm-show\{display:inline !important;\}\}/);
    assert.match(html, /\[data-ogsc\] \.ee-dm-text\{/, "Outlook.com hook");
    assert.match(html, /<body class="ee-bg" style=/);
    assert.match(html, /<h1 class="ee-dm-text" style="[^"]*color:#1a1a1a/, "theme-coloured heading is tagged");
    assert.match(html, /<a href="https:\/\/acme\.com\/help" target="_blank" class="ee-dm-link"/, "theme-coloured link is tagged");
  });

  // Verifier on #1056: Markdown set the theme colour as its own, so it was
  // never tagged and kept near-black text (and theme links) on the dark card.
  test("Markdown on the card is tagged like Text: its text and its links", () => {
    const md = (tsx: string) =>
      renderToHtml(
        EmailDocumentSchema.parse({ ...parseTsx(tsx), category: "transactional", previewText: "x", theme: optedIn }),
        {},
        { showPoweredBy: false },
      );
    const html = md(`<Section><Markdown>Read the [guide](https://acme.com/guide) first.</Markdown></Section>`);
    // Inline code keeps its light chip, so it keeps light-mode text (#1056).
    assert.match(md("<Section><Markdown>Run `npm i` first.</Markdown></Section>"), /<code style="color:#1a1a1a;font-family:Consolas/);
    assert.match(html, /<div class="ee-dm-text" style="[^"]*color:#1a1a1a/, "theme-coloured Markdown is tagged");
    assert.match(html, /<a href="https:\/\/acme\.com\/guide" target="_blank" class="ee-dm-link"/, "its link is tagged");
    // Its own colour, or a band with its own background, keeps its colours.
    assert.doesNotMatch(md(`<Section><Markdown color="#7c2d12">Own colour.</Markdown></Section>`), /<div class="ee-dm-text"/);
    const band = md(`<Section background-color="#fef3c7"><Markdown>On the band, [link](https://acme.com/x).</Markdown></Section>`);
    assert.doesNotMatch(band, /ee-dm-text"[^>]*>On the band|class="ee-dm-link"/);
  });

  // Verifier on #1056: a background set through customCss is the section's
  // own too, and a standalone Link block is swapped like an inline link.
  test("a customCss background keeps its copy's colours; a standalone Link is swapped", () => {
    const render = (tsx: string) =>
      renderToHtml(
        EmailDocumentSchema.parse({ ...parseTsx(tsx), category: "transactional", previewText: "x", theme: optedIn }),
        {},
        { showPoweredBy: false },
      );
    assert.match(render(`<Section custom-css="background-color:#ffffff"><Text>On white.</Text></Section>`), /<p style="[^"]*">On white\.<\/p>/);
    assert.match(render(`<Section custom-css="padding:4px; background: #fef3c7 !important"><Text>On amber.</Text></Section>`), /<p style="[^"]*">On amber\.<\/p>/);
    assert.match(render(`<Section custom-css="background: transparent"><Text>On the card.</Text></Section>`), /<p class="ee-dm-text"[^>]*>On the card\.<\/p>/);
    // A transparent background through a class or the prop shows the card too.
    assert.match(render(`<Section className="bg-transparent"><Text>Through a class.</Text></Section>`), /<p class="ee-dm-text"[^>]*>Through a class\.<\/p>/);
    assert.match(render(`<Section background-color="transparent"><Text>Through the prop.</Text></Section>`), /<p class="ee-dm-text"[^>]*>Through the prop\.<\/p>/);
    assert.match(render(`<Section className="bg-white"><Text>On white.</Text></Section>`), /<p style="[^"]*">On white\.<\/p>/, "a real bg- colour is still its own");
    // Verifier on #1056: what paints is the last layer (className, then the
    // prop, then customCss), not any one of them.
    const onCard = /<p class="ee-dm-text"[^>]*>Over\.<\/p>/;
    const own = /<p style="[^"]*">Over\.<\/p>/;
    assert.match(render(`<Section className="bg-white bg-transparent"><Text>Over.</Text></Section>`), onCard);
    assert.match(render(`<Section className="bg-transparent bg-white"><Text>Over.</Text></Section>`), own);
    assert.match(render(`<Section className="bg-white" custom-css="background:transparent"><Text>Over.</Text></Section>`), onCard);
    assert.match(render(`<Section background-color="#fef3c7" custom-css="background-color: transparent !important"><Text>Over.</Text></Section>`), onCard);
    assert.match(render(`<Section className="bg-transparent" custom-css="background-color:#ffffff"><Text>Over.</Text></Section>`), own);
    assert.match(render(`<Section custom-css="background:transparent; background-image:url(https://acme.com/a.png)"><Text>Over.</Text></Section>`), own);
    // An !important declaration isn't overridden by a later plain one (#1056).
    assert.match(render(`<Section custom-css="background-color:#ffffff !important; background-color:transparent"><Text>Over.</Text></Section>`), own);
    assert.match(render(`<Section custom-css="background:#ffffff !important; background:transparent"><Text>Over.</Text></Section>`), own);
    assert.match(render(`<Section custom-css="background-color:#ffffff !important; background-color:transparent !important"><Text>Over.</Text></Section>`), onCard);
    assert.match(render(`<Section custom-css="background-color:transparent !important; background-color:#ffffff"><Text>Over.</Text></Section>`), onCard);
    // The shorthand's own parts decide (#1056): no colour and no image paints nothing.
    for (const css of ["background:none no-repeat", "background: no-repeat center / cover", "background:url(https://acme.com/a.png) no-repeat; background-image:none", "background:transparent none repeat-x"]) {
      assert.match(render(`<Section custom-css="${css}"><Text>Over.</Text></Section>`), onCard, css);
    }
    for (const css of ["background:#fef3c7 no-repeat", "background: url(https://acme.com/a.png) no-repeat center", "background: linear-gradient(#fff, #eee)", "background:rebeccapurple"]) {
      assert.match(render(`<Section custom-css="${css}"><Text>Over.</Text></Section>`), own, css);
    }
    // Zero alpha paints nothing either; any other alpha (or none) does.
    for (const bg of ["#ffffff00", "#fff0", "rgba(255, 255, 255, 0)", "rgba(255,255,255,0.0)", "rgb(255 255 255 / 0%)", "hsla(0, 0%, 100%, 0)"]) {
      assert.match(render(`<Section background-color="${bg}"><Text>Over.</Text></Section>`), onCard, bg);
      assert.match(render(`<Section custom-css="background-color: ${bg}"><Text>Over.</Text></Section>`), onCard, `customCss ${bg}`);
    }
    for (const bg of ["rgb(0, 0, 0)", "rgba(255, 255, 255, 0.5)", "#ffffff80"]) {
      assert.match(render(`<Section background-color="${bg}"><Text>Over.</Text></Section>`), own, bg);
    }
    // …and an inline run on a zero-alpha highlight is still on the card (#1056).
    const run = render(`<Section><Text>A <span style="background-color: rgba(255, 255, 255, 0)">clear</span> run and <a href="https://acme.com/z" style="background-color: #ffffff00">a link</a>.</Text></Section>`);
    assert.doesNotMatch(run, /<span style="color:/, "no light-mode colour forced on a clear run");
    assert.match(run, /<a href="https:\/\/acme\.com\/z" target="_blank" class="ee-dm-link"/, "a clear link is still swapped");
    assert.match(render(`<Section><Link href="https://acme.com/a">Read more</Link></Section>`), /<a href="https:\/\/acme\.com\/a" target="_blank" class="ee-dm-link"/);
    assert.doesNotMatch(render(`<Section><Link href="https://acme.com/a" color="#b91c1c">Read more</Link></Section>`), /ee-dm-link"[^>]*>Read more/);
    assert.doesNotMatch(render(`<Section background-color="#fef3c7"><Link href="https://acme.com/a">Read more</Link></Section>`), /class="ee-dm-link"/);
  });

  test("text on a section with its own background, and buttons, keep their colours", () => {
    const html = renderToHtml(doc(), {}, { showPoweredBy: false });
    assert.match(html, /<p style="[^"]*">Offer ends Friday\.<\/p>/, "no dark class on the amber band's copy");
    assert.doesNotMatch(html, /<a href="https:\/\/acme\.com\/start"[^>]*ee-dm/, "button untouched");
    assert.doesNotMatch(html, /<img[^>]*ee-dm/, "images untouched");
  });

  // Verifier on #1056: on by default it changed every existing template sent
  // through /v1, and copy given its own dark colour went unreadable on the
  // dark card. Without darkMode a template renders exactly as before 0.4.0.
  test("a theme without darkMode renders as before: no dark CSS or classes, color-scheme light dark", () => {
    const legacy = doc({ darkMode: undefined });
    assert.equal(legacy.theme.darkMode, undefined);
    const html = renderToHtml(legacy, {}, { showPoweredBy: false });
    assert.doesNotMatch(html, /prefers-color-scheme|ee-dm-|ee-bg|data-ogsc/);
    assert.match(html, /<meta name="color-scheme" content="light dark" \/>/);
    assert.match(html, /<meta name="supported-color-schemes" content="light dark" \/>/);
    assert.deepEqual(lintEmailDesign(doc({ darkMode: undefined, darkColors: { bodyColor: "#202020", textColor: "#303030" } })).filter((h) => h.rule === "dark-contrast"), []);
  });

  test("<Email dark-mode=\"auto\"> opts in, prints back, and a bad value is reported", () => {
    const { doc: parsed, warnings } = parseTsxDocument(`<Email dark-mode="auto"><Section><Text>Hi</Text></Section></Email>`);
    assert.deepEqual(warnings, []);
    assert.equal(parsed.theme.darkMode, "auto");
    assert.match(renderToHtml(parsed, {}, { showPoweredBy: false }), /prefers-color-scheme:dark/);
    assert.match(printTsx(parsed, { document: true }), /<Email [^>]*dark-mode="auto"/);
    assert.doesNotMatch(printTsx(EmailDocumentSchema.parse(parseTsx(`<Section><Text>Hi</Text></Section>`)), { document: true }), /dark-mode=/, "unset stays unset");
    const bad = parseTsxDocument(`<Email dark-mode="always"><Section><Text>Hi</Text></Section></Email>`);
    assert.equal(bad.doc.theme.darkMode, undefined);
    assert.match(bad.warnings.join(" "), /dark-mode/);
  });

  // Verifier on #1056: a leaf with its own background is its own surface too.
  test("a Text, Heading or Markdown block with its own background keeps its copy's colours", () => {
    const render = (tsx: string) =>
      renderToHtml(EmailDocumentSchema.parse({ ...parseTsx(tsx), category: "transactional", previewText: "x", theme: optedIn }), {}, { showPoweredBy: false });
    // Class attributes only: the head's dark <style> names the classes too.
    const tagged = /class="[^"]*ee-dm-(?:text|link)/;
    assert.doesNotMatch(render(`<Section><Text custom-css="background-color:#ffffff">On white, <a href="https://acme.com">a link</a>.</Text></Section>`), tagged);
    assert.doesNotMatch(render(`<Section><Heading level={2} className="bg-white">On white</Heading></Section>`), /<h2 class="[^"]*ee-dm-text/);
    assert.doesNotMatch(render(`<Section><Markdown custom-css="background:#fef3c7">On amber, [a link](https://acme.com).</Markdown></Section>`), tagged);
    assert.match(render(`<Section><Text>On the card.</Text></Section>`), /<p class="ee-dm-text"/, "a plain block is still tagged");
  });

  // Verifier on #1056: a highlighted run (its own background) inherited the
  // dark palette's light text; and <Email> dropped a custom dark palette.
  test("a highlight keeps readable text; a highlighted link isn't swapped", () => {
    const html = renderToHtml(
      EmailDocumentSchema.parse({
        ...parseTsx(`<Section><Text>Plain <span style="background-color: #ffffff">highlight</span> and <a href="https://acme.com/h" style="background-color: #fef08a">a marked link</a>.</Text></Section>`),
        category: "transactional",
        previewText: "x",
        theme: optedIn,
      }),
      {},
      { showPoweredBy: false },
    );
    assert.match(html, /<span style="color:#1a1a1a;background-color:#ffffff;?">highlight<\/span>/, "its own text colour, on its own background");
    // A transparent background paints nothing: the run stays on the card (#1056).
    const clear = renderToHtml(
      EmailDocumentSchema.parse({ ...parseTsx(`<Section><Text>A <span style="background-color: transparent">clear</span> run and <a href="https://acme.com/c" style="background-color: transparent">a link</a>.</Text></Section>`), category: "transactional", previewText: "x", theme: optedIn }),
      {},
      { showPoweredBy: false },
    );
    assert.match(clear, /<span style="background-color:transparent;?">clear<\/span>/, "no light-mode colour forced");
    assert.match(clear, /<a href="https:\/\/acme\.com\/c" target="_blank" class="ee-dm-link"/, "a clear link is still swapped");
    assert.match(html, /<a href="https:\/\/acme\.com\/h" target="_blank" style="[^"]*background-color:#fef08a/);
    assert.doesNotMatch(html, /<a href="https:\/\/acme\.com\/h" target="_blank" class=/, "no dark-link class on a highlighted link");
    // Without dark mode the output is unchanged: no colour added to the highlight.
    const legacy = renderToHtml(
      EmailDocumentSchema.parse({ ...parseTsx(`<Section><Text>Plain <span style="background-color: #ffffff">highlight</span>.</Text></Section>`), category: "transactional", previewText: "x" }),
      {},
      { showPoweredBy: false },
    );
    assert.match(legacy, /<span style="background-color:#ffffff;?">highlight<\/span>/);
    // Verifier on #1056: a parent in its own colour isn't swapped, so its
    // highlight inherits that colour as before, in both modes.
    const own = (tsx: string) =>
      renderToHtml(EmailDocumentSchema.parse({ ...parseTsx(tsx), category: "transactional", previewText: "x", theme: optedIn }), {}, { showPoweredBy: false });
    assert.match(
      own(`<Section background-color="#111111"><Text color="#ffffff">White <span style="background-color: #000000">on black</span>.</Text></Section>`),
      /<span style="background-color:#000000;?">on black<\/span>/,
    );
    assert.match(own(`<Section><Text color="#ffffff">White <span style="background-color: #000000">on black</span>.</Text></Section>`), /<span style="background-color:#000000;?">on black<\/span>/);
    assert.doesNotMatch(own(`<Section><Markdown color="#7c2d12">Use \`code\` here.</Markdown></Section>`), /<code[^>]*color:#1a1a1a/);
    assert.match(own(`<Section><Markdown>Use \`code\` here.</Markdown></Section>`), /<code[^>]*color:#1a1a1a/, "a theme-coloured parent's chip still keeps light-mode text");
  });

  // Verifier on #1056: the sanitizer dropped the slash of modern colour
  // syntax, so rgb(28 28 31 / 100%) became an invalid declaration.
  test("slash-alpha palette colours survive into the dark CSS", () => {
    const css = darkModeCss({ ...optedIn, darkColors: { bodyColor: "rgb(28 28 31 / 100%)", textColor: "hsl(240 5% 93% / 1)" } } as Theme);
    assert.match(css, /\.ee-body\{background-color:rgb\(28 28 31 \/ 100%\) !important;\}/);
    assert.match(css, /\.ee-dm-text\{color:hsl\(240 5% 93% \/ 1\) !important;\}/);
    // Still nothing that ends the block or opens a comment.
    const hostile = darkModeCss({ ...optedIn, darkColors: { bodyColor: "red}</style><script>/*x*/" } } as Theme);
    assert.doesNotMatch(hostile, /[<*]/);
    assert.match(hostile, /\.ee-body\{background-color:red\/stylescript\/x\/ !important;\}/, "the value can't close its rule");
  });

  test("<Email dark-colors> sets the dark palette from TSX and JSX, and prints back", () => {
    const { doc: parsed, warnings } = parseTsxDocument(`<Email dark-mode="auto" dark-colors={{ bodyColor: "#000000", textColor: "#ffffff" }}><Section><Text>Hi</Text></Section></Email>`);
    assert.deepEqual(warnings, []);
    assert.deepEqual(parsed.theme.darkColors, { bodyColor: "#000000", textColor: "#ffffff" });
    assert.match(darkModeCss(parsed.theme), /\.ee-body\{background-color:#000000 !important;\}/);
    const printed = printTsx(parsed, { document: true });
    assert.match(printed, /dark-colors=\{\{ bodyColor: "#000000", textColor: "#ffffff" \}\}/);
    assert.deepEqual(parseTsxDocument(printed).doc.theme.darkColors, parsed.theme.darkColors, "round trip");
    // fromJsx hands <Email>'s camelCase props to the same function.
    const jsx = applyDocumentAttrs(EmailDocumentSchema.parse({}), { darkMode: "auto", darkColors: { linkColor: "#93c5fd" } });
    assert.deepEqual(jsx.doc.theme.darkColors, { linkColor: "#93c5fd" });
    // Colours are free-form strings; a non-string is reported, not kept.
    const bad = applyDocumentAttrs(EmailDocumentSchema.parse({}), { darkColors: { bodyColor: 42 } });
    assert.match(bad.warnings.join(" "), /dark-colors/);
    assert.equal(bad.doc.theme.darkColors, undefined);
  });

  test("darkMode \"off\": no dark CSS, no classes, light-only declaration", () => {
    const html = renderToHtml(doc({ darkMode: "off" }), {}, { showPoweredBy: false });
    assert.doesNotMatch(html, /prefers-color-scheme|ee-dm-|ee-bg/);
    assert.match(html, /<meta name="color-scheme" content="light" \/>/);
    assert.match(html, /<meta name="supported-color-schemes" content="light" \/>/);
  });

  test("the editor canvas renders without dark CSS or Outlook conditionals", () => {
    const html = renderToHtml(doc(), {}, { editor: true, showPoweredBy: false });
    assert.doesNotMatch(html, /prefers-color-scheme|ee-dm-|\[if mso\]/);
  });

  test("custom dark colours win; derived links stay AA on the card", () => {
    const p = darkPalette({ linkColor: "#2563eb" });
    assert.ok((contrastRatio(p.linkColor, p.bodyColor) ?? 0) >= 4.5, p.linkColor);
    const css = darkModeCss({ ...doc().theme, darkColors: { bodyColor: "#000000", textColor: "#ffffff" } });
    assert.match(css, /\.ee-body\{background-color:#000000 !important;\}/);
    assert.match(css, /\.ee-dm-text\{color:#ffffff !important;\}/);
  });
});

describe("Outlook (mso) conditionals", () => {
  test("96 DPI settings, table spacing, line-height rule, and a ghost table at the content width", () => {
    const html = renderToHtml(doc(), {}, { showPoweredBy: false });
    assert.match(html, /xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"/);
    assert.match(html, /<!--\[if mso\]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG\/><o:PixelsPerInch>96<\/o:PixelsPerInch>/);
    assert.match(html, /mso-table-lspace:0pt;mso-table-rspace:0pt;[^<]*mso-line-height-rule:exactly/);
    assert.match(html, /<!--\[if mso\]><table role="presentation" align="center" width="600"/);
    assert.match(html, /<!--\[if mso\]><\/td><\/tr><\/table><!\[endif\]-->/);
  });
});

describe("design lint: dark-contrast", () => {
  test("the default palette reads; an unreadable custom one is flagged; opting out silences it", () => {
    const rule = (theme: Partial<Theme>) => lintEmailDesign(doc(theme)).filter((h) => h.rule === "dark-contrast");
    assert.deepEqual(rule({}), []);
    const bad = rule({ darkColors: { bodyColor: "#202020", textColor: "#303030" } });
    assert.equal(bad.length, 1);
    assert.equal(bad[0]!.severity, "fix");
    assert.match(bad[0]!.message, /In dark mode the text \(#303030\) is hard to read/);
    assert.deepEqual(rule({ darkMode: "off", darkColors: { bodyColor: "#202020", textColor: "#303030" } }), []);
    assert.ok((darkContrast({ linkColor: "#2563eb" }).text ?? 0) >= 4.5);
  });

  test("a conditional background is flagged for a look; an unconditional one isn't", () => {
    const hints = (className: string, darkMode: "auto" | "off" = "auto") =>
      lintEmailDesign(
        EmailDocumentSchema.parse({
          ...parseTsx(`<Section className="${className}"><Text>Hi</Text></Section>`),
          category: "transactional",
          previewText: "Hi",
          theme: { ...EmailDocumentSchema.parse({}).theme, darkMode },
        }),
      ).filter((h) => h.rule === "dark-contrast");
    for (const cls of ["sm:bg-white", "hover:bg-[#ffffff]", "p-4 md:hover:bg-gray-100"]) {
      const h = hints(cls);
      assert.equal(h.length, 1, cls);
      assert.equal(h[0]!.severity, "check");
      assert.match(h[0]!.message, /only at some widths or states/);
      assert.ok(h[0]!.blockId);
    }
    assert.deepEqual(hints("bg-white"), []);
    assert.deepEqual(hints("sm:bg-transparent"), []);
    assert.deepEqual(hints("sm:bg-white", "off"), []);
  });
});

describe("dark mode — ink icons on the card", () => {
  const icon = (v: string) => `https://www.unitpost.com/email-assets/icons/rocket-${v}.png`;
  const iconDoc = (tsx: string, darkMode: "auto" | "off" = "auto") =>
    EmailDocumentSchema.parse({ ...parseTsx(tsx), theme: { ...EmailDocumentSchema.parse({}).theme, darkMode } });

  test("an ink icon on the card ships its white copy, hidden, for dark mode to swap in", () => {
    const html = renderToHtml(iconDoc(`<Section padding-x={32}><Image src="${icon("ink")}" alt="" width={24} /><Text>Launch</Text></Section>`));
    assert.match(html, /<span class="ee-dm-hide"><span [^>]*><img src="[^"]*rocket-ink\.png"/);
    assert.match(html, /<!--\[if !mso\]><!--><span class="ee-dm-show" style="display:none;"><span [^>]*><img src="[^"]*rocket-white\.png"[^>]*\/><\/span><\/span><!--<!\[endif\]-->/);
  });

  test("no copy without dark mode, on a band with its own background, or for other looks", () => {
    assert.doesNotMatch(renderToHtml(iconDoc(`<Image src="${icon("ink")}" alt="" width={24} />`, "off")), /rocket-white/);
    assert.doesNotMatch(renderToHtml(iconDoc(`<Section background-color="#fef3c7"><Image src="${icon("ink")}" alt="" width={24} /></Section>`)), /rocket-white/);
    assert.doesNotMatch(renderToHtml(iconDoc(`<Image src="${icon("soft")}" alt="" width={40} />`)), /class="ee-dm-show"/);
    assert.doesNotMatch(renderToHtml(iconDoc(`<Image src="https://acme.com/logo-ink.png" alt="Acme" width={120} />`)), /class="ee-dm-show"/);
  });

  test("a dark-mode card set to a light colour keeps the ink icon (verifier on #1090)", () => {
    const light = EmailDocumentSchema.parse({
      ...parseTsx(`<Image src="${icon("ink")}" alt="" width={24} />`),
      theme: { ...EmailDocumentSchema.parse({}).theme, darkMode: "auto", darkColors: { bodyColor: "#f4f4f5", textColor: "#18181b" } },
    });
    assert.doesNotMatch(renderToHtml(light), /rocket-white/);
  });
});
