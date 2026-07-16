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
});
