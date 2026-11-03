import { ImageSource } from '../../src/models/ImageSource';
import { VideoPoster, VIDEO_PLACEHOLDER_URL } from '../../src/utils/VideoPoster';
import { formatDuration, parseClockDuration, isVideoPath, isMediaPath, extensionOf } from '../../src/models/media';
import { ImmichSourceResolver } from '../../src/resolvers/ImmichSourceResolver';
import { ImmichClient } from '../../src/services/immich/ImmichClient';
import { ContentScanner } from '../../src/services/ContentScanner';
import { TFile, Platform } from 'obsidian';
import { FolderScanner } from '../../src/services/FolderScanner';
import { Logger } from '../../src/utils/Logger';

jest.mock('../../src/services/immich/ImmichClient');

afterEach(() => jest.restoreAllMocks());

describe('media helpers', () => {
    test('recognise video files by extension', () => {
        expect(isVideoPath('Clips/Trip.MP4')).toBe(true);
        expect(isVideoPath('clip.webm?x=1')).toBe(true);
        expect(isVideoPath('photo.jpg')).toBe(false);
        expect(isMediaPath('a.mov')).toBe(true);
        expect(isMediaPath('notes.md')).toBe(false);
        expect(extensionOf('folder.v2/readme')).toBe('');
    });

    test('format and parse durations', () => {
        expect(formatDuration(12.4)).toBe('0:12');
        expect(formatDuration(245)).toBe('4:05');
        expect(formatDuration(3723)).toBe('1:02:03');
        expect(formatDuration(NaN)).toBeUndefined();
        expect(parseClockDuration('0:00:12.345000')).toBeCloseTo(12.345);
        expect(parseClockDuration('1:02:03')).toBe(3723);
        expect(parseClockDuration('garbage')).toBeUndefined();
        expect(parseClockDuration(undefined)).toBeUndefined();
    });
});

describe('local videos', () => {
    test('show a captured still frame and play from the resource URL', async () => {
        const capture = jest.spyOn(VideoPoster, 'capture').mockResolvedValue({ url: 'blob:poster', duration: 42, width: 1920, height: 1080 });
        const video = ImageSource.fromLocalPath('Clips/trip.mp4', 'trip', 'app://res/Clips/trip.mp4');
        const durations: number[] = [];
        video.onDurationKnown(s => durations.push(s));

        expect(video.mediaType).toBe('video');
        // The resource URL is the video, not something an <img> can show
        expect(video.resourceUrl).toBeUndefined();
        await expect(video.resolveVideoUrl()).resolves.toBe('app://res/Clips/trip.mp4');

        await expect(video.resolveDisplayUrl()).resolves.toBe('blob:poster');
        expect(capture).toHaveBeenCalledWith('app://res/Clips/trip.mp4', undefined);
        expect(video.durationSeconds).toBe(42);
        expect(video.dimensions).toEqual({ width: 1920, height: 1080 });
        expect(durations).toEqual([42]);
    });

    test('images are unchanged and cannot be played', async () => {
        const photo = ImageSource.fromLocalPath('a.jpg', 'a', 'app://res/a.jpg');
        expect(photo.mediaType).toBe('image');
        expect(photo.getDisplayUrl()).toBe('app://res/a.jpg');
        await expect(photo.resolveVideoUrl()).rejects.toThrow('Not a video');
    });

    test('the scanner finds videos and lets them read their file for the still frame', async () => {
        const vault: any = {
            on: jest.fn(),
            getAbstractFileByPath: jest.fn(),
            readBinary: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
            adapter: { getResourcePath: (p: string) => `app://res/${p}`, stat: jest.fn() }
        };
        const file = new TFile('Clips/trip.mp4', 'trip.mp4');
        vault.getAbstractFileByPath.mockReturnValue(file);
        const scanner = new ContentScanner(vault);

        const [video] = await scanner.scanPath('Clips/trip.mp4');
        expect(video.mediaType).toBe('video');

        const capture = jest.spyOn(VideoPoster, 'capture').mockImplementation(async (_src, readFile) => {
            await readFile?.();
            return { url: 'blob:poster' };
        });
        await video.resolveDisplayUrl!();
        expect(capture).toHaveBeenCalled();
        expect(vault.readBinary).toHaveBeenCalledWith(file);
    });
});

describe('large local videos', () => {
    const makeVault = (size: number) => {
        const file = Object.assign(new TFile('Clips/big.mp4', 'big.mp4'), { stat: { size, mtime: 1 } });
        const vault: any = {
            on: jest.fn(),
            getAbstractFileByPath: jest.fn().mockReturnValue(file),
            readBinary: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
            adapter: { getResourcePath: (p: string) => `app://res/${p}`, stat: jest.fn().mockResolvedValue({ size }) }
        };
        return { vault, file };
    };
    const readerOf = async (vault: any) => {
        const [video] = await new ContentScanner(vault).scanPath('Clips/big.mp4');
        let reader: (() => Promise<unknown>) | undefined;
        jest.spyOn(VideoPoster, 'capture').mockImplementation(async (_src, readFile) => {
            reader = readFile;
            return { url: 'blob:poster' };
        });
        await video.resolveDisplayUrl!();
        return reader;
    };

    test('files over 50 MB are never read whole for a still frame', async () => {
        const { vault } = makeVault(80 * 1024 * 1024);
        const reader = await readerOf(vault);
        await expect(reader!()).resolves.toBeUndefined();
        expect(vault.readBinary).not.toHaveBeenCalled();
    });

    test('phones and tablets never read the file for a still frame', async () => {
        const { vault } = makeVault(1024);
        (Platform as any).isMobile = true;
        try {
            expect(await readerOf(vault)).toBeUndefined();
        } finally {
            (Platform as any).isMobile = false;
        }
    });

    test('the folder scanner does not warn about large videos', async () => {
        const warn = jest.spyOn(Logger, 'warn').mockImplementation(() => undefined);
        const { vault, file } = makeVault(900 * 1024 * 1024);
        const scanner = new FolderScanner(vault);
        const image = await (scanner as any).createImageSource(file);
        expect(image.size).toBe(900 * 1024 * 1024);
        expect(warn).not.toHaveBeenCalled();
    });
});

describe('VideoPoster', () => {
    let n = 0;
    beforeEach(() => {
        // jsdom has no object URLs
        (global.URL as any).createObjectURL = jest.fn(() => `blob:test-${++n}`);
        (global.URL as any).revokeObjectURL = jest.fn();
    });

    test('uses the file bytes when the frame cannot be read from the URL', async () => {
        const grab = jest.spyOn(VideoPoster, 'grabFrame')
            .mockRejectedValueOnce(new Error('SecurityError'))
            .mockResolvedValueOnce({ blob: new Blob(['jpg']), duration: 5, width: 4, height: 3 });
        const reader = jest.fn().mockResolvedValue(new ArrayBuffer(4));

        const result = await VideoPoster.capture('app://res/fallback.mp4', reader);
        expect(reader).toHaveBeenCalled();
        expect(grab).toHaveBeenCalledTimes(2);
        expect(grab.mock.calls[1][0]).toMatch(/^blob:/);
        expect(result).toMatchObject({ duration: 5, width: 4, height: 3 });
        expect(result.url).toMatch(/^blob:/);
    });

    test('falls back to a placeholder when no frame can be had', async () => {
        jest.spyOn(VideoPoster, 'grabFrame').mockRejectedValue(new Error('cannot decode'));
        await expect(VideoPoster.capture('app://res/broken.mp4')).resolves.toEqual({ url: VIDEO_PLACEHOLDER_URL });
    });
});

describe('Immich videos', () => {
    const connections = [{ key: 'home', baseUrl: 'https://immich.example.com', apiKey: 'k' }];
    const source: any = { type: 'immich', connection: 'home', filters: { assetType: 'VIDEO' } };

    beforeEach(() => jest.resetAllMocks());

    test('show a still frame in every view and play the playback encoding in the viewer', async () => {
        (ImmichClient.prototype.searchMetadata as jest.Mock).mockResolvedValue([
            { id: 'v1', originalFileName: 'clip.mov', type: 'VIDEO', duration: '0:01:05.500000', exifInfo: { fileSizeInByte: 734003200 } },
            { id: 'p1', originalFileName: 'photo.jpg', type: 'IMAGE', duration: '0:00:00.00000' }
        ]);
        const blob = (ImmichClient.prototype.getAssetBlobUrl as jest.Mock).mockImplementation(async (id: string, rep: string) => `blob:${id}:${rep}`);
        (ImmichClient.prototype.getAssetWebUrl as jest.Mock).mockImplementation((id: string) => `https://immich.example.com/photos/${id}`);
        const resolver = new ImmichSourceResolver(() => connections);

        // Views that otherwise load originals (embed) get a preview still for videos
        const { images: [video, photo] } = await resolver.resolve(source, {});
        expect(video.mediaType).toBe('video');
        expect(video.durationSeconds).toBeCloseTo(65.5);
        // The size and Immich page let the viewer skip downloading a large video
        expect(video.size).toBe(734003200);
        expect(video.openUrl).toBe('https://immich.example.com/photos/v1');
        await expect(video.resolveDisplayUrl!()).resolves.toBe('blob:v1:preview');
        await expect(video.resolveVideoUrl!()).resolves.toBe('blob:v1:video');
        expect(photo.mediaType).toBe('image');
        expect(photo.durationSeconds).toBeUndefined();
        expect(photo.openUrl).toBeUndefined();
        await expect(photo.resolveDisplayUrl!()).resolves.toBe('blob:p1:original');

        // Tile views keep the small thumbnail
        const { images: [tile] } = await resolver.resolve(source, { viewType: 'masonry' });
        await expect(tile.resolveDisplayUrl!()).resolves.toBe('blob:v1:thumbnail');
        expect(blob).toHaveBeenCalledWith('v1', 'video');
    });
});
