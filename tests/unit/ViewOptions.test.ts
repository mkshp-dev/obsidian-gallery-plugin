import { readViewOptions, viewOptionErrors } from '../../src/models/viewOptions';
import { ParameterParser } from '../../src/processors/ParameterParser';
import { GalleryProcessor } from '../../src/processors/GalleryProcessor';
import { JustifiedView } from '../../src/views/JustifiedView';
import { MasonryView } from '../../src/views/MasonryView';
import { ThumbnailView } from '../../src/views/ThumbnailView';
import { ImageSource } from '../../src/models/ImageSource';

function createContainer(): HTMLElement {
    const el = document.createElement('div') as HTMLElement & { empty?: () => void };
    el.empty = () => { while (el.firstChild) el.removeChild(el.firstChild); };
    document.body.appendChild(el);
    return el;
}

const image = () => new ImageSource('photos/a.jpg', 'local', 'a', 'app://a.jpg');

describe('readViewOptions', () => {
    test('reads the options that apply to the view', () => {
        expect(readViewOptions({ type: 'justified', rowHeight: 180, gap: 2, captions: false, pagination: true, itemsPerPage: 30 })).toEqual({
            type: 'justified',
            options: { rowHeight: 180, gap: 2, captions: false, pagination: true, itemsPerPage: 30 },
            warnings: []
        });
    });

    test('a view given as a plain name has no options', () => {
        expect(readViewOptions('masonry')).toEqual({ type: 'masonry', options: {}, warnings: [] });
    });

    test('warns about unknown keys, listing the options for that view', () => {
        const { options, warnings } = readViewOptions({ type: 'masonry', columns: 4, itemPerPage: 10 });
        expect(options).toEqual({});
        expect(warnings).toEqual([
            'Unknown view option "columns" is ignored. Options for the masonry view: pagination, itemsPerPage, captions, frame, columnWidth, gap.',
            'Unknown view option "itemPerPage" is ignored. Options for the masonry view: pagination, itemsPerPage, captions, frame, columnWidth, gap.'
        ]);
    });

    test('warns about options that do not apply to the chosen view', () => {
        expect(readViewOptions({ type: 'masonry', rowHeight: 200 }).warnings).toEqual([
            '"rowHeight" doesn\'t apply to the masonry view and is ignored (it applies to: justified).'
        ]);
        expect(readViewOptions({ type: 'carousel', pagination: true }).warnings).toEqual([
            '"pagination" doesn\'t apply to the carousel view and is ignored (it applies to: thumbnail, masonry, justified, embed).'
        ]);
    });

    test('the legacy grid name gets the masonry options', () => {
        expect(readViewOptions({ type: 'grid', columnWidth: 300 })).toEqual({ type: 'masonry', options: { columnWidth: 300 }, warnings: [] });
    });
});

describe('view option values', () => {
    test('out-of-range and wrongly typed values are errors', () => {
        expect(viewOptionErrors({ type: 'justified', rowHeight: 10 })).toEqual(['view.rowHeight must be a number from 40 to 1000']);
        expect(viewOptionErrors({ type: 'masonry', gap: '8px' })).toEqual(['view.gap must be a number from 0 to 64']);
        expect(viewOptionErrors({ type: 'thumbnail', captions: 'no' })).toEqual(['view.captions must be true or false']);
        expect(viewOptionErrors({ type: 'thumbnail', itemsPerPage: 2.5 })).toEqual(['view.itemsPerPage must be a whole number from 1 to 10000']);
    });

    test('the parser rejects a block with a bad value but accepts unknown keys', () => {
        expect(() => ParameterParser.parseAndValidate('path: photos\nview:\n  type: justified\n  rowHeight: huge'))
            .toThrow('view.rowHeight must be a number from 40 to 1000');
        expect(() => ParameterParser.parseAndValidate('path: photos\nview:\n  type: masonry\n  columns: 4')).not.toThrow();
    });
});

describe('applying view options', () => {
    const settings = {
        timeoutMs: 1000, allowRemoteImages: false, showCaptions: true, captionMaxLines: 1,
        pagination: false, itemsPerPage: 24, errorDisplayMode: 'full'
    };
    const runtime = (view: unknown, overrides = {}) =>
        (GalleryProcessor as any).viewRuntimeOptions({ path: '', view }, { ...settings, ...overrides });

    test('block options override the settings; sizes and warnings are passed through', () => {
        expect(runtime({ type: 'justified', captions: false, itemsPerPage: 12, pagination: true, rowHeight: 150, foo: 1 })).toMatchObject({
            showCaptions: false, pagination: true, itemsPerPage: 12, rowHeight: 150,
            warnings: [expect.stringContaining('"foo"')]
        });
        expect(runtime('thumbnail')).toMatchObject({ showCaptions: true, pagination: false, itemsPerPage: 24 });
    });

    test('warnings are not shown when error messages are hidden', () => {
        expect(runtime({ type: 'masonry', foo: 1 }, { errorDisplayMode: 'hidden' }).warnings).toEqual([]);
    });

    test('justified and masonry set their size variables on this gallery only', () => {
        const justified = new JustifiedView(createContainer());
        justified.setOptions({ rowHeight: 150, gap: 2 });
        justified.update([image()]);
        const jRoot = justified.container.querySelector<HTMLElement>('.gallery-justified-layout')!;
        expect(jRoot.style.getPropertyValue('--gallery-justified-row-height')).toBe('150px');
        expect(jRoot.style.getPropertyValue('--gallery-justified-gap')).toBe('2px');

        const masonry = new MasonryView(createContainer());
        masonry.setOptions({ columnWidth: 300 });
        masonry.update([image()]);
        const mRoot = masonry.container.querySelector<HTMLElement>('.gallery-masonry-layout')!;
        expect(mRoot.style.getPropertyValue('--gallery-masonry-column-width')).toBe('300px');
        expect(mRoot.style.getPropertyValue('--gallery-masonry-gap')).toBe('');
    });

    test('views show warnings under the gallery, and keep them after re-rendering', () => {
        const view = new ThumbnailView(createContainer());
        view.setOptions({ warnings: ['Unknown view option "foo" is ignored.'] });
        view.update([image()]);
        view.render();
        const lines = Array.from(view.container.querySelectorAll('.gallery-warning-compact')).map(el => el.textContent);
        expect(lines).toEqual(['⚠️ gallery: Unknown view option "foo" is ignored.']);
    });
});

describe('gallery frame', () => {
    const settings = {
        timeoutMs: 1000, allowRemoteImages: false, showCaptions: true, captionMaxLines: 1,
        pagination: false, itemsPerPage: 24, errorDisplayMode: 'full', showFrame: true
    };
    const runtime = (view: unknown, overrides = {}) =>
        (GalleryProcessor as any).viewRuntimeOptions({ path: '', view }, { ...settings, ...overrides });

    test('frame follows the setting unless the block overrides it', () => {
        expect(runtime('masonry').frame).toBe(true);
        expect(runtime('masonry', { showFrame: false }).frame).toBe(false);
        expect(runtime({ type: 'masonry', frame: false }).frame).toBe(false);
        expect(runtime({ type: 'thumbnail', frame: true }, { showFrame: false }).frame).toBe(true);
    });

    test('frame is not an option for the embed view, which never has one', () => {
        expect(readViewOptions({ type: 'embed', frame: true }).warnings).toEqual([
            '"frame" doesn\'t apply to the embed view and is ignored (it applies to: thumbnail, carousel, masonry, justified).'
        ]);
        expect(viewOptionErrors({ type: 'masonry', frame: 'no' })).toEqual(['view.frame must be true or false']);
    });

    test('the view marks its container frameless, and can switch back', () => {
        const container = createContainer();
        const view = new MasonryView(container);
        view.setOptions({ frame: false });
        view.update([image()]);
        expect(container.classList.contains('gallery-frameless')).toBe(true);

        view.setOptions({ frame: true });
        expect(container.classList.contains('gallery-frameless')).toBe(false);
    });
});
