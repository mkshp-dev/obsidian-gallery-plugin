/**
 * Text helpers for burning galleries into a note: find each gallery's code block, name the
 * image it becomes, and swap the block for an embed of that image. Pure functions, so they can
 * be tested without Obsidian.
 */

export interface GalleryBlockLocation {
    /** Line of the opening fence */
    start: number;
    /** Line of the closing fence */
    end: number;
    /** What every line of the block starts with: indentation and blockquote/callout markers ("> ") */
    prefix: string;
}

const FENCE_OPEN = /^((?:[ \t]*>)*[ \t]*)(`{3,}|~{3,})[ \t]*obs-gallery\b.*$/;

/**
 * Every obs-gallery code block in a note, in order. A block inside a blockquote or callout is
 * found too; its lines keep the "> " prefix, which is stripped from the body.
 */
export function findGalleryBlocks(lines: string[]): Array<GalleryBlockLocation & { body: string }> {
    const blocks: Array<GalleryBlockLocation & { body: string }> = [];
    for (let i = 0; i < lines.length; i++) {
        const open = FENCE_OPEN.exec(lines[i]);
        if (!open) continue;
        const prefix = open[1];
        const fence = open[2];
        const strip = (line: string) => stripPrefix(line, prefix);
        let end = -1;
        for (let j = i + 1; j < lines.length; j++) {
            const inner = strip(lines[j]).trim();
            // Closed by the same fence character, at least as long as the opening one
            if (/^(`{3,}|~{3,})$/.test(inner) && inner[0] === fence[0] && inner.length >= fence.length) {
                end = j;
                break;
            }
        }
        // An unclosed block runs to the end of the note; it isn't touched
        if (end === -1) break;
        blocks.push({ start: i, end, prefix, body: lines.slice(i + 1, end).map(strip).join('\n') });
        i = end;
    }
    return blocks;
}

function stripPrefix(line: string, prefix: string): string {
    if (prefix && line.startsWith(prefix)) return line.slice(prefix.length);
    // A quoted block's lines may drop the trailing space ("> " vs ">")
    const trimmed = prefix.trimEnd();
    if (trimmed && line.startsWith(trimmed)) return line.slice(trimmed.length);
    return line;
}

/**
 * The block a rendered gallery came from: the one whose body is the gallery's source. When the
 * same gallery appears more than once, the one nearest `hintLine` (where Obsidian says the
 * rendered block starts, when it knows) wins. Undefined when no block matches.
 */
export function locateGalleryBlock(lines: string[], source: string, hintLine?: number): GalleryBlockLocation | undefined {
    const wanted = normalizeBody(source);
    const matches = findGalleryBlocks(lines).filter(block => normalizeBody(block.body) === wanted);
    if (matches.length === 0) return undefined;
    if (matches.length === 1 || hintLine === undefined) return matches[0];
    return matches.reduce((best, block) =>
        Math.abs(block.start - hintLine) < Math.abs(best.start - hintLine) ? block : best);
}

function normalizeBody(body: string): string {
    return body.split('\n').map(line => line.trimEnd()).join('\n').trim();
}

/** The note with the block's lines replaced by one line holding `embed` (keeping a callout's "> ") */
export function replaceGalleryBlock(lines: string[], block: GalleryBlockLocation, embed: string): string[] {
    const out = [...lines];
    out.splice(block.start, block.end - block.start + 1, block.prefix + embed);
    return out;
}

/** Characters file systems or Obsidian links don't allow in a file name */
const UNSAFE_NAME = /[\\/:*?"<>|#^[\]]/g;

/**
 * The burned image's file name: "<plugin> - <note> - <date-time>.webp", with " - <n>" (the
 * gallery's position in the note) when the note has more than one gallery.
 */
export function burnFileName(pluginName: string, noteTitle: string, timestamp: string, rank?: number): string {
    const clean = (text: string) => text.replace(UNSAFE_NAME, '').replace(/\s+/g, ' ').trim();
    const parts = [clean(pluginName), clean(noteTitle) || 'Untitled', clean(timestamp)];
    if (rank !== undefined) parts.push(String(rank));
    return `${parts.filter(Boolean).join(' - ')}.webp`;
}

/** Local date and time for file names: "2026-11-11 143005" (no colons, which file names can't hold) */
export function burnTimestamp(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
