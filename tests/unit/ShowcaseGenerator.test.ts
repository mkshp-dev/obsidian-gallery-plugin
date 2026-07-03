import { App, Notice } from 'obsidian';
import { ShowcaseGenerator } from '../../src/generators/ShowcaseGenerator';

// Mock the Notice class
jest.mock('obsidian', () => {
    return {
        Notice: jest.fn(),
        App: jest.fn(),
        TFolder: jest.fn(),
        FileSystemAdapter: jest.fn()
    };
});

describe('ShowcaseGenerator', () => {
    // Setup global atob for jest environment
    beforeAll(() => {
        if (typeof global.atob === 'undefined') {
            global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
            global.window = { atob: global.atob };
        }
    });
    let mockApp: jest.Mocked<App>;
    let generator: ShowcaseGenerator;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        mockApp = {
            vault: {
                adapter: {
                    exists: jest.fn().mockResolvedValue(false),
                    mkdir: jest.fn().mockResolvedValue(undefined)
                },
                getAbstractFileByPath: jest.fn(),
                createFolder: jest.fn(),
                create: jest.fn(),
                createBinary: jest.fn(),
            }
        } as unknown as jest.Mocked<App>;

        generator = new ShowcaseGenerator(mockApp);
    });

    test('should abort if GalleryDemo folder already exists', async () => {
        // Setup mock to return an existing folder
        (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue({});

        await generator.generateShowcase();

        expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith('GalleryDemo');
        expect(Notice).toHaveBeenCalledWith('GalleryDemo already exists. Delete or rename it if you want to regenerate the showcase.');

        // Ensure no files or folders were created
        expect(mockApp.vault.adapter.mkdir).not.toHaveBeenCalled();
        expect(mockApp.vault.create).not.toHaveBeenCalled();
        expect(mockApp.vault.createBinary).not.toHaveBeenCalled();
    });

    test('should create showcase folder, files, and assets if it does not exist', async () => {
        // Setup mock to indicate folder doesn't exist yet
        (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
        (mockApp.vault.adapter.exists as jest.Mock).mockResolvedValue(false);
        (mockApp.vault.adapter.mkdir as jest.Mock).mockResolvedValue(undefined);
        (mockApp.vault.create as jest.Mock).mockResolvedValue(undefined);
        (mockApp.vault.createBinary as jest.Mock).mockResolvedValue(undefined);

        await generator.generateShowcase();

        // 1. Verify folder creation
        expect(mockApp.vault.adapter.mkdir).toHaveBeenCalledWith('GalleryDemo');
        expect(mockApp.vault.adapter.mkdir).toHaveBeenCalledWith('GalleryDemo/Assets');

        // 2. Verify dummy assets were written (4 images)
        expect(mockApp.vault.createBinary).toHaveBeenCalledTimes(4);
        expect(mockApp.vault.createBinary).toHaveBeenCalledWith('GalleryDemo/Assets/demo-1.jpg', expect.any(ArrayBuffer));
        expect(mockApp.vault.createBinary).toHaveBeenCalledWith('GalleryDemo/Assets/demo-4.jpg', expect.any(ArrayBuffer));

        // 3. Verify markdown notes were created
        expect(mockApp.vault.create).toHaveBeenCalledWith('GalleryDemo/00 - Welcome.md', expect.any(String));
        expect(mockApp.vault.create).toHaveBeenCalledWith('GalleryDemo/01 - Local source.md', expect.any(String));
        expect(mockApp.vault.create).toHaveBeenCalledWith('GalleryDemo/02 - External URLs.md', expect.any(String));
        expect(mockApp.vault.create).toHaveBeenCalledWith('GalleryDemo/03 - Views.md', expect.any(String));
        expect(mockApp.vault.create).toHaveBeenCalledWith('GalleryDemo/04 - Mixed sources.md', expect.any(String));
        expect(mockApp.vault.create).toHaveBeenCalledWith('GalleryDemo/05 - Sort and limit.md', expect.any(String));
        expect(mockApp.vault.create).toHaveBeenCalledWith('GalleryDemo/06 - Recursive and filters.md', expect.any(String));
        expect(mockApp.vault.create).toHaveBeenCalledWith('GalleryDemo/07 - Immich authenticated.md', expect.any(String));
        expect(mockApp.vault.create).toHaveBeenCalledWith('GalleryDemo/08 - Immich favorites and recent.md', expect.any(String));
        expect(mockApp.vault.create).toHaveBeenCalledWith('GalleryDemo/09 - Immich albums.md', expect.any(String));
        expect(mockApp.vault.create).toHaveBeenCalledWith('GalleryDemo/10 - Immich shared link.md', expect.any(String));
        expect(mockApp.vault.create).toHaveBeenCalledWith('GalleryDemo/11 - Password-protected Immich share.md', expect.any(String));
        expect(mockApp.vault.create).toHaveBeenCalledWith('GalleryDemo/12 - Error states.md', expect.any(String));

        // 4. Verify success notice
        expect(Notice).toHaveBeenCalledWith('Gallery view showcase generated successfully in gallerydemo');
    });

    test('should show error notice if generation fails', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Setup mock to throw an error
        (mockApp.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
        (mockApp.vault.adapter.mkdir as jest.Mock).mockRejectedValue(new Error('Simulated failure'));

        await generator.generateShowcase();

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(Notice).toHaveBeenCalledWith('Failed to generate showcase. Check console for details.');

        consoleErrorSpy.mockRestore();
    });
});
