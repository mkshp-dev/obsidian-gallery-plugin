import { App, Editor, EditorPosition } from 'obsidian';
import { GalleryEditorSuggest } from '../../src/ui/GalleryEditorSuggest';
import GalleryPlugin from '../../src/main';

// Basic sanity tests for suggestion trigger
describe('GalleryEditorSuggest', () => {
    let suggest: GalleryEditorSuggest;
    let mockApp: App;
    let mockPlugin: GalleryPlugin;

    beforeEach(() => {
        mockApp = {} as App;
        mockPlugin = {
            settings: {
                immichConnections: [
                    { key: 'conn1', baseUrl: 'http://test', apiKey: 'abc' }
                ]
            }
        } as unknown as GalleryPlugin;
        suggest = new GalleryEditorSuggest(mockApp, mockPlugin);
    });

    it('should trigger inside obs-gallery block for connection', () => {
        const mockEditor = {
            getLine: (line: number) => {
                if (line === 0) return '```obs-gallery';
                if (line === 1) return 'sources:';
                if (line === 2) return '  - type: immich';
                if (line === 3) return '    connection: ';
                return '';
            }
        } as unknown as Editor;

        const result = suggest.onTrigger({ line: 3, ch: 16 } as EditorPosition, mockEditor, null);
        expect(result).not.toBeNull();
        if (result) {
            const queryData = JSON.parse(result.query);
            expect(queryData.field).toBe('connection');
        }
    });

    it('should not trigger outside obs-gallery block', () => {
        const mockEditor = {
            getLine: (line: number) => {
                if (line === 0) return '```yaml';
                if (line === 1) return 'connection: ';
                return '';
            }
        } as unknown as Editor;

        const result = suggest.onTrigger({ line: 1, ch: 12 } as EditorPosition, mockEditor, null);
        expect(result).toBeNull();
    });

    it('should trigger for array fields', () => {
        const mockEditor = {
            getLine: (line: number) => {
                if (line === 0) return '```obs-gallery';
                if (line === 1) return 'sources:';
                if (line === 2) return '  - type: immich';
                if (line === 3) return '    albumIds:';
                if (line === 4) return '      - ';
                return '';
            }
        } as unknown as Editor;

        const result = suggest.onTrigger({ line: 4, ch: 8 } as EditorPosition, mockEditor, null);
        expect(result).not.toBeNull();
        if (result) {
            const queryData = JSON.parse(result.query);
            expect(queryData.field).toBe('albumIds');
        }
    });

    describe('mosaic options', () => {
        const editorWith = (last: string) => ({
            getLine: (line: number) => ['```obs-gallery', 'view:', '  type: mosaic', last][line] ?? ''
        } as unknown as Editor);

        const suggestFor = async (last: string) => {
            const trigger = suggest.onTrigger({ line: 3, ch: last.length } as EditorPosition, editorWith(last), null)!;
            expect(trigger.start).toEqual({ line: 3, ch: last.indexOf(':') + 2 });
            return suggest.getSuggestions({ query: trigger.query } as any);
        };

        beforeEach(() => {
            (mockPlugin.settings as any).mosaicPatterns = [
                { name: 'Hero left', columns: 3, rows: 2, slots: [{}, {}, {}] },
                { name: 'Featured', columns: 4, rows: 4, slots: [{}, {}] }
            ];
        });

        it('suggests saved pattern names, filtered by what is typed', async () => {
            expect((await suggestFor('  pattern: ')).map(s => s.label)).toEqual(['Hero left', 'Featured']);
            const hero = await suggestFor('  pattern: "her');
            expect(hero).toEqual([{ label: 'Hero left', value: 'Hero left', description: '3 × 2 grid, 3 tiles' }]);
        });

        it('suggests crop and contain for fit', async () => {
            expect((await suggestFor('  fit: ')).map(s => s.value)).toEqual(['crop', 'contain']);
            expect((await suggestFor('  fit: con')).map(s => s.value)).toEqual(['contain']);
        });

        it('doesn\'t mistake other keys ending in "fit" or "pattern" for these', () => {
            expect(suggest.onTrigger({ line: 3, ch: 18 } as EditorPosition, editorWith('  unfit: '), null)).toBeNull();
        });
    });
});
