import {
  Fragment,
  isValidElement,
  type FunctionComponent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ColumnBlockSchema,
  EmailDocumentSchema,
  type Block,
  type ButtonBlock,
  type CodeBlock,
  type ColumnBlock,
  type DividerBlock,
  type EmailDocument,
  type HeadingBlock,
  type ListBlock,
  type HtmlBlock,
  type ImageBlock,
  type LeafBlock,
  type LinkBlock,
  type MarkdownBlock,
  type RowBlock,
  type SectionBlock,
  type SpacerBlock,
  type TextBlock,
} from "./schema";
import { createBlock, newBlockId } from "./blocks";
import { normalizeBorderAttrs } from "./border-attrs";
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

export type SectionProps = WithChildren<Omit<SectionBlock, "children">>;
export type RowProps = WithChildren<Omit<RowBlock, "columns">>;
export type ColumnProps = WithChildren<Omit<ColumnBlock, "children">>;
export type HeadingProps = WithChildren<Omit<HeadingBlock, "text" | "content">> & {
  text?: string;
};
export type TextProps = WithChildren<Omit<TextBlock, "text" | "content">> & {
  text?: string;
};
export type ListProps = WithChildren<Omit<ListBlock, "items">> & {
  items?: ListBlock["items"];
};
export type ButtonProps = WithChildren<Omit<ButtonBlock, "text">> & { text?: string };
export type LinkProps = WithChildren<Omit<LinkBlock, "text">> & { text?: string };
export type ImageProps = Omit<ImageBlock, "type" | "id">;
export type DividerProps = Omit<DividerBlock, "type" | "id">;
export type SpacerProps = Omit<SpacerBlock, "type" | "id">;
export type MarkdownProps = WithChildren<Omit<MarkdownBlock, "markdown">> & {
  markdown?: string;
};
export type CodeProps = WithChildren<Omit<CodeBlock, "code">> & { code?: string };
export type HtmlProps = WithChildren<Omit<HtmlBlock, "html">> & { html?: string };

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
        const t = textOf((c.props as { children?: ReactNode }).children).trim();
        return t ? [{ text: t }] : [];
      }
      return [];
    });
  }

  const inner = textOf(children);
  if (kind === "heading" || kind === "text") {
    if (inner && attrs.text == null) attrs.text = inner;
  } else if (kind === "button" || kind === "link") {
    if (inner && attrs.text == null) attrs.text = inner;
  } else if (kind === "markdown") {
    if (inner && attrs.markdown == null) attrs.markdown = inner;
  } else if (kind === "code") {
    if (inner && attrs.code == null) attrs.code = inner;
  } else if (kind === "html") {
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
