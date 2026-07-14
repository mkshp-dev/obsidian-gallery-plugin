import { ContentScanner } from '../../src/services/ContentScanner';
import { TFile, TFolder } from 'obsidian';

describe('ContentScanner', () => {
    let mockVault: any;
    let scanner: ContentScanner;

    beforeEach(() => {
        mockVault = {
            on: jest.fn(),
            getAbstractFileByPath: jest.fn(),
            getFiles: jest.fn().mockReturnValue([]),
            read: jest.fn(),
            adapter: {
                getResourcePath: jest.fn().mockImplementation((path) => `app://local-resource/${path}`),
                stat: jest.fn().mockResolvedValue({ size: 100 }),
                exists: jest.fn(),
                list: jest.fn()
            }
        };
        scanner = new ContentScanner(mockVault);
    });

    describe('scanPath', () => {
        it('should return empty list if path not found', async () => {
            mockVault.getAbstractFileByPath.mockReturnValue(null);
            await expect(scanner.scanPath('non-existent.png')).rejects.toThrow('Path not found');
        });

        it('should scan single image file and generate resource URL', async () => {
            const fakeFile = new TFile('Photos/pic.jpg', 'pic.jpg');
            mockVault.getAbstractFileByPath.mockReturnValue(fakeFile);

            const result = await scanner.scanPath('Photos/pic.jpg');
            expect(result.length).toBe(1);
            expect(result[0].path).toBe('Photos/pic.jpg');
            expect(result[0].displayName).toBe('pic');
            expect(result[0].getDisplayUrl()).toBe('app://local-resource/Photos/pic.jpg');
            expect(mockVault.adapter.getResourcePath).toHaveBeenCalledWith('Photos/pic.jpg');
        });

        it('should scan folder and delegate to FolderScanner', async () => {
            const fakeFolder = new TFolder('Photos', 'Photos');
            const fakeFile = new TFile('Photos/pic.jpg', 'pic.jpg');
            fakeFolder.children = [fakeFile];
            mockVault.getAbstractFileByPath.mockReturnValue(fakeFolder);
            
            mockVault.adapter.list = jest.fn().mockResolvedValue({
                files: ['Photos/pic.jpg'],
                folders: []
            });
            mockVault.adapter.exists = jest.fn().mockResolvedValue(true);

            const result = await scanner.scanPath('Photos');
            expect(result.length).toBe(1);
            expect(result[0].path).toBe('Photos/pic.jpg');
            expect(result[0].getDisplayUrl()).toBe('app://local-resource/Photos/pic.jpg');
        });
    });

    describe('extractLinksFromFile', () => {
        it('should extract markdown image links and resolve local resource URLs', async () => {
            const sourceFile = new TFile('notes/vacation.md', 'vacation.md');
            sourceFile.parent = new TFolder('notes', 'notes');

            const content = `
                Here is a relative link: ![Vacation](./images/lake.jpg)
                Here is an absolute link: ![Sunset](photos/sunset.png)
                Here is an external link: ![Web Image](https://example.com/logo.png)
            `;
            mockVault.read.mockResolvedValue(content);

            const lakeFile = new TFile('notes/images/lake.jpg', 'lake.jpg');
            const sunsetFile = new TFile('photos/sunset.png', 'sunset.png');

            mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
                if (path === './images/lake.jpg' || path === 'notes/images/lake.jpg') return lakeFile;
                if (path === 'photos/sunset.png') return sunsetFile;
                return null;
            });

            const result = await scanner.extractLinksFromFile(sourceFile);
            expect(result.length).toBe(3);

            // Relative link resolved
            expect(result[0].path).toBe('notes/images/lake.jpg');
            expect(result[0].displayName).toBe('Vacation');
            expect(result[0].getDisplayUrl()).toBe('app://local-resource/notes/images/lake.jpg');

            // Absolute link resolved
            expect(result[1].path).toBe('photos/sunset.png');
            expect(result[1].displayName).toBe('Sunset');
            expect(result[1].getDisplayUrl()).toBe('app://local-resource/photos/sunset.png');

            // External link intact
            expect(result[2].path).toBe('https://example.com/logo.png');
            expect(result[2].displayName).toBe('Web Image');
            expect(result[2].getDisplayUrl()).toBe('https://example.com/logo.png');
        });

        it('should extract wiki links and fallback to vault-wide search if needed', async () => {
            const sourceFile = new TFile('notes/vacation.md', 'vacation.md');
            sourceFile.parent = new TFolder('notes', 'notes');

            const content = `
                [[sea.png|Beautiful Sea]]
                [[lake.jpg]]
            `;
            mockVault.read.mockResolvedValue(content);

            const seaFile = new TFile('photos/sea.png', 'sea.png');
            mockVault.getFiles.mockReturnValue([
                new TFile('notes/vacation.md', 'vacation.md'),
                seaFile
            ]);

            mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
                if (path === 'photos/sea.png') return seaFile;
                return null;
            });

            const result = await scanner.extractLinksFromFile(sourceFile);
            expect(result.length).toBe(2);

            // Found sea.png in general vault list
            expect(result[0].path).toBe('photos/sea.png');
            expect(result[0].displayName).toBe('Beautiful Sea');
            expect(result[0].getDisplayUrl()).toBe('app://local-resource/photos/sea.png');

            // lake.jpg not found, returns fallback
            expect(result[1].path).toBe('lake.jpg');
            expect(result[1].displayName).toBe('lake');
            expect(result[1].getDisplayUrl()).toBe('lake.jpg');
        });
    });
});
