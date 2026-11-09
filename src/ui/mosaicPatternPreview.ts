import { MosaicPattern, blankCells, placeMosaic } from '../models/mosaicPattern';

/**
 * Draw a pattern as a small grid of tiles, repeated `repeats` times down the grid. Blank cells
 * show as dotted outlines. With `numbered`, each tile shows the position of the image that fills
 * it (1, 2, 3...).
 */
export function renderPatternPreview(parent: HTMLElement, pattern: MosaicPattern, options: { repeats?: number; numbered?: boolean } = {}): HTMLElement {
    const repeats = options.repeats ?? 1;
    const grid = parent.createDiv({ cls: 'gallery-mosaic-pattern-preview' });
    grid.style.setProperty('--gallery-mosaic-preview-columns', String(pattern.columns));
    grid.style.setProperty('--gallery-mosaic-preview-rows', String(pattern.rows * repeats));

    const blanks = blankCells(pattern);
    for (let r = 0; r < repeats; r++) {
        for (const blank of blanks) {
            const cell = grid.createDiv({ cls: 'gallery-mosaic-pattern-preview-blank' });
            cell.style.gridColumn = String(blank.col + 1);
            cell.style.gridRow = String(blank.row + r * pattern.rows + 1);
        }
    }

    placeMosaic(pattern, pattern.slots.length * repeats).forEach((place, i) => {
        const tile = grid.createDiv({ cls: 'gallery-mosaic-pattern-preview-tile' });
        tile.style.gridColumn = `${place.col + 1} / span ${place.colSpan}`;
        tile.style.gridRow = `${place.row + 1} / span ${place.rowSpan}`;
        // Later repeats are faded, so the pattern itself stands out
        if (i >= pattern.slots.length) tile.addClass('is-repeat');
        if (options.numbered) tile.setText(String(i + 1));
    });
    return grid;
}
