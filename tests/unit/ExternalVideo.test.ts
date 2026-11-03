import { requestUrl, Platform } from 'obsidian';
import { ImageSource } from '../../src/models/ImageSource';
import { ExternalSourceResolver } from '../../src/resolvers/ExternalSourceResolver';
import { ObjectUrlManager } from '../../src/utils/ObjectUrlManager';
import { VideoPoster, VIDEO_PLACEHOLDER_URL } from '../../src/utils/VideoPoster';

jest.mock('../../src/utils/Logger', () => ({
    Logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const request = requestUrl as jest.Mock;
const frame = { blob: new Blob(['jpg']), duration: 30, width: 1280, height: 720 };

let n = 0;
beforeEach(() => {
    jest.restoreAllMocks();
    request.mockReset();
    ObjectUrlManager.cleanupAll();
    (global.URL as any).createObjectURL = jest.fn(() => `blob:ext-${++n}`);
    (global.URL as any).revokeObjectURL = jest.fn();
});

describe('external video URLs', () => {
    test('URLs ending in a video extension are videos that play from the URL', async () => {
        const capture = jest.spyOn(VideoPoster, 'captureExternal').mockResolvedValue({ url: 'blob:still', duration: 30, width: 1280, height: 720 });
        const video = ImageSource.fromUrl('https://cdn.example.com/clips/surf.mp4?v=2');
        expect(video.mediaType).toBe('video');
        await expect(video.resolveVideoUrl()).resolves.toBe('https://cdn.example.com/clips/surf.mp4?v=2');

        await expect(video.resolveDisplayUrl()).resolves.toBe('blob:still');
        expect(capture).toHaveBeenCalledWith('https://cdn.example.com/clips/surf.mp4?v=2');
        expect(video.durationSeconds).toBe(30);
        expect(video.dimensions).toEqual({ width: 1280, height: 720 });

        // Letting go of a streamed URL doesn't break playing it again
        video.releaseVideo();
        await expect(video.resolveVideoUrl()).resolves.toBe('https://cdn.example.com/clips/surf.mp4?v=2');
    });

    test('images stay images, even with a video extension in the query', () => {
        expect(ImageSource.fromUrl('https://example.com/a.jpg').mediaType).toBe('image');
        expect(ImageSource.fromUrl('https://example.com/thumb?for=clip.mp4').mediaType).toBe('image');
    });

    test('video: true marks a URL without a video extension', async () => {
        const { images, errors } = await new ExternalSourceResolver().resolve({
            type: 'external',
            urls: [
                { url: 'https://media.example.com/stream/123', caption: 'Launch', video: true },
                { url: 'https://media.example.com/photo/456' },
                'https://media.example.com/clip.webm'
            ]
        }, {});
        expect(errors).toEqual([]);
        expect(images.map(i => i.mediaType)).toEqual(['video', 'image', 'video']);
        expect(images[0].caption).toBe('Launch');
        await expect(images[0].resolveVideoUrl!()).resolves.toBe('https://media.example.com/stream/123');
    });
});

describe('VideoPoster.captureExternal', () => {
    const url = 'https://cdn.example.com/clip.mp4';

    test('reads the frame straight from the site when it allows it (CORS), with no download', async () => {
        const grab = jest.spyOn(VideoPoster, 'grabFrame').mockResolvedValue(frame);
        const result = await VideoPoster.captureExternal(url);
        expect(grab).toHaveBeenCalledWith(url, true);
        expect(request).not.toHaveBeenCalled();
        expect(result).toMatchObject({ duration: 30 });
        expect(result.url).toMatch(/^blob:/);
    });

    test('otherwise downloads a small video to take the frame', async () => {
        const grab = jest.spyOn(VideoPoster, 'grabFrame').mockRejectedValueOnce(new Error('SecurityError')).mockResolvedValueOnce(frame);
        request
            .mockResolvedValueOnce({ status: 200, headers: { 'content-length': '2000000' } })
            .mockResolvedValueOnce({ status: 200, headers: {}, arrayBuffer: new ArrayBuffer(8) });
        const result = await VideoPoster.captureExternal('https://cdn.example.com/small.mp4');
        expect(request.mock.calls.map(c => c[0].method)).toEqual(['HEAD', 'GET']);
        expect(grab.mock.calls[1][0]).toMatch(/^blob:/);
        expect(result.url).toMatch(/^blob:/);
    });

    test('large, unknown-size and mobile videos give the placeholder without downloading', async () => {
        jest.spyOn(VideoPoster, 'grabFrame').mockRejectedValue(new Error('SecurityError'));

        request.mockResolvedValueOnce({ status: 200, headers: { 'content-length': String(500 * 1024 * 1024) } });
        await expect(VideoPoster.captureExternal('https://cdn.example.com/big.mp4')).resolves.toEqual({ url: VIDEO_PLACEHOLDER_URL });

        request.mockResolvedValueOnce({ status: 200, headers: {} });
        await expect(VideoPoster.captureExternal('https://cdn.example.com/unknown.mp4')).resolves.toEqual({ url: VIDEO_PLACEHOLDER_URL });

        (Platform as any).isMobile = true;
        try {
            await expect(VideoPoster.captureExternal('https://cdn.example.com/phone.mp4')).resolves.toEqual({ url: VIDEO_PLACEHOLDER_URL });
        } finally {
            (Platform as any).isMobile = false;
        }
        expect(request.mock.calls.map(c => c[0].method)).toEqual(['HEAD', 'HEAD']);
    });
});

describe('Validate remote content type', () => {
    test('accepts video types only for videos', async () => {
        const { ImageLoader } = await import('../../src/utils/ImageLoader');
        request.mockResolvedValue({ status: 200, headers: { 'Content-Type': 'video/mp4' } });
        await expect(ImageLoader.validateImageUrl('https://cdn.example.com/clip.mp4', 1000, true)).resolves.toBe(true);
        await expect(ImageLoader.validateImageUrl('https://cdn.example.com/clip.mp4', 1000)).resolves.toBe(false);
    });
});
