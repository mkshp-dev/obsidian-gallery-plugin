import { ThumbnailView } from '../../src/views/ThumbnailView';
import { GridView } from '../../src/views/GridView';
import { CarouselView } from '../../src/views/CarouselView';
import { ImageSource } from '../../src/models/ImageSource';

/** Image stand-in that loads (asynchronously) whenever it is given a non-empty src */
class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 10;
    naturalHeight = 10;
    private _src = '';
    set src(value: string) {
        this._src = value;
        queueMicrotask(() => (value ? this.onload?.() : this.onerror?.()));
    }
    get src() { return this._src; }
}

const OriginalImage = global.Image;
const IntersectionObserverMock = window.IntersectionObserver as unknown as jest.Mock;

function createContainer(): HTMLElement {
    const el = document.createElement('div') as HTMLElement & { empty?: () => void };
    el.empty = () => { while (el.firstChild) el.removeChild(el.firstChild); };
    document.body.appendChild(el);
    return el;
}

/** Fires the most recently created IntersectionObserver as if `targets` scrolled into view */
function intersect(targets: Element[]) {
    const calls = IntersectionObserverMock.mock.calls;
    const callback = calls[calls.length - 1][0] as (entries: Array<{ isIntersecting: boolean; target: Element }>) => void;
    callback(targets.map(target => ({ isIntersecting: true, target })));
}

/** A remote image whose fetch is controlled by the test */
function deferredImage(id: number) {
    let resolveFetch: (url: string) => void = () => {};
    let rejectFetch: (error: Error) => void = () => {};
    const loader = jest.fn(() => new Promise<string>((resolve, reject) => { resolveFetch = resolve; rejectFetch = reject; }));
    const image = new ImageSource(`immich://home/search/asset/${id}`, 'immich', `asset${id}`, undefined, undefined, loader);
    return { image, loader, resolve: (url: string) => resolveFetch(url), reject: (error: Error) => rejectFetch(error) };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
    global.Image = FakeImage as unknown as typeof Image;
    IntersectionObserverMock.mockClear();
    document.body.innerHTML = '';
});

afterEach(() => {
    global.Image = OriginalImage;
    jest.useRealTimers();
});

describe('ThumbnailView loading', () => {
    test('fetches remote images only when their tile becomes visible', async () => {
        const view = new ThumbnailView(createContainer());
        const first = deferredImage(1);
        const second = deferredImage(2);
        view.update([first.image, second.image]);

        expect(first.loader).not.toHaveBeenCalled();
        expect(second.loader).not.toHaveBeenCalled();

        const tiles = Array.from(view.container.querySelectorAll('.gallery-thumbnail-item'));
        intersect([tiles[0]]);
        expect(first.loader).toHaveBeenCalledTimes(1);
        expect(second.loader).not.toHaveBeenCalled();

        first.resolve('blob:first');
        await flush();
        expect((tiles[0].querySelector('img') as HTMLImageElement).getAttribute('src')).toBe('blob:first');
        expect(first.image.loadState).toBe('loaded');
    });

    test('runs at most 10 loads at once and starts queued ones as slots free up', async () => {
        const view = new ThumbnailView(createContainer());
        const images = Array.from({ length: 12 }, (_, i) => deferredImage(i));
        view.update(images.map(d => d.image));

        intersect(Array.from(view.container.querySelectorAll('.gallery-thumbnail-item')));
        await flush();

        const started = () => images.filter(d => d.loader.mock.calls.length > 0).length;
        expect(started()).toBe(10);

        images[0].resolve('blob:0');
        await flush();
        expect(started()).toBe(11);

        images[1].reject(new Error('HTTP 500'));
        await flush();
        expect(started()).toBe(12);
        expect(images[1].image.loadState).toBe('error');
    });

    test('reloads tiles when returning to a page that was already shown', async () => {
        const view = new ThumbnailView(createContainer());
        view.setOptions({ pagination: true, itemsPerPage: 1 });
        const a = ImageSource.fromLocalPath('photos/a.jpg', 'a', 'app://a.jpg');
        const b = ImageSource.fromLocalPath('photos/b.jpg', 'b', 'app://b.jpg');
        view.update([a, b]);

        const tileImg = () => view.container.querySelector('.gallery-thumbnail-item img') as HTMLImageElement;

        intersect([view.container.querySelector('.gallery-thumbnail-item')!]);
        await flush();
        expect(tileImg().getAttribute('src')).toBe('app://a.jpg');

        (view as any).goToPage(2);
        (view as any).goToPage(1);
        expect(tileImg().getAttribute('src')).toBeNull();

        intersect([view.container.querySelector('.gallery-thumbnail-item')!]);
        await flush();
        expect(tileImg().getAttribute('src')).toBe('app://a.jpg');
    });
});

describe('GridView loading', () => {
    test('fetches on visibility and shows the error tile once a fetch keeps failing', async () => {
        jest.useFakeTimers();
        const view = new GridView(createContainer());
        const failing = deferredImage(1);
        failing.loader.mockRejectedValue(new Error('HTTP 401'));
        view.update([failing.image]);

        expect(failing.loader).not.toHaveBeenCalled();

        // Let a failed fetch pass through its promise chain to LazyLoader's retry timer
        const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

        intersect(Array.from(view.container.querySelectorAll('img')));
        // Initial attempt plus LazyLoader's 3 retries, 1s apart
        for (let i = 0; i < 4; i++) {
            await settle();
            jest.advanceTimersByTime(1000);
        }
        await settle();

        expect(failing.loader).toHaveBeenCalledTimes(4);
        expect(failing.image.loadState).toBe('error');
        expect(view.container.querySelector('.gallery-item-error')).not.toBeNull();
    });
});

describe('CarouselView loading', () => {
    test('loads only the current slide and its neighbours, then more as it moves', () => {
        const view = new CarouselView(createContainer());
        const images = Array.from({ length: 5 }, (_, i) => deferredImage(i));
        view.update(images.map(d => d.image));

        const started = () => images.map(d => d.loader.mock.calls.length > 0);
        expect(started()).toEqual([true, true, false, false, false]);

        (view as any).goTo(2);
        expect(started()).toEqual([true, true, true, true, false]);
    });
});
