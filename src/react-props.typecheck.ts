// Compile-time only: `npm run typecheck` fails if a React prop that the schema
// defaults becomes required again (the zod output type makes `<Text>` demand
// fontSize, align and marginBottom). Not imported anywhere, not shipped.
import { createElement as h, Fragment } from "react";
import {
  Button,
  Code,
  Column,
  Divider,
  Heading,
  Html,
  Image,
  Link,
  List,
  Markdown,
  Row,
  Section,
  Spacer,
  Text,
} from "./react";

export const minimalProps = h(
  Fragment,
  null,
  h(
    Section,
    {},
    h(Heading, {}, "Title"),
    h(Text, {}, "Body"),
    h(List, {}, h("li", null, "Item")),
    h(Button, {}, "Go"),
    h(Link, { href: "https://example.com" }, "More"),
    h(Image, { src: "https://example.com/logo.png", borderRadius: 8 }),
    h(Divider, {}),
    h(Spacer, {}),
    h(Markdown, {}, "**Hi**"),
    h(Code, {}, "npm test"),
    h(Html, {}, "<p>Hi</p>"),
  ),
  h(Row, { borderRadius: 12 }, h(Column, {}, h(Text, {}, "Left")), h(Column, { width: 50 })),
);

// Optional is not untyped: a value outside the schema still fails.
// @ts-expect-error level is 1 | 2 | 3 | 4.
export const badLevel = h(Heading, { level: 7 }, "Title");
