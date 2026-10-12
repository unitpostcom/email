import {
  Fragment,
  isValidElement,
  type FunctionComponent,
  type ReactElement,
  type ReactNode,
} from "react";
import type * as z from "zod";
import {
  ButtonBlockSchema,
  CodeBlockSchema,
  ColumnBlockSchema,
  DividerBlockSchema,
  EmailDocumentSchema,
  HeadingBlockSchema,
  HtmlBlockSchema,
  ImageBlockSchema,
  LinkBlockSchema,
  ListBlockSchema,
  MarkdownBlockSchema,
  RowBlockSchema,
  SpacerBlockSchema,
  TextBlockSchema,
  type Block,
  type ColumnBlock,
  type EmailDocument,
  type InlineRun,
  type LeafBlock,
  type ListBlock,
  type SectionBlock,
  type TextBlock,
} from "./schema";
import { createBlock, newBlockId } from "./blocks";
import { normalizeBorderAttrs } from "./border-attrs";
import { dedentText } from "./dedent";
import { renderToHtml, type RenderOptions } from "./render";

// React authoring codec. Components are typed host tags; `fromJsx` / `render`
// walk the element tree into EmailDocument and the existing renderer. React
// never paints these — pass them to render(), not ReactDOM. The engine and
// parseTsx stay React-free (import this module only from `@unitpost/email/react`).

const HOST = Symbol.for("unitpost.email.host");

type HostType = Block["type"] | "column";

type HostComponent<P> = FunctionComponent<P> & {
  [HOST]: HostType;
  displayName: string;
};

function host<P>(name: string, type: HostType): HostComponent<P> {
  const Comp = ((props: P) => {
    void props;
    throw new Error(
      `${name} is an email component — pass it to render() from @unitpost/email/react, not ReactDOM.`,
    );
  }) as unknown as HostComponent<P>;
  Comp.displayName = name;
  Comp[HOST] = type;
  return Comp;
}

function isHost(type: unknown): type is HostComponent<Record<string, unknown>> {
  return (
    typeof type === "function" &&
    HOST in type &&
    typeof (type as HostComponent<Record<string, unknown>>)[HOST] === "string"
  );
}

type WithChildren<T> = Omit<T, "type" | "id"> & { children?: ReactNode };

// Keys the schema fills in when they're left out (`.default()` / `.optional()`).
type OptionalKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? K : never }[keyof T];

// Props as an author writes them: the schema's value types, with every prop
// that has a default optional. (The output type alone would make `<Text>` demand
// fontSize, align and marginBottom.)
type AuthorProps<S extends z.ZodType> = Omit<
  z.output<S>,
  OptionalKeys<z.input<S>> | "type" | "id"
> &
  Partial<Pick<z.output<S>, Extract<OptionalKeys<z.input<S>>, keyof z.output<S>>>>;

// The scalar border props the docs list (and the TSX dialect uses). fromJsx
// folds them into the nested `border` object.
export type BorderShorthandProps = {
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "dotted";
  borderColor?: string;
  borderRadius?: number;
};

// Section's schema is recursive (z.lazy with an explicit output type), so its
// defaulted props are listed by hand.
export type SectionProps = WithChildren<Omit<SectionBlock, "children" | "paddingX" | "paddingY">> &
  Partial<Pick<SectionBlock, "paddingX" | "paddingY">> &
  BorderShorthandProps;
export type RowProps = WithChildren<Omit<AuthorProps<typeof RowBlockSchema>, "columns">> &
  BorderShorthandProps;
export type ColumnProps = WithChildren<Omit<AuthorProps<typeof ColumnBlockSchema>, "children">> &
  BorderShorthandProps;
export type HeadingProps = WithChildren<
  Omit<AuthorProps<typeof HeadingBlockSchema>, "text" | "content">
> & { text?: string };
export type TextProps = WithChildren<Omit<AuthorProps<typeof TextBlockSchema>, "text" | "content">> & {
  text?: string;
};
export type ListProps = WithChildren<Omit<AuthorProps<typeof ListBlockSchema>, "items">> & {
  items?: ListBlock["items"];
};
export type ButtonProps = WithChildren<Omit<AuthorProps<typeof ButtonBlockSchema>, "text">> & {
  text?: string;
};
export type LinkProps = WithChildren<Omit<AuthorProps<typeof LinkBlockSchema>, "text">> & {
  text?: string;
};
export type ImageProps = AuthorProps<typeof ImageBlockSchema> & BorderShorthandProps;
export type DividerProps = AuthorProps<typeof DividerBlockSchema>;
export type SpacerProps = AuthorProps<typeof SpacerBlockSchema>;
export type MarkdownProps = WithChildren<Omit<AuthorProps<typeof MarkdownBlockSchema>, "markdown">> & {
  markdown?: string;
};
export type CodeProps = WithChildren<Omit<AuthorProps<typeof CodeBlockSchema>, "code">> & {
  code?: string;
};
export type HtmlProps = WithChildren<Omit<AuthorProps<typeof HtmlBlockSchema>, "html">> & {
  html?: string;
};

export const Section = host<SectionProps>("Section", "section");
export const Row = host<RowProps>("Row", "row");
export const Column = host<ColumnProps>("Column", "column");
export const Heading = host<HeadingProps>("Heading", "heading");
export const Text = host<TextProps>("Text", "text");
export const Button = host<ButtonProps>("Button", "button");
export const Link = host<LinkProps>("Link", "link");
export const List = host<ListProps>("List", "list");
export const Image = host<ImageProps>("Image", "image");
export const Divider = host<DividerProps>("Divider", "divider");
export const Spacer = host<SpacerProps>("Spacer", "spacer");
export const Markdown = host<MarkdownProps>("Markdown", "markdown");
export const Code = host<CodeProps>("Code", "code");
export const Html = host<HtmlProps>("Html", "html");

export class JsxRenderError extends Error {}

function nodesOf(children: ReactNode): ReactNode[] {
  if (children == null || typeof children === "boolean") return [];
  if (Array.isArray(children)) return children.flatMap(nodesOf);
  return [children];
}

function textOf(children: ReactNode): string {
  return nodesOf(children)
    .map((n) => {
      if (typeof n === "string" || typeof n === "number") return String(n);
      if (isValidElement(n)) {
        const inner = (n.props as { children?: ReactNode }).children;
        return textOf(inner);
      }
      return "";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

// Markdown, code and raw HTML are whitespace-significant: keep newlines and
// dedent like parseTsx does. Multi-line bodies come in as a template literal
// (`<Markdown>{`…`}</Markdown>`), since JSX itself folds newlines in text.
function rawTextOf(children: ReactNode): string {
  const raw = nodesOf(children)
    .map((n) => {
      if (typeof n === "string" || typeof n === "number") return String(n);
      if (isValidElement(n)) {
        return rawTextOf((n.props as { children?: ReactNode }).children);
      }
      return "";
    })
    .join("");
  return dedentText(raw);
}

type InlineMarks = NonNullable<InlineRun["marks"]>;

const INLINE_TAG_MARKS: Record<string, InlineMarks> = {
  strong: { bold: true },
  b: { bold: true },
  em: { italic: true },
  i: { italic: true },
  u: { underline: true },
  s: { strike: true },
  del: { strike: true },
  strike: { strike: true },
};

// color / background from a React style object (or a CSS string, which the
// TSX dialect uses).
function styleMarks(style: unknown): InlineMarks {
  const out: InlineMarks = {};
  if (typeof style === "string") {
    for (const decl of style.split(";")) {
      const at = decl.indexOf(":");
      if (at < 0) continue;
      const key = decl.slice(0, at).trim().toLowerCase();
      const value = decl.slice(at + 1).trim();
      if (key === "color") out.color = value;
      else if (key === "background-color" || key === "background") out.background = value;
    }
  } else if (style && typeof style === "object") {
    const s = style as Record<string, unknown>;
    if (typeof s.color === "string") out.color = s.color;
    const bg = s.backgroundColor ?? s.background;
    if (typeof bg === "string") out.background = bg;
  }
  return out;
}

// Inline formatting inside <Text>, <Heading> and <li>: <strong>/<b>, <em>/<i>,
// <u>, <s>, <a href> and <span style> become marked runs, the same marks
// parseTsx reads from the TSX dialect. Anything else keeps its text.
function inlineRuns(children: ReactNode, marks: InlineMarks = {}): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const n of nodesOf(children)) {
    if (typeof n === "string" || typeof n === "number") {
      const text = String(n).replace(/\s+/g, " ");
      if (!text) continue;
      runs.push(Object.keys(marks).length ? { text, marks: { ...marks } } : { text });
      continue;
    }
    if (!isValidElement(n)) continue;
    const props = n.props as { children?: ReactNode; href?: unknown; style?: unknown };
    const type = n.type as unknown;
    if (typeof type === "function" && !isHost(type)) {
      runs.push(...inlineRuns((type as (p: object) => ReactNode)(props), marks));
      continue;
    }
    if (typeof type !== "string") {
      runs.push(...inlineRuns(props.children, marks));
      continue;
    }
    const tag = type.toLowerCase();
    const next: InlineMarks = { ...marks, ...INLINE_TAG_MARKS[tag] };
    if (tag === "a") {
      next.link = typeof props.href === "string" ? props.href : "";
      Object.assign(next, styleMarks(props.style));
    } else if (tag === "span") {
      Object.assign(next, styleMarks(props.style));
    }
    runs.push(...inlineRuns(props.children, next));
  }
  return runs;
}

// Plain text + (only when something is formatted) the runs, trimmed at the
// edges like parseTsx trims a tag's inner text.
function inlineContent(children: ReactNode): { text: string; content?: InlineRun[] } {
  const runs = inlineRuns(children);
  if (runs.length) {
    runs[0] = { ...runs[0], text: runs[0].text.trimStart() };
    const last = runs.length - 1;
    runs[last] = { ...runs[last], text: runs[last].text.trimEnd() };
  }
  const kept = runs.filter((r) => r.text);
  const text = kept.map((r) => r.text).join("");
  return kept.some((r) => r.marks) ? { text, content: kept } : { text };
}

function expand(node: ReactNode): ReactNode[] {
  if (node == null || typeof node === "boolean") return [];
  if (Array.isArray(node)) return node.flatMap(expand);
  if (!isValidElement(node)) return [node];

  const type = node.type as unknown;
  if (type === Fragment || type === Symbol.for("react.fragment")) {
    return expand((node.props as { children?: ReactNode }).children);
  }
  if (typeof type === "function" && !isHost(type)) {
    const rendered = (type as (p: object) => ReactNode)(
      node.props as object,
    );
    return expand(rendered);
  }
  return [node];
}

function leafBlocks(children: ReactNode): LeafBlock[] {
  const out: LeafBlock[] = [];
  for (const n of expand(children)) {
    if (typeof n === "string" || typeof n === "number") {
      const t = String(n).trim();
      if (t) out.push(createBlock("text", { text: t }) as TextBlock);
      continue;
    }
    const block = toBlock(n);
    if (block.type === "section" || block.type === "row") {
      throw new JsxRenderError(
        `<${block.type === "section" ? "Section" : "Row"}> is not valid inside <Column>.`,
      );
    }
    out.push(block as LeafBlock);
  }
  return out;
}

function toColumn(node: ReactNode): ColumnBlock {
  const expanded = expand(node);
  if (expanded.length !== 1 || !isValidElement(expanded[0])) {
    throw new JsxRenderError("<Column> is only valid inside a <Row>.");
  }
  const el = expanded[0] as ReactElement<{ children?: ReactNode } & Record<string, unknown>>;
  const colType = el.type;
  if (!isHost(colType) || colType[HOST] !== "column") {
    throw new JsxRenderError("<Row> children must be <Column> elements.");
  }
  const { children, ...attrs } = el.props;
  return ColumnBlockSchema.parse({
    type: "column",
    id: newBlockId(),
    ...normalizeBorderAttrs("column", attrs),
    children: leafBlocks(children),
  });
}

function toBlock(node: ReactNode): Block {
  const expanded = expand(node);
  if (expanded.length !== 1) {
    throw new JsxRenderError("Expected a single email element.");
  }
  const n = expanded[0];
  if (typeof n === "string" || typeof n === "number") {
    return createBlock("text", { text: String(n).trim() });
  }
  if (!isValidElement(n)) {
    throw new JsxRenderError("Expected an email component.");
  }
  const el = n as ReactElement<{ children?: ReactNode } & Record<string, unknown>>;
  const hostType = el.type;
  if (!isHost(hostType)) {
    throw new JsxRenderError(
      "Unknown element. Use catalog components (Section, Heading, Button, …) or your own function that returns them.",
    );
  }
  const kind = hostType[HOST];
  const { children, ...rest } = el.props;
  const attrs = normalizeBorderAttrs(kind, { ...rest });

  if (kind === "column") {
    throw new JsxRenderError(
      "<Column> is only valid inside a <Row>. Wrap your columns in a <Row>…</Row>.",
    );
  }
  if (kind === "section") {
    return createBlock("section", {
      ...attrs,
      children: expand(children).flatMap((c) => {
        if (typeof c === "string" || typeof c === "number") {
          const t = String(c).trim();
          return t ? [createBlock("text", { text: t })] : [];
        }
        return [toBlock(c)];
      }),
    });
  }
  if (kind === "row") {
    return createBlock("row", {
      ...attrs,
      columns: expand(children).map(toColumn),
    });
  }

  if (kind === "list" && attrs.items == null) {
    // <List><li>…</li><li>…</li></List> — each <li> element (or plain string
    // child) is one item.
    attrs.items = expand(children).flatMap((c) => {
      if (typeof c === "string" || typeof c === "number") {
        const t = String(c).trim();
        return t ? [{ text: t }] : [];
      }
      if (isValidElement(c)) {
        const item = inlineContent((c.props as { children?: ReactNode }).children);
        return item.text ? [item] : [];
      }
      return [];
    });
  }

  if (kind === "heading" || kind === "text") {
    const inline = inlineContent(children);
    if (inline.text && attrs.text == null) {
      attrs.text = inline.text;
      if (inline.content && attrs.content == null) attrs.content = inline.content;
    }
  } else if (kind === "button" || kind === "link") {
    const inner = textOf(children);
    if (inner && attrs.text == null) attrs.text = inner;
  } else if (kind === "markdown") {
    const inner = rawTextOf(children);
    if (inner && attrs.markdown == null) attrs.markdown = inner;
  } else if (kind === "code") {
    const inner = rawTextOf(children);
    if (inner && attrs.code == null) attrs.code = inner;
  } else if (kind === "html") {
    const inner = rawTextOf(children);
    if (inner && attrs.html == null) attrs.html = inner;
  }

  return createBlock(kind, attrs);
}

export function fromJsx(
  node: ReactNode,
  base?: EmailDocument,
): EmailDocument {
  const blocks = expand(node).flatMap((n) => {
    if (typeof n === "string" || typeof n === "number") {
      const t = String(n).trim();
      return t ? [createBlock("text", { text: t })] : [];
    }
    return [toBlock(n)];
  });
  return base
    ? EmailDocumentSchema.parse({ ...base, blocks })
    : EmailDocumentSchema.parse({ blocks });
}

export function render(
  node: ReactNode,
  variables: Record<string, string> = {},
  options: RenderOptions = {},
): string {
  return renderToHtml(fromJsx(node), variables, options);
}
