import { requestUrl, Platform } from 'obsidian';
import { NextcloudClient } from '../../src/services/nextcloud/NextcloudClient';
import { NextcloudSourceResolver } from '../../src/resolvers/NextcloudSourceResolver';
import { NextcloudShareSourceResolver } from '../../src/resolvers/NextcloudShareSourceResolver';
import { ObjectUrlManager } from '../../src/utils/ObjectUrlManager';
import { VideoPoster, VIDEO_PLACEHOLDER_URL } from '../../src/utils/VideoPoster';
import { acceptsMimeType, isVideoMimeType, parseHttpDate } from '../../src/models/media';

jest.mock('../../src/utils/Logger', () => ({
    Logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const request = requestUrl as jest.Mock;
const connection = { key: 'cloud', baseUrl: 'https://cloud.example.com', username: 'me', appPassword: 'pw' };

/** A WebDAV listing (real XML, parsed by jsdom's DOMParser) */
const listing = (entries: Array<{ href: string; type?: string; size?: number; id?: string; folder?: boolean; modified?: string }>) =>
    `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">` +
    entries.map(e => `<d:response><d:href>${e.href}</d:href><d:propstat><d:prop>` +
        (e.folder ? '<d:resourcetype><d:collection/></d:resourcetype>' : '<d:resourcetype/>') +
        (e.type ? `<d:getcontenttype>${e.type}</d:getcontenttype>` : '') +
        (e.size ? `<d:getcontentlength>${e.size}</d:getcontentlength>` : '') +
        (e.id ? `<oc:fileid>${e.id}</oc:fileid>` : '') +
        (e.modified ? `<d:getlastmodified>${e.modified}</d:getlastmodified>` : '') +
        `</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join('') +
    `</d:multistatus>`;

const ok = (type: string) => ({ status: 200, arrayBuffer: new ArrayBuffer(4), headers: { 'content-type': type } });
const urls = () => request.mock.calls.map(call => call[0].url);

let n = 0;
beforeEach(() => {
    jest.restoreAllMocks();
    request.mockReset();
    NextcloudClient.invalidateCache();
    ObjectUrlManager.cleanupAll();
    (global.URL as any).createObjectURL = jest.fn(() => `blob:nc-${++n}`);
    (global.URL as any).revokeObjectURL = jest.fn();
});

describe('MIME types', () => {
    test('listings keep images and videos, narrowed by mimeTypes, with wildcards', () => {
        // Supported images, and any video (one the player can't decode gets the viewer's notice)
        for (const type of ['image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']) {
            expect(acceptsMimeType(type)).toBe(true);
        }
        expect(acceptsMimeType('image/tiff')).toBe(false);
        expect(acceptsMimeType('application/pdf')).toBe(false);
        expect(acceptsMimeType(undefined)).toBe(false);

        expect(acceptsMimeType('video/webm', ['video/*'])).toBe(true);
        expect(acceptsMimeType('image/png', ['video/*'])).toBe(false);
        expect(acceptsMimeType('video/mp4; codecs=avc1', ['image/png', 'video/mp4'])).toBe(true);
        expect(acceptsMimeType('video/quicktime', ['image/png', 'video/mp4'])).toBe(false);
        expect(acceptsMimeType('IMAGE/PNG', ['image/*'])).toBe(true);

        expect(isVideoMimeType('video/mp4; codecs=avc1')).toBe(true);
        expect(isVideoMimeType('image/jpeg')).toBe(false);
        expect(parseHttpDate('Sat, 21 Feb 2026 12:15:00 GMT')).toBe(Date.UTC(2026, 1, 21, 12, 15));
        expect(parseHttpDate('not a date')).toBeUndefined();
    });
});

describe('Nextcloud connection videos', () => {
    const client = () => new NextcloudClient(connection);

    test('the folder listing includes videos', async () => {
        request.mockResolvedValue({ status: 207, text: listing([
            { href: '/remote.php/dav/files/me/Clips/', folder: true },
            { href: '/remote.php/dav/files/me/Clips/trip.mp4', type: 'video/mp4', size: 5000, id: '42' },
            { href: '/remote.php/dav/files/me/Clips/notes.txt', type: 'text/plain' }
        ]) });
        const files = await client().listFiles('/Clips');
        expect(files.map(f => f.name)).toEqual(['trip.mp4']);
    });

    test('a video preview never falls back to downloading the original', async () => {
        request.mockResolvedValue({ status: 404, arrayBuffer: new ArrayBuffer(0), headers: {} });
        await expect(client().getFileBlobUrl('/Clips/trip.mp4', 'thumbnail', '42', true)).rejects.toThrow('No preview');
        expect(urls()).toEqual(['https://cloud.example.com/index.php/core/preview?fileId=42&x=256&y=256&a=1']);
    });

    const resolveClip = async (size: number, preview: 'ok' | 'missing') => {
        request.mockImplementation(async (req: { url: string; method: string }) => {
            if (req.method === 'PROPFIND') return { status: 207, text: listing([
                { href: '/remote.php/dav/files/me/Clips/', folder: true },
                { href: '/remote.php/dav/files/me/Clips/trip.mp4', type: 'video/mp4', size, id: '42', modified: 'Sat, 21 Feb 2026 12:15:00 GMT' }
            ]) };
            if (req.url.includes('/core/preview')) return preview === 'ok' ? ok('image/jpeg') : { status: 404, headers: {}, arrayBuffer: new ArrayBuffer(0) };
            return ok('video/mp4');
        });
        const { images, errors } = await new NextcloudSourceResolver(() => [connection]).resolve(
            { type: 'nextcloud', connection: 'cloud', path: '/Clips' } as any, { viewType: 'masonry' });
        expect(errors).toEqual([]);
        return images[0];
    };

    test('tiles show the server preview; the viewer downloads the file; it links to Nextcloud', async () => {
        const video = await resolveClip(5000, 'ok');
        expect(video.mediaType).toBe('video');
        expect(video.size).toBe(5000);
        expect(video.openUrl).toBe('https://cloud.example.com/index.php/f/42');
        // Nextcloud sends no date taken, size or length for videos: the modified date stands in
        expect(video.mtime).toBe(Date.UTC(2026, 1, 21, 12, 15));
        expect(video.durationSeconds).toBeUndefined();

        await video.resolveDisplayUrl!();
        expect(urls()).toContain('https://cloud.example.com/index.php/core/preview?fileId=42&x=256&y=256&a=1');
        // The still frame doesn't download the video
        expect(urls()).not.toContain('https://cloud.example.com/remote.php/dav/files/me/Clips/trip.mp4');
        await video.resolveVideoUrl!();
        expect(urls()).toContain('https://cloud.example.com/remote.php/dav/files/me/Clips/trip.mp4');
    });

    test('without a server preview, a small video is downloaded once for its still frame', async () => {
        const capture = jest.spyOn(VideoPoster, 'captureDownloaded').mockImplementation(async (_key, download) => {
            await download();
            return { url: 'blob:frame', duration: 9 };
        });
        const video = await resolveClip(5000, 'missing');
        await expect(video.resolveDisplayUrl!()).resolves.toBe('blob:frame');
        expect(capture).toHaveBeenCalledWith('nextcloud:cloud:/Clips/trip.mp4', expect.any(Function), 5000);
        expect(video.durationSeconds).toBe(9);
    });
});

describe('VideoPoster.captureDownloaded', () => {
    test('downloads and captures small videos', async () => {
        jest.spyOn(VideoPoster, 'grabFrame').mockResolvedValue({ blob: new Blob(['jpg']), duration: 3, width: 4, height: 3 });
        const download = jest.fn().mockResolvedValue(new Blob(['mp4']));
        const result = await VideoPoster.captureDownloaded('k1', download, 1000);
        expect(download).toHaveBeenCalled();
        expect(result).toMatchObject({ duration: 3 });
        expect(result.url).toMatch(/^blob:/);
    });

    test('large, unknown-size, failed and mobile downloads give the placeholder without downloading', async () => {
        const download = jest.fn().mockResolvedValue(new Blob(['mp4']));
        await expect(VideoPoster.captureDownloaded('k2', download, 80 * 1024 * 1024)).resolves.toEqual({ url: VIDEO_PLACEHOLDER_URL });
        await expect(VideoPoster.captureDownloaded('k3', download, undefined)).resolves.toEqual({ url: VIDEO_PLACEHOLDER_URL });
        (Platform as any).isMobile = true;
        try {
            await expect(VideoPoster.captureDownloaded('k4', download, 1000)).resolves.toEqual({ url: VIDEO_PLACEHOLDER_URL });
        } finally {
            (Platform as any).isMobile = false;
        }
        expect(download).not.toHaveBeenCalled();

        await expect(VideoPoster.captureDownloaded('k5', () => Promise.reject(new Error('HTTP 500')), 1000)).resolves.toEqual({ url: VIDEO_PLACEHOLDER_URL });
    });
});

describe('Nextcloud share videos', () => {
    const shareListing = listing([
        { href: '/public.php/webdav/', folder: true },
        { href: '/public.php/webdav/Trip/clip.mov', type: 'video/quicktime', size: 7000 }
    ]);

    const resolveShare = async (password?: string, preview: 'ok' | 'missing' = 'ok') => {
        request.mockImplementation(async (req: { url: string; method: string }) => {
            if (req.method === 'PROPFIND') return { status: 207, text: shareListing };
            if (req.url.includes('publicpreview')) return preview === 'ok' ? ok('image/png') : { status: 404, headers: {}, arrayBuffer: new ArrayBuffer(0) };
            return ok('video/quicktime');
        });
        const { images } = await new NextcloudShareSourceResolver().resolve(
            { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN', recursive: false, password } as any, { viewType: 'justified' });
        return images[0];
    };

    test('tiles use the public preview and the viewer plays the downloaded file', async () => {
        const video = await resolveShare();
        expect(video.mediaType).toBe('video');
        expect(video.size).toBe(7000);
        expect(video.openUrl).toBe('https://cloud.example.com/s/TOKEN');

        await video.resolveDisplayUrl!();
        expect(urls()).toContain('https://cloud.example.com/index.php/apps/files_sharing/publicpreview/TOKEN?file=%2FTrip%2Fclip.mov&x=256&y=256&a=1');
        expect(urls()).not.toContain('https://cloud.example.com/public.php/webdav/Trip/clip.mov');

        await video.resolveVideoUrl!();
        expect(urls()).toContain('https://cloud.example.com/public.php/webdav/Trip/clip.mov');
    });

    test('password-protected shares skip the public preview and take a frame from the file', async () => {
        const capture = jest.spyOn(VideoPoster, 'captureDownloaded').mockResolvedValue({ url: 'blob:frame' });
        const video = await resolveShare('secret');
        await expect(video.resolveDisplayUrl!()).resolves.toBe('blob:frame');
        expect(urls().some(u => u.includes('publicpreview'))).toBe(false);
        expect(capture).toHaveBeenCalledWith(expect.stringContaining('/public.php/webdav/Trip/clip.mov'), expect.any(Function), 7000);
    });

    test('shares listed under public.php/dav/files/<token> get the public preview too', async () => {
        request.mockImplementation(async (req: { url: string; method: string }) => {
            if (req.method === 'PROPFIND') return { status: 207, text: listing([
                { href: '/public.php/dav/files/TOKEN/', folder: true },
                { href: '/public.php/dav/files/TOKEN/Videos/sintel-trailer.mp4', type: 'video/mp4', size: 4372373 }
            ]) };
            return ok('image/jpeg');
        });
        const { images } = await new NextcloudShareSourceResolver().resolve(
            { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN', recursive: false } as any, { viewType: 'masonry' });
        await images[0].resolveDisplayUrl!();
        expect(urls()).toContain('https://cloud.example.com/index.php/apps/files_sharing/publicpreview/TOKEN?file=%2FVideos%2Fsintel-trailer.mp4&x=256&y=256&a=1');
    });

    test('a missing public preview falls back to a frame from the file', async () => {
        const capture = jest.spyOn(VideoPoster, 'captureDownloaded').mockResolvedValue({ url: VIDEO_PLACEHOLDER_URL });
        const video = await resolveShare(undefined, 'missing');
        await expect(video.resolveDisplayUrl!()).resolves.toBe(VIDEO_PLACEHOLDER_URL);
        expect(capture).toHaveBeenCalled();
    });
});
