import { TFile } from 'obsidian';
import { ContentScanner } from '../../src/services/ContentScanner';
import { ImageSource } from '../../src/models/ImageSource';
import { acceptsMimeType, isMediaPath, isSvgPath, readSvgSize } from '../../src/models/media';
import { AVIF_SAMPLE_BASE64, SVG_SAMPLES } from '../../src/generators/DemoImageFactory';
import { MasonryView } from '../../src/views/MasonryView';

describe('AVIF and SVG', () => {
    test('are supported formats everywhere', () => {
        for (const path of ['a.avif', 'b.svg', 'C.SVG', 'https://example.com/logo.svg?v=1']) expect(isMediaPath(path)).toBe(true);
        expect(ImageSource.fromLocalPath('art/logo.svg').mediaType).toBe('image');
        expect(() => ImageSource.fromLocalPath('photos/x.avif')).not.toThrow();
        expect(acceptsMimeType('image/avif')).toBe(true);
        expect(acceptsMimeType('image/svg+xml')).toBe(true);
        expect(acceptsMimeType('image/svg+xml', ['image/*'])).toBe(true);
        expect(isSvgPath('logo.svg#frag')).toBe(true);
        expect(isSvgPath('logo.png')).toBe(false);
    });

    test('readSvgSize uses width and height, else the viewBox', () => {
        expect(readSvgSize('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">')).toEqual({ width: 400, height: 300 });
        expect(readSvgSize('<?xml version="1.0"?>\n<svg width="64px" height=\'32px\' viewBox="0 0 10 10"></svg>')).toEqual({ width: 64, height: 32 });
        expect(readSvgSize('<svg viewBox="0 0 100 200"></svg>')).toEqual({ width: 100, height: 200 });
        expect(readSvgSize('<svg viewBox="0,0,16,9" width="100%" height="100%"></svg>')).toEqual({ width: 16, height: 9 });
        expect(readSvgSize('<svg width="320" viewBox="0 0 16 9"></svg>')).toEqual({ width: 320, height: 180 });
        expect(readSvgSize('<svg></svg>')).toBeUndefined();
        expect(readSvgSize('not svg')).toBeUndefined();
    });

    test('the scanner gives local SVGs their size from the file', async () => {
        const file = Object.assign(new TFile('Art/tall.svg', 'tall.svg'), { stat: { size: 200, mtime: 1 } });
        const vault: any = {
            on: jest.fn(),
            getAbstractFileByPath: jest.fn().mockReturnValue(file),
            cachedRead: jest.fn().mockResolvedValue('<svg viewBox="0 0 100 200"><rect/></svg>'),
            adapter: { getResourcePath: (p: string) => `app://res/${p}`, stat: jest.fn() }
        };
        const [svg] = await new ContentScanner(vault).scanPath('Art/tall.svg');
        expect(svg.dimensions).toEqual({ width: 100, height: 200 });

        // Unreadable files are left for the browser to measure
        vault.cachedRead.mockRejectedValue(new Error('gone'));
        const [other] = await new ContentScanner(vault).scanPath('Art/tall.svg');
        expect(other.dimensions).toBeUndefined();
    });

    test('the viewer scales SVGs to the stage', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const view = new MasonryView(container);
        const svg = ImageSource.fromLocalPath('Art/logo.svg', 'logo', 'app://res/logo.svg');
        const png = ImageSource.fromLocalPath('Art/logo.png', 'logo-png', 'app://res/logo.png');
        view.update([svg, png]);
        (view as any).expandImage(svg);
        const img = () => document.querySelector('.gallery-modal-image-container img')!;
        expect(img().classList.contains('is-svg')).toBe(true);
        (document.querySelector('.gallery-modal-nav.next') as HTMLButtonElement).click();
        expect(img().classList.contains('is-svg')).toBe(false);
    });

    test('the test lab samples are a real AVIF and valid SVGs', () => {
        const avif = Buffer.from(AVIF_SAMPLE_BASE64, 'base64');
        expect(avif.subarray(4, 12).toString('latin1')).toBe('ftypavif');
        expect(readSvgSize(SVG_SAMPLES[0].svg)).toEqual({ width: 400, height: 300 });
        expect(readSvgSize(SVG_SAMPLES[1].svg)).toEqual({ width: 100, height: 200 });
    });
});
