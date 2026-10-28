# Changelog

Notable changes to `@unitpost/email`. A change to the HTML a published document renders to is a breaking change.

## Unreleased

### Fixed

- **Line breaks in TSX.** `parseTsx` read a `<br>` inside `<Text>`, `<Heading>` or a list item as nothing (`<Text>a<br />b</Text>` became "ab"), and `printTsx` printed a stored line break as a newline that read back as a space. A `<br>` (any spelling) is now the document's soft line break ("\n", the editor's Shift+Enter), and `printTsx` prints one as `<br />`, so print → parse keeps it; whitespace around a `<br>` is the markup's formatting. `htmlToBlocks` keeps a paragraph's `<br>` as a line break too (it was a space). Rendering is unchanged: the renderer already draws a stored line break as `<br />`, so no saved document renders differently; only TSX that contains `<br>` parses to what it says.

### Added

- **`printSimpleText(doc)`** prints a Simple document in the `text` format `parseSimpleText` reads: lines with their bold, italic, underline, strike, links, colour, highlight, size and font, centred or right-aligned lines, lists and images. Text that would read as markup, an entity or a list item is escaped so it reads back as written. **`simpleDocumentText(doc)`** returns that text only when parsing it again renders the same email, and null otherwise (an indented line, or a block a Simple email has no line for), so a caller never edits a lossy copy. Nothing that exists changes.

## 0.4.0

Publishes when this version reaches `main` (`publish-email.yml`). This release adds a Design-mode document element, editor conversion and a body border. Every existing call (`parseTsx`, `printTsx`, `renderToHtml`, `getComponentDoc`) behaves as before; the rendering changes are the fixes below (`<title>` text, library images in HTML blocks, character references in TSX, rows narrower than their columns' total) and the opt-in dark-mode swap for `ink` icons.

### Added

- **`<Email>` document element** (`Email` in React): one outermost element sets the theme, preview text and category, so a single TSX string is a complete, styled email. `parseTsxDocument` returns the document plus `warnings`; `printTsx(doc, { document: true })` prints it back. A `<Email>` anywhere other than outermost parses as before.
- **Editors:** `templateEditor`, `convertTemplateDocument` and `TEMPLATE_EDITORS` move a template between Simple, Design and Code, listing what a switch can't carry. `htmlToBlocks` turns HTML into Design blocks where it can.
- **`theme.bodyBorder`**: a stroke around the body card that follows `bodyRadius`.
- Docs helpers: `EMAIL_ELEMENT_DOC`, `getDocumentedComponent`, `DOCUMENTED_COMPONENTS`, `EMAIL_ELEMENT_ATTRIBUTES`, `applyDocumentAttrs`.
- **Email design guide** (`EMAIL_DESIGN.md`, generated from `design-guide.ts`): `EMAIL_DESIGN_RULES`, `EMAIL_RECIPES` (welcome, receipt, sign-in code, password reset, product launch, newsletter, promo, re-engagement, event invite), `recipeStarter(type, { accent, logo, name, website, font })` for a complete, brand-themed starter email, `matchEmailRecipe`, `emailFontStack`, `emailDesignPromptSection`.
- **Themed bands**: `brandPalette(accent)` derives every colour from one brand accent with WCAG AA text contrast; 18 new layouts built on it (brand / wordmark headers; headline, contrast, gradient, status and media heroes; feature section, icon rows, stats, order summary, code card, callout, offer card, event details, product grid; contrast CTA; sign-off). `buildThemedLayout(key, palette)` rebuilds one in a brand's colours; the builders are under `emailBands`.
- **Hosted email assets**: `EMAIL_ICONS` (184 Lucide icons as PNG in four looks), `EMAIL_PLACEHOLDERS`, `emailIconUrl`, `emailPlaceholderUrl`, `parseEmailIconUrl`, `darkModeIconTwin`. In an opted-in dark-mode email whose dark card is dark, an `ink` icon on the body card carries its `white` copy, hidden, and the dark CSS swaps them (`.ee-dm-hide` / `.ee-dm-show`; the copy is hidden from Outlook for Windows). A `darkColors.bodyColor` set to a light colour keeps the ink icon.
- **Dark mode, opt-in** (`theme.darkMode: "auto"` or `<Email dark-mode="auto">`, plus `theme.darkColors` / `<Email dark-colors={{ … }}>`): an opted-in Design email carries `prefers-color-scheme: dark` CSS (plus Outlook.com's `[data-ogsc]` / `[data-ogsb]` hooks) that swaps the backdrop, the body card, text in the theme's text colour and links in the theme's link colour to a dark palette (Text, Heading, list, Markdown and Link blocks alike). Copy on a section, row, column or block with its own background (backgroundColor, a `bg-` class or a customCss background; the layer that ends up painting, in render order, so a later transparent one shows the card), highlighted inline text and links, buttons, images and anything given its own colour keep their colours. Unset dark colours are derived (near-black backdrop and card, light text, the link colour lifted to AA on the card). `darkMode: "off"` declares the email light-only (`color-scheme: light`). **A theme without `darkMode` renders exactly as before** (no dark CSS or classes, `color-scheme: light dark`): turning it on for every existing template would have changed emails sent through `/v1` unasked, and copy given its own dark colour would have gone unreadable on the dark card. Helpers: `darkPalette`, `darkModeCss`, `darkContrast`, `darkModeEnabled`. The editor canvas (`editor: true`) renders without them.
- **Outlook (mso) conditionals** on every sent Design email: the VML/Office namespaces on `<html>`, `OfficeDocumentSettings` at 96 DPI, `mso-table-lspace/rspace: 0` and `mso-line-height-rule: exactly`, and a fixed-width "ghost" table that holds the card at `theme.contentWidth` in Outlook for Windows (which ignores `max-width`). Buttons keep the padded-table markup, which already renders in Outlook, so no VML button. Not added in the editor canvas.
- **`lintEmailDesign(doc)`**: design hints for a Design email (contrast, alt text, placeholder links / copy / images, heading structure, a marketing email with no action, Markdown, a hand-written footer, gradient without a fallback colour, tiny text, and `dark-contrast`: dark-mode text or links that don't read on the dark card, and, as a `check`, a background behind a variant such as `sm:bg-white` or `hover:bg-…`, whose block keeps its light-mode text where the background doesn't apply; `button-style`: a button in another shape than the email's other buttons, or, as a `check`, another fill; `icon-contrast`: an `ink` icon on a dark background or a `white` one on a light background). Colour helpers: `contrastRatio`, `readableTextOn`, `shadeToContrast`, `mix`, `parseColor`.

### Changed

- Layouts: the image bands (`hero-image`, `content-article`, `columns-split`) use neutral placeholders instead of hot-linked stock photos; sample alt text and copy no longer name real companies; `footer-social` text is AA-readable. Saved documents are unaffected.

### Fixed

- `sanitizeEmailHtml` drops a `<title>`'s text. Before, a whole email's `<head><title>…</title>` left that text visible at the top of the body. Only HTML that contains a `<title>` renders differently.
- A library image inside an HTML block (`<img src="/img/{id}">`) resolves against `assetBaseUrl`, the same as an `Image` block's. Before, it stayed relative and broke in the inbox. That's what a Design template converted to Code produces. Only HTML with a relative library image path renders differently, and only when an `assetBaseUrl` is set. `resolveHtmlImageSrcs(html, assetBaseUrl)` does the same for any HTML string.
- The TSX dialect decodes character references in text and string attributes, as JSX does: `<Button>Book a call &rarr;</Button>` is an arrow (it was the literal `&rarr;`), `href="…?a=1&amp;b=2"` is `?a=1&b=2`. Numeric references and the names email copy uses (punctuation, arrows, currency, accented letters) decode; an unknown name stays as written, and `&amp;rarr;` is the text `&rarr;`. `htmlToBlocks` decodes once too: `&#38;rarr;` in imported HTML is the text `&rarr;`, not an arrow. `printTsx` escapes text that looks like a reference, and `"`, `<` and `>` where they'd break the markup, so a print → parse round-trip keeps it.
- `printTsx` prints the per-side `margin` / `padding` boxes and `componentRef` as object literals (`padding={{ top: 40, left: 32 }}`), which `parseTsx` already read. Before, they were left out, so a design printed and parsed back (the Code tab, an agent editing from TSX) lost its inspector spacing and component links.
- `safeUrl` / `safeImageUrl` read the scheme the way a browser does: tabs and newlines anywhere, and C0 controls or spaces at the ends, are removed before the check (and from the URL returned), so `java\tscript:alert(1)` becomes `#`. Before, a URL with a tab inside its scheme passed as relative.
- A `<Row>` whose columns add up to less than 100% leaves the rest empty (`rowEmptyShare`): a single column at 50% is half the row wide. Before, table layout stretched the columns to fill the row. A remainder under 5% (or the column count) is rounding and changes nothing, so only rows that set narrower columns render differently.
- `printTsx(doc, { document: true })` escapes `<` and `>` in `<Email>` attributes, so a preview text like `Save > spend` parses back unchanged instead of spilling into the body.
- `htmlToBlocks` keeps an element whose images share it with copy or with other images (a logo beside a line of text, a row of badges) as HTML. Before, a paragraph like that became a single `Text` or `Image` block, and the image or the other images were dropped without a warning. A single image on its own still becomes an `Image`.

## 0.3.0

Not on npm yet: publishes when this version reaches `main` (`publish-email.yml`). 0.2.0 shipped the React entry; this release is the Simple-mode validator, the wider `text` format and a security fix.

### Added

- **Simple-mode validator** — `normalizeSimpleDocument(doc)` reduces a Simple document to what a Simple email can carry (lines, blank lines, bold/italic/underline/strike, colour, highlight, 13/18/24px sizes, font-menu fonts, links, lists, images, `{{variables}}`) and lists what it flattened or removed; `isNormalizedSimpleDocument`, `expandSimpleBlocks`, `snapSimpleTextSize`, `simpleFontStack`, `isSimpleColor`, `templateKind`, `SIMPLE_TEXT_SIZES`.
- **`parseSimpleText(text)`** returns the Simple document plus `warnings`; the `text` format now also takes `<s>`, `<br>`, `<span style="color / background-color / font-size / font-family">`, `<div style="text-align:center|right">` around a line, and an `<img>` alone on a line. `SIMPLE_TEXT_GUIDE` states the whole format.
- `cssValue(value)` — one CSS value made safe for a `style="…"` attribute.
- `renderToText` option `links`: `false` prints link labels without URLs; `"action"` does the same but prints a button as one `Label: url` line. Default `true` (unchanged).
- `renderToHtml` option `buttonLinkFallback`: a small grey "Button not working? Copy this link into your browser:" line with the link under each button. Off by default.

### Changed (breaking: rendered HTML differs for the documents below)

- Simple emails: a document holding blocks the Simple fragment can't draw (a section, row, button, spacer, Markdown / code / HTML block) renders their lines instead of dropping them — such a document used to send an empty body.
- `textToSimpleDocument`: unsupported HTML tags and TSX components used as markup — paired (`<p>…</p>`, an opening tag with its closing tag later), self-closing or void — are removed (their text kept) instead of staying as literal text; a lone mention ("the `<p>` tag") stays as written; attribute values are entity-decoded once (`?a=1&amp;b=2`); lists carry no margin.
- `simplifyEmailDocument` ends with `normalizeSimpleDocument`: headings become bold Large/Huge lines.
- `resolveVariablesWithContact`: an undeclared built-in contact field (`{{first_name}}`, `{{last_name}}`, `{{email}}`, …) resolves from the contact; `documentHasPerRecipientVariables` counts it.

### Fixed

- **Style attribute injection**: run colour / highlight / font, block `customCss` and theme colour / font values were interpolated raw into `style="…"`, so a value like `red" onmouseover="…` added an attribute. Every value now passes `cssValue` (`customCss`: the same characters minus `;`).

## 0.2.0 — 2026-10-12

### Added

- **`@unitpost/email/react`** — write emails as React components (`Section`, `Heading`, `Text`, `List`, `Button`, …) and call `render(<Email />)` for the HTML string. It lowers to the same `EmailDocument` as `parseTsx` and the visual editor. `react` is an optional peer; the core package stays React-free.
  - `<a href>`, `<strong>`/`<b>`, `<em>`/`<i>`, `<u>`, `<s>` and `<span style>` (a React style object or a CSS string) inside `<Text>`, `<Heading>` and `<li>` become formatted runs, the same as in `parseTsx`.
  - Multi-line `<Markdown>`, `<Code>` and `<Html>` keep their newlines and are dedented like `parseTsx`. Pass multi-line content as a template literal: ``<Markdown>{`…`}</Markdown>``.
  - Props with a schema default are optional in TypeScript (`<Text>Hi</Text>` needs no `fontSize`, `align` or `marginBottom`); values are still checked (`level={7}` is an error). `borderWidth`, `borderStyle`, `borderColor` and `borderRadius` are declared on `Section`, `Row`, `Column` and `Image`.
- `hasPoweredByText(text)` — whether a text part already carries the mark (new line or the previous URL), used by `appendPoweredByText` for idempotency.

### Changed (breaking: rendered HTML and text differ)

- **The branding mark reads "Sent with Unitpost"**, not "Powered by Unitpost", in the designed shell, Simple emails and `appendPoweredBy`. Same look, link and `utm_medium=powered_by` sentinel.
- **Text parts end in one line, `Sent with Unitpost`** (words only, no URL), instead of "Powered by Unitpost" plus the full tracked URL (`POWERED_BY_TEXT`, `renderToText`, `appendPoweredByText`). `htmlToPlainText` turns the HTML mark into the same line.

### Fixed

- Simple emails: the "Unitpost" link in "Sent with Unitpost" was white (`#ffffff`) and invisible on white reading panes. It now uses the footer grey.
- `appendPoweredByText` skipped the mark when the body merely mentioned "Sent with Unitpost" anywhere; only a text part whose last line ends with the mark (or the previous URL line) counts as branded now.
- Marketing footer: the company line `{{company_name}} · {{company_address}}` no longer ends (or starts) with a dangling `·` when only one of the two is set.

## 0.1.5 — 2026-08-19

### Fixed

- **Broken package entry points (again).** `0.1.4` published with `main`/`exports` still pointing at `./src/index.ts`, which is not in the tarball — the same bug as `0.1.0`. This release points at `dist/`. `0.1.4` is unimportable; use `0.1.5`.

### Changed

- Public source lives at [`github.com/unitpostcom/email`](https://github.com/unitpostcom/email). The npm `repository` / `bugs` fields now point there.
- README rewritten for GitHub and npm (same file): install first, playground / gallery / components links, rendered example screenshots.

## 0.1.4 — 2026-07-17

### Changed

- **Pre-built footer bands no longer hard-code compliance content.** `footer-simple`, `footer-rich`, and `footer-social` previously baked in a "You're receiving this because…" line and a placeholder postal address. Those are dropped; the bands now carry only chrome (logo, nav/help links, a "just reply" line). If you relied on the band supplying unsubscribe/address text, add your own.

## 0.1.3 — 2026-07-14

No library-facing changes.

## 0.1.2 — 2026-07-12

### Fixed

- **TSX round-trip corrupted Markdown/Code content.** `printTsx` pretty-prints paired-tag content with per-line indentation, but `parseTsx` only trimmed the ends — so indentation leaked into stored `markdown`/`code` and accumulated on every print→parse cycle. The parser now dedents that content.

### Added

- `createBlock(type, overrides?)` — a second argument merging caller props over the defaults before schema validation.

## 0.1.1 — 2026-07-12

### Fixed

- **Broken package entry points.** `0.1.0` published with `main`/`exports` pointing at `./src/index.ts`, which is not in the tarball. `0.1.1` points at `dist/`. `0.1.0` is deprecated on npm.

## 0.1.0 — 2026-07-10

First public release.

### Added

- **Document model** — `EmailDocument`: `Section` / `Row` / `Column` plus `Heading`, `Text`, `Button`, `Link`, `Image`, `Divider`, `Spacer`, `Markdown`, `Code`, and sanitized raw-`Html` blocks.
- **Renderer** — `renderToHtml`: table-based, inline-styled HTML for Outlook, Gmail, and Apple Mail.
- **Constrained-TSX codec** — `parseTsx` / `printTsx`.
- **Variables** — `{{variable}}` interpolation with `resolveVariables`.
- **Component catalog** — `COMPONENT_CATALOG`.
- **Pre-built layouts** — `SECTION_LAYOUTS`.
- **Samples** — `SAMPLE_TEMPLATES`.
- **Sanitizer** — `sanitizeEmailHtml`.
