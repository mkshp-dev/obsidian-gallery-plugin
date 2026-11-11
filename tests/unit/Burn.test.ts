import {
    findGalleryBlocks, locateGalleryBlock, replaceGalleryBlock, burnFileName, burnTimestamp
} from '../../src/services/burn/burnText';
import { objectFitRect, wrapText, fitScale, intersect } from '../../src/services/burn/snapshotGeometry';

const note = (text: string) => text.split('\n');

describe('burn: finding the gallery block', () => {
    test('finds blocks and their bodies', () => {
        const lines = note('# Trip\n```obs-gallery\nsource: A\n```\ntext\n~~~obs-gallery\nsource: B\n~~~');
        const blocks = findGalleryBlocks(lines);
        expect(blocks.map(b => [b.start, b.end, b.body])).toEqual([[1, 3, 'source: A'], [5, 7, 'source: B']]);
    });

    test('ignores other code blocks', () => {
        expect(findGalleryBlocks(note('```js\nx\n```'))).toEqual([]);
    });

    test('finds a block inside a callout and keeps its prefix', () => {
        const lines = note('> [!note]\n> ```obs-gallery\n> source: A\n> ```');
        const [block] = findGalleryBlocks(lines);
        expect(block).toMatchObject({ start: 1, end: 3, prefix: '> ', body: 'source: A' });
    });

    test('picks the block whose body matches the rendered source', () => {
        const lines = note('```obs-gallery\nsource: A\n```\n```obs-gallery\nsource: B\n```');
        expect(locateGalleryBlock(lines, 'source: B\n')?.start).toBe(3);
        expect(locateGalleryBlock(lines, 'source: C')).toBeUndefined();
    });

    test('tells identical blocks apart by the line Obsidian reports', () => {
        const lines = note('```obs-gallery\nsource: A\n```\n\n```obs-gallery\nsource: A\n```');
        expect(locateGalleryBlock(lines, 'source: A', 4)?.start).toBe(4);
        expect(locateGalleryBlock(lines, 'source: A', 0)?.start).toBe(0);
    });
});

describe('burn: replacing the block', () => {
    test('swaps the whole block for one embed line', () => {
        const lines = note('before\n```obs-gallery\nsource: A\nview: masonry\n```\nafter');
        const block = locateGalleryBlock(lines, 'source: A\nview: masonry')!;
        expect(replaceGalleryBlock(lines, block, '![[a.webp]]')).toEqual(note('before\n![[a.webp]]\nafter'));
    });

    test('keeps the embed inside the same callout', () => {
        const lines = note('> [!note]\n> ```obs-gallery\n> source: A\n> ```\n> text');
        const block = locateGalleryBlock(lines, 'source: A')!;
        expect(replaceGalleryBlock(lines, block, '![[a.webp]]')).toEqual(note('> [!note]\n> ![[a.webp]]\n> text'));
    });

    test('names the file after the plugin, note and time, numbered when the note has several galleries', () => {
        expect(burnFileName('Gallery View', 'Trip', '2026-11-11 143005')).toBe('Gallery View - Trip - 2026-11-11 143005.webp');
        expect(burnFileName('Gallery View', 'Trip', '2026-11-11 143005', 2)).toBe('Gallery View - Trip - 2026-11-11 143005 - 2.webp');
        expect(burnFileName('Gallery View', 'A: [b] #c|d?', 't')).toBe('Gallery View - A b cd - t.webp');
    });

    test('formats the time without colons', () => {
        expect(burnTimestamp(new Date(2026, 10, 1, 9, 5, 7))).toBe('2026-11-01 090507');
    });
});

describe('burn: geometry', () => {
    const box = { x: 0, y: 0, width: 100, height: 100 };

    test('object-fit cover fills the box, centred', () => {
        expect(objectFitRect(box, 200, 100, 'cover', '50% 50%')).toEqual({ x: -50, y: 0, width: 200, height: 100 });
    });

    test('object-fit contain fits inside, honouring object-position', () => {
        expect(objectFitRect(box, 200, 100, 'contain', '50% 50%')).toEqual({ x: 0, y: 25, width: 100, height: 50 });
        expect(objectFitRect(box, 200, 100, 'contain', '0% 0%')).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    });

    test('object-fit fill stretches to the box', () => {
        expect(objectFitRect(box, 200, 100, 'fill', '50% 50%')).toEqual(box);
    });

    test('wraps text and clamps it with an ellipsis', () => {
        const measure = (s: string) => s.length; // one unit per character
        expect(wrapText('a bb ccc', 4, 3, measure)).toEqual(['a bb', 'ccc']);
        expect(wrapText('one two three four', 7, 1, measure)).toEqual(['one tw…']);
        expect(wrapText('abcdefgh', 4, 2, measure)).toEqual(['abcd', 'efgh']);
    });

    test('lowers the scale for huge galleries', () => {
        expect(fitScale(800, 600, 2)).toBe(2);
        expect(fitScale(800, 20000, 2)).toBeCloseTo(0.8);
    });

    test('intersects rectangles', () => {
        expect(intersect(box, { x: 50, y: 50, width: 100, height: 100 })).toEqual({ x: 50, y: 50, width: 50, height: 50 });
        expect(intersect(box, { x: 200, y: 0, width: 10, height: 10 })).toBeNull();
    });
});
