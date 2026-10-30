import { MasonryView } from '../../src/views/MasonryView';
import { ImageSource } from '../../src/models/ImageSource';
import { wheelZoomFactor } from '../../src/views/GalleryView';

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
