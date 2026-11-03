import { MasonryView } from '../../src/views/MasonryView';
import { VideoPoster } from '../../src/utils/VideoPoster';
import { ImageSource } from '../../src/models/ImageSource';
import { wheelZoomFactor, slideshowSeconds } from '../../src/views/GalleryView';

/** Image stand-in that loads (asynchronously) whenever it is given a non-empty src */
class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private _src = '';
    set src(value: string) {
        this._src = value;
        queueMicrotask(() => (value ? this.onload?.() : this.onerror?.()));
    }
    get src() { return this._src; }
}

const OriginalImage = global.Image;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function createContainer(): HTMLElement {
    const el = document.createElement('div') as HTMLElement & { empty?: () => void };
    el.empty = () => { while (el.firstChild) el.removeChild(el.firstChild); };
    document.body.appendChild(el);
    return el;
}

function openViewer(images: ImageSource[], index = 0) {
    const view = new MasonryView(createContainer());
    view.update(images);
    (view as any).expandImage(images[index]);
    const modal = document.querySelector('.gallery-modal') as HTMLElement;
    const q = (sel: string) => modal.querySelector(sel) as HTMLElement | null;
    return { view, modal, q };
}

const local = (name: string, caption?: string) => new ImageSource(`photos/${name}.jpg`, 'local', name, `app://${name}.jpg`, caption);

beforeEach(() => {
    global.Image = FakeImage as unknown as typeof Image;
    document.body.innerHTML = '';
});

afterEach(() => {
    global.Image = OriginalImage;
});

describe('image viewer', () => {
    test('shows the position, name and caption, with icon buttons in the toolbar', async () => {
        const { q } = openViewer([local('a', 'First photo'), local('b'), local('c')]);
        await flush();

        expect(q('.gallery-modal-counter')!.textContent).toBe('1 / 3');
        expect(q('.gallery-modal-name')!.textContent).toBe('a');
        expect(q('.gallery-modal-caption')!.textContent).toBe('First photo');
        expect(q('.gallery-modal-caption')!.classList.contains('is-empty')).toBe(false);
        expect(Array.from(document.querySelectorAll('.gallery-modal-tools button')).map(b => b.getAttribute('data-icon')))
            .toEqual(['play', 'zoom-out', 'zoom-in', 'rotate-ccw', 'info', 'external-link', 'x']);
    });

    test('arrows and arrow keys move through the images, wrapping around', async () => {
        const { modal, q } = openViewer([local('a'), local('b', 'Second'), local('c')]);

        (q('.gallery-modal-nav.next') as HTMLButtonElement).click();
        expect(q('.gallery-modal-counter')!.textContent).toBe('2 / 3');
        expect(q('.gallery-modal-caption')!.textContent).toBe('Second');

        modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        expect(q('.gallery-modal-counter')!.textContent).toBe('3 / 3');
        // An image without a caption hides the caption bar
        expect(q('.gallery-modal-caption')!.classList.contains('is-empty')).toBe(true);
    });

    test('a single image has no arrows, counter or slideshow', () => {
        const { q } = openViewer([local('only')]);
        expect(q('.gallery-modal-content')!.classList.contains('is-single')).toBe(true);
        expect(q('.gallery-modal-counter')!.textContent).toBe('');
        expect(q('.play-btn')!.classList.contains('is-hidden')).toBe(true);
    });

    test('preloads the images either side of the current one', async () => {
        const images = [local('a'), local('b'), local('c'), local('d')];
        const spies = images.map(img => jest.spyOn(img, 'resolveDisplayUrl'));
        openViewer(images, 1);
        await flush();
        await flush();

        // b is shown; a and c are preloaded; d is not touched
        expect(spies[0]).toHaveBeenCalled();
        expect(spies[2]).toHaveBeenCalled();
        expect(spies[3]).not.toHaveBeenCalled();
    });

    test('closing removes the document-wide drag listeners it added', () => {
        const remove = jest.spyOn(document, 'removeEventListener');
        const { modal } = openViewer([local('a'), local('b')]);

        modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        expect(document.querySelector('.gallery-modal')).toBeNull();
        const removed = remove.mock.calls.map(call => call[0]);
        expect(removed).toEqual(expect.arrayContaining(['mousemove', 'mouseup']));
        remove.mockRestore();
    });
});

describe('details panel', () => {
    const rows = () => Array.from(document.querySelectorAll('.gallery-modal-info-panel .info-row'))
        .map(row => [row.querySelector('.info-label')!.textContent, row.querySelector('.info-value')!.textContent]);
    const labels = () => rows().map(([label]) => label);

    test('shows the date taken, camera and lens once the panel is opened', async () => {
        const img = local('a');
        const loader = jest.fn().mockResolvedValue({ takenAt: new Date(2024, 6, 14, 18, 32), camera: 'Canon EOS R5', lens: 'RF24-105mm' });
        img.setMetadataLoader(loader);
        const { q } = openViewer([img, local('b')]);
        await flush();

        // Nothing is read while the panel is closed
        expect(loader).not.toHaveBeenCalled();
        expect(labels()).toEqual(['Path', 'Type']);

        (q('.info-btn') as HTMLButtonElement).click();
        await flush();
        expect(loader).toHaveBeenCalledTimes(1);
        expect(labels()).toEqual(['Path', 'Type', 'Taken', 'Camera', 'Lens']);
        expect(rows()[3][1]).toBe('Canon EOS R5');
        expect(rows()[2][1]).toContain('2024');
    });

    test('leaves out missing fields, and a failed read leaves the panel as it was', async () => {
        const partial = local('a');
        partial.setMetadataLoader(() => Promise.resolve({ camera: 'Pixel 8' }));
        const broken = local('b');
        broken.setMetadataLoader(() => Promise.reject(new Error('unreadable')));
        const { q } = openViewer([partial, broken]);

        (q('.info-btn') as HTMLButtonElement).click();
        await flush();
        expect(labels()).toEqual(['Path', 'Type', 'Camera']);

        (q('.gallery-modal-nav.next') as HTMLButtonElement).click();
        await flush();
        expect(labels()).toEqual(['Path', 'Type']);
    });

    test('remote images show the details their source sent', () => {
        const img = new ImageSource('immich://home/search/asset/1', 'immich', 'IMG_1.jpg');
        img.metadata = { lens: 'XF23mmF2 R WR' };
        openViewer([img]);
        expect(labels()).toEqual(['Path', 'Type', 'Lens']);
    });
});

describe('slideshow', () => {
    afterEach(() => jest.useRealTimers());

    test('moves on after the configured interval', () => {
        jest.useFakeTimers();
        const view = new MasonryView(createContainer());
        view.setOptions({ slideshowInterval: 8 });
        const images = [local('a'), local('b'), local('c')];
        view.update(images);
        (view as any).expandImage(images[0]);
        const counter = () => document.querySelector('.gallery-modal-counter')!.textContent;

        (document.querySelector('.play-btn') as HTMLButtonElement).click();
        jest.advanceTimersByTime(7900);
        expect(counter()).toBe('1 / 3');
        jest.advanceTimersByTime(200);
        expect(counter()).toBe('2 / 3');
    });

    test('the interval is kept between 1 and 60 seconds, defaulting to 4', () => {
        expect(slideshowSeconds(8)).toBe(8);
        expect(slideshowSeconds(0.2)).toBe(1);
        expect(slideshowSeconds(600)).toBe(60);
        expect(slideshowSeconds(0)).toBe(4);
        expect(slideshowSeconds('abc')).toBe(4);
        expect(slideshowSeconds(undefined)).toBe(4);
    });
});

describe('videos', () => {
    /** A remote-style video whose still frame and playable file are fetched on demand */
    const clip = (name: string, seconds?: number) => {
        const v = new ImageSource(`immich://home/search/asset/${name}`, 'immich', name, undefined, undefined, () => Promise.resolve(`blob:${name}-still`));
        v.setMediaType('video', () => Promise.resolve(`blob:${name}-video`));
        v.durationSeconds = seconds;
        return v;
    };

    beforeEach(() => {
        jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
        jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
        jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    });
    afterEach(() => jest.restoreAllMocks());

    test('tiles get a play badge with the length', () => {
        const container = createContainer();
        const view = new MasonryView(container);
        view.update([clip('v', 65), local('a')]);
        const badges = container.querySelectorAll('.gallery-video-badge');
        expect(badges).toHaveLength(1);
        expect(badges[0].querySelector('.gallery-video-badge-time')!.textContent).toBe('1:05');
        expect(badges[0].getAttribute('aria-label')).toBe('Video, 1:05');
    });

    test('the viewer plays a video with controls instead of showing an image', async () => {
        const video = clip('v', 12);
        const { q } = openViewer([video, local('a')]);
        await flush();

        const el = q('video.gallery-modal-video') as HTMLVideoElement;
        expect(el.classList.contains('is-hidden')).toBe(false);
        expect(el.hasAttribute('controls')).toBe(true);
        expect(el.getAttribute('src')).toBe('blob:v-video');
        expect(el.getAttribute('poster')).toBe('blob:v-still');
        expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
        expect(q('.gallery-modal-image-container img')!.classList.contains('is-hidden')).toBe(true);
        // No zoom for videos
        expect(q('.gallery-modal-content')!.classList.contains('is-video')).toBe(true);

        (q('.info-btn') as HTMLButtonElement).click();
        const labels = Array.from(document.querySelectorAll('.info-label')).map(l => l.textContent);
        expect(labels).toContain('Duration');
    });

    test('moving on stops the video and lets go of its download', async () => {
        const video = clip('v');
        const release = jest.spyOn(video, 'releaseVideo');
        const { q } = openViewer([video, local('a')]);
        await flush();

        (q('.gallery-modal-nav.next') as HTMLButtonElement).click();
        await flush();
        expect(release).toHaveBeenCalled();
        expect(q('video.gallery-modal-video')!.classList.contains('is-hidden')).toBe(true);
        expect(q('video.gallery-modal-video')!.hasAttribute('src')).toBe(false);
        expect(q('.gallery-modal-image-container img')!.classList.contains('is-hidden')).toBe(false);
        expect(q('.gallery-modal-content')!.classList.contains('is-video')).toBe(false);
    });

    test('a video that fails to load shows its still frame', async () => {
        const broken = new ImageSource('immich://home/search/asset/x', 'immich', 'x', undefined, undefined, () => Promise.resolve('blob:x-still'));
        broken.setMediaType('video', () => Promise.reject(new Error('HTTP 500')));
        const { q } = openViewer([broken, local('a')]);
        await flush();
        await flush();

        const img = q('.gallery-modal-image-container img') as HTMLImageElement;
        expect(q('video.gallery-modal-video')!.classList.contains('is-hidden')).toBe(true);
        expect(img.classList.contains('is-hidden')).toBe(false);
        expect(img.alt).toBe('Failed to load video');
        expect(img.getAttribute('src')).toBe('blob:x-still');
    });

    test('a video the player cannot decode shows its still frame', async () => {
        const { q } = openViewer([clip('v'), local('a')]);
        await flush();
        q('video.gallery-modal-video')!.dispatchEvent(new Event('error'));
        await flush();
        expect(q('video.gallery-modal-video')!.classList.contains('is-hidden')).toBe(true);
        expect((q('.gallery-modal-image-container img') as HTMLImageElement).getAttribute('src')).toBe('blob:v-still');
    });

    test('a remote video over the size limit is not downloaded; it links to Immich instead', async () => {
        const big = clip('big');
        big.size = 900 * 1024 * 1024;
        big.openUrl = 'https://immich.example.com/photos/big';
        const resolveVideo = jest.spyOn(big, 'resolveVideoUrl');
        const open = jest.spyOn(window, 'open').mockImplementation(() => null);

        const view = new MasonryView(createContainer());
        view.setOptions({ maxRemoteVideoMb: 200 });
        view.update([big, local('a')]);
        (view as any).expandImage(big);
        await flush();
        const q = (sel: string) => document.querySelector(sel) as HTMLElement;

        expect(resolveVideo).not.toHaveBeenCalled();
        expect(q('video.gallery-modal-video').classList.contains('is-hidden')).toBe(true);
        expect(q('.gallery-modal-image-container img').getAttribute('src')).toBe('blob:big-still');
        const notice = q('.gallery-modal-video-notice');
        expect(notice.classList.contains('is-hidden')).toBe(false);
        expect(notice.textContent).toContain('too large to play here (900.0 MB)');
        (notice.querySelector('button') as HTMLButtonElement).click();
        expect(open).toHaveBeenCalledWith('https://immich.example.com/photos/big', '_blank');

        // The notice goes away on the next item
        (q('.gallery-modal-nav.next') as HTMLButtonElement).click();
        expect(q('.gallery-modal-video-notice').classList.contains('is-hidden')).toBe(true);
    });

    test('external videos stream from their URL at any size, once remote content is allowed', async () => {
        jest.spyOn(VideoPoster, 'captureExternal').mockResolvedValue({ url: 'blob:ext-still' });
        const ext = ImageSource.fromUrl('https://cdn.example.com/huge.mp4');
        ext.size = 5 * 1024 * 1024 * 1024;

        const view = new MasonryView(createContainer());
        view.setOptions({ allowRemoteImages: true, maxRemoteVideoMb: 200 });
        view.update([ext, local('a')]);
        (view as any).expandImage(ext);
        await flush();
        expect(document.querySelector('video.gallery-modal-video')!.getAttribute('src')).toBe('https://cdn.example.com/huge.mp4');
        expect(document.querySelector('.gallery-modal-video-notice')!.classList.contains('is-hidden')).toBe(true);
    });

    test('external videos are not loaded while remote content is off', async () => {
        const capture = jest.spyOn(VideoPoster, 'captureExternal');
        const ext = ImageSource.fromUrl('https://cdn.example.com/clip.mp4');
        const { q } = openViewer([ext, local('a')]);
        await flush();

        expect(q('video.gallery-modal-video')!.classList.contains('is-hidden')).toBe(true);
        expect(q('video.gallery-modal-video')!.hasAttribute('src')).toBe(false);
        const img = q('.gallery-modal-image-container img') as HTMLImageElement;
        expect(img.alt).toBe('External video blocked');
        expect(capture).not.toHaveBeenCalled();
    });

    test('a large Nextcloud video links to Nextcloud', async () => {
        const big = new ImageSource('nextcloud://cloud/Clips/big.mp4', 'nextcloud', 'big', undefined, undefined, () => Promise.resolve('blob:big-still'));
        big.setMediaType('video', () => Promise.resolve('blob:big-video'));
        big.size = 900 * 1024 * 1024;
        big.openUrl = 'https://cloud.example.com/index.php/f/42';
        openViewer([big, local('a')]);
        await flush();
        expect(document.querySelector('.gallery-modal-video-notice button')!.textContent).toBe('Open in Nextcloud');
    });

    test('a video whose source gave no length learns it from the player, updating the tile', async () => {
        const container = createContainer();
        const view = new MasonryView(container);
        const video = clip('v');
        view.update([video, local('a')]);
        (view as any).expandImage(video);
        await flush();

        const player = document.querySelector('video.gallery-modal-video') as HTMLVideoElement;
        Object.defineProperty(player, 'duration', { value: 75, configurable: true });
        player.dispatchEvent(new Event('loadedmetadata'));
        expect(video.durationSeconds).toBe(75);
        expect(container.querySelector('.gallery-video-badge-time')!.textContent).toBe('1:15');
    });

    test('videos under the limit, of unknown size, local, or with no limit set are played', async () => {
        const small = clip('small');
        small.size = 50 * 1024 * 1024;
        const unknown = clip('unknown');
        const noLimit = clip('nolimit');
        noLimit.size = 5 * 1024 * 1024 * 1024;
        const localBig = new ImageSource('Clips/long.mp4', 'local', 'long', 'app://long.mp4', undefined, () => Promise.resolve('blob:long-still'));
        localBig.size = 5 * 1024 * 1024 * 1024;

        for (const [item, limit, src] of [[small, 200, 'blob:small-video'], [unknown, 200, 'blob:unknown-video'], [noLimit, 0, 'blob:nolimit-video'], [localBig, 200, 'app://long.mp4']] as const) {
            document.body.innerHTML = '';
            const view = new MasonryView(createContainer());
            view.setOptions({ maxRemoteVideoMb: limit });
            view.update([item, local('a')]);
            (view as any).expandImage(item);
            await flush();
            expect(document.querySelector('video.gallery-modal-video')!.getAttribute('src')).toBe(src);
        }
    });

    test('a local video still frame is not cut off by the remote load timeout', () => {
        jest.useFakeTimers();
        try {
            const view = new MasonryView(createContainer());
            view.setOptions({ remoteLoadTimeoutMs: 1000 });
            const slow = new ImageSource('Clips/a.mp4', 'local', 'a', 'app://a.mp4', undefined, () => new Promise<string>(() => {}));
            const onError = jest.fn();
            (view as any).loadWithTimeout(slow, jest.fn(), onError);
            jest.advanceTimersByTime(60000);
            expect(onError).not.toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });

    test('the slideshow lets a video play to the end before moving on', async () => {
        jest.useFakeTimers();
        try {
            const view = new MasonryView(createContainer());
            view.setOptions({ slideshowInterval: 2 });
            const images = [clip('v'), local('a')];
            view.update(images);
            (view as any).expandImage(images[0]);
            await Promise.resolve();
            const counter = () => document.querySelector('.gallery-modal-counter')!.textContent;

            (document.querySelector('.play-btn') as HTMLButtonElement).click();
            jest.advanceTimersByTime(10000);
            expect(counter()).toBe('1 / 2');

            document.querySelector('video.gallery-modal-video')!.dispatchEvent(new Event('ended'));
            expect(counter()).toBe('2 / 2');
            jest.advanceTimersByTime(2100);
            expect(counter()).toBe('1 / 2');
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('wheel zoom', () => {
    test('one mouse-wheel notch zooms by 1.25x', () => {
        expect(wheelZoomFactor(-100)).toBeCloseTo(1.25);
        expect(wheelZoomFactor(100)).toBeCloseTo(1 / 1.25);
    });

    test('small touchpad deltas zoom a little', () => {
        expect(wheelZoomFactor(-4)).toBeGreaterThan(1);
        expect(wheelZoomFactor(-4)).toBeLessThan(1.01);
    });

    test('line and page deltas never zoom more than one notch', () => {
        expect(wheelZoomFactor(-3, 1)).toBeCloseTo(1.25);
        expect(wheelZoomFactor(-1, 2)).toBeCloseTo(1.25);
        expect(wheelZoomFactor(-1000)).toBeCloseTo(1.25);
    });
});
