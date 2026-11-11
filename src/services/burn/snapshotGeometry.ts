/**
 * Geometry and text layout for drawing a gallery onto a canvas. Pure functions, so they can be
 * tested without a browser canvas.
 */

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function intersect(a: Rect, b: Rect): Rect | null {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);
    return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

export function union(a: Rect | null, b: Rect): Rect {
    if (!a) return { ...b };
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return {
        x, y,
        width: Math.max(a.x + a.width, b.x + b.width) - x,
        height: Math.max(a.y + a.height, b.y + b.height) - y
    };
}

/** One CSS object-position component ("50%", "12px", "center"...) as an offset into `free` px */
function positionOffset(value: string | undefined, free: number): number {
    if (!value) return free / 2;
    const v = value.trim();
    if (v === 'left' || v === 'top') return 0;
    if (v === 'right' || v === 'bottom') return free;
    if (v === 'center') return free / 2;
    const pct = /^(-?\d+(?:\.\d+)?)%$/.exec(v);
    if (pct) return free * Number(pct[1]) / 100;
    const px = /^(-?\d+(?:\.\d+)?)px$/.exec(v);
    if (px) return Number(px[1]);
    return free / 2;
}

/**
 * Where an image of natural size `nw`×`nh` is drawn inside `box`, following CSS object-fit and
 * object-position. The result may extend past the box (cover); the caller clips to the box.
 */
export function objectFitRect(box: Rect, nw: number, nh: number, fit: string, position: string): Rect {
    if (!(nw > 0 && nh > 0)) return { ...box };
    let width: number;
    let height: number;
    switch (fit) {
        case 'cover': {
            const s = Math.max(box.width / nw, box.height / nh);
            width = nw * s; height = nh * s;
            break;
        }
        case 'contain': {
            const s = Math.min(box.width / nw, box.height / nh);
            width = nw * s; height = nh * s;
            break;
        }
        case 'none':
            width = nw; height = nh;
            break;
        case 'scale-down': {
            const s = Math.min(1, box.width / nw, box.height / nh);
            width = nw * s; height = nh * s;
            break;
        }
        default: // fill
            return { ...box };
    }
    const [px, py] = position.trim().split(/\s+/);
    return {
        x: box.x + positionOffset(px, box.width - width),
        y: box.y + positionOffset(py, box.height - height),
        width,
        height
    };
}

/**
 * Words wrapped into lines no wider than `maxWidth`, at most `maxLines` (the last one ending in
 * an ellipsis when text was cut). A word wider than a line is broken by characters.
 */
export function wrapText(text: string, maxWidth: number, maxLines: number, measure: (s: string) => number): string[] {
    const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (words.length === 0 || maxLines < 1 || maxWidth <= 0) return [];
    const lines: string[] = [];
    let current = '';
    for (const original of words) {
        let word = original;
        const candidate = current ? `${current} ${word}` : word;
        if (measure(candidate) <= maxWidth) {
            current = candidate;
            continue;
        }
        if (current) lines.push(current);
        // Break a word that doesn't fit on a line of its own
        while (measure(word) > maxWidth && word.length > 1) {
            let cut = word.length - 1;
            while (cut > 1 && measure(word.slice(0, cut)) > maxWidth) cut--;
            lines.push(word.slice(0, cut));
            word = word.slice(cut);
        }
        current = word;
    }
    if (current) lines.push(current);

    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = ellipsize(kept[maxLines - 1], maxWidth, measure);
    return kept;
}

function ellipsize(line: string, maxWidth: number, measure: (s: string) => number): string {
    let text = line;
    while (text.length > 0 && measure(`${text}…`) > maxWidth) text = text.slice(0, -1);
    return `${text.trimEnd()}…`;
}

/**
 * The scale to draw at: `preferred` (2 for sharp images on high-density screens), lowered so the
 * canvas stays within what browsers and WebP can hold.
 */
export function fitScale(width: number, height: number, preferred: number, maxSide = 16000, maxArea = 64_000_000): number {
    if (!(width > 0 && height > 0)) return preferred;
    let scale = preferred;
    scale = Math.min(scale, maxSide / width, maxSide / height);
    scale = Math.min(scale, Math.sqrt(maxArea / (width * height)));
    return scale;
}
