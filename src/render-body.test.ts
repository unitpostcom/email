import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDocument, normalizeMarketingFooterFragment, MARKETING_FOOTER_BAND_PADDING_Y, type ComponentFragment } from "./schema";
import { renderToHtml } from "./render";

// A minimal marketing document with a single text block. The renderer appends
// the managed compliance footer for marketing docs.
function marketingDoc(bodyRadius?: number) {
  return parseDocument({
    version: 1,
    category: "marketing",
    from: "hi@acme.test",
    previewText: "",
    theme: bodyRadius != null ? { bodyRadius } : {},
    variables: [],
    blocks: [{ type: "text", id: "t1", text: "Hello" }],
  });
}

const footer: ComponentFragment = {
  blocks: [
    {
      type: "section",
      id: "footer-band",
      backgroundColor: "#000000",
      paddingX: 0,
      paddingY: 20,
      children: [
        {
          type: "link",
          id: "f-unsub",
          align: "center",
          fontSize: 12,
          text: "Unsubscribe",
          href: "{{unsubscribe_url}}",
        },
      ],
    },
  ],
} as unknown as ComponentFragment;

// --- Body corner radius ----------------------------------------------------

test("bodyRadius emits border-radius + overflow:hidden on the container", () => {
  const html = renderToHtml(marketingDoc(16), { unsubscribe_url: "https://x" }, {});
  assert.match(html, /border-radius:16px/);
  // overflow:hidden clips the footer band to the rounded bottom corners.
  assert.match(html, /overflow:hidden/);
});

test("bodyRadius of 0 (default) emits no container border-radius", () => {
  const html = renderToHtml(marketingDoc(), { unsubscribe_url: "https://x" }, {});
  // The container carries no radius; buttons/images may still round, so scope
  // the assertion to the ee-body container style.
  const containerTag = /class="ee-body[^"]*" style="([^"]*)"/.exec(html);
  assert.ok(containerTag, "expected an ee-body container tag");
  assert.doesNotMatch(containerTag![1], /border-radius/);
  assert.doesNotMatch(containerTag![1], /overflow:hidden/);
});

// --- Marketing footer is a full-width row attached at the bottom -----------

test("marketing footer renders as a SEPARATE full-width row with no padding", () => {
  const html = renderToHtml(
    marketingDoc(),
    { unsubscribe_url: "https://x", company_name: "Acme", company_address: "1 St" },
    { marketingFooter: footer },
  );
  // The footer sits in its own <td style="padding:0;"> row so it spans the full
  // body width regardless of the body's own padding.
  assert.match(html, /<tr><td style="padding:0;">/);
  // And the footer band's background is present (full-width black band).
  assert.match(html, /background-color:#000000/);
});

test("body padding lives on the body row td, not the container table", () => {
  const html = renderToHtml(
    parseDocument({
      version: 1,
      category: "marketing",
      from: "hi@acme.test",
      previewText: "",
      theme: { bodyPadding: 32 },
      variables: [],
      blocks: [{ type: "text", id: "t1", text: "Hello" }],
    }),
    { unsubscribe_url: "https://x" },
    { marketingFooter: footer },
  );
  // The body content row carries the 32px padding.
  assert.match(html, /<tr><td style="padding:32px">/);
});

test("normalizeMarketingFooterFragment strips a legacy leading spacer+divider rule", () => {
  // A STALE stored footer: the old layout baked a leading spacer + divider
  // (the ugly light hairline above the fine print) inside the footer section.
  const stale = {
    blocks: [
      {
        type: "section",
        id: "footer-band",
        backgroundColor: "#000000",
        paddingX: 0,
        paddingY: 0,
        children: [
          { type: "spacer", id: "s", height: 16 },
          { type: "divider", id: "d", color: "#e4e4e7" },
          {
            type: "link",
            id: "unsub",
            align: "center",
            fontSize: 12,
            text: "Unsubscribe",
            href: "{{unsubscribe_url}}",
          },
        ],
      },
    ],
  } as unknown as ComponentFragment;

  const clean = normalizeMarketingFooterFragment(stale);
  const section = clean.blocks[0];
  assert.equal(section.type, "section");
  // The leading spacer + divider are gone; the fine print survives.
  assert.equal(section.type === "section" ? section.children.length : -1, 1);
  const first = section.type === "section" ? section.children[0] : undefined;
  assert.equal(first?.type, "link");

  // And the rendered send no longer contains the #e4e4e7 hairline.
  const doc = marketingDoc();
  const dirtyHtml = renderToHtml(doc, { unsubscribe_url: "https://x" }, { marketingFooter: stale });
  assert.match(dirtyHtml, /border-top:1px solid #e4e4e7/);
  const cleanHtml = renderToHtml(doc, { unsubscribe_url: "https://x" }, { marketingFooter: clean });
  assert.doesNotMatch(cleanHtml, /border-top:1px solid #e4e4e7/);
});

test("normalizeMarketingFooterFragment keeps dividers BETWEEN real footer text", () => {
  // A divider that separates two fine-print lines is intentional content, not
  // the legacy leading rule — it must survive normalization.
  const frag = {
    blocks: [
      {
        type: "section",
        id: "fb",
        backgroundColor: "#000000",
        paddingX: 0,
        paddingY: 20,
        children: [
          { type: "text", id: "a", text: "Line one" },
          { type: "divider", id: "mid", color: "#e4e4e7" },
          { type: "link", id: "u", text: "Unsubscribe", href: "{{unsubscribe_url}}" },
        ],
      },
    ],
  } as unknown as ComponentFragment;

  const out = normalizeMarketingFooterFragment(frag);
  const children = out.blocks[0].type === "section" ? out.blocks[0].children : [];
  assert.equal(children.length, 3);
  assert.equal(children[1]?.type, "divider");
});

test("normalizeMarketingFooterFragment heals a padding-less band to the canonical paddingY", () => {
  // A STALE stored footer: the band predates carrying vertical padding, so it
  // shipped `padding:0px 0px` (no top/bottom breathing room around the fine
  // print). Normalization must repair the band's paddingY up to the canonical
  // value so the sent <td> has real vertical padding.
  const stale = {
    blocks: [
      {
        type: "section",
        id: "footer-band",
        backgroundColor: "#000000",
        paddingX: 0,
        paddingY: 0,
        children: [
          {
            type: "link",
            id: "unsub",
            align: "center",
            fontSize: 12,
            text: "Unsubscribe",
            href: "{{unsubscribe_url}}",
          },
        ],
      },
    ],
  } as unknown as ComponentFragment;

  const healed = normalizeMarketingFooterFragment(stale);
  const band = healed.blocks[0];
  assert.equal(band.type, "section");
  assert.equal(
    band.type === "section" ? band.paddingY : -1,
    MARKETING_FOOTER_BAND_PADDING_Y,
  );

  // And the rendered send emits the repaired vertical padding on the band <td>.
  const doc = marketingDoc();
  const staleHtml = renderToHtml(doc, { unsubscribe_url: "https://x" }, { marketingFooter: stale });
  assert.match(staleHtml, /padding:0px 0px/);
  const healedHtml = renderToHtml(doc, { unsubscribe_url: "https://x" }, { marketingFooter: healed });
  assert.match(
    healedHtml,
    new RegExp(`padding:${MARKETING_FOOTER_BAND_PADDING_Y}px 0px`),
  );
  assert.doesNotMatch(healedHtml, /padding:0px 0px/);
});

test("normalizeMarketingFooterFragment leaves an explicit per-side band padding untouched", () => {
  // If the band carries an intentional per-side `padding`, resolvePadding uses
  // it — so the normalizer must NOT clobber it with the canonical paddingY.
  const frag = {
    blocks: [
      {
        type: "section",
        id: "footer-band",
        backgroundColor: "#000000",
        paddingX: 0,
        paddingY: 0,
        padding: { top: 8, bottom: 8 },
        children: [
          {
            type: "link",
            id: "unsub",
            align: "center",
            fontSize: 12,
            text: "Unsubscribe",
            href: "{{unsubscribe_url}}",
          },
        ],
      },
    ],
  } as unknown as ComponentFragment;

  const out = normalizeMarketingFooterFragment(frag);
  const band = out.blocks[0];
  // paddingY stays 0 (per-side padding wins in the renderer).
  assert.equal(band.type === "section" ? band.paddingY : -1, 0);
});

test("container table collapses borders so body→footer has no seam hairline", () => {
  // Gmail (esp. light mode) paints a 1px light line where the white body <td>
  // meets the dark footer <td> unless the table collapses its cell borders.
  const html = renderToHtml(
    marketingDoc(),
    { unsubscribe_url: "https://x" },
    { marketingFooter: footer },
  );
  const containerTag = /class="ee-body[^"]*" style="([^"]*)"/.exec(html);
  assert.ok(containerTag, "expected an ee-body container tag");
  assert.match(containerTag![1], /border-collapse:collapse/);
  assert.match(containerTag![1], /border-spacing:0/);
});

// --- Row/column rendering: editor↔email parity ------------------------------

function rowDoc(overrides: Record<string, unknown> = {}) {
  return parseDocument({
    version: 1,
    category: "transactional",
    from: "hi@acme.test",
    previewText: "",
    variables: [],
    blocks: [
      {
        type: "row",
        id: "r1",
        columnGap: 16,
        ...overrides,
        columns: [
          {
            type: "column",
            id: "c1",
            width: 50,
            children: [{ type: "text", id: "t1", text: "Left" }],
          },
          {
            type: "column",
            id: "c2",
            width: 50,
            children: [{ type: "text", id: "t2", text: "Right" }],
          },
        ],
      },
    ],
  });
}

test("column table uses table-layout:fixed so % widths hold against the gap spacer", () => {
  // Without fixed layout, `50% + gap-px + 50%` over-constrains the table and
  // browsers shrink ONE column (e.g. 272px vs 256px on a 50/50 split) — the
  // exact drift users saw between the canvas and the received email.
  const html = renderToHtml(rowDoc(), {}, {});
  assert.match(html, /<table[^>]*class="ee-cols"[^>]*style="table-layout:fixed;">/);
});

test("gap spacer td carries ee-gap so mobile stacking can hide it", () => {
  const html = renderToHtml(rowDoc(), {}, {});
  assert.match(html, /<td class="ee-gap"[^>]*width="16">/);
});

test("stackOnMobile:false omits the ee-cols stacking hook", () => {
  const html = renderToHtml(rowDoc({ stackOnMobile: false }), {}, {});
  assert.doesNotMatch(html, /class="ee-cols"/);
  // The fixed layout still applies (width parity is unconditional).
  assert.match(html, /style="table-layout:fixed;"/);
});

test("stacking media query targets the whole ee-cols table, not bare td.ee-col", () => {
  // Flipping only the <td>s to display:block leaves them wrapped in an
  // anonymous table row — they stay side-by-side. The table + tr must become
  // block-level too, and the gap spacer must be hidden.
  const html = renderToHtml(rowDoc(), {}, {});
  assert.match(html, /table\.ee-cols, table\.ee-cols > tbody, table\.ee-cols > tbody > tr, table\.ee-cols > tr\{display:block !important;width:100% !important;\}/);
  assert.match(html, /table\.ee-cols \.ee-col\{display:block !important;width:100% !important;box-sizing:border-box !important;\}/);
  assert.match(html, /table\.ee-cols \.ee-gap\{display:none !important;\}/);
});

// --- Hidden preheader marker ------------------------------------------------

test("preview text renders a hidden preheader marked with data-unitpost-preheader", () => {
  // apps/web's content-risk scanner exempts exactly this marker so a
  // preview-text-only-marketing-ESP-standard pattern (display:none) doesn't
  // trip its generic hidden-text/spam-evasion heuristic (2026-08-10
  // incident: legitimate workspaces got flagged purely for setting a
  // preview text). Keep this attribute stable — content-risk.ts's
  // stripKnownPreheader matches on it verbatim.
  const doc = parseDocument({
    version: 1,
    category: "marketing",
    from: "hi@acme.test",
    previewText: "Get 20% off your next order",
    variables: [],
    blocks: [{ type: "text", id: "t1", text: "Hello" }],
  });
  const html = renderToHtml(doc, {}, {});
  assert.match(html, /<div data-unitpost-preheader="true" style="display:none[^"]*">Get 20% off your next order/);
});

test("no preview text emits no preheader element at all", () => {
  const html = renderToHtml(marketingDoc(), {}, {});
  assert.doesNotMatch(html, /data-unitpost-preheader/);
});
