import { test } from "node:test";
import assert from "node:assert/strict";

import { libraryImagePath, resolveImageSrc, effectiveAssetBase } from "./library-image-url";

const UUID = "6a210000-6a21-425c-a627-708f1986a4e3";
const CDN = "https://assets.unitpost.com";

test("libraryImagePath builds the opaque relative path", () => {
  assert.equal(libraryImagePath(UUID), `/img/${UUID}`);
});

test("resolves a relative /img/{id} against the CDN base", () => {
  assert.equal(resolveImageSrc(`/img/${UUID}`, CDN), `${CDN}/img/${UUID}`);
});

test("resolves the legacy /api/library-images/{id}/raw form to the CDN /img path", () => {
  assert.equal(
    resolveImageSrc(`/api/library-images/${UUID}/raw`, CDN),
    `${CDN}/img/${UUID}`,
  );
});

test("strips a trailing slash on the base so the URL never doubles up", () => {
  assert.equal(resolveImageSrc(`/img/${UUID}`, `${CDN}/`), `${CDN}/img/${UUID}`);
});

test("leaves an already-absolute external URL unchanged", () => {
  const ext = "https://cdn.example.com/photo.png";
  assert.equal(resolveImageSrc(ext, CDN), ext);
});

test("leaves a data: URI unchanged", () => {
  const data = "data:image/png;base64,AAAA";
  assert.equal(resolveImageSrc(data, CDN), data);
});

test("leaves a protocol-relative URL unchanged", () => {
  const pr = "//cdn.example.com/x.png";
  assert.equal(resolveImageSrc(pr, CDN), pr);
});

test("leaves a {{variable}} src unchanged (interpolated elsewhere)", () => {
  const v = "{{hero_image_url}}";
  assert.equal(resolveImageSrc(v, CDN), v);
});

test("leaves the path relative when no base is configured (local dev)", () => {
  assert.equal(resolveImageSrc(`/img/${UUID}`, ""), `/img/${UUID}`);
  assert.equal(resolveImageSrc(`/img/${UUID}`, undefined), `/img/${UUID}`);
});

test("returns empty input unchanged", () => {
  assert.equal(resolveImageSrc("", CDN), "");
});

test("effectiveAssetBase prefers the CDN when set", () => {
  assert.equal(
    effectiveAssetBase(CDN, "https://www.unitpost.com"),
    CDN,
  );
});

test("effectiveAssetBase falls back to a real app origin when CDN is unset", () => {
  assert.equal(
    effectiveAssetBase("", "https://www.unitpost.com"),
    "https://www.unitpost.com",
  );
  assert.equal(
    effectiveAssetBase(undefined, "https://www.unitpost.com/"),
    "https://www.unitpost.com",
  );
});

test("effectiveAssetBase refuses a localhost app origin (would break in real inboxes)", () => {
  assert.equal(effectiveAssetBase("", "http://localhost:3000"), "");
  assert.equal(effectiveAssetBase("", "http://127.0.0.1:3000"), "");
  assert.equal(effectiveAssetBase(undefined, undefined), "");
});

test("effectiveAssetBase feeds resolveImageSrc end-to-end (prod fallback to app origin)", () => {
  const base = effectiveAssetBase("", "https://www.unitpost.com");
  assert.equal(
    resolveImageSrc(`/img/${UUID}`, base),
    `https://www.unitpost.com/img/${UUID}`,
  );
});

// --- Regression: host-less base URLs must never produce `http:///img/{id}` ---
// A misconfigured CDN env (`http://`, `https://`, `http:///`, a bare scheme)
// used to slip through and emit `http:///img/{id}`, which the Gmail image proxy
// 404s (empty host). resolveImageSrc must treat a host-less base as "no base"
// and leave the path relative instead.
for (const bad of ["http://", "https://", "http:///", "https:///", "http:"]) {
  test(`resolveImageSrc treats host-less base ${JSON.stringify(bad)} as no base (stays relative)`, () => {
    assert.equal(resolveImageSrc(`/img/${UUID}`, bad), `/img/${UUID}`);
  });
}

test("effectiveAssetBase ignores a host-less CDN and falls back to the app origin", () => {
  assert.equal(
    effectiveAssetBase("http://", "https://www.unitpost.com"),
    "https://www.unitpost.com",
  );
  assert.equal(
    effectiveAssetBase("https:///", "https://www.unitpost.com"),
    "https://www.unitpost.com",
  );
});

test("effectiveAssetBase returns empty when BOTH CDN and app origin are host-less", () => {
  assert.equal(effectiveAssetBase("http://", "http://"), "");
  assert.equal(effectiveAssetBase("https:///", undefined), "");
});

// --- Regression: a REAL SEND from local dev must never ship a relative path ---
// The reported bug: a campaign/test send on localhost (no CDN, MAIN_APP_URL =
// http://localhost:3000) rendered `<img src="/img/{id}">`. A recipient's mail
// client (Gmail proxy) turns a relative src into a HOST-LESS absolute
// `http:///img/{id}` that 404s. Send paths now pass a reachable production
// origin as the final fallback so the src resolves to `<host>/img/{id}`.
const PROD = "https://www.unitpost.com";

test("effectiveAssetBase uses the send fallback when CDN unset + app origin is localhost", () => {
  assert.equal(effectiveAssetBase("", "http://localhost:3000", PROD), PROD);
  assert.equal(effectiveAssetBase(undefined, "http://127.0.0.1:3000", PROD), PROD);
  assert.equal(effectiveAssetBase(undefined, undefined, PROD), PROD);
});

test("effectiveAssetBase still prefers a real CDN/app origin over the send fallback", () => {
  // CDN wins outright.
  assert.equal(effectiveAssetBase(CDN, "http://localhost:3000", PROD), CDN);
  // A real (non-localhost) app origin wins over the fallback.
  assert.equal(
    effectiveAssetBase("", "https://staging.unitpost.com", PROD),
    "https://staging.unitpost.com",
  );
});

test("effectiveAssetBase ignores a localhost send fallback (never freeze loopback)", () => {
  // A defensively-wrong fallback that is itself loopback must not be used.
  assert.equal(effectiveAssetBase("", "http://localhost:3000", "http://localhost:9999"), "");
});

test("send fallback feeds resolveImageSrc end-to-end (local-dev send → absolute prod URL)", () => {
  const base = effectiveAssetBase(undefined, "http://localhost:3000", PROD);
  assert.equal(resolveImageSrc(`/img/${UUID}`, base), `${PROD}/img/${UUID}`);
});
