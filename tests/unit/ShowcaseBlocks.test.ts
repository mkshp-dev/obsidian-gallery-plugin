import { App } from 'obsidian';
import { ShowcaseGenerator, ShowcaseOptions } from '../../src/generators/ShowcaseGenerator';
import { DEMO } from '../../src/generators/DemoServers';
import { ParameterParser } from '../../src/processors/ParameterParser';

// jsdom has no canvas implementation, so stub the image renderer
jest.mock('../../src/generators/DemoImageFactory', () => {
    const actual = jest.requireActual('../../src/generators/DemoImageFactory');
    return {
        ...actual,
        renderDemoImage: jest.fn(async (spec: { name: string; format: string }) => ({
            fileName: `${spec.name}.${spec.format === 'jpeg' ? 'jpg' : spec.format}`,
            data: new ArrayBuffer(8)
        }))
    };
});

/** Every note the showcase writes, keyed by path */
async function generateNotes(options?: ShowcaseOptions): Promise<Map<string, string>> {
    const create = jest.fn();
    const app = {
        vault: {
            adapter: { exists: jest.fn().mockResolvedValue(false), mkdir: jest.fn() },
            getAbstractFileByPath: jest.fn(),
            createFolder: jest.fn(),
            create,
            createBinary: jest.fn()
        }
    } as unknown as App;
    await new ShowcaseGenerator(app).generateShowcase(options);
    return new Map(create.mock.calls.map(([path, content]) => [path as string, content as string]));
}

const galleryBlocks = (markdown: string) =>
    Array.from(markdown.matchAll(/```obs-gallery\n([\s\S]*?)```/g), m => m[1]);

describe('showcase notes', () => {
    test('every gallery block is valid, except in the error-states note', async () => {
        const notes = await generateNotes();
        let checked = 0;

        for (const [path, content] of notes) {
            if (path.includes('Error states')) continue;
            for (const block of galleryBlocks(content)) {
                expect(() => ParameterParser.parseAndValidate(block)).not.toThrow();
                checked++;
            }
        }
        expect(checked).toBeGreaterThan(40);
    });

    test('remote examples point at the demo servers, not placeholders', async () => {
        const notes = await generateNotes();
        const all = Array.from(notes.values()).join('\n');

        expect(all).not.toMatch(/connection: home\b|your-immich-host|use23\.thegood\.cloud|YOUR_[A-Z_]*TOKEN|\$\{/);
        expect(all).toContain('https://demo-immich.mkshp.dev/share/');
        expect(all).toContain('https://demo-nextcloud.mkshp.dev/s/');
        expect(all).toContain('connection: immich-demo');
        expect(all).toContain('connection: nextcloud-demo');
    });

    test('the welcome note says whether the demo connections were added, and lists them either way', async () => {
        const welcome = async (demoConnections: ShowcaseOptions['demoConnections']) =>
            (await generateNotes({ demoConnections })).get('GalleryDemo/00 - Welcome.md')!;

        const added = await welcome('added');
        const declined = await welcome('declined');

        expect(added).toContain('were added to **Settings → Gallery View → Providers**');
        expect(declined).toContain('need these two connections');
        for (const note of [added, declined]) {
            expect(note).toContain(DEMO.immichApiKey);
            expect(note).toContain(DEMO.nextcloudAppPassword);
        }
    });
});
