import '../../tests/setup';
import { App, Plugin, Modal, Setting, Editor } from 'obsidian';
import { GalleryBuilderModal } from '../../src/ui/GalleryBuilderModal';
import type GalleryPlugin from '../../src/main';

if (typeof Element !== 'undefined' && !(Element.prototype as any).empty) {
  (Element.prototype as any).empty = function() {
    while (this.firstChild) {
      this.removeChild(this.firstChild);
    }
  };
}

jest.mock('obsidian', () => {
    const original = jest.requireActual('obsidian');
    class MockSetting {
        constructor() {}
        setName() { return this; }
        setDesc() { return this; }
        setHeading() { return this; }
        addText(cb: any) {
            cb({
                inputEl: {},
                setPlaceholder: function() { return this; },
                setValue: function() { return this; },
                onChange: function() { return this; }
            });
            return this;
        }
        addToggle(cb: any) {
            cb({
                setValue: function() { return this; },
                onChange: function() { return this; }
            });
            return this;
        }
        addDropdown(cb: any) {
            cb({
                addOptions: function() { return this; },
                addOption: function() { return this; },
                setValue: function() { return this; },
                onChange: function() { return this; }
            });
            return this;
        }
        addSearch(cb: any) {
            cb({
                setPlaceholder: function() { return this; },
                onChange: function() { return this; }
            });
            return this;
        }
    }
    return {
        ...original,
        Setting: MockSetting
    };
});

describe('GalleryBuilderModal Nextcloud sources', () => {
    let mockApp: App;
    let mockPlugin: GalleryPlugin;
    let mockEditor: Editor;

    beforeEach(() => {
        mockApp = {
            vault: {
                getAllLoadedFiles: () => []
            }
        } as unknown as App;
        mockPlugin = {
            settings: {
                nextcloudConnections: [{ key: 'test-nc', baseUrl: '', username: '', appPassword: '' }]
            }
        } as unknown as GalleryPlugin;
        mockEditor = {} as Editor;
    });

    it('should initialize nextcloud source with correct type', () => {
        const modal = new GalleryBuilderModal(mockApp, mockPlugin, mockEditor);
        const container = document.createElement('div');

        (modal as any).addSource('nextcloud', container);
        expect((modal as any).sources.length).toBe(1);
        expect((modal as any).sources[0].type).toBe('nextcloud');
    });

    it('should initialize nextcloud-share source with correct type', () => {
        const modal = new GalleryBuilderModal(mockApp, mockPlugin, mockEditor);
        const container = document.createElement('div');

        (modal as any).addSource('nextcloud-share', container);
        expect((modal as any).sources.length).toBe(1);
        expect((modal as any).sources[0].type).toBe('nextcloud-share');
    });
});

describe('GalleryBuilderModal Nextcloud YAML generation', () => {
    let mockApp: App;
    let mockPlugin: GalleryPlugin;
    let mockEditor: Editor;

    beforeEach(() => {
        mockApp = { vault: { getAllLoadedFiles: () => [] } } as unknown as App;
        mockPlugin = {
            settings: { nextcloudConnections: [{ key: 'test-nc', baseUrl: '', username: '', appPassword: '' }] }
        } as unknown as GalleryPlugin;
        mockEditor = {} as Editor;
    });

    it('should correctly configure nextcloud source and generate valid YAML', () => {
        const modal = new GalleryBuilderModal(mockApp, mockPlugin, mockEditor);
        const container = document.createElement('div');
        (modal as any).addSource('nextcloud', container);

        const source = (modal as any).sources[0];

        // Simulate UI updates
        source.filenameFilter = '*.png';
        source.filters = { modifiedAfter: '2025-01-01', maxSizeKb: 1000 };
        source.sort = { by: 'size', order: 'desc' };

        // We import the real generator for integration testing
        const { GalleryYamlGenerator } = require('../../src/utils/GalleryYamlGenerator');
        const yaml = GalleryYamlGenerator.generateYaml([source], 'grid');

        expect(yaml).toContain('type: nextcloud');
        expect(yaml).toContain('filenameFilter: *.png');
        expect(yaml).toContain('modifiedAfter: 2025-01-01');
        expect(yaml).toContain('maxSizeKb: 1000');
        expect(yaml).toContain('by: size');
        expect(yaml).toContain('order: desc');
    });

    it('should correctly configure nextcloud-share source and generate valid YAML', () => {
        const modal = new GalleryBuilderModal(mockApp, mockPlugin, mockEditor);
        const container = document.createElement('div');
        (modal as any).addSource('nextcloud-share', container);

        const source = (modal as any).sources[0];

        // Simulate UI updates
        source.url = 'https://example.com/s/TOKEN';
        source.filenameFilter = '*.jpg';
        source.filters = { mimeTypes: ['image/jpeg'] };
        source.limit = 50;

        const { GalleryYamlGenerator } = require('../../src/utils/GalleryYamlGenerator');
        const yaml = GalleryYamlGenerator.generateYaml([source], 'grid');

        expect(yaml).toContain('type: nextcloud-share');
        expect(yaml).toContain('url: https://example.com/s/TOKEN');
        expect(yaml).toContain('filenameFilter: *.jpg');
        expect(yaml).toContain('mimeTypes:');
        expect(yaml).toContain('- image/jpeg');
        expect(yaml).toContain('limit: 50');
    });
});
