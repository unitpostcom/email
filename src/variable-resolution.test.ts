import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDocument, safeParseDocument } from "./schema";
import { collectVariables, renderToHtml, resolveVariablesWithContact } from "./render";

// Regression coverage for the data-integrity gate: a template that references a
// {{variable}} with no provided value and no contact field is REPORTED AS
// MISSING — the signal the Main App turns into a 422 BEFORE accepting a send
// (and the engine turns into a NonRetriable FAILED). Previously the missing-
// variable case was discovered only inside the engine render step, so a
// structurally-impossible send was accepted (row QUEUED) and surfaced as a
// deferred failure minutes later. These tests pin the resolver contract that
// both the boundary validation and the engine render rely on.
//
// Templates deliberately carry NO per-variable fallback anymore (silent
// per-template defaults were shipping placeholder copy to real recipients
// without any UI surfacing — see MESSAGING_MODEL.md §1.4). Legacy stored docs
// with the old `fallback` field are stripped by migrateDocument on load.

// A template referencing {{first_name}} declared as a contact-sourced variable.
function docRef(name: string, decl: Record<string, unknown> = {}) {
  return parseDocument({
    variables: [{ name, ...decl }],
    blocks: [
      { type: "text", id: "t1", content: [{ text: `Hi {{${name}}}` }] },
    ],
  });
}

test("collectVariables sees the referenced token", () => {
  const doc = docRef("first_name", { source: "contact" });
  assert.deepEqual(collectVariables(doc), ["first_name"]);
});

test("collectVariables sees tokens inside list items (text and inline runs)", () => {
  const doc = parseDocument({
    blocks: [
      {
        type: "list",
        id: "l1",
        items: [
          { text: "Plain {{plain_var}} item" },
          {
            text: "{{run_var}} teammates",
            content: [{ text: "{{run_var}} teammates", marks: { bold: true } }],
          },
          { text: "", content: [{ text: "docs", marks: { link: "{{link_var}}" } }] },
        ],
      },
    ],
  });
  assert.deepEqual(collectVariables(doc), ["link_var", "plain_var", "run_var"]);
  // And a provided value now resolves instead of shipping literally.
  const { values, missing } = resolveVariablesWithContact(doc, { plain_var: "a", run_var: "5", link_var: "https://x" });
  assert.deepEqual(missing, []);
  assert.equal(values.run_var, "5");
});

test("collectVariables sees tokens inside raw-HTML blocks (TPL-034)", () => {
  // renderHtmlBlock interpolates {{vars}} into html blocks, so the collector
  // must report them — otherwise the send pre-flight never resolves them and
  // an unresolvable token would ship literally instead of 422-ing.
  const doc = parseDocument({
    blocks: [
      { type: "html", id: "h1", html: "<p>Hello {{qa_missing_var}}</p>" },
    ],
  });
  assert.deepEqual(collectVariables(doc), ["qa_missing_var"]);
  const { missing } = resolveVariablesWithContact(doc, {}, {});
  assert.deepEqual(missing, ["qa_missing_var"]);
});

test("missing when no value, no contact field, no campaign default", () => {
  const doc = docRef("first_name", { source: "contact" });
  const { values, missing } = resolveVariablesWithContact(doc, {}, {});
  assert.deepEqual(missing, ["first_name"]);
  assert.equal(values.first_name, undefined);
});

test("resolved when the recipient's contact supplies it", () => {
  const doc = docRef("first_name", { source: "contact" });
  const { values, missing } = resolveVariablesWithContact(
    doc,
    {},
    { first_name: "Ada" },
  );
  assert.deepEqual(missing, []);
  assert.equal(values.first_name, "Ada");
});

test("legacy template `fallback` is STRIPPED on load and NOT used to resolve", () => {
  // A stored document from the old world (per-template fallback declared on
  // the variable). migrateDocument removes the field so VariableSchema
  // continues to parse cleanly; the resolver has no template-fallback branch
  // anymore, so this variable is reported as missing exactly as if the legacy
  // fallback had never been there. This is what closes the newsletter bug:
  // silent template-shipped defaults can never make a variable "not missing".
  const legacy = {
    variables: [
      { name: "first_name", source: "contact", contactField: "first_name", fallback: "there" },
    ],
    blocks: [
      { type: "text", id: "t1", content: [{ text: "Hi {{first_name}}" }] },
    ],
  };
  const r = safeParseDocument(legacy);
  assert.equal(r.success, true);
  if (!r.success) return;
  // Schema no longer carries `fallback`, and migrateDocument dropped it.
  const decl = r.data.variables.find((v) => v.name === "first_name");
  assert.ok(decl);
  assert.equal((decl as { fallback?: unknown }).fallback, undefined);
  // Resolver treats it as missing when contact/defaults are empty.
  const { values, missing } = resolveVariablesWithContact(r.data, {}, {}, {});
  assert.deepEqual(missing, ["first_name"]);
  assert.equal(values.first_name, undefined);
});

test("provided value wins over contact + campaign default", () => {
  const doc = docRef("first_name", { source: "contact" });
  const { values, missing } = resolveVariablesWithContact(
    doc,
    { first_name: "Grace" },
    { first_name: "Ada" },
    { first_name: "there" },
  );
  assert.deepEqual(missing, []);
  assert.equal(values.first_name, "Grace");
});

test("fill-only default backfills a contact missing the value", () => {
  const doc = docRef("first_name", { source: "contact" });
  const { values, missing } = resolveVariablesWithContact(
    doc,
    {},
    {},
    { first_name: "there" },
  );
  assert.deepEqual(missing, []);
  assert.equal(values.first_name, "there");
});

test("fill-only default does NOT clobber a real contact value", () => {
  const doc = docRef("first_name", { source: "contact" });
  const { values, missing } = resolveVariablesWithContact(
    doc,
    {},
    { first_name: "Ada" },
    { first_name: "there" },
  );
  assert.deepEqual(missing, []);
  // Contact's real value wins over the campaign fill-only default.
  assert.equal(values.first_name, "Ada");
});

test("provided override still beats a fill-only default", () => {
  const doc = docRef("first_name", { source: "contact" });
  const { values } = resolveVariablesWithContact(
    doc,
    { first_name: "Grace" },
    { first_name: "Ada" },
    { first_name: "there" },
  );
  // provided (system/branding/transactional) is the top of the precedence.
  assert.equal(values.first_name, "Grace");
});

test("an empty contact value does NOT satisfy a required variable", () => {
  const doc = docRef("first_name", { source: "contact" });
  const { missing } = resolveVariablesWithContact(
    doc,
    {},
    { first_name: "" },
  );
  assert.deepEqual(missing, ["first_name"]);
});

// F2: a {{token}} used ONLY in the subject (not the document body) must still be
// scanned + resolved via `extraTexts`, so it enters the missing-var report and
// gets a per-recipient value instead of shipping as a literal in the subject.
function docNoVars() {
  return parseDocument({
    variables: [],
    blocks: [{ type: "text", id: "t1", content: [{ text: "Hello there" }] }],
  });
}

test("collectVariables scans subject-only tokens via extraTexts", () => {
  const doc = docNoVars();
  assert.deepEqual(collectVariables(doc), []);
  assert.deepEqual(collectVariables(doc, ["Hi {{first_name}}!"]), [
    "first_name",
  ]);
});

test("subject-only variable is reported missing when unresolved", () => {
  const doc = docNoVars();
  const { missing } = resolveVariablesWithContact(doc, {}, {}, {}, [
    "Hi {{first_name}}!",
  ]);
  assert.deepEqual(missing, ["first_name"]);
});

test("subject-only variable resolves from the contact", () => {
  const doc = docNoVars();
  const { values, missing } = resolveVariablesWithContact(
    doc,
    { first_name: "Ada" },
    {},
    {},
    ["Hi {{first_name}}!"],
  );
  assert.deepEqual(missing, []);
  assert.equal(values.first_name, "Ada");
});

// SCAN / RENDER PARITY. The send pipeline resolves ONLY the tokens
// collectVariables reports, then renders with that map — so any field the
// renderer interpolates but the scan does not see ships a literal {{token}}
// with no "missing variable" error (the list-item hole, Oct 2026). This doc
// puts a distinct token in every text-bearing field of every leaf block type,
// nested in a section and a row, plus the preview text; resolving exactly the
// scanned set must leave no literal token in the HTML. A new block type or a
// new interpolated field that the scan misses fails here.
test("scan/render parity: every interpolated field is seen by collectVariables", () => {
  const doc = parseDocument({
    previewText: "{{t_preview}}",
    blocks: [
      { type: "text", id: "t", text: "{{t_text}} {{t_text_run}}", content: [{ text: "{{t_text}} " }, { text: "{{t_text_run}}", marks: { bold: true, link: "{{t_text_link}}" } }] },
      { type: "heading", id: "h", level: 2, text: "{{t_heading}}", content: [{ text: "{{t_heading}}", marks: { link: "{{t_heading_link}}" } }] },
      { type: "list", id: "l", items: [{ text: "{{t_list_text}}" }, { text: "x", content: [{ text: "{{t_list_run}}", marks: { link: "{{t_list_link}}" } }] }] },
      { type: "button", id: "b", text: "{{t_button_text}}", href: "{{t_button_href}}" },
      { type: "link", id: "k", text: "{{t_link_text}}", href: "{{t_link_href}}" },
      { type: "image", id: "i", src: "{{t_image_src}}", alt: "{{t_image_alt}}", href: "{{t_image_href}}" },
      { type: "code", id: "c", code: "{{t_code}}" },
      { type: "html", id: "m", html: "<p>{{t_html}}</p>" },
      { type: "markdown", id: "d", markdown: "{{t_markdown}}" },
      { type: "divider", id: "v" },
      { type: "spacer", id: "s", height: 8 },
      {
        type: "section",
        id: "sec",
        children: [
          { type: "text", id: "st", text: "{{t_section_text}}" },
          { type: "list", id: "sl", items: [{ text: "{{t_section_list}}" }] },
        ],
      },
      {
        type: "row",
        id: "row",
        columns: [{ type: "column", id: "col", children: [{ type: "text", id: "rt", text: "{{t_row_text}}" }] }],
      },
    ],
  });
  const referenced = collectVariables(doc);
  // Provide a value ONLY for what the scan found — the pipeline's behaviour.
  const values = Object.fromEntries(referenced.map((name) => [name, name.startsWith("t_") && /link|href|src/.test(name) ? `https://example.com/${name}` : `V_${name}`]));
  const html = renderToHtml(doc, values);
  const leftovers = [...html.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]);
  assert.deepEqual(leftovers, [], `renderer interpolated fields the scan never saw: ${leftovers.join(", ")}`);
  // And the scan found every token we planted (no silent over-coverage either).
  const planted = ["t_preview","t_text","t_text_run","t_text_link","t_heading","t_heading_link","t_list_text","t_list_run","t_list_link","t_button_text","t_button_href","t_link_text","t_link_href","t_image_src","t_image_alt","t_image_href","t_code","t_html","t_markdown","t_section_text","t_section_list","t_row_text"];
  for (const name of planted) assert.ok(referenced.includes(name), `scan missed ${name}`);
});

// 2026-10-13 audit: templates written by Ask Unit, the public API / MCP, or
// typed (not picked from the {{ menu) carry NO variable declarations. A
// built-in contact field can only ever mean the contact's own field, so an
// undeclared {{first_name}} must resolve from the recipient's contact instead
// of failing every live send.
test("an UNDECLARED built-in contact field resolves from the contact", () => {
  const doc = parseDocument({
    blocks: [{ type: "text", id: "t", text: "Hi {{first_name}} {{last_name}} ({{email}})" }],
  });
  assert.deepEqual(doc.variables, []);
  const { values, missing } = resolveVariablesWithContact(
    doc,
    {},
    { first_name: "Ann", last_name: "Lee", email: "ann@example.com" },
    {},
    ["Welcome, {{first_name}}"],
  );
  assert.deepEqual(missing, []);
  assert.deepEqual(values, { first_name: "Ann", last_name: "Lee", email: "ann@example.com" });
});

test("an undeclared built-in with no contact value is still missing (fails closed), and a campaign default fills it", () => {
  const doc = parseDocument({ blocks: [{ type: "text", id: "t", text: "Hi {{first_name}}" }] });
  assert.deepEqual(resolveVariablesWithContact(doc, {}, {}).missing, ["first_name"]);
  assert.deepEqual(resolveVariablesWithContact(doc, {}, { first_name: "" }).missing, ["first_name"]);
  assert.deepEqual(resolveVariablesWithContact(doc, {}, {}, { first_name: "there" }).values, { first_name: "there" });
});

test("an undeclared CUSTOM token is not read from the contact (only built-ins are implicit)", () => {
  const doc = parseDocument({ blocks: [{ type: "text", id: "t", text: "Your plan: {{plan}}" }] });
  assert.deepEqual(resolveVariablesWithContact(doc, {}, { plan: "Pro" }).missing, ["plan"]);
});
