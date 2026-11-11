import { App, TFile, normalizePath, requestUrl } from 'obsidian';
import type { IGalleryView, IImageSource } from '../../models/interfaces';
import { GallerySnapshot } from './GallerySnapshot';
import { burnFileName, findGalleryBlocks, locateGalleryBlock, replaceGalleryBlock } from './burnText';

/** A rendered gallery, ready to draw; `release` is called once it has been drawn */
export interface AcquiredGallery {
    view: IGalleryView;
    release(): void;
}

/** A gallery block in the note to burn */
export interface BurnTarget {
    /** The block's body (what's between the fences) */
    source: string;
    /** Line of the block's opening fence when the burn started */
    start: number;
    /**
     * The block rendered: the gallery already showing in the note, or one rendered off-screen
     * for the burn (galleries far down a note aren't rendered until scrolled to)
     */
    acquire(): Promise<AcquiredGallery>;
}

export interface BurnOptions {
    /** Vault folder for the images; '' for the vault root */
    folder: string;
    /** First part of each file name */
    pluginName: string;
    /** Date and time in the file names, e.g. "2026-11-11 143005" */
    timestamp: string;
    /** Called before each gallery is drawn (1-based) */
    onProgress?: (current: number, total: number) => void;
}

export interface BurnReport {
    /** Images made and put in the note in place of their gallery */
    burned: TFile[];
    /** Why a gallery wasn't burned; its block is left in the note */
    failed: string[];
    /** Images saved but not put in the note (the note changed while they were being drawn) */
    orphaned: TFile[];
    /** Photos that couldn't be drawn, across all the images */
    missingImages: number;
}

const MIME_BY_EXTENSION: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml'
};

/**
 * Burns galleries into their note: draws each as it looks now, saves the drawing as a WebP in
 * the chosen folder, then replaces its obs-gallery code block with an embed of the image. For
 * places that don't run plugins, such as Obsidian Publish. There's no way back: the code block
 * is gone from the note.
 */
export class GalleryBurner {
    constructor(private readonly app: App) {}

    async burnNote(note: TFile, targets: BurnTarget[], options: BurnOptions): Promise<BurnReport> {
        const report: BurnReport = { burned: [], failed: [], orphaned: [], missingImages: 0 };

        if (targets.length === 0) return report;
        const folder = GalleryBurner.resolveFolder(this.app, options.folder);
        if (folder === null) {
            report.failed.push(`The folder "${options.folder}" set for burned galleries doesn't exist. Pick another in the plugin settings.`);
            return report;
        }

        // Each gallery's position in the note numbers its file when there is more than one
        const blockStarts = findGalleryBlocks((await this.app.vault.read(note)).split('\n')).map(block => block.start);
        const rankOf = (start: number) => blockStarts.length > 1 ? blockStarts.indexOf(start) + 1 || undefined : undefined;

        // Draw and save every image first, one gallery at a time; the note is only changed once they all exist
        const made: Array<{ target: BurnTarget; file: TFile }> = [];
        for (const [index, target] of targets.entries()) {
            options.onProgress?.(index + 1, targets.length);
            let acquired: AcquiredGallery | null = null;
            try {
                acquired = await target.acquire();
                const view = acquired.view;
                await view.prepareForSnapshot?.();
                const snapshot = await GallerySnapshot.capture(view.container, {
                    loadImage: img => this.imageSource(img, view)
                });
                const name = burnFileName(options.pluginName, note.basename, options.timestamp, rankOf(target.start));
                const file = await this.app.vault.createBinary(this.availablePath(folder, name), await snapshot.blob.arrayBuffer());
                made.push({ target, file });
                report.missingImages += snapshot.missingImages;
            } catch (error) {
                console.error('Gallery burn failed:', error);
                report.failed.push(error instanceof Error ? error.message : String(error));
            } finally {
                acquired?.release();
            }
        }
        if (made.length === 0) return report;

        // Swap the blocks for embeds, last first so earlier line numbers stay put
        const placed = new Set<TFile>();
        await this.app.vault.process(note, text => {
            let current = text.split('\n');
            for (const { target, file } of [...made].sort((a, b) => b.target.start - a.target.start)) {
                const start = target.start;
                // Found again: the note may have changed while the images were drawn
                const block = locateGalleryBlock(current, target.source, start);
                if (!block) continue;
                const embed = `!${this.app.fileManager.generateMarkdownLink(file, note.path)}`;
                current = replaceGalleryBlock(current, block, embed);
                placed.add(file);
            }
            return current.join('\n');
        });

        for (const { file } of made) {
            if (placed.has(file)) report.burned.push(file);
            else report.orphaned.push(file);
        }
        return report;
    }

    /**
     * The folder for the images; '' (the vault root) when none is set. It must exist: the
     * setting only offers existing folders, so a missing one was deleted or renamed since.
     */
    static resolveFolder(app: App, folder: string): string | null {
        const path = folder.trim() ? normalizePath(folder.trim()) : '';
        if (!path || path === '/') return '';
        return app.vault.getFolderByPath(path) ? path : null;
    }

    /** `folder/name`, numbered ("name 2.webp") if a file of that name exists */
    private availablePath(folder: string, name: string): string {
        const join = (file: string) => (folder ? normalizePath(`${folder}/${file}`) : file);
        const base = name.replace(/\.webp$/, '');
        let path = join(name);
        for (let n = 2; this.app.vault.getAbstractFileByPath(path); n++) path = join(`${base} ${n}.webp`);
        return path;
    }

    /**
     * The image an <img> in the gallery shows, from where the gallery got it: the blob it already
     * downloaded (Immich, Nextcloud, video still frames), the vault file, or the URL fetched again
     * without CORS limits.
     */
    private async imageSource(img: HTMLImageElement, view: IGalleryView): Promise<Blob | string | null> {
        const path = img.closest('[data-image-path]')?.getAttribute('data-image-path');
        const source: IImageSource | undefined = path ? view.images.find(image => image.path === path) : undefined;
        const src = img.currentSrc || img.getAttribute('src') || '';

        // Already in this window, so it doesn't taint the canvas
        if (src.startsWith('blob:') || src.startsWith('data:')) return src;

        if (source?.type === 'local' && source.mediaType === 'image') {
            const file = this.app.vault.getFileByPath(source.path);
            if (file) {
                const data = await this.app.vault.readBinary(file);
                return new Blob([data], { type: MIME_BY_EXTENSION[file.extension.toLowerCase()] ?? '' });
            }
        }

        const remote = /^https?:\/\//i.test(src) ? src
            : source?.type === 'external' && source.mediaType === 'image' ? source.path : '';
        if (remote) {
            const response = await requestUrl({ url: remote, method: 'GET', throw: false });
            if (response.status >= 400) return null;
            const type = Object.entries(response.headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1] ?? '';
            return new Blob([response.arrayBuffer], { type });
        }
        return null;
    }
}
