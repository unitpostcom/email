# Changelog

Notable changes to `@unitpost/email`. A change to the HTML a published document renders to is a breaking change.

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
