import { test } from "node:test";
import assert from "node:assert/strict";

import { extractLibraryImageIds } from "./library-image-refs";

// ===========================================================================
// Library-image reference extraction — captured at SEND time off the rendered
// HTML so the delete guard can refuse to remove bytes still referenced by mail
// already sent / scheduled (recipients fetch them at open time).
// ===========================================================================

const UUID = "6a210000-6a21-425c-a627-708f1986a4e3";

test("extracts the id from an absolute /raw url", () => {
  const html = `<img src="https://app.example.com/api/library-images/${UUID}/raw" />`;
  assert.deepEqual(extractLibraryImageIds(html), [UUID]);
});

test("extracts the id from a relative /raw path", () => {
  const html = `<img src="/api/library-images/${UUID}/raw">`;
  assert.deepEqual(extractLibraryImageIds(html), [UUID]);
});

test("tolerates a localhost origin (dev-authored templates)", () => {
  const html = `<img src="http://localhost:3000/api/library-images/${UUID}/raw">`;
  assert.deepEqual(extractLibraryImageIds(html), [UUID]);
});

test("dedupes repeated references to the same image", () => {
  const html = `
    <img src="/api/library-images/${UUID}/raw">
    <img src="https://x/api/library-images/${UUID}/raw?v=2">
  `;
  assert.deepEqual(extractLibraryImageIds(html), [UUID]);
});

test("returns every distinct id in order of first appearance", () => {
  const a = "11111111-1111-1111-1111-111111111111";
  const b = "22222222-2222-2222-2222-222222222222";
  const html = `
    <img src="/api/library-images/${a}/raw">
    <img src="/api/library-images/${b}/raw">
  `;
  assert.deepEqual(extractLibraryImageIds(html), [a, b]);
});

test("ignores non-library and malformed urls", () => {
  assert.deepEqual(
    extractLibraryImageIds(
      `<img src="https://cdn.example.com/photo.png">
       <img src="/api/library-images//raw">
       <a href="/api/library-images/${UUID}">link, not /raw</a>`,
    ),
    [],
  );
});

test("extracts the id from the current /img/{id} CDN path", () => {
  const html = `<img src="https://assets.unitpost.com/img/${UUID}" />`;
  assert.deepEqual(extractLibraryImageIds(html), [UUID]);
});

test("extracts the id from a relative /img/{id} path", () => {
  const html = `<img src="/img/${UUID}">`;
  assert.deepEqual(extractLibraryImageIds(html), [UUID]);
});

test("extracts ids from a mix of /img and legacy /raw forms, deduped", () => {
  const html = `
    <img src="https://assets.unitpost.com/img/${UUID}">
    <img src="/api/library-images/${UUID}/raw">
  `;
  assert.deepEqual(extractLibraryImageIds(html), [UUID]);
});

test("returns [] for empty / nullish input", () => {
  assert.deepEqual(extractLibraryImageIds(""), []);
  assert.deepEqual(extractLibraryImageIds(null), []);
  assert.deepEqual(extractLibraryImageIds(undefined), []);
});
