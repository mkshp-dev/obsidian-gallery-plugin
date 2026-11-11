import { Rect, intersect, union, objectFitRect, wrapText, fitScale } from './snapshotGeometry';

/**
 * Draws a rendered gallery onto a canvas, as it looks right now, and returns it as an image.
 *
 * It doesn't screenshot the window (plugins can't, and not on mobile). It walks the gallery's
 * DOM and repaints what's there from the layout the browser computed: each box's background,
 * border and rounded corners, each image with its object-fit, captions, video badges and icons.
 * That covers every view, because they are all built from those pieces.
 *
 * Images are never drawn from the <img> elements themselves: a vault resource URL or a remote
 * URL would "taint" the canvas and the browser would refuse to export it. The caller's
 * `loadImage` supplies each image's bytes instead (read from the vault, fetched without CORS,
 * or taken from the blob the gallery already downloaded).
 */

export interface SnapshotOptions {
    /**
     * The image an <img> shows: its bytes, or a blob:/data: URL of this window (those don't taint
     * the canvas); null to leave it out
     */
    loadImage: (img: HTMLImageElement) => Promise<Blob | string | null>;
    /** Pixels per CSS pixel (default 2), lowered for galleries too large for one image */
    scale?: number;
    /** Fill behind the gallery; null for transparent. Default: the note's background */
    background?: string | null;
    /** Output type (default image/webp) and quality */
    type?: string;
    quality?: number;
}

export interface SnapshotResult {
    blob: Blob;
    width: number;
    height: number;
    /** Images that couldn't be drawn (their tile is left empty) */
    missingImages: number;
}

/** Controls and notes that make sense only in the live gallery */
const SKIP_SELECTOR = [
    'button',
    'input',
    '.gallery-pagination',
    '.gallery-loading-spinner',
    '.gallery-warning-compact',
    '.gallery-error-compact',
    '.gallery-carousel-nav',
    '.gallery-carousel-counter',
    '.gallery-carousel-indicators'
].join(',');

const LOAD_CONCURRENCY = 4;

interface PreparedImage {
    source: CanvasImageSource;
    naturalWidth: number;
    naturalHeight: number;
}

export class GallerySnapshot {
    private readonly prepared = new Map<HTMLImageElement, PreparedImage>();
    private readonly svgImages = new Map<SVGSVGElement, HTMLImageElement>();
    private readonly objectUrls: string[] = [];
    private readonly bitmaps: ImageBitmap[] = [];
    private ctx!: CanvasRenderingContext2D;
    private missingImages = 0;

    private constructor(private readonly root: HTMLElement, private readonly options: SnapshotOptions) {}

    static async capture(root: HTMLElement, options: SnapshotOptions): Promise<SnapshotResult> {
        const snapshot = new GallerySnapshot(root, options);
        try {
            return await snapshot.run();
        } finally {
            snapshot.release();
        }
    }

    private async run(): Promise<SnapshotResult> {
        const region = this.captureRegion();
        if (!region) throw new Error('The gallery has nothing visible to burn');

        const scale = fitScale(region.width, region.height, this.options.scale ?? 2);
        await Promise.all([this.prepareImages(region, scale), this.prepareSvgs()]);

        const canvas = createEl('canvas');
        canvas.width = Math.max(1, Math.round(region.width * scale));
        canvas.height = Math.max(1, Math.round(region.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('This device could not create a canvas to draw the gallery on');
        this.ctx = ctx;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const background = this.options.background === undefined ? this.noteBackground() : this.options.background;
        if (background) {
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.scale(scale, scale);
        ctx.translate(-region.x, -region.y);
        this.paint(this.root);

        const blob = await new Promise<Blob | null>(resolve =>
            canvas.toBlob(resolve, this.options.type ?? 'image/webp', this.options.quality ?? 0.92));
        if (!blob) throw new Error('The gallery image could not be encoded');
        return { blob, width: canvas.width, height: canvas.height, missingImages: this.missingImages };
    }

    private release(): void {
        this.bitmaps.forEach(bitmap => bitmap.close());
        this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    }

    // ---- What to capture ----

    /**
     * The area to capture: the visible tiles, plus the gallery's own padding and border around
     * them so its frame shows. Pagination bars and notes below the tiles fall outside it.
     */
    private captureRegion(): Rect | null {
        let tiles: Rect | null = null;
        for (const tile of Array.from(this.root.querySelectorAll<HTMLElement>('[data-image-path]'))) {
            const visible = this.visibleRect(tile);
            if (visible) tiles = union(tiles, visible);
        }
        if (!tiles) return null;

        const style = getComputedStyle(this.root);
        const px = (v: string) => parseFloat(v) || 0;
        const grown: Rect = {
            x: tiles.x - px(style.paddingLeft) - px(style.borderLeftWidth),
            y: tiles.y - px(style.paddingTop) - px(style.borderTopWidth),
            width: tiles.width + px(style.paddingLeft) + px(style.paddingRight) + px(style.borderLeftWidth) + px(style.borderRightWidth),
            height: tiles.height + px(style.paddingTop) + px(style.paddingBottom) + px(style.borderTopWidth) + px(style.borderBottomWidth)
        };
        return intersect(grown, toRect(this.root.getBoundingClientRect()));
    }

    private visibleRect(el: Element): Rect | null {
        return visibleRectWithin(el, this.root);
    }

    /** The colour behind the gallery in the note, so the image matches what's on screen */
    private noteBackground(): string | null {
        for (let node: HTMLElement | null = this.root; node; node = node.parentElement) {
            const color = getComputedStyle(node).backgroundColor;
            if (!isTransparent(color)) return color;
        }
        return null;
    }

    // ---- Image loading ----

    /** Load every visible image, decoded at about the size it will be drawn */
    private async prepareImages(region: Rect, scale: number): Promise<void> {
        const imgs = Array.from(this.root.querySelectorAll('img')).filter(img => {
            const visible = this.visibleRect(img);
            return visible && intersect(visible, region) && !img.closest(SKIP_SELECTOR);
        });
        let next = 0;
        const worker = async () => {
            while (next < imgs.length) {
                const img = imgs[next++];
                try {
                    const prepared = await this.prepareImage(img, scale);
                    if (prepared) this.prepared.set(img, prepared);
                    else this.missingImages++;
                } catch (error) {
                    console.warn('Gallery burn: could not load an image', img.alt, error);
                    this.missingImages++;
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(LOAD_CONCURRENCY, imgs.length) }, worker));
    }

    private async prepareImage(img: HTMLImageElement, scale: number): Promise<PreparedImage | null> {
        const loaded = await this.options.loadImage(img);
        if (!loaded) return null;
        let url: string;
        if (typeof loaded === 'string') {
            url = loaded;
        } else {
            url = URL.createObjectURL(loaded);
            this.objectUrls.push(url);
        }
        const decoded = new Image();
        decoded.src = url;
        await decoded.decode();
        const naturalWidth = decoded.naturalWidth;
        const naturalHeight = decoded.naturalHeight;

        // Decode once at the drawn size, so a gallery of large photos doesn't hold them all full size
        const style = getComputedStyle(img);
        const target = objectFitRect(contentBox(img, style), naturalWidth, naturalHeight, style.objectFit, style.objectPosition);
        const width = Math.ceil(target.width * scale);
        const height = Math.ceil(target.height * scale);
        if (width > 0 && height > 0 && width < naturalWidth && typeof createImageBitmap === 'function') {
            try {
                const bitmap = await createImageBitmap(decoded, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
                this.bitmaps.push(bitmap);
                return { source: bitmap, naturalWidth, naturalHeight };
            } catch {
                // Some images (SVGs without a size) can't become bitmaps; draw the decoded image instead
            }
        }
        return { source: decoded, naturalWidth, naturalHeight };
    }

    /**
     * Turn the SVG icons into images up front: that's asynchronous, and painting is not
     */
    private async prepareSvgs(): Promise<void> {
        const svgs = Array.from(this.root.querySelectorAll('svg')).filter(svg => !svg.closest(SKIP_SELECTOR) && isShown(svg));
        await Promise.all(svgs.map(async svg => {
            const rect = svg.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const style = getComputedStyle(svg);
            const color = style.color;
            const clone = svg.cloneNode(true) as SVGSVGElement;
            // Icon strokes are often set by the theme's CSS, which the standalone SVG won't have
            if (style.strokeWidth) clone.setAttribute('stroke-width', style.strokeWidth);
            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            clone.setAttribute('width', String(rect.width));
            clone.setAttribute('height', String(rect.height));
            const markup = new XMLSerializer().serializeToString(clone).replace(/currentColor/g, color);
            const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
            this.objectUrls.push(url);
            const image = new Image();
            image.src = url;
            try {
                await image.decode();
                this.svgImages.set(svg, image);
            } catch {
                // An icon that won't render is left out
            }
        }));
    }

    // ---- Painting ----

    private paint(el: Element): void {
        if (el.matches(SKIP_SELECTOR)) return;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        const opacity = parseFloat(style.opacity);
        // A fading-in image (opacity 0 until loaded) is drawn as it will look once loaded
        const isImg = el.instanceOf(HTMLImageElement);
        if (!isImg && opacity < 0.05) return;

        const rect = toRect(el.getBoundingClientRect());
        const ctx = this.ctx;
        ctx.save();
        if (!isImg && opacity < 1) ctx.globalAlpha *= opacity;

        this.paintBox(rect, style);
        if (isImg) {
            this.paintImage(el, rect, style);
            ctx.restore();
            return;
        }
        if (el.instanceOf(SVGSVGElement)) {
            this.paintSvg(el, rect);
            ctx.restore();
            return;
        }
        this.paintText(el, rect, style);

        if (clipsOverflow(style)) {
            roundedPath(ctx, paddingBox(rect, style), radii(rect, style));
            ctx.clip();
        }
        for (const child of Array.from(el.children)) this.paint(child);
        ctx.restore();
    }

    /** Background colour and border */
    private paintBox(rect: Rect, style: CSSStyleDeclaration): void {
        const ctx = this.ctx;
        const corners = radii(rect, style);
        if (!isTransparent(style.backgroundColor)) {
            roundedPath(ctx, rect, corners);
            ctx.fillStyle = style.backgroundColor;
            ctx.fill();
        }
        const border = parseFloat(style.borderTopWidth) || 0;
        if (border > 0 && style.borderTopStyle !== 'none' && !isTransparent(style.borderTopColor)) {
            const half = border / 2;
            roundedPath(ctx, { x: rect.x + half, y: rect.y + half, width: rect.width - border, height: rect.height - border },
                corners.map(r => Math.max(0, r - half)));
            ctx.lineWidth = border;
            ctx.strokeStyle = style.borderTopColor;
            ctx.stroke();
        }
    }

    private paintImage(img: HTMLImageElement, rect: Rect, style: CSSStyleDeclaration): void {
        const prepared = this.prepared.get(img);
        if (!prepared) return;
        const box = contentBox(img, style);
        const target = objectFitRect(box, prepared.naturalWidth, prepared.naturalHeight, style.objectFit, style.objectPosition);
        const ctx = this.ctx;
        ctx.save();
        roundedPath(ctx, box, radii(rect, style));
        ctx.clip();
        ctx.drawImage(prepared.source, target.x, target.y, target.width, target.height);
        ctx.restore();
    }

    /** Icons are inline SVGs coloured with currentColor; draw them through an image of the SVG */
    private paintSvg(svg: SVGSVGElement, rect: Rect): void {
        const image = this.svgImages.get(svg);
        if (image) this.ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    }

    /** Text directly inside an element (captions, a video's length), wrapped and clamped as on screen */
    private paintText(el: Element, rect: Rect, style: CSSStyleDeclaration): void {
        const text = Array.from(el.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent ?? '')
            .join('')
            .trim();
        if (!text) return;

        const ctx = this.ctx;
        const fontSize = parseFloat(style.fontSize) || 14;
        const lineHeight = style.lineHeight === 'normal' ? fontSize * 1.2 : (parseFloat(style.lineHeight) || fontSize * 1.2);
        ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.fillStyle = style.color;
        ctx.textBaseline = 'middle';

        const box = contentBox(el, style);
        const clamp = parseInt(style.getPropertyValue('-webkit-line-clamp'), 10);
        const fits = Math.max(1, Math.round(box.height / lineHeight));
        const maxLines = clamp > 0 ? Math.min(clamp, fits) : fits;
        const lines = wrapText(text, box.width + 1, maxLines, s => ctx.measureText(s).width);

        const align = style.textAlign;
        let x = box.x;
        if (align === 'center') { ctx.textAlign = 'center'; x = box.x + box.width / 2; }
        else if (align === 'right' || align === 'end') { ctx.textAlign = 'right'; x = box.x + box.width; }
        else ctx.textAlign = 'left';

        const total = lines.length * lineHeight;
        const centred = style.display.includes('flex') && style.alignItems === 'center';
        const top = centred ? box.y + Math.max(0, (box.height - total) / 2) : box.y;
        lines.forEach((line, i) => ctx.fillText(line, x, top + lineHeight * (i + 0.5)));
    }

}

/**
 * The part of an element that shows: its box clipped by every scrolling or clipping ancestor up
 * to `root` (a carousel's other slides, for example, are clipped away). Null when none of it shows.
 */
export function visibleRectWithin(el: Element, root: Element): Rect | null {
    if (!isShown(el)) return null;
    let rect: Rect | null = toRect(el.getBoundingClientRect());
    if (rect.width <= 0 || rect.height <= 0) return null;
    for (let node = el.parentElement; node && rect; node = node.parentElement) {
        if (!isShown(node)) return null;
        if (clipsOverflow(getComputedStyle(node))) rect = intersect(rect, toRect(node.getBoundingClientRect()));
        if (node === root) break;
    }
    return rect;
}

// ---- Style helpers ----

function toRect(r: DOMRect): Rect {
    return { x: r.left, y: r.top, width: r.width, height: r.height };
}

function isShown(el: Element): boolean {
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
}

function clipsOverflow(style: CSSStyleDeclaration): boolean {
    return style.overflowX !== 'visible' || style.overflowY !== 'visible';
}

function isTransparent(color: string): boolean {
    if (!color || color === 'transparent') return true;
    const rgba = /rgba?\(([^)]+)\)/.exec(color);
    if (!rgba) return false;
    const parts = rgba[1].split(/[\s,/]+/).filter(Boolean);
    return parts.length === 4 && parseFloat(parts[3]) === 0;
}

function px(value: string): number {
    return parseFloat(value) || 0;
}

/** The box inside the border */
function paddingBox(rect: Rect, style: CSSStyleDeclaration): Rect {
    const left = px(style.borderLeftWidth);
    const top = px(style.borderTopWidth);
    return {
        x: rect.x + left,
        y: rect.y + top,
        width: rect.width - left - px(style.borderRightWidth),
        height: rect.height - top - px(style.borderBottomWidth)
    };
}

/** The box inside the border and padding, where content (an image, text) goes */
function contentBox(el: Element, style: CSSStyleDeclaration): Rect {
    const rect = paddingBox(toRect(el.getBoundingClientRect()), style);
    const left = px(style.paddingLeft);
    const top = px(style.paddingTop);
    return {
        x: rect.x + left,
        y: rect.y + top,
        width: Math.max(0, rect.width - left - px(style.paddingRight)),
        height: Math.max(0, rect.height - top - px(style.paddingBottom))
    };
}

/** Corner radii in px (top-left, top-right, bottom-right, bottom-left); percentages count against the box */
function radii(rect: Rect, style: CSSStyleDeclaration): number[] {
    const one = (value: string) => {
        const first = value.trim().split(/\s+/)[0] ?? '0';
        const n = parseFloat(first) || 0;
        return first.endsWith('%') ? Math.min(rect.width, rect.height) * n / 100 : n;
    };
    const max = Math.min(rect.width, rect.height) / 2;
    return [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius]
        .map(v => Math.min(max, one(v)));
}

function roundedPath(ctx: CanvasRenderingContext2D, rect: Rect, corners: number[]): void {
    ctx.beginPath();
    if (corners.some(r => r > 0) && typeof ctx.roundRect === 'function') {
        ctx.roundRect(rect.x, rect.y, rect.width, rect.height, corners);
    } else {
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
    }
}
