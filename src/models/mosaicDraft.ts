import { MOSAIC_MAX_COLUMNS, MOSAIC_MAX_ROWS, MosaicPattern, MosaicSlot } from './mosaicPattern';

/** Tile id of a blank cell */
const BLANK = -1;

/**
 * A mosaic pattern being edited in the "Build custom mosaic" modal. Every cell is blank or belongs
 * to one tile, and every tile is a rectangle; the edits below keep that true, so a draft always
 * makes a valid pattern once it has at least one tile.
 */
export class MosaicDraft {
    private constructor(
        public columns: number,
        public rows: number,
        /** Tile id of each cell (BLANK for a blank cell), row by row */
        private cells: number[],
        private nextId: number
    ) {}

    /** A grid where every cell is its own tile */
    static blank(columns: number, rows: number): MosaicDraft {
        const cells = Array.from({ length: columns * rows }, (_, i) => i);
        return new MosaicDraft(columns, rows, cells, cells.length);
    }

    static fromPattern(pattern: MosaicPattern): MosaicDraft {
        const cells = new Array<number>(pattern.columns * pattern.rows).fill(BLANK);
        pattern.slots.forEach((slot, id) => {
            for (let r = slot.row; r < slot.row + slot.rowSpan; r++) {
                for (let c = slot.col; c < slot.col + slot.colSpan; c++) cells[r * pattern.columns + c] = id;
            }
        });
        return new MosaicDraft(pattern.columns, pattern.rows, cells, pattern.slots.length);
    }

    private tileAt(col: number, row: number): number {
        return this.cells[row * this.columns + col];
    }

    isBlank(col: number, row: number): boolean {
        return this.tileAt(col, row) === BLANK;
    }

    /** The tile covering a cell, in cells, or null for a blank cell */
    slotAt(col: number, row: number): MosaicSlot | null {
        const id = this.tileAt(col, row);
        return id === BLANK ? null : this.slotOf(id);
    }

    private slotOf(id: number): MosaicSlot {
        let minCol = Infinity, minRow = Infinity, maxCol = -1, maxRow = -1;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.columns; c++) {
                if (this.tileAt(c, r) !== id) continue;
                minCol = Math.min(minCol, c); maxCol = Math.max(maxCol, c);
                minRow = Math.min(minRow, r); maxRow = Math.max(maxRow, r);
            }
        }
        return { col: minCol, row: minRow, colSpan: maxCol - minCol + 1, rowSpan: maxRow - minRow + 1 };
    }

    /** Tile ids in the order images fill them: each tile's first cell, reading row by row */
    private orderedIds(): number[] {
        const seen = new Set<number>();
        for (const id of this.cells) if (id !== BLANK) seen.add(id);
        return [...seen];
    }

    /** The tiles in the order images fill them */
    get slots(): MosaicSlot[] {
        return this.orderedIds().map(id => this.slotOf(id));
    }

    get tileCount(): number {
        return this.orderedIds().length;
    }

    /** The cells from (col1, row1) to (col2, row2), corners in any order, clamped to the grid */
    private rect(col1: number, row1: number, col2: number, row2: number) {
        const left = Math.max(0, Math.min(col1, col2)), right = Math.min(this.columns - 1, Math.max(col1, col2));
        const top = Math.max(0, Math.min(row1, row2)), bottom = Math.min(this.rows - 1, Math.max(row1, row2));
        return { left, right, top, bottom, inside: (c: number, r: number) => c >= left && c <= right && r >= top && r <= bottom };
    }

    /**
     * Give every cell in a rectangle `id`. A tile that only partly overlaps the rectangle would no
     * longer be a rectangle, so its other cells become single cells.
     */
    private fill(col1: number, row1: number, col2: number, row2: number, id: (c: number, r: number) => number): void {
        const area = this.rect(col1, row1, col2, row2);
        const touched = new Set<number>();
        for (let r = area.top; r <= area.bottom; r++) for (let c = area.left; c <= area.right; c++) touched.add(this.tileAt(c, r));
        touched.delete(BLANK);

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.columns; c++) {
                const i = r * this.columns + c;
                if (area.inside(c, r)) this.cells[i] = id(c, r);
                else if (touched.has(this.cells[i])) this.cells[i] = this.nextId++;
            }
        }
    }

    /**
     * Make the cells from (col1, row1) to (col2, row2), corners in any order, one tile (blank
     * cells among them included). Merging a single cell makes a blank cell a tile again.
     */
    merge(col1: number, row1: number, col2: number, row2: number): void {
        if (col1 === col2 && row1 === row2) {
            if (this.isBlank(col1, row1)) this.cells[row1 * this.columns + col1] = this.nextId++;
            return;
        }
        const merged = this.nextId++;
        this.fill(col1, row1, col2, row2, () => merged);
    }

    /** Make the cells in a rectangle blank, or (with `blank` false) turn its blank cells into single tiles */
    setBlank(col1: number, row1: number, col2: number, row2: number, blank: boolean): void {
        if (blank) {
            this.fill(col1, row1, col2, row2, () => BLANK);
            return;
        }
        const area = this.rect(col1, row1, col2, row2);
        for (let r = area.top; r <= area.bottom; r++) {
            for (let c = area.left; c <= area.right; c++) {
                if (this.isBlank(c, r)) this.cells[r * this.columns + c] = this.nextId++;
            }
        }
    }

    /** Split the tile covering a cell into single cells */
    split(col: number, row: number): void {
        const id = this.tileAt(col, row);
        if (id === BLANK) return;
        let first = true;
        for (let i = 0; i < this.cells.length; i++) {
            if (this.cells[i] !== id) continue;
            // The first cell keeps the id, so the tile keeps its place in the fill order
            if (!first) this.cells[i] = this.nextId++;
            first = false;
        }
    }

    /**
     * Change the grid's size. Tiles and blank cells keep their cells that are still inside the grid
     * (a rectangle cut by the new edge is still a rectangle), and new cells are single tiles.
     */
    resize(columns: number, rows: number): void {
        columns = Math.max(1, Math.min(MOSAIC_MAX_COLUMNS, Math.round(columns)));
        rows = Math.max(1, Math.min(MOSAIC_MAX_ROWS, Math.round(rows)));
        const cells: number[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                cells.push(c < this.columns && r < this.rows ? this.tileAt(c, r) : this.nextId++);
            }
        }
        this.columns = columns;
        this.rows = rows;
        this.cells = cells;
    }

    /** Why the draft can't be saved, or undefined when it can */
    problem(): string | undefined {
        return this.tileCount === 0 ? 'Leave at least one cell for an image.' : undefined;
    }

    toPattern(): MosaicPattern {
        return { columns: this.columns, rows: this.rows, slots: this.slots };
    }
}
