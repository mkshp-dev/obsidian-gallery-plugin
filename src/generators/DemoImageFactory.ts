/**
 * Runtime image generation for the local "test lab" showcase.
 *
 * Images are drawn on a canvas instead of being bundled as base64 so the demo
 * can cover many sizes, aspect ratios, and formats without bloating main.js.
 * Each image is labelled with its own name, dimensions, and format so layout
 * problems are easy to spot at a glance.
 */

export type DemoImageFormat = 'png' | 'jpeg' | 'webp';

export interface DemoImageSpec {
    /** File name without extension */
    name: string;
    width: number;
    height: number;
    format: DemoImageFormat;
    /** Base hue (0-360) for the background gradient */
    hue: number;
    /** Write the extension in upper case (e.g. .JPG) */
    upperCaseExt?: boolean;
}

export interface DemoImageFile {
    fileName: string;
    data: ArrayBuffer;
}

const MIME_TO_EXT: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp'
};

/** 240x160 animated GIF (canvas cannot encode GIFs) */
export const ANIMATED_GIF_BASE64 = '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';

/**
 * Draw a labelled test image and encode it. Returns null when canvas
 * rendering is unavailable in the current environment.
 */
export async function renderDemoImage(spec: DemoImageSpec): Promise<DemoImageFile | null> {
    const canvas = createEl('canvas');
    canvas.width = spec.width;
    canvas.height = spec.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const { width: w, height: h, hue } = spec;

    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, `hsl(${hue}, 65%, 55%)`);
    gradient.addColorStop(1, `hsl(${(hue + 50) % 360}, 70%, 35%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Corner markers make cropping (object-fit: cover) obvious
    const marker = Math.max(4, Math.round(Math.min(w, h) * 0.08));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(0, 0, marker, marker);
    ctx.fillRect(w - marker, 0, marker, marker);
    ctx.fillRect(0, h - marker, marker, marker);
    ctx.fillRect(w - marker, h - marker, marker, marker);

    // Inset border shows whether edges are clipped
    const border = Math.max(1, Math.round(Math.min(w, h) * 0.01));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = border;
    ctx.strokeRect(border / 2, border / 2, w - border, h - border);

    // Centre label
    const lines = Math.min(w, h) >= 120
        ? [spec.name, `${w}×${h}`, spec.format.toUpperCase()]
        : [`${w}×${h}`];
    const fontSize = Math.max(8, Math.round(Math.min(w / 14, h / (lines.length * 2.2))));
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = Math.round(fontSize / 4);
    const lineHeight = fontSize * 1.25;
    const top = h / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => {
        ctx.fillText(line, w / 2, top + i * lineHeight, w * 0.9);
    });

    const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, `image/${spec.format}`, 0.85)
    );
    if (!blob) return null;

    // Some platforms (e.g. iOS) silently fall back to PNG for unsupported
    // encoders, so name the file after what was actually produced.
    let ext = MIME_TO_EXT[blob.type] ?? 'png';
    if (spec.upperCaseExt) ext = ext.toUpperCase();

    return { fileName: `${spec.name}.${ext}`, data: await blob.arrayBuffer() };
}

/** A 320×240 AVIF for the local test lab (canvas cannot encode AVIF, so it is embedded) */
export const AVIF_SAMPLE_BASE64 = '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';

/** SVGs for the local test lab: one with a width and height, and one with only a viewBox */
export const SVG_SAMPLES: Array<{ name: string; svg: string }> = [
    {
        name: 'vector-sized.svg',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
            '<rect width="400" height="300" fill="#2a6f97"/><rect x="6" y="6" width="388" height="288" fill="none" stroke="#fff" stroke-width="6"/>' +
            '<circle cx="200" cy="130" r="70" fill="#f9c74f"/>' +
            '<text x="200" y="260" font-family="sans-serif" font-size="26" fill="#fff" text-anchor="middle">SVG 400×300</text></svg>'
    },
    {
        name: 'vector-viewbox-only.svg',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200">' +
            '<rect width="100" height="200" fill="#6a4c93"/><rect x="2" y="2" width="96" height="196" fill="none" stroke="#fff" stroke-width="2"/>' +
            '<polygon points="50,30 85,100 15,100" fill="#ffca3a"/>' +
            '<text x="50" y="150" font-family="sans-serif" font-size="11" fill="#fff" text-anchor="middle">viewBox 1:2</text></svg>'
    }
];
