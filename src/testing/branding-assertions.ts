import assert from "node:assert/strict";

import { POWERED_BY_SENTINEL } from "../brand-mark";

// ===========================================================================
// @unitpost/email/testing — the BRANDING CONTRACT as reusable assertions.
//
// Workspace-only entry (not in publishConfig.exports; never shipped to npm).
// Shared by the renderer's unit matrix (src/branding-matrix.test.ts) and the
// wire e2e that runs real sends through the engine
// (tests/integration/src/e2e/email), so "what a recipient gets" is asserted
// with ONE definition at both layers:
//
//   • HTML, designed shell / Code / raw API HTML → the pill: muted "Sent with",
//     the logo, "Unitpost" — one <a> to unitpost.com carrying the sentinel.
//   • HTML, Simple → one subtle text line; "Unitpost" is a grey underlined link.
//   • Plain text → "Sent with Unitpost" as the last line; never a URL.
//   • Branding removed (paid + opted out) → nothing at all, in HTML or text.
//   • At most ONE mark, whatever path the email took.
//
// Body-order checks look for the literal "BODY-MARKER" in the email body.
// ===========================================================================

export const BODY_MARKER = "BODY-MARKER";

export const brandMarkCount = (s: string): number => (s.match(/Sent with/g) ?? []).length;

const lastLine = (s: string) =>
  s
    .trim()
    .split("\n")
    .filter((l) => l.trim())
    .pop() ?? "";

export function assertNoMark(html: string | undefined, text: string | undefined, name: string): void {
  for (const [part, s] of [
    ["html", html],
    ["text", text],
  ] as const) {
    if (s === undefined) continue;
    assert.equal(brandMarkCount(s), 0, `${name} ${part}: no mark when branding is removed`);
    assert.ok(!s.includes(POWERED_BY_SENTINEL), `${name} ${part}: no branding link`);
    assert.ok(!s.includes("web-app-manifest-192x192.png"), `${name} ${part}: no logo`);
  }
}

export function assertTextMark(text: string, name: string): void {
  assert.equal(brandMarkCount(text), 1, `${name} text: exactly one mark`);
  assert.match(lastLine(text), /Sent with Unitpost$/, `${name} text: the mark ends the email`);
  // "No printed link of ours" means the MARK prints no URL. The marketing
  // footer's unsubscribe link legitimately lives on our host in production
  // (MAIN_APP_URL = https://www.unitpost.com/unsubscribe…) — the wire e2e
  // caught the old blanket /unitpost\.com/ failing every real marketing text.
  assert.doesNotMatch(
    text,
    /unitpost\.com(?!\/unsubscribe)|unitpo\.st|https?:\/\/[^\s]*utm_/i,
    `${name} text: no printed link of ours`,
  );
  assert.doesNotMatch(text, /Powered by/, `${name} text: never "Powered by"`);
}

export function assertPill(html: string, name: string): void {
  assert.equal(brandMarkCount(html), 1, `${name} html: exactly one mark`);
  assert.doesNotMatch(html, /Powered by/, `${name} html: never "Powered by"`);
  const link = html.match(
    new RegExp(`<a [^>]*href="[^"]*${POWERED_BY_SENTINEL}[^"]*"[^>]*>([\\s\\S]*?)</a>`),
  );
  assert.ok(link, `${name} html: the mark is ONE embedded link`);
  assert.match(link![1]!, /Sent with/, `${name} html: link carries "Sent with"`);
  assert.match(link![1]!, /web-app-manifest-192x192\.png/, `${name} html: pill has the logo`);
  assert.match(link![1]!, />Unitpost</, `${name} html: and the wordmark`);
  assert.ok(html.indexOf(BODY_MARKER) < html.indexOf("Sent with"), `${name} html: mark after the body`);
}

export function assertSimpleLine(html: string, name: string): void {
  assert.equal(brandMarkCount(html), 1, `${name} html: exactly one mark`);
  assert.doesNotMatch(html, /<table|<img|Powered by/, `${name} html: a text line, not the pill`);
  assert.match(
    html,
    new RegExp(
      `Sent with <a href="[^"]*${POWERED_BY_SENTINEL}[^"]*"[^>]*style="color:#888888;text-decoration:underline"`,
    ),
    `${name} html: "Unitpost" is a grey underlined embedded link`,
  );
  assert.doesNotMatch(html, /#ffffff/i, `${name} html: never white-on-white`);
}
