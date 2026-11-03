import { TFile, TFolder, requestUrl } from 'obsidian';
import { createMockMarkdownPostProcessorContext } from '../setup';
import { GalleryProcessor } from '../../src/processors/GalleryProcessor';
import { ImageSource } from '../../src/models/ImageSource';
import { ISourceConfig, ViewRuntimeOptions } from '../../src/models/interfaces';
import { isSkippedListing, skippedFilesNote, unsupportedMediaFormat } from '../../src/models/media';
import { ContentScanner } from '../../src/services/ContentScanner';
import { LocalSourceResolver } from '../../src/resolvers/LocalSourceResolver';
import { NextcloudClient } from '../../src/services/nextcloud/NextcloudClient';
import { NextcloudShareSourceResolver } from '../../src/resolvers/NextcloudShareSourceResolver';

jest.mock('../../src/utils/Logger', () => ({
    Logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() }
}));

describe('skipped-files note', () => {
    test('names the formats, most common first', () => {
        expect(skippedFilesNote([])).toBeUndefined();
        expect(skippedFilesNote(['a/IMG_1.HEIC'])).toBe("1 file wasn't shown: HEIC isn't supported.");
        expect(skippedFilesNote(['1.heic', '2.heic', '3.cr2'])).toBe("3 files weren't shown: HEIC and RAW aren't supported.");
        expect(skippedFilesNote(['1.tif', '2.heic', '3.heic', '4.nef', '5.dng'])).toBe("5 files weren't shown: HEIC, RAW and TIFF aren't supported.");
    });

    test('only photo and video formats count, not notes or documents', () => {
        for (const name of ['x.heic', 'x.HEIF', 'x.tiff', 'x.bmp', 'x.dng', 'x.avi', 'x.mkv']) expect(unsupportedMediaFormat(name)).toBeDefined();
        for (const name of ['x.md', 'x.pdf', 'x.jpg', 'x.mp4', 'x.svg', 'x']) expect(unsupportedMediaFormat(name)).toBeUndefined();
    });

    test('server listings count unsupported image types and photo/video extensions', () => {
        expect(isSkippedListing('image/heic', 'IMG_1.HEIC')).toBe(true);
        expect(isSkippedListing('image/tiff', 'scan.tif')).toBe(true);
        expect(isSkippedListing('application/octet-stream', 'raw.cr3')).toBe(true);
        expect(isSkippedListing('application/pdf', 'doc.pdf')).toBe(false);
        expect(isSkippedListing('image/jpeg', 'a.jpg')).toBe(false); // shown, not skipped
        // A mimeTypes filter: only what it asks for is mentioned
        expect(isSkippedListing('image/heic', 'a.heic', ['image/jpeg'])).toBe(false);
        expect(isSkippedListing('image/heic', 'a.heic', ['image/*'])).toBe(true);
    });
});

describe('vault folders', () => {
    const folder = (path: string, children: any[]) => Object.assign(new TFolder(path, path.split('/').pop()), { children });
    const file = (path: string) => new TFile(path, path.split('/').pop()!);
    const tree = folder('Phone', [
        file('Phone/IMG_1.HEIC'), file('Phone/IMG_2.jpg'), file('Phone/notes.md'), file('Phone/scan.pdf'),
        folder('Phone/Raw', [file('Phone/Raw/DSC_1.NEF'), file('Phone/Raw/DSC_1.jpg')])
    ]);
    const vault: any = {
        on: jest.fn(),
        getAbstractFileByPath: (p: string) => (p === 'Phone' ? tree : null),
        adapter: { getResourcePath: (p: string) => `app://res/${p}`, stat: jest.fn() }
    };

    test('the scanner lists photos and videos it can\'t show, without reading files', () => {
        const scanner = new ContentScanner(vault);
        expect(scanner.listSkippedFiles('Phone')).toEqual(['Phone/IMG_1.HEIC', 'Phone/Raw/DSC_1.NEF']);
        expect(scanner.listSkippedFiles('Phone', false)).toEqual(['Phone/IMG_1.HEIC']);
        expect(scanner.listSkippedFiles('Missing')).toEqual([]);
    });

    test('the local source reports them, narrowed by its filename filter', async () => {
        const scanner = { scanPath: async () => [], listSkippedFiles: () => ['Phone/IMG_1.HEIC', 'Phone/Raw/DSC_1.NEF'] };
        const resolver = new LocalSourceResolver(scanner as any);
        await expect(resolver.resolve({ type: 'local', path: 'Phone' }, {})).resolves.toMatchObject({ skipped: ['Phone/IMG_1.HEIC', 'Phone/Raw/DSC_1.NEF'] });
        await expect(resolver.resolve({ type: 'local', path: 'Phone', filenameFilter: 'IMG_*' } as any, {})).resolves.toMatchObject({ skipped: ['Phone/IMG_1.HEIC'] });
    });
});

describe('Nextcloud', () => {
    const request = requestUrl as jest.Mock;
    const listing = (entries: Array<[string, string]>) =>
        `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">` +
        entries.map(([href, type]) => `<d:response><d:href>${href}</d:href><d:propstat><d:prop>` +
            (type ? `<d:getcontenttype>${type}</d:getcontenttype>` : '<d:resourcetype><d:collection/></d:resourcetype>') +
            `</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join('') + `</d:multistatus>`;

    beforeEach(() => {
        request.mockReset();
        NextcloudClient.invalidateCache();
    });

    test('folder listings collect skipped files, also from the cache', async () => {
        request.mockResolvedValue({ status: 207, text: listing([
            ['/remote.php/dav/files/me/Phone/', ''],
            ['/remote.php/dav/files/me/Phone/IMG_1.jpg', 'image/jpeg'],
            ['/remote.php/dav/files/me/Phone/IMG_2.HEIC', 'image/heic'],
            ['/remote.php/dav/files/me/Phone/notes.md', 'text/markdown']
        ]) });
        const client = new NextcloudClient({ key: 'c', baseUrl: 'https://cloud.example.com', username: 'me', appPassword: 'x' });
        const skipped: string[] = [];
        const files = await client.listFiles('/Phone', false, undefined, skipped);
        expect(files.map(f => f.name)).toEqual(['IMG_1.jpg']);
        expect(skipped).toEqual(['/Phone/IMG_2.HEIC']);

        const again: string[] = [];
        await client.listFiles('/Phone', false, undefined, again);
        expect(again).toEqual(['/Phone/IMG_2.HEIC']);
        expect(request).toHaveBeenCalledTimes(1);
    });

    test('share links report skipped files too', async () => {
        request.mockResolvedValue({ status: 207, text: listing([
            ['/public.php/webdav/', ''],
            ['/public.php/webdav/a.jpg', 'image/jpeg'],
            ['/public.php/webdav/b.heic', 'image/heic'],
            ['/public.php/webdav/c.tiff', 'image/tiff']
        ]) });
        const result = await new NextcloudShareSourceResolver().resolve(
            { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN', recursive: false } as any, {});
        expect(result.images).toHaveLength(1);
        expect(result.skipped).toEqual(['b.heic', 'c.tiff']);
    });
});

describe('under the gallery', () => {
    function container(): HTMLElement & any {
        const el = document.createElement('div') as any;
        const augment = (node: any) => {
            node.createEl = (tag: string, o?: any) => { const c = augment(document.createElement(tag)); if (o?.cls) c.className = o.cls; if (o?.text) c.textContent = o.text; node.appendChild(c); return c; };
            node.createDiv = (o?: any) => node.createEl('div', typeof o === 'string' ? { cls: o } : o || {});
            node.empty = () => { while (node.firstChild) node.removeChild(node.firstChild); };
            node.addClass = (c: string) => node.classList.add(c);
            node.removeClass = (c: string) => node.classList.remove(c);
            return node;
        };
        return augment(el);
    }
    class View {
        type = 'thumbnail'; images: any[] = []; options: ViewRuntimeOptions[] = [];
        update(images: any[]) { this.images = images; }
        render() {} destroy() {}
        setOptions(o: ViewRuntimeOptions) { this.options.push(o); }
        getStats() { return { totalImages: this.images.length, loadedImages: this.images.length, pendingImages: 0, errorImages: 0 }; }
    }
    const setup = (skipped: string[], images = () => [ImageSource.fromLocalPath('Phone/IMG_2.jpg')]) => {
        const views: View[] = [];
        const factory = { createView: () => { const v = new View(); views.push(v); return v; }, getSupportedTypes: () => ['thumbnail'], registerViewType() {} };
        const processor = new GalleryProcessor({ scanPath: async () => [], validateImageSource: async () => true } as any, factory as any);
        let current = skipped;
        processor['resolverRegistry'].resolveSource = jest.fn(async (_source: ISourceConfig) => ({ images: images(), errors: [], skipped: current }));
        return { processor, views, setSkipped: (s: string[]) => { current = s; } };
    };
    const yaml = 'sources:\n  - type: local\n    path: Phone\nview: thumbnail';

    test('a gallery that skipped files says so in one line', async () => {
        const { processor, views } = setup(['Phone/IMG_1.HEIC', 'Phone/Raw/DSC_1.NEF']);
        const result = await processor.processCodeBlock(yaml, container(), createMockMarkdownPostProcessorContext() as any);
        expect(result.success).toBe(true);
        expect(views[0].options.at(-1)!.warnings).toEqual(["2 files weren't shown: HEIC and RAW aren't supported."]);
    });

    test('the note follows the files on refresh, and is hidden with error messages off', async () => {
        const { processor, views, setSkipped } = setup(['Phone/IMG_1.HEIC']);
        const result = await processor.processCodeBlock(yaml, container(), createMockMarkdownPostProcessorContext() as any);
        setSkipped([]);
        await processor.refreshGallery(result.galleryInstance!.id);
        expect(views[0].options.at(-1)!.warnings).toEqual([]);

        const hidden = setup(['Phone/IMG_1.HEIC']);
        await hidden.processor.processCodeBlock(yaml, container(), createMockMarkdownPostProcessorContext() as any, { errorDisplayMode: 'hidden' });
        expect(hidden.views[0].options.at(-1)!.warnings).toEqual([]);
    });

    test('a folder of only unsupported files explains why it looks empty', async () => {
        const { processor } = setup(['Phone/IMG_1.HEIC', 'Phone/IMG_3.HEIC'], () => []);
        const el = container();
        await processor.processCodeBlock('path: Phone\nview: thumbnail', el, createMockMarkdownPostProcessorContext() as any);
        expect(el.textContent).toContain('No images found in "Phone". 2 files weren\'t shown: HEIC isn\'t supported.');
    });
});
