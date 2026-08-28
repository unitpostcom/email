// Nested `border` <-> scalar borderWidth/Style/Color/Radius.
// parseTsx and fromJsx share this so `<Section borderRadius={12}>` matches
// `<Section border-radius={12}>` in the editor dialect.

const NESTED_BORDER_TYPES = new Set(["section", "row", "column", "image"]);
const SCALAR_RADIUS_TYPES = new Set(["button", "image"]);

export function normalizeBorderAttrs(
  type: string,
  attrs: Record<string, unknown>,
): Record<string, unknown> {
  const { borderWidth, borderStyle, borderColor, borderRadius, ...rest } =
    attrs;
  if (
    borderWidth === undefined &&
    borderStyle === undefined &&
    borderColor === undefined &&
    borderRadius === undefined
  ) {
    return attrs;
  }
  const border: Record<string, unknown> = {};
  if (NESTED_BORDER_TYPES.has(type)) {
    if (typeof borderWidth === "number") border.width = borderWidth;
    if (typeof borderStyle === "string") border.style = borderStyle;
    if (typeof borderColor === "string") border.color = borderColor;
  }
  if (typeof borderRadius === "number") {
    if (SCALAR_RADIUS_TYPES.has(type)) rest.borderRadius = borderRadius;
    else if (NESTED_BORDER_TYPES.has(type)) border.radius = borderRadius;
  }
  if (Object.keys(border).length) rest.border = border;
  return rest;
}
