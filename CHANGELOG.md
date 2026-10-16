# Changelog

Notable changes to `@unitpost/email`. A change to the HTML a published document renders to is a breaking change.

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
