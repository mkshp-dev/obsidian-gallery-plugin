import { App, PluginManifest } from 'obsidian';
import GalleryPlugin from '../../main';

// Mock obsidian classes properly based on how main.ts uses it
jest.mock('obsidian', () => ({
    Plugin: class {
        app: App;
        manifest: PluginManifest;
        constructor(app: App, manifest: PluginManifest) {
            this.app = app;
            this.manifest = manifest;
        }
        async loadData() { return {}; }
        async saveData(data: any) {}
    },
    PluginSettingTab: class {},
    Setting: class {
        setName() { return this; }
        setDesc() { return this; }
        setHeading() { return this; }
        addDropdown() { return this; }
        addToggle() { return this; }
        addText() { return this; }
        addButton() { return this; }
    },
    MarkdownRenderChild: class {
        containerEl: any;
        constructor(containerEl: any) { this.containerEl = containerEl; }
    },
    Notice: class {},
    Modal: class {
        app: App;
        contentEl: any;
        constructor(app: App) {
            this.app = app;
            this.contentEl = {
                empty: jest.fn(),
                createEl: jest.fn().mockReturnValue({
                    addEventListener: jest.fn()
                }),
                createDiv: jest.fn().mockReturnValue({
                    createEl: jest.fn().mockReturnValue({
                        addEventListener: jest.fn()
                    }),
                    createDiv: jest.fn().mockReturnValue({
                        createEl: jest.fn().mockReturnValue({
                            addEventListener: jest.fn()
                        }),
                        setCssStyles: jest.fn()
                    }),
                    setCssStyles: jest.fn()
                }),
                addClass: jest.fn()
            };
        }
        open() {}
        close() {}
    },
    TFile: class {},
    requestUrl: jest.fn()
}));

describe('GalleryPlugin Settings Migration', () => {
    let plugin: GalleryPlugin;

    beforeEach(() => {
        plugin = new GalleryPlugin({} as any, {} as any);
    });

    it('should migrate old Immich connection format with id and name to only key', async () => {
        // Provide old data format
        plugin.loadData = jest.fn().mockResolvedValue({
            immichConnections: [
                {
                    id: 'old-id',
                    name: 'Old Name',
                    baseUrl: 'http://test.com',
                    apiKey: 'key'
                },
                {
                    key: 'existing-key',
                    name: 'Ignored Name',
                    baseUrl: 'http://test2.com',
                    apiKey: 'key2'
                },
                {
                    // No key, no name, no id - should generate a key
                    baseUrl: 'http://test3.com',
                    apiKey: 'key3'
                }
            ]
        });

        await plugin.loadSettings();

        const conns = plugin.settings.immichConnections;
        expect(conns).toHaveLength(3);

        // 1: name takes precedence over id if key missing
        expect(conns[0].key).toBe('Old Name');
        expect(conns[0]).not.toHaveProperty('name');
        expect(conns[0]).not.toHaveProperty('id');
        expect(conns[0].baseUrl).toBe('http://test.com');

        // 2: key exists, so it keeps key
        expect(conns[1].key).toBe('existing-key');
        expect(conns[1]).not.toHaveProperty('name');
        expect(conns[1]).not.toHaveProperty('id');

        // 3: should have a generated key
        expect(conns[2].key).toMatch(/^conn_/);
    });
});
