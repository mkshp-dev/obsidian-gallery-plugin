/**
 * Mosaic patterns: a small grid of tiles, repeated down the gallery. Each tile is a rectangle of
 * cells that one image fills; cells no tile covers are blank and stay empty in the gallery.
 *
 * Patterns are drawn with the "Build custom mosaic" command and saved by name in the plugin
 * settings; a gallery uses one with `pattern: <name>`. The pattern repeats as often as the
 * gallery has images; images left over after the last full repeat go into rows of single cells,
 * so no image is hidden.
 */

/** One tile of a pattern, in cells (0-based) */
export interface MosaicSlot {
    col: number;
    row: number;
    colSpan: number;
    rowSpan: number;
}

export interface MosaicPattern {
    columns: number;
    rows: number;
    /** Tiles in the order images fill them (reading order of their top-left cells); uncovered cells are blank */
    slots: MosaicSlot[];
}

/** Where one image goes in the gallery's grid, in cells (0-based) */
export type MosaicPlacement = MosaicSlot;

export const MOSAIC_MAX_COLUMNS = 8;
export const MOSAIC_MAX_ROWS = 16;

const tile = (col: number, row: number, colSpan = 1, rowSpan = 1): MosaicSlot => ({ col, row, colSpan, rowSpan });

/**
 * The built-in pattern, 3 columns by 6 rows: a large tile on the left, a plain row, a large tile
 * on the right, a plain row.
 */
export const DEFAULT_MOSAIC_PATTERN: MosaicPattern = {
    columns: 3,
    rows: 6,
    slots: [
        tile(0, 0, 2, 2), tile(2, 0), tile(2, 1),
        tile(0, 2), tile(1, 2), tile(2, 2),
        tile(0, 3), tile(1, 3, 2, 2), tile(0, 4),
        tile(0, 5), tile(1, 5), tile(2, 5)
    ]
};

/** Used instead when cells would be too small for the pattern's columns (phones, narrow panes) */
export const NARROW_MOSAIC_PATTERN: MosaicPattern = {
    columns: 2,
    rows: 4,
    slots: [tile(0, 0, 2, 2), tile(0, 2), tile(1, 2), tile(0, 3), tile(1, 3)]
};

const isWhole = (value: unknown, min: number, max: number): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

/**
 * Why `value` isn't a usable pattern, or undefined when it is: the size is in range, every tile
 * is inside the grid, no two tiles overlap, and there is at least one tile. Used for patterns
 * read back from the settings file, which may have been edited by hand.
 */
export function patternProblem(value: unknown): string | undefined {
    if (typeof value !== 'object' || value === null) return 'not a pattern';
    const { columns, rows, slots } = value as Partial<Record<keyof MosaicPattern, unknown>>;
    if (!isWhole(columns, 1, MOSAIC_MAX_COLUMNS)) return `columns must be a whole number from 1 to ${MOSAIC_MAX_COLUMNS}`;
    if (!isWhole(rows, 1, MOSAIC_MAX_ROWS)) return `rows must be a whole number from 1 to ${MOSAIC_MAX_ROWS}`;
    if (!Array.isArray(slots) || slots.length === 0) return 'it has no tiles';
    const used = new Set<number>();
    for (const slot of slots as unknown[]) {
        const s = (typeof slot === 'object' && slot !== null ? slot : {}) as Partial<Record<keyof MosaicSlot, unknown>>;
        if (!isWhole(s.col, 0, columns - 1) || !isWhole(s.row, 0, rows - 1) ||
            !isWhole(s.colSpan, 1, columns - s.col) || !isWhole(s.rowSpan, 1, rows - s.row)) {
            return 'a tile is outside the grid';
        }
        for (let r = s.row; r < s.row + s.rowSpan; r++) {
            for (let c = s.col; c < s.col + s.colSpan; c++) {
                if (used.has(r * columns + c)) return 'two tiles overlap';
                used.add(r * columns + c);
            }
        }
    }
    return undefined;
}

/** The pattern's blank cells (covered by no tile), in reading order */
export function blankCells(pattern: MosaicPattern): { col: number; row: number }[] {
    const covered = new Set<number>();
    for (const s of pattern.slots) {
        for (let r = s.row; r < s.row + s.rowSpan; r++) for (let c = s.col; c < s.col + s.colSpan; c++) covered.add(r * pattern.columns + c);
    }
    const blanks: { col: number; row: number }[] = [];
    for (let r = 0; r < pattern.rows; r++) {
        for (let c = 0; c < pattern.columns; c++) if (!covered.has(r * pattern.columns + c)) blanks.push({ col: c, row: r });
    }
    return blanks;
}

/**
 * Where each of `count` images goes when `pattern` repeats down the grid. Images keep their order.
 * After the last full repeat, the longest run of the pattern's first tiles that fills whole rows
 * (around their blank cells) is used, and any images still left go into rows of single cells
 * (the last row may be short).
 */
export function placeMosaic(pattern: MosaicPattern, count: number): MosaicPlacement[] {
    const placements: MosaicPlacement[] = [];
    const perRepeat = pattern.slots.length;
    const repeats = Math.floor(count / perRepeat);

    for (let r = 0; r < repeats; r++) {
        for (const slot of pattern.slots) {
            placements.push({ ...slot, row: slot.row + r * pattern.rows });
        }
    }

    let row = repeats * pattern.rows;
    const left = count - repeats * perRepeat;
    const prefix = filledPrefix(pattern, left);
    for (let i = 0; i < prefix.count; i++) {
        const slot = pattern.slots[i];
        placements.push({ ...slot, row: slot.row + row });
    }
    row += prefix.rows;

    for (let i = 0; i < left - prefix.count; i++) {
        placements.push({ col: i % pattern.columns, row: row + Math.floor(i / pattern.columns), colSpan: 1, rowSpan: 1 });
    }
    return placements;
}

/** The most of the pattern's first tiles (up to `max`) that exactly fill its first rows, and how many rows */
function filledPrefix(pattern: MosaicPattern, max: number): { count: number; rows: number } {
    // Cells for images (not blank) in the first n rows
    const blanksByRow = new Array<number>(pattern.rows).fill(0);
    for (const blank of blankCells(pattern)) blanksByRow[blank.row]++;
    const openCells = (rows: number) => {
        let open = 0;
        for (let r = 0; r < rows; r++) open += pattern.columns - blanksByRow[r];
        return open;
    };

    for (let k = Math.min(max, pattern.slots.length); k > 0; k--) {
        let rows = 0;
        let area = 0;
        for (let i = 0; i < k; i++) {
            const slot = pattern.slots[i];
            rows = Math.max(rows, slot.row + slot.rowSpan);
            area += slot.colSpan * slot.rowSpan;
        }
        // Tiles never overlap, so covering as many cells as the rows have open means they fill them
        if (area === openCells(rows)) return { count: k, rows };
    }
    return { count: 0, rows: 0 };
}

/** Whether a tile is larger than one cell, so it should load a larger image */
export function isLargeTile(placement: MosaicPlacement): boolean {
    return placement.colSpan > 1 || placement.rowSpan > 1;
}

/**
 * A pattern made with the "Build custom mosaic" command, kept in the plugin settings. A gallery
 * uses it by name (`pattern: featured`).
 */
export interface SavedMosaicPattern extends MosaicPattern {
    name: string;
}

export const PATTERN_NAME_MAX = 40;

/** The saved pattern with this name; names match ignoring case and surrounding spaces */
export function findSavedPattern(name: string, saved: readonly SavedMosaicPattern[]): SavedMosaicPattern | undefined {
    const key = name.trim().toLowerCase();
    return saved.find(p => p.name.trim().toLowerCase() === key);
}

/**
 * Why `name` can't be used for a saved pattern, or undefined when it can. `current` is the name
 * of the pattern being edited, which may keep its own name.
 */
export function patternNameProblem(name: string, saved: readonly SavedMosaicPattern[], current?: string): string | undefined {
    const trimmed = name.trim();
    if (trimmed === '') return 'Give the pattern a name.';
    if (trimmed.length > PATTERN_NAME_MAX) return `Use at most ${PATTERN_NAME_MAX} characters.`;
    if (!/^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(trimmed)) return 'Use letters, digits, spaces, - and _, starting with a letter or digit.';
    const existing = findSavedPattern(trimmed, saved);
    if (existing && existing.name.trim().toLowerCase() !== current?.trim().toLowerCase()) {
        return `A pattern named "${existing.name}" already exists.`;
    }
    return undefined;
}

/**
 * The pattern a gallery's `view.pattern` names. No name means the built-in pattern; an unknown
 * name (or a saved pattern that is no longer valid) also gives the built-in pattern, with a
 * warning to show under the gallery.
 */
export function resolvePatternOption(name: string | undefined, saved: readonly SavedMosaicPattern[]): { pattern?: MosaicPattern; warning?: string } {
    if (name === undefined) return {};
    const found = findSavedPattern(name, saved);
    if (found && patternProblem(found) === undefined) {
        return { pattern: { columns: found.columns, rows: found.rows, slots: found.slots } };
    }
    return {
        warning: `The mosaic pattern "${name.trim()}" isn't saved in this vault, so the built-in pattern is used. Create it with the "Build custom mosaic" command.`
    };
}
