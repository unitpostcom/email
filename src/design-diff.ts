// What an edit took out of an email.
//
// An author (Ask Unit, an API caller) re-sends the WHOLE body on every design
// save. Editing one line, it sometimes re-writes the rest from memory and
// drops what it wasn't looking at: the icons of a feature row vanished when
// the user asked for an unrelated change (owner report 2026-10-26). The save
// route compares the stored design with the new one and reports what's gone,
// so the author can put it back before telling the user it's done.
//
// Counted, not diffed: images by their src (an icon, a logo, a photo is the
// thing a reader misses), buttons and top-level bands by number. Rewording,
// restyling and reordering are edits, not removals, and aren't reported.
// Pure; no I/O.

import type { Block, EmailDocument } from "./schema";

type Tally = { images: string[]; buttons: number; bands: number };

function tally(doc: EmailDocument): Tally {
  const out: Tally = { images: [], buttons: 0, bands: 0 };
  const walk = (blocks: readonly unknown[]) => {
    for (const raw of blocks) {
      const b = raw as Block & { children?: unknown[]; columns?: unknown[] };
      if (b.type === "image" && typeof b.src === "string" && b.src.trim()) out.images.push(b.src.trim());
      else if (b.type === "button") out.buttons += 1;
      if (b.children) walk(b.children);
      if (b.columns) walk(b.columns);
    }
  };
  walk(doc.blocks);
  out.bands = doc.blocks.filter((b) => b.type === "section" || b.type === "row").length;
  return out;
}

/** The last path segment of an image URL ("…/icons/rocket-soft.png" → "rocket-soft.png"). */
function shortSrc(src: string): string {
  const path = src.split(/[?#]/)[0]!;
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name || src;
}

/**
 * Plain lines naming what `next` lost from `prev`: images (each src, as often
 * as it went missing), buttons and top-level sections. [] when nothing was
 * removed, or when `prev` was empty (a first design removes nothing).
 */
export function designRemovals(prev: EmailDocument | null | undefined, next: EmailDocument): string[] {
  if (!prev || prev.blocks.length === 0) return [];
  const before = tally(prev);
  const after = tally(next);
  const lines: string[] = [];

  const left = new Map<string, number>();
  for (const src of after.images) left.set(src, (left.get(src) ?? 0) + 1);
  const gone: string[] = [];
  for (const src of before.images) {
    const n = left.get(src) ?? 0;
    if (n > 0) left.set(src, n - 1);
    else gone.push(src);
  }
  if (gone.length) {
    const names = [...new Set(gone.map(shortSrc))];
    lines.push(
      `${gone.length} image${gone.length === 1 ? "" : "s"} (${names.slice(0, 6).join(", ")}${names.length > 6 ? ", …" : ""})`,
    );
  }
  if (after.buttons < before.buttons) {
    lines.push(`${before.buttons - after.buttons} of ${before.buttons} button${before.buttons === 1 ? "" : "s"}`);
  }
  if (after.bands < before.bands) {
    lines.push(`${before.bands - after.bands} of ${before.bands} section${before.bands === 1 ? "" : "s"}`);
  }
  return lines;
}
