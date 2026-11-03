// The nesting rules of the document model, worded once so `parseTsx` (a TSX
// string) and `fromJsx` (React elements) refuse the same markup with the same
// message. A section holds leaf blocks and sections, a row holds columns, a
// column holds leaf blocks; rows sit at the top level.

export const COLUMN_OUTSIDE_ROW = "<Column> is only valid inside a <Row>. Wrap your columns in a <Row>…</Row>.";

export const ROW_IN_SECTION =
  "<Section> may only contain leaf blocks or nested <Section>s — a <Row> cannot go inside a <Section>. Move the <Row> to the top level (rows are their own horizontal band), or use a nested <Section> instead.";

export const ROW_CHILD_NOT_COLUMN =
  "<Row> may only contain <Column> components. Put content inside a <Column>…</Column> within the <Row>.";

export function containerInColumn(tag: "Section" | "Row" | "Column"): string {
  return `<Column> may only contain leaf blocks (Text, Heading, Button, Image, …) — a <${tag}> can't go inside a <Column>. Put the leaf content directly in the <Column>, and keep <Section>/<Row> at the top level.`;
}
