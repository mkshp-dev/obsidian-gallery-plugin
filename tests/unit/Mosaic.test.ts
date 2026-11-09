import {
    DEFAULT_MOSAIC_PATTERN,
    NARROW_MOSAIC_PATTERN,
    MosaicPattern,
    patternProblem,
    placeMosaic
} from '../../src/models/mosaicPattern';
import { MosaicView } from '../../src/views/MosaicView';
import { LayoutTile } from '../../src/views/AspectLayoutView';
import { ViewFactory } from '../../src/views/ViewFactory';
import { ImageSource } from '../../src/models/ImageSource';
import { readViewOptions, viewOptionErrors } from '../../src/models/viewOptions';
import { usesThumbnailImages } from '../../src/models/viewTypes';
import { GalleryYamlGenerator } from '../../src/utils/GalleryYamlGenerator';

const tile = (col: number, row: number, colSpan = 1, rowSpan = 1) => ({ col, row, colSpan, rowSpan });

/** A large square on the left and two single cells on the right, 3 columns by 2 rows */
const hero: MosaicPattern = { columns: 3, rows: 2, slots: [tile(0, 0, 2, 2), tile(2, 0), tile(2, 1)] };

describe('patternProblem', () => {
    test('the built-in patterns are valid', () => {
        expect(patternProblem(DEFAULT_MOSAIC_PATTERN)).toBeUndefined();
        expect(patternProblem(NARROW_MOSAIC_PATTERN)).toBeUndefined();
        expect(DEFAULT_MOSAIC_PATTERN.slots).toHaveLength(12);
        expect(NARROW_MOSAIC_PATTERN.slots).toHaveLength(5);
    });

    test('blank cells are allowed', () => {
        expect(patternProblem({ columns: 3, rows: 1, slots: [tile(0, 0), tile(2, 0)] })).toBeUndefined();
    });

    test('rejects saved data that isn\'t a drawable pattern', () => {
        expect(patternProblem(null)).toBe('not a pattern');
        expect(patternProblem({ columns: 9, rows: 1, slots: [tile(0, 0)] })).toMatch(/columns/);
        expect(patternProblem({ columns: 2, rows: 17, slots: [tile(0, 0)] })).toMatch(/rows/);
        expect(patternProblem({ columns: 2, rows: 1, slots: [] })).toBe('it has no tiles');
        expect(patternProblem({ columns: 2, rows: 1, slots: [tile(1, 0, 2)] })).toBe('a tile is outside the grid');
        expect(patternProblem({ columns: 2, rows: 2, slots: [tile(0, 0, 2, 2), tile(1, 1)] })).toBe('two tiles overlap');
        expect(patternProblem({ columns: 2, rows: 1, slots: [{ col: '0', row: 0, colSpan: 1, rowSpan: 1 }] })).toBe('a tile is outside the grid');
    });
});

describe('placeMosaic', () => {

    test('repeats the pattern down the grid, keeping image order', () => {
        const placed = placeMosaic(hero, 6);
        expect(placed.map(p => p.row)).toEqual([0, 0, 1, 2, 2, 3]);
        expect(placed[3]).toEqual({ col: 0, row: 2, colSpan: 2, rowSpan: 2 });
    });

    test('puts images after the last full repeat into rows of single cells', () => {
        const placed = placeMosaic(hero, 8);
        expect(placed.slice(6)).toEqual([
            { col: 0, row: 4, colSpan: 1, rowSpan: 1 },
            { col: 1, row: 4, colSpan: 1, rowSpan: 1 }
        ]);
    });

    test('uses the start of the pattern for leftovers when it fills whole rows', () => {
        // 7 images on the built-in pattern: the first six tiles fill rows 0–2, the seventh starts a plain row
        const placed = placeMosaic(DEFAULT_MOSAIC_PATTERN, 7);
        expect(placed[0]).toEqual({ col: 0, row: 0, colSpan: 2, rowSpan: 2 });
        expect(placed.slice(3, 6).map(p => p.row)).toEqual([2, 2, 2]);
        expect(placed[6]).toEqual({ col: 0, row: 3, colSpan: 1, rowSpan: 1 });
    });

    test('a single image gets a single cell, not a large tile with holes beside it', () => {
        expect(placeMosaic(hero, 1)).toEqual([{ col: 0, row: 0, colSpan: 1, rowSpan: 1 }]);
        expect(placeMosaic(hero, 0)).toEqual([]);
    });

    test('blank cells stay empty, and leftovers use the pattern\'s start only when it fills its rows', () => {
        // Row 0 has a blank middle cell, row 1 is full: the first two tiles fill row 0 around it
        const gappy: MosaicPattern = { columns: 3, rows: 2, slots: [tile(0, 0), tile(2, 0), tile(0, 1), tile(1, 1), tile(2, 1)] };
        expect(placeMosaic(gappy, 5).map(p => [p.col, p.row])).toEqual([[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]]);
        expect(placeMosaic(gappy, 7).slice(5).map(p => [p.col, p.row])).toEqual([[0, 2], [2, 2]]);
        // One tile alone can't fill row 0, so it goes into a plain row
        expect(placeMosaic(gappy, 1)).toEqual([tile(0, 0)]);
        expect(placeMosaic(gappy, 6).slice(5)).toEqual([tile(0, 2)]);
    });

    test('never places two images on the same cell', () => {
        for (const count of [1, 5, 12, 13, 29]) {
            const cells = new Set<string>();
            for (const p of placeMosaic(DEFAULT_MOSAIC_PATTERN, count)) {
                for (let r = p.row; r < p.row + p.rowSpan; r++) {
                    for (let c = p.col; c < p.col + p.colSpan; c++) {
                        const key = `${r},${c}`;
                        expect(cells.has(key)).toBe(false);
                        cells.add(key);
                    }
                }
            }
        }
    });
});

describe('mosaic view options', () => {
    test('pattern (a saved pattern\'s name) and gap apply to mosaic', () => {
        expect(readViewOptions({ type: 'mosaic', pattern: 'featured', gap: 0 })).toEqual({
            type: 'mosaic',
            options: { pattern: 'featured', gap: 0 },
            warnings: []
        });
        const notAName = ['view.pattern must be the name of a pattern saved with the "Build custom mosaic" command'];
        expect(viewOptionErrors({ type: 'mosaic', pattern: ['A A'] })).toEqual(notAName);
        expect(viewOptionErrors({ type: 'mosaic', pattern: ' ' })).toEqual(notAName);
    });

    test('pattern is ignored with a note on other views', () => {
        expect(readViewOptions({ type: 'masonry', pattern: 'featured' }).warnings).toEqual([
            '"pattern" doesn\'t apply to the masonry view and is ignored (it applies to: mosaic).'
        ]);
    });

    test('mosaic tiles use thumbnails, and the factory creates the view', () => {
        expect(usesThumbnailImages('mosaic')).toBe(true);
        expect(new ViewFactory().createView('mosaic', document.createElement('div'))).toBeInstanceOf(MosaicView);
    });

    test('the builder writes the pattern quoted', () => {
        const yaml = GalleryYamlGenerator.generateYaml([{ type: 'local', path: 'Photos' }], 'mosaic', { pattern: 'Hero left', gap: 2 });
        expect(yaml).toContain('  type: mosaic\n  pattern: "Hero left"\n  gap: 2\n');
    });

    test('fit is crop or contain, for mosaic only', () => {
        expect(readViewOptions({ type: 'mosaic', fit: 'contain' }).options).toEqual({ fit: 'contain' });
        expect(viewOptionErrors({ type: 'mosaic', fit: 'cover' })).toEqual(['view.fit must be "crop" or "contain"']);
        expect(readViewOptions({ type: 'masonry', fit: 'contain' }).warnings).toEqual([
            '"fit" doesn\'t apply to the masonry view and is ignored (it applies to: mosaic).'
        ]);
        const yaml = GalleryYamlGenerator.generateYaml([{ type: 'local', path: 'Photos' }], 'mosaic', { pattern: 'Hero left', fit: 'contain' });
        expect(yaml).toContain('  pattern: "Hero left"\n  fit: contain\n');
    });
});

describe('MosaicView', () => {
    /** Layout roots report this width; jsdom has no layout, so clientWidth is otherwise 0 */
    let layoutWidth = 0;
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

    beforeAll(() => {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
            configurable: true,
            get(this: HTMLElement) {
                return this.classList.contains('gallery-mosaic-layout') ? layoutWidth : 0;
            }
        });
    });

    afterAll(() => {
        if (clientWidthDescriptor) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidthDescriptor);
    });

    beforeEach(() => {
        document.body.innerHTML = '';
        layoutWidth = 0;
    });

    function createContainer(): HTMLElement {
        const el = document.createElement('div') as HTMLElement & { empty?: () => void };
        el.empty = () => { while (el.firstChild) el.removeChild(el.firstChild); };
        document.body.appendChild(el);
        return el;
    }

    const images = (count: number) =>
        Array.from({ length: count }, (_, i) => new ImageSource(`photos/${i}.jpg`, 'local', `img${i}`, `app://${i}.jpg`));

    const tiles = (view: MosaicView) => Array.from(view.container.querySelectorAll<HTMLElement>('.gallery-mosaic-tile'));

    test('places tiles on the grid with square cells, in image order', () => {
        // 3 columns with 4px gaps: (608 - 8) / 3 = 200px cells
        layoutWidth = 608;
        const view = new MosaicView(createContainer());
        view.setOptions({ showCaptions: false });
        view.update(images(4));

        const root = view.container.querySelector<HTMLElement>('.gallery-mosaic-layout')!;
        expect(root.style.getPropertyValue('--gallery-mosaic-columns')).toBe('3');
        expect(root.style.getPropertyValue('--gallery-mosaic-cell')).toBe('200px');

        const placed = tiles(view);
        expect(placed.map(t => t.querySelector('img')!.getAttribute('alt'))).toEqual(['img0', 'img1', 'img2', 'img3']);
        expect(placed[0].style.gridColumn).toBe('1 / span 2');
        expect(placed[0].style.gridRow).toBe('1 / span 2');
        expect(placed[0].classList.contains('is-large')).toBe(true);
        expect(placed[3].style.gridRow).toBe('3 / span 1');
        expect(placed[3].classList.contains('is-large')).toBe(false);
    });

    test('uses the block\'s pattern, leaving blank cells empty', () => {
        layoutWidth = 1000;
        const view = new MosaicView(createContainer());
        // One cell, a blank cell, then a two-cell tile
        view.setOptions({ pattern: { columns: 4, rows: 1, slots: [tile(0, 0), tile(2, 0, 2)] } });
        view.update(images(2));

        expect(view.container.querySelector<HTMLElement>('.gallery-mosaic-layout')!.style.getPropertyValue('--gallery-mosaic-columns')).toBe('4');
        expect(tiles(view).map(t => t.style.gridColumn)).toEqual(['1 / span 1', '3 / span 2']);
    });

    test('switches to the two-column pattern when cells would be too small', () => {
        // 3 columns at 250px leave 80px cells (under 90px); a phone's ~330px still fits 3 columns
        expect(MosaicView.fitPattern(DEFAULT_MOSAIC_PATTERN, 250, 4)).toEqual({ pattern: NARROW_MOSAIC_PATTERN, cell: 123 });
        expect(MosaicView.fitPattern(DEFAULT_MOSAIC_PATTERN, 330, 4).pattern).toBe(DEFAULT_MOSAIC_PATTERN);
        // Before the gallery has a width, the pattern is kept with a fallback cell size
        expect(MosaicView.fitPattern(DEFAULT_MOSAIC_PATTERN, 0, 4)).toEqual({ pattern: DEFAULT_MOSAIC_PATTERN, cell: 160 });
    });

    test('large tiles load the larger version of a remote image, small ones the thumbnail', async () => {
        layoutWidth = 608;
        const view = new MosaicView(createContainer());
        const remote = Array.from({ length: 2 }, (_, i) => {
            const image = new ImageSource(`immich://c/search/asset/${i}`, 'immich', `img${i}`, undefined, undefined, () => Promise.resolve(`blob:thumb${i}`));
            image.setLargeLoader(() => Promise.resolve(`blob:preview${i}`));
            return image;
        });
        view.update(remote);

        const internals = view as unknown as { tiles: LayoutTile[]; resolveTileUrl(tile: LayoutTile): Promise<string> };
        // With two images the large tile can't fill whole rows, so both get single cells
        await expect(internals.resolveTileUrl(internals.tiles[0])).resolves.toBe('blob:thumb0');

        view.update([...remote, ...images(1)]);
        await expect(internals.resolveTileUrl(internals.tiles[0])).resolves.toBe('blob:preview0');
        await expect(internals.resolveTileUrl(internals.tiles[1])).resolves.toBe('blob:thumb1');
    });

    test('fits SVGs instead of cropping them', () => {
        layoutWidth = 608;
        const view = new MosaicView(createContainer());
        view.update([new ImageSource('art/logo.svg', 'local', 'logo', 'app://logo.svg'), ...images(1)]);
        expect(tiles(view).map(t => t.classList.contains('is-svg'))).toEqual([true, false]);
    });

    test('pages hold whole repeats of the pattern: itemsPerPage is rounded to the nearest multiple', () => {
        expect(MosaicView.wholeRepeats(9, 12)).toBe(12);
        expect(MosaicView.wholeRepeats(1, 12)).toBe(12);
        expect(MosaicView.wholeRepeats(24, 12)).toBe(24);
        expect(MosaicView.wholeRepeats(30, 12)).toBe(36);
        expect(MosaicView.wholeRepeats(29, 12)).toBe(24);
        expect(MosaicView.wholeRepeats(10, 3)).toBe(9);

        layoutWidth = 608;
        const view = new MosaicView(createContainer());
        view.setOptions({ pagination: true, itemsPerPage: 9 });
        view.update(images(30));
        // The built-in pattern has 12 tiles, so 9 per page becomes 12: pages of 12, 12 and 6
        expect(tiles(view)).toHaveLength(12);
        expect(view.container.querySelector('.gallery-pagination')!.textContent).toContain('Page 1 of 3');

        // A saved pattern of 3 tiles: 9 per page is three whole repeats
        view.setOptions({ pattern: hero, pagination: true, itemsPerPage: 9 });
        view.render();
        expect(tiles(view)).toHaveLength(9);
        expect(view.container.querySelector('.gallery-pagination')!.textContent).toContain('Page 1 of 4');
    });

    test('fit: contain marks the layout, and each loaded image becomes its tile\'s blurred backdrop', () => {
        layoutWidth = 608;
        const view = new MosaicView(createContainer());
        view.update(images(2));
        const root = () => view.container.querySelector<HTMLElement>('.gallery-mosaic-layout')!;
        expect(root().classList.contains('is-contain')).toBe(false);

        view.setOptions({ fit: 'contain' });
        view.render();
        expect(root().classList.contains('is-contain')).toBe(true);

        const img = tiles(view)[0].querySelector('img')!;
        img.src = 'app://a "quoted".jpg';
        img.dispatchEvent(new Event('load'));
        // Quotes in the URL are escaped, so they can't end the url("...") early
        expect(tiles(view)[0].style.getPropertyValue('--gallery-mosaic-backdrop')).toBe('url("app://a \\"quoted\\".jpg")');

        // Leaving fit out again (the block no longer sets it) goes back to cropping
        view.setOptions({ fit: undefined });
        view.render();
        expect(root().classList.contains('is-contain')).toBe(false);
    });
});
