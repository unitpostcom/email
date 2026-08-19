import { test } from "node:test";
import assert from "node:assert/strict";

import { interpolate, renderText } from "./util";

// ===========================================================================
// Variable interpolation — render-at-send token substitution (EMAIL_SENDING §2).
//
// `interpolate` is the low-level {{token}} substitution the renderer runs over
// authored text. The QA doc's "resolution precedence" + "missing var" rules are
// enforced a layer up (the send path builds the variables map and decides
// fail-vs-fallback); here we lock the substitution primitive itself: provided
// values win, whitespace inside braces is tolerated, and an UNKNOWN token is
// left verbatim (never silently blanked) so a missing value is visible.
// ===========================================================================

test("substitutes a known token with its provided value", () => {
  assert.equal(
    interpolate("Hi {{first_name}}", { first_name: "Marie" }),
    "Hi Marie",
  );
});

test("tolerates whitespace inside the braces", () => {
  assert.equal(
    interpolate("Hi {{ first_name }}", { first_name: "Marie" }),
    "Hi Marie",
  );
});

test("leaves an unknown token verbatim (visible, not blank)", () => {
  assert.equal(interpolate("Hi {{first_name}}", {}), "Hi {{first_name}}");
});

test("a provided value overrides — input wins over an empty map default", () => {
  // The map is the resolved set (provided > contact > fallback computed upstream);
  // whatever lands here is what renders.
  assert.equal(
    interpolate("{{cta}}", { cta: "Buy now" }),
    "Buy now",
  );
});

test("substitutes multiple distinct tokens in one pass", () => {
  assert.equal(
    interpolate("{{greeting}} {{first_name}}!", {
      greeting: "Hello",
      first_name: "Marie",
    }),
    "Hello Marie!",
  );
});

test("dotted token keys resolve (e.g. nested-style names)", () => {
  assert.equal(
    interpolate("{{user.name}}", { "user.name": "Ada" }),
    "Ada",
  );
});

test("renderText interpolates THEN escapes — no HTML injection via a value", () => {
  // Order matters: a value containing markup must be escaped, so a variable can
  // never smuggle live HTML into the rendered output.
  const out = renderText("Hi {{name}}", { name: "<script>alert(1)</script>" });
  assert.equal(out.includes("<script>"), false);
  assert.equal(out.includes("&lt;script&gt;"), true);
});
