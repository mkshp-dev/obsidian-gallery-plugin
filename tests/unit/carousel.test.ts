import { CarouselView } from '../../src/views/CarouselView';
import { ImageSource } from '../../src/models/ImageSource';

describe('CarouselView modal behavior', () => {
  test('blocks external images when allowRemoteImages is false', () => {
    const container = document.createElement('div');
    const view = new CarouselView(container as any);
    // Apply options
    view.setOptions({ allowRemoteImages: false, remoteLoadTimeoutMs: 100 });

    const img = ImageSource.fromUrl('https://picsum.photos/200/300');
    view.update([img]);

    // Simulate click on the first item
    const item = container.querySelector('.gallery-carousel-item') as HTMLElement | null;
    expect(item).toBeTruthy();
    if (item) item.click();

    const modalImg = document.querySelector('.gallery-modal-image img') as HTMLImageElement | null;
    expect(modalImg).toBeTruthy();
    expect(modalImg!.classList.contains('gallery-external-blocked') || modalImg!.alt.includes('blocked')).toBeTruthy();
  });
});

describe('CarouselView controls', () => {
  const images = (n: number) => Array.from({ length: n }, (_, i) => new ImageSource(`photos/${i}.jpg`, 'local', `img${i}`, `app://${i}.jpg`));
  const render = (n: number, options = {}) => {
    const container = document.createElement('div');
    const view = new CarouselView(container as any);
    view.setOptions(options);
    view.update(images(n));
    return { container, view };
  };
  const q = (c: HTMLElement, sel: string) => c.querySelector(sel) as HTMLElement | null;

  test('shows a counter and dots, and disables the arrows at the ends', () => {
    const { container, view } = render(3);
    const prev = q(container, '.gallery-carousel-nav.prev') as HTMLButtonElement;
    const next = q(container, '.gallery-carousel-nav.next') as HTMLButtonElement;
    const dots = () => Array.from(container.querySelectorAll('.gallery-carousel-indicator'));

    expect(q(container, '.gallery-carousel-counter')!.textContent).toBe('1 / 3');
    expect(dots()).toHaveLength(3);
    expect(dots()[0].classList.contains('active')).toBe(true);
    expect(dots()[0].getAttribute('aria-current')).toBe('true');
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    next.click();
    next.click();
    expect(q(container, '.gallery-carousel-counter')!.textContent).toBe('3 / 3');
    expect(dots()[2].classList.contains('active')).toBe(true);
    expect(dots()[0].hasAttribute('aria-current')).toBe(false);
    expect(next.disabled).toBe(true);
    // Positioned by percentage, so resizing the pane keeps the slide aligned
    expect(q(container, '.gallery-carousel-container')!.style.transform).toBe('translateX(-200%)');

    (view as any).goTo(1);
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(false);
  });

  test('leaves the dots out for long galleries; the counter shows the position', () => {
    const { container } = render(13);
    expect(container.querySelectorAll('.gallery-carousel-indicator')).toHaveLength(0);
    expect(q(container, '.gallery-carousel-counter')!.textContent).toBe('1 / 13');
  });

  test('a single image gets no arrows, counter or dots', () => {
    const { container } = render(1);
    expect(q(container, '.gallery-carousel-nav')).toBeNull();
    expect(q(container, '.gallery-carousel-counter')).toBeNull();
    expect(q(container, '.gallery-carousel-indicators')).toBeNull();
  });

  test('the height option sets the stage height for this gallery', () => {
    const { container } = render(2, { height: 300 });
    expect(q(container, '.gallery-carousel')!.style.getPropertyValue('--gallery-carousel-height')).toBe('300px');
  });
});
