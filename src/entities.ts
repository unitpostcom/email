// HTML character references in the TSX dialect (codec.ts).
//
// Real JSX decodes character references in text and in string attributes:
// `Continue &rarr;` renders an arrow. Our dialect is parsed by hand, and it
// only knew the five markup escapes, so a model writing `Book a call &rarr;`
// shipped a button that read "&rarr;" (owner report 2026-10-26). This is the
// decoder the parser uses for every text chunk and attribute value.
//
// One pass, left to right: `&amp;rarr;` is the literal text "&rarr;", never an
// arrow. A name we don't know stays as written. The table covers what email
// copy uses (punctuation, arrows, currency, symbols, accented Latin letters);
// it isn't the whole HTML5 list.

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  ensp: "\u2002",
  emsp: "\u2003",
  thinsp: "\u2009",
  zwnj: "\u200c",
  zwj: "\u200d",
  shy: "\u00ad",
  // punctuation
  ndash: "–",
  mdash: "—",
  hellip: "…",
  middot: "·",
  bull: "•",
  lsquo: "‘",
  rsquo: "’",
  sbquo: "‚",
  ldquo: "“",
  rdquo: "”",
  bdquo: "„",
  laquo: "«",
  raquo: "»",
  lsaquo: "‹",
  rsaquo: "›",
  prime: "′",
  Prime: "″",
  dagger: "†",
  Dagger: "‡",
  sect: "§",
  para: "¶",
  iexcl: "¡",
  iquest: "¿",
  // arrows
  larr: "←",
  rarr: "→",
  uarr: "↑",
  darr: "↓",
  harr: "↔",
  lArr: "⇐",
  rArr: "⇒",
  uArr: "⇑",
  dArr: "⇓",
  hArr: "⇔",
  crarr: "↵",
  // currency
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  curren: "¤",
  inr: "₹",
  // symbols and maths
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
  plusmn: "±",
  times: "×",
  divide: "÷",
  minus: "−",
  ne: "≠",
  le: "≤",
  ge: "≥",
  asymp: "≈",
  infin: "∞",
  permil: "‰",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  sup1: "¹",
  sup2: "²",
  sup3: "³",
  ordf: "ª",
  ordm: "º",
  micro: "µ",
  check: "✓",
  cross: "✗",
  star: "☆",
  starf: "★",
  hearts: "♥",
  spades: "♠",
  clubs: "♣",
  diams: "♦",
  loz: "◊",
  // letters without a composed form below
  szlig: "ß",
  aelig: "æ",
  AElig: "Æ",
  oelig: "œ",
  OElig: "Œ",
  oslash: "ø",
  Oslash: "Ø",
  eth: "ð",
  ETH: "Ð",
  thorn: "þ",
  THORN: "Þ",
};

// `eacute`, `Uuml`, `ntilde`, `ccedil`, … : a letter plus a combining mark,
// composed. Only names whose composition is one character count.
const MARKS: Record<string, string> = {
  acute: "\u0301",
  grave: "\u0300",
  circ: "\u0302",
  uml: "\u0308",
  tilde: "\u0303",
  ring: "\u030a",
  cedil: "\u0327",
  caron: "\u030c",
};

// Own entries only: a plain object also "has" constructor, toString, …
// (verifier on #1090: `&constructor;` decoded to a function's source).
const own = (key: string): string | undefined => (Object.hasOwn(NAMED, key) ? NAMED[key] : undefined);

function named(name: string): string | undefined {
  const direct = own(name) ?? own(name.toLowerCase());
  if (direct !== undefined) return direct;
  const m = /^([A-Za-z])(acute|grave|circ|uml|tilde|ring|cedil|caron)$/.exec(name);
  if (!m) return undefined;
  const composed = (m[1] + MARKS[m[2]!]).normalize("NFC");
  return composed.length === 1 ? composed : undefined;
}

function codePoint(raw: string, radix: 10 | 16): string | undefined {
  const point = Number.parseInt(raw, radix);
  return Number.isSafeInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : undefined;
}

const REFERENCE = /&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi;

/** Decode HTML character references in one pass; unknown ones stay as written. */
export function decodeCharacterReferences(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(REFERENCE, (whole, ref: string) => {
    if (ref[0] !== "#") return named(ref) ?? whole;
    const hex = ref[1] === "x" || ref[1] === "X";
    return codePoint(ref.slice(hex ? 2 : 1), hex ? 16 : 10) ?? whole;
  });
}

/**
 * Escape what decodeCharacterReferences would read as a reference, so text
 * that literally contains "&rarr;" prints as `&amp;rarr;` and parses back to
 * the same text. A bare `&` ("Terms & conditions") prints as is.
 */
export function escapeCharacterReferences(s: string): string {
  return s.replace(/&(?=#\d{1,7};|#x[0-9a-f]{1,6};|[a-z][a-z0-9]{1,31};)/gi, "&amp;");
}

/**
 * Text content of a TSX element (a Button label, a plain Text line): what
 * looks like a reference is escaped (above), and `<` / `>` too, since the
 * tokenizer would read `<` as a tag. Parsing decodes them back.
 */
export function escapeTsxText(s: string): string {
  return escapeCharacterReferences(s).replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * A double-quoted TSX attribute value: also `"` (it would end the value) and
 * `>` (the tokenizer ends a tag at the first one). Verifier on #1090: a
 * decoded `alt="Say &quot;hi&quot;"` printed raw and reparsed truncated.
 */
export function escapeTsxAttr(s: string): string {
  return escapeTsxText(s).replace(/"/g, "&quot;");
}
