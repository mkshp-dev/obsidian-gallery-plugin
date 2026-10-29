import { createHash, webcrypto } from 'crypto';
import { requestUrl } from 'obsidian';
import { downloadSamplePhotos, fetchPhotoManifest, parsePhotoManifest, SamplePhoto, SAMPLE_PHOTOS_BASE_URL } from '../../src/generators/SamplePhotos';

jest.mock('obsidian', () => ({
    ...jest.requireActual('obsidian'),
    requestUrl: jest.fn()
}));

// jsdom may not expose WebCrypto; the plugin uses crypto.subtle to check downloads
if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const mockRequestUrl = requestUrl as jest.MockedFunction<typeof requestUrl>;

const bytesOf = (text: string) => { const b = Buffer.from(text); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

function photo(overrides: Partial<SamplePhoto> = {}): SamplePhoto {
    const file = overrides.file ?? 'iceland/skogafoss.jpg';
    return {
        file,
        name: 'Skógafoss at dusk.jpg',
        set: 'iceland',
        width: 1280,
        height: 1920,
        bytes: 1000,
        sha256: sha256(`photo:${file}`),
        credit: 'Someone',
        source: 'https://unsplash.com/photos/x',
        license: 'Unsplash License',
        ...overrides
    };
}

const manifestText = (photos: unknown[]) => JSON.stringify({ version: 1, photos });

/** Serves each photo's file as `photo:<file>`, failing the files in `failing` */
function servePhotos(failing: string[] = []) {
    mockRequestUrl.mockImplementation((async (request: { url: string }) => {
        const file = decodeURIComponent(request.url.slice(SAMPLE_PHOTOS_BASE_URL.length));
        if (failing.includes(file)) return { status: 404, arrayBuffer: new ArrayBuffer(0) };
        return { status: 200, arrayBuffer: bytesOf(`photo:${file}`) };
    }) as never);
}

beforeEach(() => {
    mockRequestUrl.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('parsePhotoManifest', () => {
    test('accepts a valid manifest', () => {
        const manifest = parsePhotoManifest(manifestText([photo(), photo({ file: 'cabin/lamp.jpg', name: 'Lamp.jpg', set: 'cabin' })]));
        expect(manifest.photos).toHaveLength(2);
        expect(manifest.photos[1].set).toBe('cabin');
    });

    test.each([
        ['not JSON', '{nope', /not valid JSON/],
        ['the wrong version', JSON.stringify({ version: 2, photos: [photo()] }), /Unsupported manifest version/],
        ['no photos', manifestText([]), /no photos/],
        ['a missing field', manifestText([{ ...photo(), credit: undefined }]), /photos\[0\]\.credit is missing/],
        ['a non-numeric size', manifestText([{ ...photo(), width: '1280' }]), /photos\[0\]\.width/],
        ['a bad hash', manifestText([photo({ sha256: 'abc' })]), /sha256/],
        ['a name with a slash', manifestText([photo({ name: '../../evil.jpg' })]), /not a safe image file name/],
        ['a name that is not an image', manifestText([photo({ name: 'notes.md' })]), /not a safe image file name/],
        ['a file outside the folder', manifestText([photo({ file: 'iceland/../../x.jpg' })]), /not a plain relative path/],
        ['an absolute URL', manifestText([photo({ file: 'https://evil.example/x.jpg' })]), /not a plain relative path/],
        ['a set with a slash', manifestText([photo({ set: 'a/b' })]), /set/],
        ['duplicate names', manifestText([photo(), photo({ file: 'iceland/other.jpg' })]), /Two photos are named/]
    ])('rejects %s', (_label, text, error) => {
        expect(() => parsePhotoManifest(text)).toThrow(error);
    });
});

describe('fetchPhotoManifest', () => {
    test('rejects an HTTP error', async () => {
        mockRequestUrl.mockResolvedValue({ status: 404, text: 'Not found' } as never);
        await expect(fetchPhotoManifest()).rejects.toThrow('HTTP 404');
        expect(mockRequestUrl).toHaveBeenCalledWith(expect.objectContaining({ url: `${SAMPLE_PHOTOS_BASE_URL}manifest.json` }));
    });
});

describe('downloadSamplePhotos', () => {
    const photos = Array.from({ length: 10 }, (_, i) => photo({ file: `iceland/p${i}.jpg`, name: `Photo ${i}.jpg` }));

    test('saves every photo and reports progress', async () => {
        servePhotos();
        const save = jest.fn().mockResolvedValue(undefined);
        const progress = jest.fn();

        const result = await downloadSamplePhotos(photos, save, progress);

        expect(result.saved).toHaveLength(10);
        expect(result.failed).toHaveLength(0);
        expect(save).toHaveBeenCalledTimes(10);
        expect(progress).toHaveBeenLastCalledWith(10, 10);
    });

    test('downloads at most four photos at once', async () => {
        let active = 0;
        let peak = 0;
        mockRequestUrl.mockImplementation((async (request: { url: string }) => {
            active++;
            peak = Math.max(peak, active);
            await new Promise(resolve => setTimeout(resolve, 1));
            active--;
            const file = request.url.slice(SAMPLE_PHOTOS_BASE_URL.length);
            return { status: 200, arrayBuffer: bytesOf(`photo:${file}`) };
        }) as never);

        await downloadSamplePhotos(photos, jest.fn().mockResolvedValue(undefined));
        expect(peak).toBe(4);
    });

    test('one failed download, hash mismatch, or save error does not stop the rest', async () => {
        servePhotos(['iceland/p2.jpg']);
        const tampered = photos.map((p, i) => (i === 5 ? { ...p, sha256: sha256('something else') } : p));
        const save = jest.fn(async (p: SamplePhoto) => {
            if (p.name === 'Photo 7.jpg') throw new Error('disk full');
        });

        const result = await downloadSamplePhotos(tampered, save);

        expect(result.failed.map(p => p.name).sort()).toEqual(['Photo 2.jpg', 'Photo 5.jpg', 'Photo 7.jpg']);
        expect(result.saved).toHaveLength(7);
    });
});
