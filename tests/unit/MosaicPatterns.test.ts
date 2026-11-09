import { MosaicDraft } from '../../src/models/mosaicDraft';
import {
    DEFAULT_MOSAIC_PATTERN,
    MosaicPattern,
    blankCells,
    patternNameProblem,
    patternProblem,
    resolvePatternOption,
    SavedMosaicPattern
} from '../../src/models/mosaicPattern';
import { GalleryProcessor } from '../../src/processors/GalleryProcessor';

jest.mock('../../src/utils/Logger', () => ({
    Logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() }
}));

/**
 * The draft as rows of characters, for readable expectations: each tile gets a digit by fill
 * order (1, 2, ...; then a, b, ...) and a blank cell is "."
 */
function draw(draft: MosaicDraft): string {
    const pattern = draft.toPattern();
    const rows = Array.from({ length: pattern.rows }, () => new Array<string>(pattern.columns).fill('.'));
    const marks = '123456789abcdefghijklmnopqrstuvwxyz';
    pattern.slots.forEach((s, i) => {
        for (let r = s.row; r < s.row + s.rowSpan; r++) for (let c = s.col; c < s.col + s.colSpan; c++) rows[r][c] = marks[i] ?? '#';
    });
    return rows.map(row => row.join('')).join('/');
}

describe('MosaicDraft', () => {
    test('starts from a pattern and gives it back unchanged', () => {
        expect(MosaicDraft.fromPattern(DEFAULT_MOSAIC_PATTERN).toPattern()).toEqual(DEFAULT_MOSAIC_PATTERN);
    });

    test('dragging across cells merges them into one tile, in any direction', () => {
        const draft = MosaicDraft.blank(3, 2);
        draft.merge(1, 1, 0, 0);
        expect(draw(draft)).toBe('112/113');
        expect(draft.tileCount).toBe(3);
    });

    test('a tile cut by a merge leaves its other cells as single cells, so every tile stays a rectangle', () => {
        const draft = MosaicDraft.blank(3, 2);
        draft.merge(0, 0, 1, 1);
        draft.merge(1, 0, 2, 0);
        expect(draw(draft)).toBe('122/345');
    });

    test('clicking a large tile splits it, and it keeps its place in the fill order', () => {
        const draft = MosaicDraft.blank(3, 2);
        draft.merge(1, 0, 2, 1);
        expect(draw(draft)).toBe('122/322');
        draft.split(2, 1);
        expect(draw(draft)).toBe('123/456');
    });

    test('cells can be left blank, and a blank cell can be used again', () => {
        const draft = MosaicDraft.blank(3, 2);
        draft.merge(0, 0, 1, 1);
        draft.setBlank(1, 1, 2, 1, true); // cuts the large tile: its other cells become single
        expect(draw(draft)).toBe('123/4..');
        expect(draft.isBlank(2, 1)).toBe(true);
        expect(draft.slotAt(2, 1)).toBeNull();

        draft.setBlank(2, 1, 2, 1, false);
        expect(draw(draft)).toBe('123/4.5');
        // Merging a single blank cell uses it again; merging across blanks makes them part of the tile
        draft.merge(1, 1, 1, 1);
        expect(draw(draft)).toBe('123/456');
        draft.setBlank(0, 1, 2, 1, true);
        draft.merge(0, 1, 2, 1);
        expect(draw(draft)).toBe('123/444');
    });

    test('a draft with no tiles can\'t be saved', () => {
        const draft = MosaicDraft.blank(2, 1);
        draft.setBlank(0, 0, 1, 0, true);
        expect(draft.problem()).toBe('Leave at least one cell for an image.');
        draft.setBlank(1, 0, 1, 0, false);
        expect(draft.problem()).toBeUndefined();
    });

    test('resizing keeps tiles and blanks inside the new edge and adds single cells', () => {
        const draft = MosaicDraft.blank(3, 2);
        draft.merge(1, 0, 2, 1);
        draft.setBlank(0, 1, 0, 1, true);
        draft.resize(2, 3);
        expect(draw(draft)).toBe('12/.2/34');
        draft.resize(4, 1);
        expect(draw(draft)).toBe('1234');
    });

    test('random edits always leave a valid pattern, and a draft of it gives the same pattern back', () => {
        let seed = 7;
        const rand = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
        const draft = MosaicDraft.blank(5, 6);
        for (let i = 0; i < 400; i++) {
            const action = rand(4);
            if (action === 0) draft.merge(rand(draft.columns), rand(draft.rows), rand(draft.columns), rand(draft.rows));
            else if (action === 1) draft.split(rand(draft.columns), rand(draft.rows));
            else if (action === 2) draft.setBlank(rand(draft.columns), rand(draft.rows), rand(draft.columns), rand(draft.rows), rand(3) === 0);
            else draft.resize(2 + rand(5), 1 + rand(7));
            const pattern = draft.toPattern();
            if (draft.tileCount === 0) continue;
            expect(patternProblem(pattern)).toBeUndefined();
            expect(MosaicDraft.fromPattern(pattern).toPattern()).toEqual(pattern);
            expect(blankCells(pattern).length + pattern.slots.reduce((a, s) => a + s.colSpan * s.rowSpan, 0)).toBe(pattern.columns * pattern.rows);
        }
    });
});

describe('saved patterns', () => {
    const heroLeft: MosaicPattern = { columns: 3, rows: 2, slots: [{ col: 0, row: 0, colSpan: 2, rowSpan: 2 }, { col: 2, row: 0, colSpan: 1, rowSpan: 1 }, { col: 2, row: 1, colSpan: 1, rowSpan: 1 }] };
    const saved: SavedMosaicPattern[] = [{ name: 'Hero left', ...heroLeft }];

    test('names must be usable in a block and not taken', () => {
        expect(patternNameProblem('featured', saved)).toBeUndefined();
        expect(patternNameProblem('A', saved)).toBeUndefined();
        expect(patternNameProblem('  ', saved)).toBe('Give the pattern a name.');
        expect(patternNameProblem('hero LEFT', saved)).toBe('A pattern named "Hero left" already exists.');
        expect(patternNameProblem('hero left', saved, 'Hero left')).toBeUndefined(); // editing keeps its name
        expect(patternNameProblem('#tag', saved)).toBe('Use letters, digits, spaces, - and _, starting with a letter or digit.');
        expect(patternNameProblem('x'.repeat(41), saved)).toBe('Use at most 40 characters.');
    });

    test('a block\'s pattern name is looked up ignoring case', () => {
        expect(resolvePatternOption(undefined, saved)).toEqual({});
        expect(resolvePatternOption('hero left', saved)).toEqual({ pattern: heroLeft });
    });

    test('an unknown name, or a grid of letters, falls back to the built-in pattern with a warning', () => {
        const warning = (name: string) => `The mosaic pattern "${name}" isn't saved in this vault, so the built-in pattern is used. Create it with the "Build custom mosaic" command.`;
        expect(resolvePatternOption('missing', saved)).toEqual({ warning: warning('missing') });
        expect(resolvePatternOption('A A B / A A C', saved)).toEqual({ warning: warning('A A B / A A C') });
        const broken = { name: 'broken', columns: 2, rows: 1, slots: [] } as SavedMosaicPattern;
        expect(resolvePatternOption('broken', [broken])).toEqual({ warning: warning('broken') });
    });

    test('the processor hands the view the saved pattern, or the built-in pattern and a warning', () => {
        const defaults = (new GalleryProcessor({} as any, {} as any, () => [], () => []) as any).DEFAULT_OPTIONS;
        const runtime = (pattern: string, mosaicPatterns: SavedMosaicPattern[]) =>
            (GalleryProcessor as any).viewRuntimeOptions({ sources: [], view: { type: 'mosaic', pattern } }, { ...defaults, mosaicPatterns });
        expect(runtime('Hero left', saved)).toMatchObject({ pattern: heroLeft, warnings: [] });
        const missing = runtime('gone', []);
        expect(missing.pattern).toBeUndefined();
        expect(missing.warnings).toEqual([expect.stringContaining('"gone" isn\'t saved in this vault')]);
    });
});
