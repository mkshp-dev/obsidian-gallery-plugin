import GalleryPlugin from '../../src/main';
import { Notice } from 'obsidian';
import { ImageSource } from '../../src/models/ImageSource';
import { MasonryView } from '../../src/views/MasonryView';
import { JustifiedView } from '../../src/views/JustifiedView';
import { ThumbnailView } from '../../src/views/ThumbnailView';
import { EmbedView } from '../../src/views/EmbedView';
import { CarouselView } from '../../src/views/CarouselView';

const platform = { isPhone: false };
const menus: any[] = [];

jest.mock('obsidian', () => {
    const original = jest.requireActual('obsidian');
    class FakeMenu {
        items: any[] = [];
        shownAt: MouseEvent | null = null;
        constructor() { menus.push(this); }
        addItem(cb: (item: any) => void) {
            const item: any = { onClick(fn: () => void) { item.click = fn; return item; } };
            for (const name of ['setSection', 'setTitle', 'setIcon', 'setWarning']) item[name] = (v: unknown) => { item[name.slice(3).toLowerCase()] = v; return item; };
            cb(item);
            this.items.push(item);
            return this;
        }
        showAtMouseEvent(e: MouseEvent) { this.shownAt = e; return this; }
    }
    return { ...original, setIcon: (el: HTMLElement, icon: string) => el.setAttribute('data-icon', icon), Menu: FakeMenu, Platform: new Proxy({}, { get: (_t, key) => (platform as any)[key] }) };
});

const local = (name: string) => ImageSource.fromLocalPath(`Photos/${name}`, name, `app://${name}`);
const remote = () => new ImageSource('https://example.com/a.jpg', 'external', 'a', 'https://example.com/a.jpg');
const rightClick = (el: Element) => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event;
};

describe('showImageMenu', () => {
    const file = { path: 'Photos/a.jpg' };
    const setup = (opts: { file?: unknown; rename?: boolean } = {}) => {
        menus.length = 0;
        const openFile = jest.fn();
        const getLeaf = jest.fn(() => ({ openFile }));
        // Stands in for core: Obsidian's own file-menu listener adds Open in new window and the copy items
        const trigger = jest.fn((_name: string, menu: any) => {
            menu.addItem((i: any) => i.setSection('open').setTitle('Open in new window'));
            menu.addItem((i: any) => i.setSection('system').setTitle('Copy path'));
        });
        const fileManager: any = { promptForDeletion: jest.fn() };
        if (opts.rename !== false) fileManager.promptForFileRename = jest.fn();
        const plugin: any = {
            showRemoteImageMenu: (GalleryPlugin.prototype as any).showRemoteImageMenu,
            app: {
                vault: { getFileByPath: jest.fn((p: string) => ('file' in opts ? opts.file : p === file.path ? file : null)) },
                workspace: { getLeaf, trigger },
                fileManager
            }
        };
        const show = (image: ImageSource) => {
            const event = new MouseEvent('contextmenu', { cancelable: true });
            const stop = jest.spyOn(event, 'stopPropagation');
            (GalleryPlugin.prototype as any).showImageMenu.call(plugin, image, event);
            return { event, stop };
        };
        return { plugin, show, getLeaf, openFile, trigger, fileManager };
    };
    const titles = () => menus[0].items.map((i: any) => i.title);

    beforeEach(() => { platform.isPhone = false; });

    test('opens the usual file menu for a photo from the vault, and replaces the default menu', () => {
        const { show, trigger } = setup();
        const { event, stop } = show(local('a.jpg'));

        expect(event.defaultPrevented).toBe(true);
        expect(stop).toHaveBeenCalled();
        // Open in new window comes from core's file-menu listener, once
        expect(titles()).toEqual(['Open in new tab', 'Open to the right', 'Rename', 'Open in new window', 'Copy path', 'Delete']);
        expect(titles().filter((t: string) => t === 'Open in new window')).toHaveLength(1);
        expect(menus[0].shownAt).toBe(event);
        // Core and other plugins add their items through file-menu, before Delete goes last
        expect(trigger).toHaveBeenCalledWith('file-menu', menus[0], file, 'gallery-view');
    });

    test('the items do what they say', () => {
        const { show, getLeaf, openFile, fileManager } = setup();
        show(local('a.jpg'));
        const click = (title: string) => menus[0].items.find((i: any) => i.title === title).click();

        click('Open in new tab');
        expect(getLeaf).toHaveBeenLastCalledWith('tab');
        click('Open to the right');
        expect(getLeaf).toHaveBeenLastCalledWith('split');
        expect(openFile).toHaveBeenCalledTimes(2);
        expect(openFile).toHaveBeenCalledWith(file);

        click('Rename');
        expect(fileManager.promptForFileRename).toHaveBeenCalledWith(file);
        click('Delete');
        expect(fileManager.promptForDeletion).toHaveBeenCalledWith(file);
        expect(menus[0].items.find((i: any) => i.title === 'Delete').warning).toBe(true);
    });

    test('phones get no split, and Rename is left out where Obsidian lacks it', () => {
        platform.isPhone = true;
        const { show } = setup({ rename: false });
        show(local('a.jpg'));
        expect(titles()).toEqual(['Open in new tab', 'Open in new window', 'Copy path', 'Delete']);
    });

    test('a vault path with no file behind it keeps the default menu', () => {
        const { show } = setup();
        expect(show(local('missing.jpg')).event.defaultPrevented).toBe(false);
        expect(menus).toHaveLength(0);
    });

    test('photos from Immich and Nextcloud link to their page there', () => {
        const { show } = setup();
        const immich = new ImageSource('immich://home/search/asset/a1', 'immich', 'a1');
        immich.openUrl = 'https://immich.example.com/photos/a1';
        const { event, stop } = show(immich);

        expect(event.defaultPrevented).toBe(true);
        expect(stop).toHaveBeenCalled();
        expect(titles()).toEqual(['Open in Immich', 'Copy link']);
        expect(menus[0].shownAt).toBe(event);

        const nextcloud = new ImageSource('nextcloud://home/a.jpg', 'nextcloud-share', 'a.jpg');
        nextcloud.openUrl = 'https://cloud.example.com/s/TOKEN';
        menus.length = 0;
        show(nextcloud);
        expect(titles()).toEqual(['Open in Nextcloud', 'Copy link']);
    });

    test('external photos open their URL in the browser and copy it', async () => {
        const { show } = setup();
        const open = jest.spyOn(window, 'open').mockImplementation(() => null);
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        show(remote() as ImageSource);
        const click = (title: string) => menus[0].items.find((i: any) => i.title === title).click();

        expect(titles()).toEqual(['Open in browser', 'Copy link']);
        click('Open in browser');
        expect(open).toHaveBeenCalledWith('https://example.com/a.jpg', '_blank');
        click('Copy link');
        expect(writeText).toHaveBeenCalledWith('https://example.com/a.jpg');
        await Promise.resolve();
        expect(Notice).toHaveBeenCalledWith('Link copied');
        open.mockRestore();
    });

    test('a remote photo with no page to link to keeps the default menu', () => {
        const { show } = setup();
        // A Nextcloud file the server gave no file id for
        const { event } = show(new ImageSource('nextcloud://home/a.jpg', 'nextcloud', 'a.jpg'));
        expect(event.defaultPrevented).toBe(false);
        expect(menus).toHaveLength(0);
    });
});

describe('views call the image menu on right-click', () => {
    const container = () => {
        const el = document.createElement('div') as HTMLElement & { empty?: () => void };
        el.empty = () => { while (el.firstChild) el.removeChild(el.firstChild); };
        document.body.appendChild(el);
        return el;
    };

    test.each([
        ['masonry', MasonryView, '.gallery-tile'],
        ['justified', JustifiedView, '.gallery-tile'],
        ['thumbnail', ThumbnailView, '.gallery-thumbnail-item'],
        ['embed', EmbedView, '.gallery-embed-item'],
        ['carousel', CarouselView, '.gallery-carousel-item']
    ] as const)('%s', (_name, ViewClass, selector) => {
        const view = new (ViewClass as any)(container());
        const onImageMenu = jest.fn();
        view.setOptions({ onImageMenu });
        const images = [local('a.jpg'), local('b.jpg')];
        view.update(images);

        const tiles = view.container.querySelectorAll(selector);
        rightClick(tiles[1]);

        expect(onImageMenu).toHaveBeenCalledTimes(1);
        expect(onImageMenu.mock.calls[0][0]).toBe(images[1]);
        expect(onImageMenu.mock.calls[0][1]).toBeInstanceOf(MouseEvent);
    });

    test('nothing happens without a menu to show', () => {
        const view = new MasonryView(container());
        view.update([local('a.jpg')]);
        expect(rightClick(view.container.querySelector('.gallery-tile')!).defaultPrevented).toBe(false);
    });

    test('later option updates keep the menu', () => {
        const view = new MasonryView(container());
        const onImageMenu = jest.fn();
        view.setOptions({ onImageMenu });
        view.setOptions({ pagination: false });
        view.update([local('a.jpg')]);
        rightClick(view.container.querySelector('.gallery-tile')!);
        expect(onImageMenu).toHaveBeenCalledTimes(1);
    });

    test('the image viewer has no file menu, since it would open hidden behind the viewer', () => {
        const view = new MasonryView(container());
        const onImageMenu = jest.fn();
        view.setOptions({ onImageMenu });
        const images = [local('a.jpg'), local('b.jpg')];
        view.update(images);
        (view as any).expandImage(images[0]);

        const event = rightClick(document.querySelector('.gallery-modal-image-container')!);
        expect(onImageMenu).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });
});
