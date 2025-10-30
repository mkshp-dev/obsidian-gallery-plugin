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
