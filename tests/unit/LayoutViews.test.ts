import { MasonryView } from '../../src/views/MasonryView';
import { JustifiedView } from '../../src/views/JustifiedView';
import { LayoutTile } from '../../src/views/AspectLayoutView';
import { ViewFactory } from '../../src/views/ViewFactory';
import { ImageSource } from '../../src/models/ImageSource';
import { normalizeViewType, resolveViewType, usesThumbnailImages } from '../../src/models/viewTypes';
import { extractImmichDimensions } from '../../src/resolvers/ImmichSourceResolver';

/** Layout roots report this width; jsdom has no layout, so clientWidth is otherwise 0 */
let layoutWidth = 0;
const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get(this: HTMLElement) {
            return /gallery-(masonry|justified)-layout/.test(this.className) ? layoutWidth : 0;
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

/** A local image with known dimensions */
function sizedImage(name: string, width: number, height: number): ImageSource {
    const image = new ImageSource(`photos/${name}.jpg`, 'local', name, `app://${name}.jpg`);
    image.dimensions = { width, height };
    return image;
}

const tileNames = (parent: Element) =>
    Array.from(parent.querySelectorAll('.gallery-tile img')).map(el => el.getAttribute('alt'));

describe('view types', () => {
    test('grid is an alias for masonry', () => {
        expect(normalizeViewType('grid')).toBe('masonry');
        expect(normalizeViewType('justified')).toBe('justified');
        expect(normalizeViewType('slideshow')).toBeUndefined();
        expect(resolveViewType({ type: 'grid' })).toBe('masonry');
        expect(resolveViewType(undefined)).toBe('thumbnail');
    });

    test('tile views use thumbnails, carousel and embed do not', () => {
        expect(['thumbnail', 'masonry', 'justified', 'grid'].every(usesThumbnailImages)).toBe(true);
        expect(['carousel', 'embed', undefined].some(usesThumbnailImages)).toBe(false);
    });

    test('ViewFactory creates masonry for grid and supports justified', () => {
        const factory = new ViewFactory();
        expect(factory.createView('grid', createContainer())).toBeInstanceOf(MasonryView);
        expect(factory.createView('justified', createContainer())).toBeInstanceOf(JustifiedView);
    });
});

describe('MasonryView', () => {
    test('places each tile in the shortest column, keeping reading order across the top', () => {
        // 700px content (padding is 0 without the stylesheet) fits 3 columns of >= 220px with 8px gaps
        layoutWidth = 700;
        const view = new MasonryView(createContainer());
        view.setOptions({ showCaptions: false });
        view.update([
            sizedImage('tall', 1000, 3000),
            sizedImage('wide1', 3000, 1000),
            sizedImage('wide2', 3000, 1000),
            sizedImage('wide3', 3000, 1000),
            sizedImage('wide4', 3000, 1000)
        ]);

        const columns = Array.from(view.container.querySelectorAll('.gallery-masonry-column'));
        expect(columns).toHaveLength(3);
        // The first row goes left to right; then the two short columns fill up before the tall one
        expect(columns.map(tileNames)).toEqual([['tall'], ['wide1', 'wide3'], ['wide2', 'wide4']]);
    });

    test('uses a single column when the width is unknown', () => {
        const view = new MasonryView(createContainer());
        view.update([sizedImage('a', 100, 100), sizedImage('b', 100, 100)]);

        const columns = view.container.querySelectorAll('.gallery-masonry-column');
        expect(columns).toHaveLength(1);
        expect(tileNames(columns[0])).toEqual(['a', 'b']);
    });

    test('sizes each tile from its ratio before the image loads', () => {
        const view = new MasonryView(createContainer());
        view.update([sizedImage('portrait', 600, 900), new ImageSource('photos/unknown.jpg', 'local', 'unknown', 'app://u.jpg')]);

        const tiles = Array.from(view.container.querySelectorAll<HTMLElement>('.gallery-tile'));
        expect(Number(tiles[0].style.getPropertyValue('--gallery-tile-ratio'))).toBeCloseTo(600 / 900);
        // Unknown size: a 3:2 placeholder until it loads
        expect(Number(tiles[1].style.getPropertyValue('--gallery-tile-ratio'))).toBeCloseTo(1.5);
    });
});

describe('JustifiedView', () => {
    const tile = (ratio: number, name = String(ratio)): LayoutTile =>
        ({ ratio, el: document.createElement('div'), image: { displayName: name } } as unknown as LayoutTile);

    test('full rows fill the width exactly at a height near the target', () => {
        const tiles = [1.5, 1.5, 0.75, 1.5, 1.5, 1, 1.5, 1.5].map(r => tile(r));
        const rows = JustifiedView.buildRows(tiles, 1000, 220, 4);

        for (const row of rows.filter(r => r.justified)) {
            const width = row.tiles.reduce((sum, t) => sum + t.ratio * row.height, 0) + 4 * (row.tiles.length - 1);
            expect(width).toBeCloseTo(1000);
            expect(row.height).toBeGreaterThan(220 * 0.6);
            expect(row.height).toBeLessThan(220 * 1.6);
        }
        expect(rows.flatMap(r => r.tiles)).toEqual(tiles);
    });

    test('a short last row takes the height of the row above instead of stretching', () => {
        const rows = JustifiedView.buildRows([tile(1.5), tile(1.5), tile(1.5), tile(1.5), tile(1)], 1000, 220, 4);
        const last = rows[rows.length - 1];
        expect(last.justified).toBe(false);
        expect(last.height).toBe(rows[0].height);
        expect(rows[0].height).toBeCloseTo(220.44);
    });

    test('equal images come out the same size in every row, even when rows end taller than the target (#223)', () => {
        // Six portrait cards on a ~350px phone: the target is capped to 140px, three cards fill a
        // row at ~152px, and the last row used to drop back to 140px and look smaller
        const width = 350;
        const target = JustifiedView.targetRowHeight(220, width);
        const rows = JustifiedView.buildRows(Array.from({ length: 6 }, (_, i) => tile(0.75, String(i))), width, target, 4);
        expect(rows.map(r => r.tiles.length)).toEqual([3, 3]);
        expect(rows[0].height).toBeGreaterThan(target);
        expect(rows[1].height).toBeCloseTo(rows[0].height);
        expect(rows[1].justified).toBe(true);
    });

    test('a short last row shrinks to fit when the height of the row above would make it too wide', () => {
        // The first row closes below the target, at ~212.5px; the last row's two wide images at that
        // height would be slightly wider than 1000px, so they fill the width at ~211.9px instead
        const rows = JustifiedView.buildRows([2, 2, 0.25, 0.4, 2.5, 2.2].map(r => tile(r)), 1000, 220, 4);
        expect(rows.map(r => r.tiles.length)).toEqual([4, 2]);
        expect(rows[0].height).toBeCloseTo(212.5, 1);
        const last = rows[1];
        expect(last.justified).toBe(true);
        expect(last.height).toBeLessThan(rows[0].height);
        const lastWidth = last.tiles.reduce((sum, t) => sum + t.ratio * last.height, 0) + 4 * (last.tiles.length - 1);
        expect(lastWidth).toBeCloseTo(1000);
    });

    test('a panorama too wide for the target height gets a row of its own', () => {
        const rows = JustifiedView.buildRows([tile(1.5, 'a'), tile(10, 'pano'), tile(1.5, 'b')], 1000, 220, 4);
        expect(rows.map(r => r.tiles.length)).toEqual([1, 1, 1]);
        expect(rows[1].height).toBeCloseTo(100);
        // The image before the panorama is not stretched to the full width
        expect(rows[0]).toMatchObject({ justified: false, height: 220 });
    });

    test('scales the target row height down on narrow galleries', () => {
        expect(JustifiedView.targetRowHeight(240, 1000)).toBe(240);
        expect(JustifiedView.targetRowHeight(240, 330)).toBeCloseTo(132);

        // A 330px phone-width gallery of 3:2 photos at rowHeight 240 packs two per row, not one
        const tiles = Array.from({ length: 6 }, (_, i) => tile(1.5, String(i)));
        const rows = JustifiedView.buildRows(tiles, 330, JustifiedView.targetRowHeight(240, 330), 4);
        expect(rows.every(r => r.tiles.length >= 2)).toBe(true);
    });

    test('renders rows and relays out once an image turns out to have another ratio', () => {
        layoutWidth = 1000;
        const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(0); return 1; });
        try {
            const view = new JustifiedView(createContainer());
            const unknown = Array.from({ length: 6 }, (_, i) => new ImageSource(`photos/${i}.jpg`, 'local', `img${i}`, `app://${i}.jpg`));
            view.update(unknown);

            // Six assumed 3:2 images: three fill a 1000px row at ~220px, then three more
            const rowCounts = () => Array.from(view.container.querySelectorAll('.gallery-justified-row')).map(r => r.children.length);
            expect(rowCounts()).toEqual([3, 3]);

            // The first image is actually a tall portrait, so the first row takes one more image
            const img = view.container.querySelector('img')!;
            Object.defineProperty(img, 'naturalWidth', { value: 500, configurable: true });
            Object.defineProperty(img, 'naturalHeight', { value: 1000, configurable: true });
            img.dispatchEvent(new Event('load'));

            expect(rowCounts()).toEqual([4, 2]);
            const firstTile = view.container.querySelector<HTMLElement>('.gallery-tile')!;
            expect(firstTile.style.getPropertyValue('--gallery-tile-grow')).toBe('0.5');
        } finally {
            raf.mockRestore();
        }
    });

    test('leaves tiles unplaced until the gallery has a width', () => {
        const view = new JustifiedView(createContainer());
        view.update([sizedImage('a', 300, 200)]);

        expect(view.container.querySelectorAll('.gallery-justified-row')).toHaveLength(0);
        expect(view.container.querySelectorAll('.gallery-tile')).toHaveLength(1);
    });
});

describe('extractImmichDimensions', () => {
    test('prefers the asset size, then EXIF', () => {
        expect(extractImmichDimensions({ id: 'a', width: 4000, height: 3000 })).toEqual({ width: 4000, height: 3000 });
        expect(extractImmichDimensions({ id: 'a', exifInfo: { exifImageWidth: 4000, exifImageHeight: 3000 } })).toEqual({ width: 4000, height: 3000 });
        expect(extractImmichDimensions({ id: 'a' })).toBeUndefined();
    });

    test('swaps EXIF sizes for rotated orientations', () => {
        expect(extractImmichDimensions({ id: 'a', exifInfo: { exifImageWidth: 4000, exifImageHeight: 3000, orientation: '6' } }))
            .toEqual({ width: 3000, height: 4000 });
    });
});
