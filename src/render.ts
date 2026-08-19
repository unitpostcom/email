import type {
  Block,
  ButtonBlock,
  CodeBlock,
  ColumnBlock,
  ComponentFragment,
  DividerBlock,
  EmailDocument,
  HeadingBlock,
  HtmlBlock,
  ImageBlock,
  LeafBlock,
  LinkBlock,
  MarkdownBlock,
  RowBlock,
  SectionBlock,
  SectionChild,
  SpacerBlock,
  TextBlock,
  Theme,
} from "./schema";
import { STYLE_TOKENS } from "./schema";
import { escapeHtml, inlineStyle, interpolate, renderText, renderInlineRuns } from "./util";
import { sanitizeEmailHtml, safeUrl, safeImageUrl } from "./sanitize";
import { compileClasses, rulesToCss, type CssRule } from "./tw-compile";
import { resolveImageSrc } from "./library-image-url";

// Cross-client email HTML renderer.
//
// Email clients (especially Outlook/Windows) don't support modern CSS, so we
// emit TABLE-based layout with INLINE styles. Everything is wrapped in a
// max-width container centered on a colored backdrop. We own the markup so we
// control client coverage and can grow the block set deliberately.

type Vars = Record<string, string>;

// Render options. `editor` injects data-block-id attributes so the live preview
// can map clicks back to blocks; production sends omit it for clean output.
// `marketingFooter` is the workspace's customizable compliance footer (a
// ComponentFragment); when provided AND the doc is marketing AND the author
// didn't inline their own {{unsubscribe_url}}, its blocks are rendered through
// the normal block pipeline and appended after the body. Falls back to the
// built-in hardcoded footer when omitted (back-compat / no stored footer yet).
export type RenderOptions = {
  editor?: boolean;
  marketingFooter?: ComponentFragment;
  // Append a prominent "Powered by Unitpost" mark at the very bottom of the
  // email, on the outer backdrop BELOW the body card (a sibling row under the
  // paper, not inside it). Resolved by the caller from the workspace's plan
  // entitlement + stored preference (free plans can't remove it; paid plans that
  // opted out pass false). Rendered on EVERY email — marketing AND transactional
  // — since it's a brand mark, not a compliance element. Defaults to true so an
  // un-entitled / unconfigured send keeps it.
  showPoweredBy?: boolean;
  // Reserved system/branding tokens the FOOTER fragment references but the body
  // usually does not: {{unsubscribe_url}}, {{company_name}}, {{company_address}}.
  // The document-level variable scan (collectVariables → resolveVariables) only
  // sees the BODY + subject, so these never make it into `variables` unless the
  // author happened to inline them — which is why footers historically shipped a
  // literal `{{unsubscribe_url}}` href and a bare ` · ` company line. We resolve
  // the footer fragment against `{ ...variables, ...footerVars }` so its tokens
  // always fill, independently of the body. Values that are absent/empty here
  // let the footer drop the block that would otherwise render blank (the company
  // line when the workspace hasn't set a name/address).
  footerVars?: Record<string, string>;
  // Absolute base URL for hosted library images (the asset CDN, e.g.
  // "https://assets.unitpost.com"). Image blocks store an origin-INDEPENDENT
  // relative `src` (`/img/{id}`); at render we rewrite it to `${assetBaseUrl}/img/{id}`
  // so recipients fetch the bytes from the CDN. Omit (or "") in same-origin
  // contexts (the dashboard live preview) — the relative path resolves there.
  // Swapping the asset domain later is a one-env-var change (no template edits).
  assetBaseUrl?: string;
};

type RenderCtx = {
  theme: Theme;
  vars: Vars;
  editor: boolean;
  // Hoisted CSS rules (responsive / pseudo) collected from block className
  // compilation; written into <head><style> at the end of the render.
  rules: CssRule[];
  // Absolute asset CDN base for resolving relative library-image `src` paths
  // (`/img/{id}` → `${assetBaseUrl}/img/{id}`). "" leaves the path relative.
  assetBaseUrl: string;
  // Set ONLY while rendering the marketing-footer fragment: drop a text/link
  // block whose content resolves to "effectively empty" (blank or just
  // separator punctuation like `·`/`|`/`-`). This hides the compliance-footer
  // company line — `{{company_name}} · {{company_address}}` — when the
  // workspace hasn't set either, instead of shipping a bare ` · `. Never set
  // for the body, so an intentionally-empty body block is untouched.
  dropEmptyText?: boolean;
};

// A text/link block's resolved content is "effectively empty" (nothing worth
// showing) when, after stripping HTML tags and common separator punctuation,
// no visible characters remain. Used by the footer sub-render to hide the
// company line when its {{company_name}}/{{company_address}} tokens resolved to
// nothing (so recipients don't see a stray " · ").
function isEffectivelyEmpty(html: string): boolean {
  const text = html
    .replace(/<[^>]*>/g, "") // strip tags
    .replace(/&[a-z]+;|&#\d+;/gi, " ") // collapse entities to space
    .replace(/[·|•\-–—,;:/\\]+/g, "") // drop separator punctuation
    .replace(/\s+/g, "") // drop whitespace
    .trim();
  return text.length === 0;
}

// `data-block-id="<id>"` attribute string (only in editor mode), with a leading
// space so it can be dropped straight into a tag.
function idAttr(id: string, ctx: RenderCtx): string {
  return ctx.editor ? ` data-block-id="${id}"` : "";
}

// Compose a block's final inline style honoring the LOCKED precedence:
//   theme defaults → className (compiled inline) → schema style props → customCss
// `schemaStyle` is the property→value map the block already builds from its
// typed props + theme defaults (lowest-but-above-className: schema props WIN
// over className so explicit inspector values aren't silently overridden).
// Returns the final inline `style=` value plus a ` class="..."` attribute
// fragment (empty unless the className produced hoisted responsive/pseudo
// rules), and registers those rules on the ctx for the <head>.
function composeStyle(
  ctx: RenderCtx,
  className: string | undefined,
  schemaStyle: Record<string, string | number | undefined | null>,
  customCss?: string,
  extraClass?: string,
  // Theme-derived DEFAULTS (e.g. fallback text color/font). These sit BELOW
  // className in the locked precedence (theme → className → schema → customCss),
  // so an explicit utility like `text-red-500` beats the theme default but an
  // explicit schema prop still wins over the utility. Pass only true defaults
  // here; pass user-set values via `schemaStyle`.
  themeDefaults?: Record<string, string | number | undefined | null>,
): { style: string; classAttr: string } {
  const compiled = compileClasses(className, ctx.theme);
  // Layer order (lowest → highest): theme defaults, className inline, schema.
  const merged: Record<string, string | number | undefined | null> = {};
  if (themeDefaults) {
    for (const [k, v] of Object.entries(themeDefaults)) {
      if (v !== undefined && v !== null && v !== "") merged[k] = v;
    }
  }
  Object.assign(merged, compiled.inline);
  for (const [k, v] of Object.entries(schemaStyle)) {
    if (v !== undefined && v !== null && v !== "") merged[k] = v;
  }
  let style = inlineStyle(merged);
  style = withCustom(style, customCss);
  if (compiled.rules.length) ctx.rules.push(...compiled.rules);
  const classes = [extraClass, compiled.className].filter(Boolean).join(" ");
  const classAttr = classes ? ` class="${classes}"` : "";
  return { style, classAttr };
}

// Append a block's customCss declarations to a base style string so user CSS
// wins (it comes last). Tolerates declarations with or without a trailing ';'.
function withCustom(base: string, customCss?: string): string {
  if (!customCss || !customCss.trim()) return base;
  const extra = customCss.trim().replace(/;?\s*$/, "");
  return base ? `${base};${extra}` : extra;
}

// ---------------------------------------------------------------------------
// Spacing resolution. The new per-side `padding`/`margin` BoxSpacing objects
// WIN when present; otherwise we fall back to the legacy fields so existing
// documents render identically.
// ---------------------------------------------------------------------------
type Side = { top?: number; right?: number; bottom?: number; left?: number };

function sidesToCss(s: Side): string {
  // CSS shorthand "top right bottom left"; missing sides default to 0.
  return `${s.top ?? 0}px ${s.right ?? 0}px ${s.bottom ?? 0}px ${s.left ?? 0}px`;
}

// Effective margin CSS value for a block. Uses `margin` per-side if set, else
// the legacy `marginBottom` (bottom-only). Returns undefined when there's no
// spacing to emit (so inlineStyle drops it).
function resolveMargin(block: {
  margin?: Side;
  marginBottom?: number;
}): string | undefined {
  if (block.margin && hasAnySide(block.margin)) return sidesToCss(block.margin);
  if (typeof block.marginBottom === "number")
    return `0 0 ${block.marginBottom}px 0`;
  return undefined;
}

// Effective padding CSS value. Uses `padding` per-side if set, else the legacy
// axis padding (paddingY vertical, paddingX horizontal) when provided.
function resolvePadding(block: {
  padding?: Side;
  paddingX?: number;
  paddingY?: number;
}): string | undefined {
  if (block.padding && hasAnySide(block.padding))
    return sidesToCss(block.padding);
  if (typeof block.paddingX === "number" || typeof block.paddingY === "number")
    return `${block.paddingY ?? 0}px ${block.paddingX ?? 0}px`;
  return undefined;
}

// Effective body-container padding. Per-side `bodyPaddingSides` wins when any
// side is set; otherwise the legacy uniform `bodyPadding` number. Shared by the
// renderer and the editor canvas so both surfaces match exactly.
export function resolveBodyPadding(theme: {
  bodyPaddingSides?: Side;
  bodyPadding?: number;
}): string | undefined {
  if (theme.bodyPaddingSides && hasAnySide(theme.bodyPaddingSides))
    return sidesToCss(theme.bodyPaddingSides);
  return theme.bodyPadding ? `${theme.bodyPadding}px` : undefined;
}

function hasAnySide(s: Side): boolean {
  return (
    s.top != null || s.right != null || s.bottom != null || s.left != null
  );
}

// Border object → CSS declarations, emitted ONLY when a positive width is set
// (a border-less block passes `undefined` for `border` shorthand so inlineStyle
// drops it). `radius` is returned separately since containers apply it to their
// own element while images map it onto the existing `borderRadius` field. All
// returned values are `undefined` when not set, so existing blocks (no `border`)
// render byte-identically.
type BorderLike = {
  width?: number;
  style?: "solid" | "dashed" | "dotted";
  color?: string;
  radius?: number;
} | undefined;

function resolveBorder(border: BorderLike): {
  border?: string;
  "border-radius"?: string;
} {
  if (!border) return {};
  const out: { border?: string; "border-radius"?: string } = {};
  if (border.width && border.width > 0) {
    out.border = `${border.width}px ${border.style ?? "solid"} ${
      border.color ?? "#e4e4e7"
    }`;
  }
  if (border.radius && border.radius > 0) {
    out["border-radius"] = `${border.radius}px`;
  }
  return out;
}

function renderLeaf(block: LeafBlock, ctx: RenderCtx): string {
  switch (block.type) {
    case "text":
      return renderTextBlock(block, ctx);
    case "heading":
      return renderHeadingBlock(block, ctx);
    case "button":
      return renderButtonBlock(block, ctx);
    case "image":
      return renderImageBlock(block, ctx);
    case "divider":
      return renderDividerBlock(block, ctx);
    case "link":
      return renderLinkBlock(block, ctx);
    case "spacer":
      return renderSpacerBlock(block, ctx);
    case "markdown":
      return renderMarkdownBlock(block, ctx);
    case "code":
      return renderCodeBlock(block, ctx);
    case "html":
      return renderHtmlBlock(block, ctx);
  }
}

function renderTextBlock(block: TextBlock, ctx: RenderCtx): string {
  const { style, classAttr } = composeStyle(
    ctx,
    block.className,
    {
      margin: resolveMargin(block),
      padding: resolvePadding(block),
      color: block.color,
      "font-size": `${block.fontSize}px`,
      "line-height": block.lineHeight ?? STYLE_TOKENS.bodyLineHeight,
      "letter-spacing":
        block.letterSpacing != null ? `${block.letterSpacing}px` : undefined,
      "font-weight": block.fontWeight,
      "text-align": block.align,
      "font-family": block.fontFamily,
    },
    block.customCss,
    undefined,
    {
      color: ctx.theme.textColor,
      "font-family": ctx.theme.fontFamily,
    },
  );
  const inner =
    block.content && block.content.length
      ? renderInlineRuns(block.content, ctx.vars, ctx.theme.linkColor)
      : renderText(block.text, ctx.vars);
  if (ctx.dropEmptyText && isEffectivelyEmpty(inner)) return "";
  return `<p${idAttr(block.id, ctx)}${classAttr} style="${style}">${inner}</p>`;
}

function renderHeadingBlock(block: HeadingBlock, ctx: RenderCtx): string {
  const { style, classAttr } = composeStyle(
    ctx,
    block.className,
    {
      margin: resolveMargin(block),
      padding: resolvePadding(block),
      color: block.color,
      "font-size": `${block.fontSize ?? STYLE_TOKENS.headingSize[block.level]}px`,
      "line-height": block.lineHeight ?? STYLE_TOKENS.headingLineHeight,
      "letter-spacing":
        block.letterSpacing != null ? `${block.letterSpacing}px` : undefined,
      "font-weight": block.fontWeight,
      "text-align": block.align,
      "font-family": block.fontFamily,
    },
    block.customCss,
    undefined,
    {
      color: ctx.theme.textColor,
      "font-family": ctx.theme.fontFamily,
      "font-weight": "700",
    },
  );
  const tag = `h${block.level}`;
  const inner =
    block.content && block.content.length
      ? renderInlineRuns(block.content, ctx.vars, ctx.theme.linkColor)
      : renderText(block.text, ctx.vars);
  return `<${tag}${idAttr(block.id, ctx)}${classAttr} style="${style}">${inner}</${tag}>`;
}

function renderButtonBlock(block: ButtonBlock, ctx: RenderCtx): string {
  // Buttons need bulletproof markup. We use a table so the clickable area is
  // padded consistently across clients. (VML for Outlook can be layered in
  // later; this padded-table approach already renders acceptably there.)
  // The className applies to the wrapper div (alignment/spacing context).
  const { style: wrapStyle, classAttr } = composeStyle(
    ctx,
    block.className,
    {
      margin: resolveMargin(block),
      padding: resolvePadding(block),
      "text-align": block.align,
    },
    block.customCss,
  );
  const cellStyle = inlineStyle({
    "background-color": block.backgroundColor,
    "border-radius": `${block.borderRadius}px`,
  });
  const linkStyle = inlineStyle({
    display: "inline-block",
    padding: `${block.innerPaddingY}px ${block.innerPaddingX}px`,
    color: block.textColor,
    "font-size": `${STYLE_TOKENS.buttonFontSize}px`,
    "font-weight": STYLE_TOKENS.buttonFontWeight,
    "text-decoration": "none",
    "border-radius": `${block.borderRadius}px`,
  });
  const href = escapeHtml(safeUrl(interpolate(block.href, ctx.vars)));
  return [
    `<div${idAttr(block.id, ctx)}${classAttr} style="${wrapStyle}">`,
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="display:inline-table;">`,
    `<tr><td style="${cellStyle}" align="center">`,
    `<a href="${href}" target="_blank" style="${linkStyle}">${renderText(block.text, ctx.vars)}</a>`,
    `</td></tr></table>`,
    `</div>`,
  ].join("");
}

function renderImageBlock(block: ImageBlock, ctx: RenderCtx): string {
  const { style: wrapStyle, classAttr } = composeStyle(
    ctx,
    block.className,
    {
      margin: resolveMargin(block),
      padding: resolvePadding(block),
      "text-align": block.align,
    },
    block.customCss,
  );
  // The FRAME is a sized box; the image fills it (width:100%). When a height is
  // pinned the image fits the frame via object-fit; otherwise the frame height
  // adapts to the image's aspect ratio. object-fit support in email clients is
  // limited — treated as a best-effort hint that gracefully degrades.
  const hasHeight = Boolean(block.height);
  const borderCss = resolveBorder(block.border);
  const frameStyle = inlineStyle({
    display: "inline-block",
    "max-width": "100%",
    ...(block.width ? { width: `${block.width}px` } : { width: "100%" }),
    ...(hasHeight ? { height: `${block.height}px` } : {}),
    ...(block.backgroundColor ? { "background-color": block.backgroundColor } : {}),
    ...(borderCss.border ? { border: borderCss.border } : {}),
    ...(block.borderRadius ? { "border-radius": `${block.borderRadius}px`, overflow: "hidden" } : {}),
    "line-height": "0",
  });
  const imgStyle = inlineStyle({
    display: "block",
    width: "100%",
    // Fill the frame height when set; otherwise preserve intrinsic aspect ratio.
    height: hasHeight ? "100%" : "auto",
    border: "0",
    outline: "none",
    "text-decoration": "none",
    ...(hasHeight ? { "object-fit": block.objectFit ?? "cover" } : {}),
  });
  // width attr mirrors the frame width for Outlook; height attr only when pinned.
  const widthAttr = block.width ? ` width="${block.width}"` : "";
  const heightAttr = block.height ? ` height="${block.height}"` : "";
  // Resolve a relative library-image path (`/img/{id}`) against the asset CDN
  // base before sanitizing. Absolute URLs, `{{variables}}`, and external CDNs
  // pass through unchanged. Variable interpolation runs first so a `{{var}}`
  // that expands to a relative path is still resolved.
  const resolvedSrc = resolveImageSrc(
    interpolate(block.src, ctx.vars),
    ctx.assetBaseUrl,
  );
  const img = `<img src="${escapeHtml(safeImageUrl(resolvedSrc))}" alt="${renderText(block.alt, ctx.vars)}"${widthAttr}${heightAttr} style="${imgStyle}" />`;
  let frame = `<span style="${frameStyle}">${img}</span>`;
  if (block.href) {
    frame = `<a href="${escapeHtml(safeUrl(interpolate(block.href, ctx.vars)))}" target="_blank" style="${inlineStyle({ display: "inline-block", "max-width": "100%" })}">${frame}</a>`;
  }
  return `<div${idAttr(block.id, ctx)}${classAttr} style="${wrapStyle}">${frame}</div>`;
}

function renderDividerBlock(block: DividerBlock, ctx: RenderCtx): string {
  const { style, classAttr } = composeStyle(
    ctx,
    block.className,
    {
      "border-top": `1px solid ${block.color}`,
      "font-size": "1px",
      "line-height": "1px",
      margin: resolveMargin(block),
      padding: resolvePadding(block),
    },
    block.customCss,
  );
  return `<div${idAttr(block.id, ctx)}${classAttr} style="${style}">&nbsp;</div>`;
}

function renderLinkBlock(block: LinkBlock, ctx: RenderCtx): string {
  const { style: wrapStyle, classAttr } = composeStyle(
    ctx,
    block.className,
    {
      margin: resolveMargin(block),
      padding: resolvePadding(block),
      "text-align": block.align,
      "font-family": block.fontFamily ?? ctx.theme.fontFamily,
    },
    block.customCss,
  );
  const linkStyle = inlineStyle({
    color: block.color ?? ctx.theme.linkColor,
    "font-size": `${block.fontSize}px`,
    // Undefined (existing links) keeps the historical always-underlined look;
    // an explicit `false` removes it, `true` forces it.
    "text-decoration": block.underline === false ? "none" : "underline",
  });
  const href = escapeHtml(safeUrl(interpolate(block.href, ctx.vars)));
  return `<div${idAttr(block.id, ctx)}${classAttr} style="${wrapStyle}"><a href="${href}" target="_blank" style="${linkStyle}">${renderText(block.text, ctx.vars)}</a></div>`;
}

function renderSpacerBlock(block: SpacerBlock, ctx: RenderCtx): string {
  // A fixed-height cell is the only reliable way to add vertical space across
  // clients (margins/padding collapse unpredictably). The non-breaking space
  // keeps Outlook from collapsing the row.
  const { style, classAttr } = composeStyle(
    ctx,
    block.className,
    {
      height: `${block.height}px`,
      "line-height": `${block.height}px`,
      "font-size": "1px",
      margin: resolveMargin(block),
    },
    block.customCss,
  );
  return `<div${idAttr(block.id, ctx)}${classAttr} style="${style}">&nbsp;</div>`;
}

function renderCodeBlock(block: CodeBlock, ctx: RenderCtx): string {
  const { style: preStyle, classAttr } = composeStyle(
    ctx,
    block.className,
    {
      margin: resolveMargin(block),
      padding: resolvePadding(block) ?? "16px",
      "background-color": block.backgroundColor,
      color: block.color,
      "border-radius": "6px",
      "font-family": STYLE_TOKENS.codeFontFamily,
      "font-size": STYLE_TOKENS.codeFontSize,
      "line-height": STYLE_TOKENS.bodyLineHeight,
      "white-space": "pre-wrap",
      "word-break": "break-word",
      "overflow-x": "auto",
    },
    block.customCss,
  );
  // Interpolate (so {{vars}} work) then escape — code is shown verbatim.
  return `<pre${idAttr(block.id, ctx)}${classAttr} style="${preStyle}"><code>${renderText(block.code, ctx.vars)}</code></pre>`;
}

// Raw HTML escape hatch. The content IS markup, so we DON'T escape it — we
// interpolate {{vars}} and emit verbatim. In editor mode we wrap it in a marked
// div so the canvas/preview can map clicks back to the block; production sends
// emit the content with a marginBottom-only wrapper (or bare if margin is 0).
function renderHtmlBlock(block: HtmlBlock, ctx: RenderCtx): string {
  // Sanitize the raw HTML before emitting: strip forbidden actions (<script>,
  // event handlers, javascript: URLs, …) so unsafe markup never reaches the
  // inbox or the dashboard preview. Defense-in-depth — ingestion also sanitizes,
  // but the renderer is the last line before output. Interpolate first so any
  // markup injected via {{vars}} is sanitized too.
  const inner = sanitizeEmailHtml(interpolate(block.html, ctx.vars)).html;
  // HTML stays bare (no wrapper) unless it actually has spacing or a className —
  // preserve that by only emitting margin/padding when non-zero.
  const marginCss = resolveMargin(block);
  const paddingCss = resolvePadding(block);
  const { style, classAttr } = composeStyle(
    ctx,
    block.className,
    {
      margin: marginCss && marginCss !== "0 0 0px 0" ? marginCss : undefined,
      padding:
        paddingCss && paddingCss !== "0px 0px 0px 0px" ? paddingCss : undefined,
    },
    block.customCss,
  );
  if (!ctx.editor && !style && !classAttr) return inner;
  const styleAttr = style ? ` style="${style}"` : "";
  return `<div${idAttr(block.id, ctx)}${classAttr}${styleAttr}>${inner}</div>`;
}

function renderMarkdownBlock(block: MarkdownBlock, ctx: RenderCtx): string {
  const { style: wrapStyle, classAttr } = composeStyle(
    ctx,
    block.className,
    {
      margin: resolveMargin(block),
      padding: resolvePadding(block),
      color: block.color ?? ctx.theme.textColor,
      "font-size": `${block.fontSize}px`,
      "line-height": STYLE_TOKENS.bodyLineHeight,
      "text-align": block.align,
      "font-family": ctx.theme.fontFamily,
    },
    block.customCss,
  );
  // Interpolate variables BEFORE markdown compilation so values participate in
  // formatting; the compiler escapes all literal text internally.
  const html = compileMarkdown(interpolate(block.markdown, ctx.vars), ctx.theme);
  return `<div${idAttr(block.id, ctx)}${classAttr} style="${wrapStyle}">${html}</div>`;
}

// ---------------------------------------------------------------------------
// Minimal, email-safe Markdown → HTML compiler.
//
// Deliberately small: headings, bold, italic, links, inline code, unordered/
// ordered lists, and paragraphs. Everything is escaped first, then a fixed set
// of inline patterns is re-introduced as inline-styled tags so the output is
// self-contained and Outlook-tolerant. This is NOT a general Markdown engine —
// it's a predictable subset whose output we fully control.
// ---------------------------------------------------------------------------
function compileInline(escaped: string, theme: Theme): string {
  return (
    escaped
      // links [text](href) — href is already escaped; quotes became &#39;/&quot;.
      // Guard the scheme too so a javascript:/vbscript: link can't slip through.
      .replace(
        /\[([^\]]+)\]\(([^)\s]+)\)/g,
        (_m, text: string, href: string) =>
          `<a href="${safeUrl(href)}" target="_blank" style="color:${theme.linkColor};text-decoration:underline;">${text}</a>`,
      )
      // bold **text**
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      // italic *text*
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      // inline code `code`
      .replace(
        /`([^`]+)`/g,
        `<code style="font-family:Consolas,Menlo,monospace;background-color:#f4f4f5;padding:2px 4px;border-radius:3px;">$1</code>`,
      )
  );
}

function compileMarkdown(src: string, theme: Theme): string {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = compileInline(escapeHtml(paragraph.join(" ")), theme);
    out.push(`<p style="margin:0 0 12px 0;">${text}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flushParagraph();
      closeList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      const size = level === 1 ? 24 : level === 2 ? 20 : 16;
      out.push(
        `<h${level} style="margin:0 0 12px 0;font-size:${size}px;line-height:1.3;">${compileInline(escapeHtml(heading[2]), theme)}</h${level}>`,
      );
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushParagraph();
      const want: "ul" | "ol" = ul ? "ul" : "ol";
      if (listType !== want) {
        closeList();
        listType = want;
        out.push(`<${want} style="margin:0 0 12px 0;padding-left:24px;">`);
      }
      const item = (ul ?? ol)![1];
      out.push(`<li style="margin:0 0 4px 0;">${compileInline(escapeHtml(item), theme)}</li>`);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  closeList();
  return out.join("");
}

function renderSectionChild(child: SectionChild, ctx: RenderCtx): string {
  return child.type === "section"
    ? renderSection(child, ctx)
    : renderLeaf(child, ctx);
}

function renderSection(block: SectionBlock, ctx: RenderCtx): string {
  const { style: cellStyle, classAttr } = composeStyle(
    ctx,
    block.className,
    {
      padding: resolvePadding(block),
      margin: resolveMargin(block),
      "background-color": block.backgroundColor ?? undefined,
      ...resolveBorder(block.border),
    },
    block.customCss,
  );
  // In the marketing-footer band (dropEmptyText), the number of VISIBLE lines
  // varies at send time: the company line is hidden when its tokens resolve
  // empty (see isEffectivelyEmpty). To keep the band vertically symmetric in
  // BOTH cases, we render children first, drop the ones that came back empty,
  // and neutralize the trailing bottom margin so the last visible line sits
  // flush against the band's bottom padding — the band's own paddingY is then
  // the ONLY outer spacing, top and bottom, no matter which line is last.
  if (ctx.dropEmptyText) {
    const rendered = block.children
      .map((c) => renderSectionChild(c, ctx))
      .filter((html) => html.trim().length > 0);
    const inner = rendered
      .map((html, i) =>
        i === rendered.length - 1 ? stripTrailingBottomMargin(html) : html,
      )
      .join("\n");
    return [
      `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">`,
      `<tr><td${idAttr(block.id, ctx)}${classAttr} style="${cellStyle}">`,
      inner,
      `</td></tr></table>`,
    ].join("");
  }
  const inner = block.children
    .map((c) => renderSectionChild(c, ctx))
    .join("\n");
  return [
    `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">`,
    `<tr><td${idAttr(block.id, ctx)}${classAttr} style="${cellStyle}">`,
    inner,
    `</td></tr></table>`,
  ].join("");
}

// Force the bottom margin of a block's outermost element to 0 by rewriting its
// inline `style`. Used only for the LAST visible footer line so its own
// marginBottom never stacks on top of the band's bottom padding (which would
// make the footer look bottom-heavy). Operates on the first `style="..."` in
// the emitted HTML — the wrapper — and either rewrites an existing
// `margin`/`margin-bottom` shorthand's bottom component or appends
// `margin-bottom:0`.
function stripTrailingBottomMargin(html: string): string {
  return html.replace(/style="([^"]*)"/, (_m, style: string) => {
    let s: string = style;
    // Rewrite a `margin` shorthand so its BOTTOM component is 0. CSS shorthand:
    // 1 value = all sides; 2 = [top&bottom, left&right]; 3 = [top, l&r, bottom];
    // 4 = [top, right, bottom, left]. We expand to explicit 4-side with bottom 0.
    s = s.replace(/margin:\s*([^;]+);?/, (_mm: string, val: string) => {
      const p = val.trim().split(/\s+/);
      const [t, r, b, l] =
        p.length === 1
          ? [p[0], p[0], p[0], p[0]]
          : p.length === 2
            ? [p[0], p[1], p[0], p[1]]
            : p.length === 3
              ? [p[0], p[1], p[2], p[1]]
              : [p[0], p[1], p[2], p[3]];
      void b;
      return `margin:${t} ${r} 0 ${l};`;
    });
    s = s.replace(/margin-bottom:\s*[^;]+;?/, "margin-bottom:0;");
    if (!/margin-bottom:/.test(s) && !/margin:/.test(s)) s += ";margin-bottom:0";
    return `style="${s}"`;
  });
}

function renderColumn(block: ColumnBlock, ctx: RenderCtx): string {
  // `ee-col` lets the head <style> media query stack columns on mobile; it's
  // passed as extraClass so it coexists with any compiled className.
  const { style: cellStyle, classAttr } = composeStyle(
    ctx,
    block.className,
    {
      "background-color": block.backgroundColor ?? undefined,
      padding: resolvePadding(block),
      "vertical-align": "top",
      ...resolveBorder(block.border),
    },
    block.customCss,
    "ee-col",
  );
  const inner = block.children.map((c) => renderLeaf(c, ctx)).join("\n");
  // Empty columns still render their <td> so the row keeps its shape.
  return `<td${classAttr} width="${block.width}%" valign="top"${idAttr(block.id, ctx)} style="${cellStyle}">${inner || "&nbsp;"}</td>`;
}

function renderRow(block: RowBlock, ctx: RenderCtx): string {
  const { style: wrapStyle, classAttr } = composeStyle(
    ctx,
    block.className,
    {
      "background-color": block.backgroundColor ?? undefined,
      ...resolveBorder(block.border),
    },
    block.customCss,
  );
  const cellPad = inlineStyle({
    padding: resolvePadding(block),
  });
  // Table cells can't use CSS `gap`, so we insert fixed-width spacer <td>s
  // between columns to reproduce the canvas's columnGap in a cross-client way.
  // The spacer carries `ee-gap` so the mobile stacking rules can hide it.
  const gap = block.columnGap ?? 0;
  const spacer =
    gap > 0
      ? `<td class="ee-gap" style="width:${gap}px;font-size:1px;line-height:1px;" width="${gap}">&nbsp;</td>`
      : "";
  const cols = block.columns
    .map((c) => renderColumn(c, ctx))
    .join(spacer);
  // `ee-cols` marks a row whose columns should stack on narrow viewports (the
  // head <style> media query keys on it). Only applied when the author left
  // stackOnMobile on — so the inspector toggle actually controls stacking.
  const colsClass = block.stackOnMobile ? ` class="ee-cols"` : "";
  // Inner fixed table holds the columns; outer cell carries row padding/bg.
  // `table-layout:fixed` is CRITICAL for editor↔email parity: with auto layout
  // the percentage widths + the px gap spacer over-constrain the table
  // (50% + 16px + 50% > 100%) and browsers resolve it by silently shrinking
  // ONE column (e.g. 272px vs 256px on a 50/50 split). Fixed layout scales the
  // declared widths proportionally, keeping the split true to the canvas.
  return [
    `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"${idAttr(block.id, ctx)}${classAttr} style="${wrapStyle}">`,
    `<tr><td style="${cellPad}">`,
    `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"${colsClass} style="table-layout:fixed;"><tr>`,
    cols,
    `</tr></table>`,
    `</td></tr></table>`,
  ].join("");
}

function renderBlock(block: Block, ctx: RenderCtx): string {
  if (block.type === "section") return renderSection(block, ctx);
  if (block.type === "row") return renderRow(block, ctx);
  return renderLeaf(block, ctx);
}

// Dedupe hoisted Tailwind rules: identical className strings hash to the same
// generated selector and produce byte-identical rules, so a document that
// reuses `sm:hidden` across ten blocks emits the rule once.
function dedupeRules(rules: CssRule[]): CssRule[] {
  const seen = new Set<string>();
  const out: CssRule[] = [];
  for (const r of rules) {
    const sig = `${r.media ?? ""}|${r.selector}|${JSON.stringify(r.declarations)}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(r);
  }
  return out;
}

// Hidden preheader: the inbox preview snippet. We append zero-width spaces so
// clients don't pull following body text into the preview.
//
// The industry-standard "hidden preheader" pattern (every major ESP does
// this) necessarily hides real text via display:none — which is also the
// generic spam/phishing "hidden text" signal that content-risk.ts screens
// for. Carry a stable marker attribute so that scanner can recognize and
// exempt exactly this one element instead of flagging every template that
// sets a preview text (see content-risk.ts's stripKnownPreheader).
function previewSpan(previewText: string, vars: Vars): string {
  if (!previewText.trim()) return "";
  const text = renderText(previewText, vars);
  const style =
    "display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;";
  const filler = "&#847;&zwnj;&nbsp;".repeat(60);
  return `<div data-unitpost-preheader="true" style="${style}">${text}${filler}</div>`;
}

// Does this document need a marketing footer (unsubscribe + postal address)?
// Marketing email legally requires an unsubscribe mechanism (CAN-SPAM/GDPR);
// transactional does not. The managed compliance footer is ALWAYS appended to
// marketing sends — we no longer suppress it when the author happens to inline
// their own {{unsubscribe_url}}, so the workspace-controlled unsubscribe +
// postal address + "powered by" mark are guaranteed on every marketing email.
function needsUnsubscribeFooter(doc: EmailDocument): boolean {
  return doc.category === "marketing";
}

// The built-in default footer markup — the back-compat fallback used when a
// workspace has no stored MarketingFooter fragment yet. Kept as a hardcoded
// string (not a fragment) so render has zero new dependencies for old data.
// Tokens are interpolated against the footer vars (unsubscribe_url + branding)
// so this fallback ships a working link + a company line only when set.
function defaultFooterHtml(theme: Theme, vars: Vars): string {
  const address = interpolate("{{company_address}}", vars).trim();
  const addressLine =
    address && !/^\{\{/.test(address) ? `<br />${escapeHtml(address)}` : "";
  const unsubUrl = safeUrl(interpolate("{{unsubscribe_url}}", vars));
  return [
    `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding:24px;text-align:center;font-family:${theme.fontFamily};font-size:12px;color:#9ca3af;line-height:1.5;">`,
    `You are receiving this email because you opted in. `,
    `<a href="${escapeHtml(unsubUrl)}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>.`,
    addressLine,
    `</td></tr></table>`,
  ].join("");
}

// A prominent, logo-like "Powered by Unitpost" mark pinned at the very bottom of
// the email, on the OUTER backdrop BELOW the body card (a sibling row, not
// inside the paper). Rendered as a wordmark inside a subtle pill so it reads as
// a brand badge rather than fine print. Links to the marketing site. Suppressed
// only for paid workspaces that turned branding off.
function poweredByHtml(theme: Theme): string {
  return [
    `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:16px 24px 8px;font-family:${theme.fontFamily};">`,
    `<a href="https://www.unitpost.com?utm_source=email_footer&utm_medium=powered_by" style="display:inline-block;text-decoration:none;color:#71717a;font-size:11px;line-height:1;padding:6px 12px;border:1px solid #e4e4e7;border-radius:9999px;background-color:#fafafa;">`,
    `<span style="color:#a1a1aa;vertical-align:middle;">Powered by </span>`,
    // Logo mark as a hosted PNG (the app icon, which carries its own background
    // chip so it reads on any surface). SVG is stripped by Gmail/Outlook, so we
    // use a raster favicon at an absolute URL that resolves in every inbox.
    // vertical-align:middle keeps it centered against the text baseline; it sits
    // right before the wordmark.
    `<img src="https://www.unitpost.com/web-app-manifest-192x192.png" width="14" height="14" alt="" style="width:14px;height:14px;border-radius:3px;vertical-align:middle;margin-right:5px;" />`,
    `<span style="color:#18181b;font-weight:700;letter-spacing:0.02em;vertical-align:middle;">Unitpost</span>`,
    `</a>`,
    `</td></tr></table>`,
  ].join("");
}

// Whether a component fragment contains the mandatory unsubscribe link — i.e.
// any block references the {{unsubscribe_url}} token (typically a link block's
// href). Used to GUARANTEE the footer ships a working unsubscribe and to
// validate edits before save.
export function fragmentHasUnsubscribeLink(fragment: ComponentFragment): boolean {
  let found = false;
  const re = /\{\{\s*unsubscribe_url\s*\}\}/;
  const scan = (s: string | undefined) => {
    if (s && re.test(s)) found = true;
  };
  const scanLeaf = (b: LeafBlock) => {
    if ("text" in b) scan(b.text);
    if ((b.type === "text" || b.type === "heading") && b.content) {
      b.content.forEach((run) => {
        scan(run.text);
        scan(run.marks?.link);
      });
    }
    if (b.type === "markdown") scan(b.markdown);
    if (b.type === "code") scan(b.code);
    if (b.type === "button" || b.type === "link") scan(b.href);
    if (b.type === "image") {
      scan(b.src);
      scan(b.alt);
      scan(b.href);
    }
  };
  const scanNode = (b: Block | SectionChild) => {
    if (b.type === "section") b.children.forEach(scanNode);
    else if (b.type === "row")
      b.columns.forEach((col) => col.children.forEach(scanLeaf));
    else scanLeaf(b);
  };
  fragment.blocks.forEach(scanNode);
  return found;
}

// Render the full document to a complete, standalone HTML email.
export function renderToHtml(
  doc: EmailDocument,
  variables: Vars = {},
  options: RenderOptions = {},
): string {
  const theme = doc.theme;
  const ctx: RenderCtx = {
    theme,
    vars: variables,
    editor: options.editor ?? false,
    rules: [],
    assetBaseUrl: (options.assetBaseUrl ?? "").replace(/\/+$/, ""),
  };
  const body = doc.blocks.map((b) => renderBlock(b, ctx)).join("\n");

  const outerStyle = inlineStyle({
    margin: "0",
    padding: "0",
    width: "100%",
    "background-color": theme.backgroundColor,
    "font-family": theme.fontFamily,
  });
  // Document-level className applies to the body "paper" container. Compile it
  // through the same path so page-wide utilities (e.g. a custom max-width or
  // background) work and any responsive rules are hoisted with block rules.
  const containerCompiled = compileClasses(doc.className, theme);
  if (containerCompiled.rules.length) ctx.rules.push(...containerCompiled.rules);
  // Body padding now lives on the BODY row's <td> (not the container table), so
  // the managed footer can be a SEPARATE full-width row that ignores that
  // padding and attaches edge-to-edge at the bottom. The container carries the
  // width, background, and (new) corner radius. `overflow:hidden` clips the
  // footer's own background to the rounded bottom corners so a rounded body
  // yields a seamless rounded footer with no square background poking out.
  const hasRadius = theme.bodyRadius > 0;
  const containerStyle = withCustom(
    inlineStyle({
      ...containerCompiled.inline,
      width: `${theme.contentWidth}px`,
      "max-width": "100%",
      margin: "0 auto",
      "background-color": theme.bodyColor,
      // Collapse cell borders + zero spacing so adjacent rows (body → footer
      // band) butt together with NO seam. Gmail (esp. light mode) otherwise
      // rounds the table layout and paints a 1px light hairline at the top of
      // the dark footer band where the two <td> backgrounds meet. Belt-and-
      // suspenders with the cellspacing="0" attribute below.
      "border-collapse": "collapse",
      "border-spacing": "0",
      ...(hasRadius
        ? { "border-radius": `${theme.bodyRadius}px`, overflow: "hidden" }
        : {}),
    }),
    undefined,
  );
  // The container always carries the stable `ee-body` class so the responsive
  // media query below can target it (fluid width on narrow viewports). A
  // document-level className (if any) compiles to its own class alongside it.
  const containerClassAttr = ` class="${["ee-body", containerCompiled.className].filter(Boolean).join(" ")}"`;

  // Marketing footer: render the workspace's stored, customizable footer
  // fragment when provided (so edits propagate to every marketing email);
  // otherwise fall back to the built-in default. Only injected when the doc is
  // marketing and the author didn't already inline {{unsubscribe_url}}. The
  // footer goes through the same block pipeline as the body so it inherits the
  // theme and hoists any responsive rules.
  //
  // Footer tokens ({{unsubscribe_url}}, {{company_name}}, {{company_address}})
  // live only in the footer fragment, which the document-level variable scan
  // never sees — so we resolve the footer against `{ ...ctx.vars, ...footerVars }`
  // (footerVars carries the system/branding values the caller resolved) and set
  // `dropEmptyText` so a company line that resolved to nothing vanishes instead
  // of shipping a bare separator. The unsubscribe LINK is a link block, so it's
  // never dropped — it always ships (compliance).
  const footerCtx: RenderCtx = {
    ...ctx,
    // Default the company tokens to "" so an unset name/address collapses the
    // line to just its separator (caught by dropEmptyText) instead of shipping a
    // literal `{{company_name}}`. unsubscribe_url is intentionally NOT defaulted
    // to "" — a blank href would break the (never-dropped) unsubscribe link; a
    // caller that omits it is a bug we'd rather surface than silently blank.
    vars: {
      company_name: "",
      company_address: "",
      ...ctx.vars,
      ...(options.footerVars ?? {}),
    },
    dropEmptyText: true,
  };
  const footer = needsUnsubscribeFooter(doc)
    ? options.marketingFooter && options.marketingFooter.blocks.length > 0
      ? options.marketingFooter.blocks
          .map((b) => renderBlock(b, footerCtx))
          .join("\n")
      : defaultFooterHtml(theme, footerCtx.vars)
    : "";

  // "Powered by Unitpost" mark: a brand badge pinned at the very bottom of EVERY
  // email — marketing AND transactional — unless the caller (which resolved the
  // plan entitlement + stored preference) opted out. On marketing emails it sits
  // just below the compliance footer; on transactional it's the only appended
  // band, so it reads as a clean, bare pill under the body.
  const poweredBy =
    (options.showPoweredBy ?? true) ? poweredByHtml(theme) : "";

  // Mobile stacking for columns: only applied where supported (ignored by
  // Outlook, which keeps the table layout — acceptable degradation). In editor
  // mode we add a hover/selected outline so blocks are visibly clickable.
  // Compiled Tailwind responsive/pseudo rules (collected during body render)
  // are appended here so they live in one place and degrade safely in Outlook.
  const twRules = ctx.rules.length ? rulesToCss(dedupeRules(ctx.rules)) : "";
  const headStyle = [
    `<style>`,
    // Fluid body: below the template's own content width, drop the fixed pixel
    // width so the container fills the viewport instead of forcing a horizontal
    // scrollbar on narrow desktop clients and mobile. The inline `width:Npx`
    // stays for Outlook (which ignores media queries and needs the fixed width);
    // clients that DO honor media queries (Apple Mail, iOS, Gmail app, most
    // narrow desktop clients) get the fluid override. Breakpoint tracks
    // contentWidth so a 700px template goes fluid <700px, a 480px one <480px.
    `@media only screen and (max-width:${theme.contentWidth}px){`,
    `.ee-body{width:100% !important;}`,
    // The powered-by wrapper carries the same fixed inline width as the body
    // card (to align with it) and needs the same fluid override, or IT becomes
    // the element pinning the layout wider than a phone viewport.
    `.ee-pby-wrap{width:100% !important;}`,
    `}`,
    `@media only screen and (max-width:600px){`,
    // Stack columns: the whole column table (table + row + cells) must become
    // block-level — turning only the <td>s into blocks leaves them wrapped in
    // an anonymous table row, so they stay side-by-side. The gap spacer <td>
    // is hidden (it would otherwise render as a stray 1px strip between the
    // stacked columns). Scoped to `.ee-cols` so only rows that opted into
    // stackOnMobile reflow.
    `table.ee-cols, table.ee-cols > tbody, table.ee-cols > tbody > tr, table.ee-cols > tr{display:block !important;width:100% !important;}`,
    `table.ee-cols .ee-col{display:block !important;width:100% !important;box-sizing:border-box !important;}`,
    `table.ee-cols .ee-gap{display:none !important;}`,
    `}`,
    twRules,
    ctx.editor
      ? `[data-block-id]{cursor:pointer;} [data-block-id]:hover{outline:2px solid rgba(37,99,235,0.4);outline-offset:1px;} [data-block-id].ee-selected{outline:2px solid #2563eb !important;outline-offset:1px;}`
      : ``,
    `</style>`,
  ].join("");

  // Body row padding lives on the body <td> (moved off the container table) so
  // the managed footer row below can span the FULL card width, ignoring this
  // padding and attaching flush to the bottom edge. Default 24px when unset.
  const bodyTdStyle = inlineStyle({
    padding: resolveBodyPadding(theme) ?? "24px",
  });

  return [
    `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">`,
    `<html lang="en" xmlns="http://www.w3.org/1999/xhtml">`,
    `<head>`,
    `<meta charset="utf-8" />`,
    `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
    `<meta http-equiv="X-UA-Compatible" content="IE=edge" />`,
    // Declare color-scheme support so email clients know the template renders
    // fine in their dark mode; we don't ship dark-specific CSS, this just opts
    // in to the client's own handling.
    `<meta name="color-scheme" content="light dark" />`,
    `<meta name="supported-color-schemes" content="light dark" />`,
    `<title></title>`,
    headStyle,
    `</head>`,
    `<body style="${outerStyle}">`,
    previewSpan(doc.previewText, variables),
    `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:${theme.backgroundColor};">`,
    `<tr><td align="center" style="padding:24px 0;">`,
    // The body "paper": the max-width, background-colored card. Two rows:
    //   1. the body content, padded by the theme's body padding;
    //   2. the managed marketing/compliance footer, a SEPARATE full-width row
    //      with NO horizontal padding so it spans the whole card and attaches
    //      flush to the bottom edge (inheriting the card's rounded bottom corners
    //      via the container's overflow:hidden). Omitted for transactional / when
    //      no footer is needed — then the body row's own bottom padding remains.
    // The "Powered by Unitpost" brand mark is emitted AFTER this card in its own
    // row so it sits on the outer backdrop, below the body — not inside the paper.
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0"${containerClassAttr} style="${containerStyle}">`,
    `<tr><td style="${bodyTdStyle}">`,
    body,
    `</td></tr>`,
    footer ? `<tr><td style="padding:0;">${footer}</td></tr>` : "",
    `</table>`,
    // "Powered by Unitpost": a sibling row on the outer backdrop, centered under
    // the body card. Constrained to the same content width so it aligns with the
    // paper above it. Omitted entirely when the workspace opted out.
    // `ee-pby-wrap` matters: like `.ee-body`, the fixed inline width must be
    // relaxed by the fluid media query on narrow viewports — a percentage
    // max-width alone can't shrink a fixed-width table during intrinsic table
    // sizing, so without the class this row pins the whole email at contentWidth
    // and forces a horizontal scroll on phones.
    poweredBy
      ? [
          `<table role="presentation" border="0" cellpadding="0" cellspacing="0" class="ee-pby-wrap" style="width:${theme.contentWidth}px;max-width:100%;margin:0 auto;">`,
          `<tr><td>`,
          poweredBy,
          `</td></tr>`,
          `</table>`,
        ].join("")
      : "",
    `</td></tr>`,
    `</table>`,
    `</body>`,
    `</html>`,
  ].join("\n");
}

// Collect the set of {{variable}} names referenced anywhere in the document.
// Useful for the editor to show "available variables" + test-send forms.
//
// `extraTexts` scans additional send-level strings that live OUTSIDE the
// document — chiefly the campaign / single-send SUBJECT line, which references
// the same {{token}} space but isn't part of the EmailDocument. Passing it here
// means a subject-only variable enters the same missing-var report + resolution
// as body tokens, instead of shipping as a literal `{{token}}` in the subject.
export function collectVariables(
  doc: EmailDocument,
  extraTexts: (string | undefined)[] = [],
): string[] {
  const found = new Set<string>();
  const scan = (s: string | undefined) => {
    if (!s) return;
    const re = /\{\{\s*([\w.]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) found.add(m[1]);
  };
  const scanLeaf = (b: LeafBlock) => {
    if ("text" in b) scan(b.text);
    if ((b.type === "text" || b.type === "heading") && b.content) {
      b.content.forEach((run) => {
        scan(run.text);
        scan(run.marks?.link);
      });
    }
    if (b.type === "markdown") scan(b.markdown);
    if (b.type === "code") scan(b.code);
    // Raw-HTML blocks interpolate {{vars}} at render time (renderHtmlBlock),
    // so their tokens must join the referenced set — otherwise the send
    // pre-flight never resolves them and a literal {{token}} ships.
    if (b.type === "html") scan(b.html);
    if (b.type === "button" || b.type === "link") scan(b.href);
    if (b.type === "image") {
      scan(b.src);
      scan(b.alt);
      scan(b.href);
    }
  };
  // Also scan document-level fields (preview text can carry variables).
  scan(doc.previewText);
  const scanNode = (b: Block | SectionChild) => {
    if (b.type === "section") b.children.forEach(scanNode);
    else if (b.type === "row") {
      b.columns.forEach((col) => col.children.forEach(scanLeaf));
    } else scanLeaf(b);
  };
  doc.blocks.forEach(scanNode);
  extraTexts.forEach(scan);
  return [...found].sort();
}

// ---------------------------------------------------------------------------
// Variable enforcement.
//
// At send time, every variable REFERENCED in the document ({{token}}) must
// resolve to a value from an explicit caller-supplied `provided` map — this
// resolver is the TRANSACTIONAL path (no contact / no campaign fallback).
// Templates deliberately carry NO per-variable defaults; a referenced token
// with no `provided` value is REPORTED AS MISSING and the send must fail with
// a validation error. The
// marketing path (resolveVariablesWithContact) additionally consults the
// recipient's contact row + a per-campaign fill-only default; see below.
// ---------------------------------------------------------------------------
export type ResolvedVariables = {
  // The merged values ready to pass to renderToHtml.
  values: Record<string, string>;
  // Referenced variables that never resolved (block the send).
  missing: string[];
};

export function resolveVariables(
  doc: EmailDocument,
  provided: Record<string, string | number> = {},
  extraTexts: (string | undefined)[] = [],
): ResolvedVariables {
  const referenced = collectVariables(doc, extraTexts);
  const values: Record<string, string> = {};
  const missing: string[] = [];

  for (const name of referenced) {
    if (Object.prototype.hasOwnProperty.call(provided, name)) {
      values[name] = String(provided[name]);
    } else {
      missing.push(name);
    }
  }
  return { values, missing };
}

// ---------------------------------------------------------------------------
// Contact-aware resolution (the marketing / per-recipient personalization path).
//
// Extends resolveVariables with a per-recipient `contact` data source. Each
// declared variable with `source: "contact"` pulls its value from the
// recipient's contact record via `contactField` (a built-in field name or a
// custom properties key). The merge precedence — DECIDED, see MESSAGING_MODEL.md —
// is:
//
//   1. explicitly `provided` value (system tokens, branding, transactional
//      caller vars) — a hard OVERRIDE that always wins.
//   2. the recipient's contact field (for source === "contact"). Workspace-level
//      custom-field defaults are folded into `contact` upstream (see
//      contact-data.server.ts), so they act as a real per-recipient value.
//   3. `defaults` (campaign-level fallback) — FILL-ONLY: applies only where the
//      recipient has no contact value, so it never clobbers real per-contact
//      data. This is the campaign author's "default for everyone missing it",
//      set in the pre-send Validate report.
//   4. otherwise → missing (the caller MUST block the send; the engine records
//      the row as FAILED with the missing-variable message).
//
// Templates deliberately carry NO per-variable fallback: silent per-template
// defaults would let placeholder copy ship to real recipients without any UI
// surfacing (the bug that triggered this rule). Every missing value must be
// resolved by workspace/contact data or an explicit per-campaign choice.
//
// Splitting `provided` (override) from `defaults` (fill-only) is what lets a
// campaign set a blanket default for a variable WITHOUT overwriting the
// contacts who already supply a real value — see MESSAGING_MODEL.md §4.2.
//
// `contact` is a flat string map of the recipient's fields already flattened by
// the caller (e.g. { first_name, last_name, email, ...customProperties,
// unsubscribe_url }). Keeping it flat (not the Prisma row) means this stays
// dependency-free and the engine owns how a Contact maps to fields.
// ---------------------------------------------------------------------------

// A flattened, send-ready view of a recipient's contact data. Keys are the
// `contactField` names a variable can reference (built-ins + custom props +
// reserved system tokens like `unsubscribe_url`).
export type ContactData = Record<string, string | number | null | undefined>;

export function resolveVariablesWithContact(
  doc: EmailDocument,
  provided: Record<string, string | number> = {},
  contact: ContactData = {},
  defaults: Record<string, string | number> = {},
  // Extra send-level texts to include in the referenced-variable scan (e.g. the
  // campaign / single-send subject), so subject-only tokens are resolved and
  // reported as missing here instead of shipping literally in the subject.
  extraTexts: (string | undefined)[] = [],
): ResolvedVariables {
  const referenced = collectVariables(doc, extraTexts);
  // Index declarations so we know each token's source/contactField.
  const declared = new Map(doc.variables.map((v) => [v.name, v]));
  const values: Record<string, string> = {};
  const missing: string[] = [];

  for (const name of referenced) {
    // 1. Explicit provided value always wins (system tokens, branding,
    //    transactional caller override).
    if (Object.prototype.hasOwnProperty.call(provided, name)) {
      values[name] = String(provided[name]);
      continue;
    }
    const decl = declared.get(name);
    // 2. Contact source → pull from the recipient's flattened contact data
    //    (custom-field workspace defaults are already merged in upstream).
    if (decl?.source === "contact") {
      const field = decl.contactField ?? name;
      const raw = contact[field];
      if (raw !== undefined && raw !== null && String(raw) !== "") {
        values[name] = String(raw);
        continue;
      }
    }
    // 3. Fill-only default (campaign-level fallback). Applies only when the
    //    contact had no value — never clobbers real per-contact data.
    if (Object.prototype.hasOwnProperty.call(defaults, name)) {
      values[name] = String(defaults[name]);
      continue;
    }
    // 4. Unresolved. Templates carry no per-variable fallback anymore, so this
    //    is the terminal "missing" branch — the send must be blocked.
    missing.push(name);
  }
  return { values, missing };
}

// Does this document personalize per recipient? True if any REFERENCED variable
// is declared with `source: "contact"` (so each recipient renders differently
// and the send must fan out one message per contact rather than share a body).
// Also true when the marketing unsubscribe footer is needed, since the
// per-recipient {{unsubscribe_url}} is itself contact-scoped.
export function documentHasPerRecipientVariables(doc: EmailDocument): boolean {
  const referenced = new Set(collectVariables(doc));
  const contactScoped = doc.variables.some(
    (v) => v.source === "contact" && referenced.has(v.name),
  );
  if (contactScoped) return true;
  // Marketing footer injects a per-recipient {{unsubscribe_url}}.
  return needsUnsubscribeFooter(doc);
}

