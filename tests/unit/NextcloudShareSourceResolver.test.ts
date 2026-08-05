import { NextcloudShareSourceResolver } from '../../src/resolvers/NextcloudShareSourceResolver';
import { INextcloudShareSourceConfig } from '../../src/models/interfaces';
import { GallerySourceResolveContext } from '../../src/resolvers/GallerySourceResolver';
import { requestUrl } from 'obsidian';
import { ObjectUrlManager } from '../../src/utils/immich/ObjectUrlManager';

jest.mock('obsidian', () => ({
  requestUrl: jest.fn()
}));

jest.mock('../../src/utils/Logger', () => ({
    Logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../../src/utils/immich/ObjectUrlManager', () => ({
    ObjectUrlManager: {
        acquire: jest.fn(),
        create: jest.fn(),
        revoke: jest.fn()
    }
}));

describe('NextcloudShareSourceResolver', () => {
    let resolver: NextcloudShareSourceResolver;

    beforeEach(() => {
        jest.clearAllMocks();
        resolver = new NextcloudShareSourceResolver();

        // Mock DOMParser for webdav response parsing
        (global as any).DOMParser = class DOMParser {
            parseFromString(str: string, type: string) {
                const responses = str.split('</d:response>').filter(s => s.trim().length > 0).map(r => r + '</d:response>');
                return {
                    getElementsByTagNameNS: () => [],
                    getElementsByTagName: (tag: string) => {
                        if (tag === 'd:response') {
                            return responses.map(r => {
                                const createMockElement = (content: string) => ({
                                    getElementsByTagNameNS: () => [],
                                    getElementsByTagName: (subtag: string) => {
                                        if (subtag === 'd:propstat') {
                                            const statMatch = content.match(/<d:propstat>(.*?)<\/d:propstat>/s);
                                            if (!statMatch) return [];
                                            const statContent = statMatch[1];
                                            return [createMockElement(statContent)];
                                        }
                                        if (subtag === 'd:prop') {
                                            const propMatch = content.match(/<d:prop>(.*?)<\/d:prop>/s);
                                            if (!propMatch) return [];
                                            const propContent = propMatch[1];
                                            return [createMockElement(propContent)];
                                        }
                                        if (subtag === 'd:resourcetype') {
                                            const typeMatch = content.match(/<d:resourcetype>(.*?)<\/d:resourcetype>/s);
                                            if (!typeMatch) return [];
                                            const typeContent = typeMatch[1];
                                            return [createMockElement(typeContent)];
                                        }
                                        const regex = new RegExp(`<${subtag}>(.*?)</${subtag}>`, 's');
                                        const m = content.match(regex);
                                        if (m) return [{ textContent: m[1] }];

                                        // Handle self-closing tags like <d:collection/>
                                        const regexSelfClosing = new RegExp(`<${subtag}\\/>`, 's');
                                        const mSelfClosing = content.match(regexSelfClosing);
                                        if (mSelfClosing) return [{ textContent: '' }];

                                        return [];
                                    }
                                });
                                return createMockElement(r);
                            });
                        }
                        return [];
                    }
                };
            }
        };
    });

    it('should return error if URL is missing', async () => {
        const source: INextcloudShareSourceConfig = { type: 'nextcloud-share', url: '' };
        const result = await resolver.resolve(source, { viewType: 'grid' });

        expect(result.images.length).toBe(0);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toBe('Nextcloud share source is missing a URL.');
    });

    it('should return error for invalid URL format', async () => {
        const source: INextcloudShareSourceConfig = { type: 'nextcloud-share', url: 'not-a-url' };
        const result = await resolver.resolve(source, { viewType: 'grid' });

        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toContain('Invalid URL format: not-a-url');
    });

    it('should support Nextcloud Photos app public share URLs (/apps/photos/public/{TOKEN})', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({ status: 404 });
        const source: INextcloudShareSourceConfig = { type: 'nextcloud-share', url: 'https://cloud.example.com/apps/photos/public/TOKEN123' };
        const result = await resolver.resolve(source, { viewType: 'grid' });

        expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
            url: 'https://cloud.example.com/public.php/webdav/'
        }));
    });

    it('should handle 404 response', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({ status: 404 });
        const source: INextcloudShareSourceConfig = { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN123' };

        const result = await resolver.resolve(source, { viewType: 'grid' });

        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toContain('Nextcloud share not found or expired.');
    });

    it('should handle 401 response with password', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({ status: 401 });
        const source: INextcloudShareSourceConfig = { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN123', password: 'wrong' };

        const result = await resolver.resolve(source, { viewType: 'grid' });

        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toContain('Authentication failed. Incorrect password for Nextcloud share.');
    });

    it('should handle 401 response without password', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({ status: 401 });
        const source: INextcloudShareSourceConfig = { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN123' };

        const result = await resolver.resolve(source, { viewType: 'grid' });

        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toContain('Authentication failed. Nextcloud share is password-protected.');
    });

    it('should resolve public share successfully', async () => {
        const xmlResponse = `
            <?xml version="1.0"?>
            <d:multistatus xmlns:d="DAV:">
                <d:response>
                    <d:href>/public.php/webdav/</d:href>
                    <d:propstat>
                        <d:prop>
                            <d:resourcetype><d:collection/></d:resourcetype>
                        </d:prop>
                        <d:status>HTTP/1.1 200 OK</d:status>
                    </d:propstat>
                </d:response>
                <d:response>
                    <d:href>/public.php/webdav/image1.jpg</d:href>
                    <d:propstat>
                        <d:prop>
                            <d:getcontenttype>image/jpeg</d:getcontenttype>
                            <d:displayname>image1.jpg</d:displayname>
                        </d:prop>
                        <d:status>HTTP/1.1 200 OK</d:status>
                    </d:propstat>
                </d:response>
                <d:response>
                    <d:href>/public.php/webdav/doc.pdf</d:href>
                    <d:propstat>
                        <d:prop>
                            <d:getcontenttype>application/pdf</d:getcontenttype>
                            <d:displayname>doc.pdf</d:displayname>
                        </d:prop>
                        <d:status>HTTP/1.1 200 OK</d:status>
                    </d:propstat>
                </d:response>
            </d:multistatus>
        `;

        (requestUrl as jest.Mock)
            .mockResolvedValueOnce({ status: 207, text: xmlResponse }) // PROPFIND
            .mockResolvedValueOnce({ // GET file
                status: 200,
                arrayBuffer: new ArrayBuffer(10),
                headers: { 'content-type': 'image/jpeg' }
            });

        (ObjectUrlManager.acquire as jest.Mock).mockReturnValue(null);
        (ObjectUrlManager.create as jest.Mock).mockReturnValue('blob:test');

        const source: INextcloudShareSourceConfig = { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN123' };
        const result = await resolver.resolve(source, { viewType: 'grid' });

        expect(result.errors.length).toBe(0);
        expect(result.images.length).toBe(1);
        expect(result.images[0].displayName).toBe('image1.jpg');
        expect(result.images[0].path).toBe('nextcloud-share://TOKEN123/public.php/webdav/image1.jpg');
        expect(result.images[0].resourceUrl).toBe('blob:test');
        expect(ObjectUrlManager.create).toHaveBeenCalled();
    });

    it('should filter files by filenameFilter glob pattern', async () => {
        const xmlResponse = `
            <?xml version="1.0"?>
            <d:multistatus xmlns:d="DAV:">
                <d:response>
                    <d:href>/public.php/webdav/image1.jpg</d:href>
                    <d:propstat>
                        <d:prop>
                            <d:getcontenttype>image/jpeg</d:getcontenttype>
                            <d:displayname>image1.jpg</d:displayname>
                        </d:prop>
                        <d:status>HTTP/1.1 200 OK</d:status>
                    </d:propstat>
                </d:response>
                <d:response>
                    <d:href>/public.php/webdav/image2.png</d:href>
                    <d:propstat>
                        <d:prop>
                            <d:getcontenttype>image/png</d:getcontenttype>
                            <d:displayname>image2.png</d:displayname>
                        </d:prop>
                        <d:status>HTTP/1.1 200 OK</d:status>
                    </d:propstat>
                </d:response>
            </d:multistatus>
        `;

        (requestUrl as jest.Mock)
            .mockResolvedValueOnce({ status: 207, text: xmlResponse })
            .mockResolvedValueOnce({
                status: 200,
                arrayBuffer: new ArrayBuffer(10),
                headers: { 'content-type': 'image/jpeg' }
            });

        (ObjectUrlManager.acquire as jest.Mock).mockReturnValue(null);
        (ObjectUrlManager.create as jest.Mock).mockReturnValue('blob:test');

        const source: INextcloudShareSourceConfig = { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN123', filenameFilter: '*.jpg' };
        const result = await resolver.resolve(source, { viewType: 'grid' });

        expect(result.errors.length).toBe(0);
        expect(result.images.length).toBe(1);
        expect(result.images[0].displayName).toBe('image1.jpg');
        expect(ObjectUrlManager.create).toHaveBeenCalledTimes(1);
    });

    it('should use ObjectUrlManager cache for blob URLs', async () => {
        const xmlResponse = `
            <?xml version="1.0"?>
            <d:multistatus xmlns:d="DAV:">
                <d:response>
                    <d:href>/public.php/webdav/image1.jpg</d:href>
                    <d:propstat>
                        <d:prop>
                            <d:getcontenttype>image/jpeg</d:getcontenttype>
                            <d:displayname>image1.jpg</d:displayname>
                        </d:prop>
                        <d:status>HTTP/1.1 200 OK</d:status>
                    </d:propstat>
                </d:response>
            </d:multistatus>
        `;

        (requestUrl as jest.Mock).mockResolvedValueOnce({ status: 207, text: xmlResponse });
        (ObjectUrlManager.acquire as jest.Mock).mockReturnValue('blob:existing');

        const source: INextcloudShareSourceConfig = { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN123' };
        const result = await resolver.resolve(source, { viewType: 'grid' });

        expect(result.images.length).toBe(1);
        expect(result.images[0].resourceUrl).toBe('blob:existing');
        // Because it was acquired from cache, GET shouldn't be called
        expect(requestUrl).toHaveBeenCalledTimes(1);
    });

    it('should handle single-file shares', async () => {
        const xmlResponse = `
            <?xml version="1.0"?>
            <d:multistatus xmlns:d="DAV:">
                <d:response>
                    <d:href>/public.php/webdav/</d:href>
                    <d:propstat>
                        <d:prop>
                            <d:getcontenttype>image/png</d:getcontenttype>
                            <d:displayname>single_image.png</d:displayname>
                        </d:prop>
                        <d:status>HTTP/1.1 200 OK</d:status>
                    </d:propstat>
                </d:response>
            </d:multistatus>
        `;

        (requestUrl as jest.Mock)
            .mockResolvedValueOnce({ status: 207, text: xmlResponse })
            .mockResolvedValueOnce({
                status: 200,
                arrayBuffer: new ArrayBuffer(10),
                headers: { 'content-type': 'image/png' }
            });

        (ObjectUrlManager.acquire as jest.Mock).mockReturnValue(null);
        (ObjectUrlManager.create as jest.Mock).mockReturnValue('blob:test2');

        const source: INextcloudShareSourceConfig = { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN123' };
        const result = await resolver.resolve(source, { viewType: 'grid' });

        expect(result.images.length).toBe(1);
        expect(result.images[0].displayName).toBe('single_image.png');
    });

    it('should handle empty folder without error', async () => {
        const xmlResponse = `
            <?xml version="1.0"?>
            <d:multistatus xmlns:d="DAV:">
                <d:response>
                    <d:href>/public.php/webdav/</d:href>
                    <d:propstat>
                        <d:prop>
                            <d:resourcetype><d:collection/></d:resourcetype>
                        </d:prop>
                        <d:status>HTTP/1.1 200 OK</d:status>
                    </d:propstat>
                </d:response>
            </d:multistatus>
        `;

        (requestUrl as jest.Mock).mockResolvedValueOnce({ status: 207, text: xmlResponse });

        const source: INextcloudShareSourceConfig = { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN123' };
        const result = await resolver.resolve(source, { viewType: 'grid' });

        expect(result.errors.length).toBe(0);
        expect(result.images.length).toBe(0);
    });
});

describe('Nextcloud Share Source Sorting', () => {
    let resolver: NextcloudShareSourceResolver;

    beforeEach(() => {
        resolver = new NextcloudShareSourceResolver();
    });

    it('should parse size and lastModified from XML and sort appropriately', async () => {
        const xmlResponse = `
            <?xml version="1.0"?>
            <d:multistatus xmlns:d="DAV:">
                <d:response>
                    <d:href>/public.php/webdav/image_a.jpg</d:href>
                    <d:propstat>
                        <d:prop>
                            <d:getcontenttype>image/jpeg</d:getcontenttype>
                            <d:displayname>image_a.jpg</d:displayname>
                            <d:getcontentlength>500</d:getcontentlength>
                            <d:getlastmodified>Wed, 01 Jan 2025 10:00:00 GMT</d:getlastmodified>
                        </d:prop>
                        <d:status>HTTP/1.1 200 OK</d:status>
                    </d:propstat>
                </d:response>
                <d:response>
                    <d:href>/public.php/webdav/image_c.png</d:href>
                    <d:propstat>
                        <d:prop>
                            <d:getcontenttype>image/png</d:getcontenttype>
                            <d:displayname>image_c.png</d:displayname>
                            <d:getcontentlength>100</d:getcontentlength>
                            <d:getlastmodified>Sun, 15 Jun 2025 10:00:00 GMT</d:getlastmodified>
                        </d:prop>
                        <d:status>HTTP/1.1 200 OK</d:status>
                    </d:propstat>
                </d:response>
                <d:response>
                    <d:href>/public.php/webdav/image_b.jpg</d:href>
                    <d:propstat>
                        <d:prop>
                            <d:getcontenttype>image/jpeg</d:getcontenttype>
                            <d:displayname>image_b.jpg</d:displayname>
                            <d:getcontentlength>1000</d:getcontentlength>
                            <d:getlastmodified>Wed, 31 Dec 2024 10:00:00 GMT</d:getlastmodified>
                        </d:prop>
                        <d:status>HTTP/1.1 200 OK</d:status>
                    </d:propstat>
                </d:response>
            </d:multistatus>
        `;

        (requestUrl as jest.Mock)
            .mockResolvedValueOnce({ status: 207, text: xmlResponse })
            .mockResolvedValue({
                status: 200,
                arrayBuffer: new ArrayBuffer(10),
                headers: { 'content-type': 'image/jpeg' }
            });

        (ObjectUrlManager.acquire as jest.Mock).mockReturnValue(null);
        (ObjectUrlManager.create as jest.Mock).mockReturnValue('blob:test');

        // Test Sort by name desc
        let source: INextcloudShareSourceConfig = { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN123', sort: { by: 'name', order: 'desc' } };
        let result = await resolver.resolve(source, { viewType: 'grid' });
        expect(result.images.map(i => i.displayName)).toEqual(['image_c.png', 'image_b.jpg', 'image_a.jpg']);

        // Test Sort by size asc
        (requestUrl as jest.Mock)
            .mockResolvedValueOnce({ status: 207, text: xmlResponse })
            .mockResolvedValue({
                status: 200,
                arrayBuffer: new ArrayBuffer(10),
                headers: { 'content-type': 'image/jpeg' }
            });
        source = { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN123', sort: { by: 'size', order: 'asc' } };
        result = await resolver.resolve(source, { viewType: 'grid' });
        expect(result.images.map(i => i.displayName)).toEqual(['image_c.png', 'image_a.jpg', 'image_b.jpg']);

        // Test Sort by lastModified asc
        (requestUrl as jest.Mock)
            .mockResolvedValueOnce({ status: 207, text: xmlResponse })
            .mockResolvedValue({
                status: 200,
                arrayBuffer: new ArrayBuffer(10),
                headers: { 'content-type': 'image/jpeg' }
            });
        source = { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN123', sort: { by: 'lastModified', order: 'asc' } };
        result = await resolver.resolve(source, { viewType: 'grid' });
        expect(result.images.map(i => i.displayName)).toEqual(['image_b.jpg', 'image_a.jpg', 'image_c.png']);
    });
});
