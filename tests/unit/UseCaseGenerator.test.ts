import { createHash, webcrypto } from 'crypto';
import { App, Notice, requestUrl } from 'obsidian';
import { UseCaseGenerator, USE_CASE_BLOCKS } from '../../src/generators/UseCaseGenerator';
import { ShowcaseOptions } from '../../src/generators/ShowcaseGenerator';
import { SAMPLE_PHOTOS_BASE_URL } from '../../src/generators/SamplePhotos';
import { ParameterParser } from '../../src/processors/ParameterParser';
import { readViewOptions } from '../../src/models/viewOptions';

jest.mock('obsidian', () => ({
    ...jest.requireActual('obsidian'),
    requestUrl: jest.fn(),
    Notice: jest.fn().mockImplementation(() => ({ setMessage: jest.fn(), hide: jest.fn() }))
}));

if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const mockRequestUrl = requestUrl as jest.MockedFunction<typeof requestUrl>;
const FOLDER = 'GalleryDemo/Use cases';

const PHOTOS = [
    { file: 'iceland/skogafoss.jpg', name: 'Skógafoss at dusk.jpg', set: 'iceland' },
    { file: 'iceland/kirkjufell.jpg', name: 'Kirkjufell.jpg', set: 'iceland' },
    { file: 'cabin/lamp.jpg', name: 'Reading lamp.jpg', set: 'cabin' }
].map(p => ({
    ...p, width: 1600, height: 1067, bytes: 100,
    sha256: createHash('sha256').update(p.file).digest('hex'),
    credit: 'Someone', source: 'https://unsplash.com/photos/x', license: 'Unsplash License'
}));

/** Serves the manifest above, each photo's bytes being its `file`; `failing` files return 404 */
function serve(failing: string[] = []) {
    mockRequestUrl.mockImplementation((async ({ url }: { url: string }) => {
        const path = decodeURIComponent(url.slice(SAMPLE_PHOTOS_BASE_URL.length));
        if (path === 'manifest.json') return { status: 200, text: JSON.stringify({ version: 1, photos: PHOTOS }) };
        if (failing.includes(path)) return { status: 404, arrayBuffer: new ArrayBuffer(0) };
        const b = Buffer.from(path);
        return { status: 200, arrayBuffer: b.buffer.slice(b.byteOffset, b.byteOffset + b.length) };
    }) as never);
}

function mockApp(existing: string[] = []) {
    const vault = {
        adapter: { exists: jest.fn().mockResolvedValue(false), mkdir: jest.fn().mockResolvedValue(undefined) },
        getAbstractFileByPath: jest.fn((path: string) => (existing.includes(path) ? {} : null)),
        create: jest.fn().mockResolvedValue(undefined),
        createBinary: jest.fn().mockResolvedValue(undefined)
    };
    return { app: { vault } as unknown as App, vault };
}

async function generate(options: ShowcaseOptions) {
    const { app, vault } = mockApp();
    await new UseCaseGenerator(app).generate(options);
    const notes = new Map<string, string>(vault.create.mock.calls.map(([path, content]) => [path, content]));
    return { notes, vault };
}

const galleryBlocks = (markdown: string) =>
    Array.from(markdown.matchAll(/```obs-gallery\n([\s\S]*?)```/g), m => m[1]);

beforeEach(() => {
    mockRequestUrl.mockReset();
    (Notice as unknown as jest.Mock).mockClear();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('UseCaseGenerator', () => {
    test('does nothing when the use-case folder exists', async () => {
        const { app, vault } = mockApp([FOLDER]);

        const created = await new UseCaseGenerator(app).generate({ demoConnections: 'added', downloadPhotos: true });

        expect(created).toBe(false);
        expect(vault.adapter.mkdir).not.toHaveBeenCalled();
        expect(vault.create).not.toHaveBeenCalled();
        expect(mockRequestUrl).not.toHaveBeenCalled();
    });

    test('creates every note and an empty folder per photo set, without network when photos are declined', async () => {
        const { notes, vault } = await generate({ demoConnections: 'added' });

        expect([...notes.keys()].map(p => p.slice(FOLDER.length + 1))).toEqual([
            'Start here.md', 'Iceland road trip.md', 'Iceland — five layouts.md', 'Change the layout.md',
            'Cabin mood board.md', 'Shakshuka.md', 'Design references.md', 'Trip highlights.md', 'Family album (Immich).md'
        ]);
        for (const set of ['iceland', 'cabin', 'recipe', 'design']) {
            expect(vault.adapter.mkdir).toHaveBeenCalledWith(`${FOLDER}/_photos/${set}`);
        }
        expect(mockRequestUrl).not.toHaveBeenCalled();
        expect(notes.get(`${FOLDER}/Start here.md`)).toContain('> [!note] No sample photos');
    });

    test('downloads the photos into _photos/<set>/<name> with no warning when all succeed', async () => {
        serve();
        const { notes, vault } = await generate({ demoConnections: 'added', downloadPhotos: true });

        expect(vault.createBinary).toHaveBeenCalledTimes(3);
        expect(vault.createBinary).toHaveBeenCalledWith(`${FOLDER}/_photos/iceland/Skógafoss at dusk.jpg`, expect.anything());
        expect(vault.createBinary).toHaveBeenCalledWith(`${FOLDER}/_photos/cabin/Reading lamp.jpg`, expect.anything());
        expect(notes.get(`${FOLDER}/Start here.md`)).toMatch(/^# Use cases/);
    });

    test('a failed photo is reported and the rest are still saved', async () => {
        serve(['iceland/kirkjufell.jpg']);
        const { notes, vault } = await generate({ demoConnections: 'added', downloadPhotos: true });

        expect(vault.createBinary).toHaveBeenCalledTimes(2);
        expect(notes.get(`${FOLDER}/Start here.md`)).toContain('1 of 3 photos couldn\'t be downloaded');
    });

    test('offline: still creates the notes, with a callout explaining the photos did not download', async () => {
        mockRequestUrl.mockRejectedValue(new Error('net::ERR_INTERNET_DISCONNECTED'));
        const { notes, vault } = await generate({ demoConnections: 'added', downloadPhotos: true });

        expect(notes.size).toBe(9);
        expect(vault.createBinary).not.toHaveBeenCalled();
        const startHere = notes.get(`${FOLDER}/Start here.md`)!;
        expect(startHere).toMatch(/^> \[!warning\] The sample photos didn't download/);
        expect(startHere).toContain('ERR_INTERNET_DISCONNECTED');
        expect(startHere).toContain('**Create use-case notes**');
    });

    test('every gallery block parses and has no ignored view options', async () => {
        const { notes } = await generate({ demoConnections: 'added' });
        let checked = 0;
        for (const content of notes.values()) {
            for (const block of galleryBlocks(content)) {
                const config = ParameterParser.parseAndValidate(block);
                expect(readViewOptions(config.view).warnings).toEqual([]);
                checked++;
            }
        }
        expect(checked).toBe(12);
        for (const block of Object.values(USE_CASE_BLOCKS)) {
            expect(readViewOptions(ParameterParser.parseAndValidate(block).view).warnings).toEqual([]);
        }
    });

    test('local galleries use paths relative to the note', async () => {
        const { notes } = await generate({ demoConnections: 'added' });
        const all = [...notes.values()].join('\n');
        expect(all).toContain('path: ./_photos/iceland');
        expect(all).not.toContain('path: GalleryDemo');
    });

    test('the Immich note warns only when the demo connection is not set up', async () => {
        const immichNote = async (options: ShowcaseOptions) =>
            (await generate(options)).notes.get(`${FOLDER}/Family album (Immich).md`)!;

        expect(await immichNote({ demoConnections: 'added' })).not.toContain('[!warning]');
        expect(await immichNote({ demoConnections: 'declined' })).toContain('[!warning] Needs the `immich-demo` connection');
        expect(await immichNote({ demoConnections: 'added', conflicts: [{ key: 'immich-demo', baseUrl: 'https://old.example.com' }] }))
            .toContain('[!warning]');
    });

    test('the setup callout is collapsed and comes after the gallery', async () => {
        const { notes } = await generate({ demoConnections: 'added' });
        const note = notes.get(`${FOLDER}/Iceland road trip.md`)!;
        expect(note.indexOf('```obs-gallery')).toBeLessThan(note.indexOf('> [!info]- How this gallery is set up'));
        expect(note).toContain('> ```yaml\n> sources:\n>   - type: local');
    });
});
