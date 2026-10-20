import { App, Notice } from 'obsidian';
import { DUMMY_ASSETS } from './DemoAssets';
import { ANIMATED_GIF_BASE64, DemoImageSpec, renderDemoImage } from './DemoImageFactory';
import { Logger } from '../utils/Logger';

/** Mixed shapes, formats, and awkward file names for the local test lab */
const TEST_LAB_IMAGES: DemoImageSpec[] = [
    { name: 'landscape-16x9', width: 800, height: 450, format: 'png', hue: 200 },
    { name: 'portrait-9x16', width: 450, height: 800, format: 'jpeg', hue: 20 },
    { name: 'square', width: 600, height: 600, format: 'webp', hue: 140 },
    { name: 'panorama', width: 1600, height: 320, format: 'jpeg', hue: 260 },
    { name: 'tall-strip', width: 240, height: 1000, format: 'png', hue: 320 },
    { name: 'tiny-icon', width: 48, height: 48, format: 'png', hue: 50 },
    { name: 'large-photo', width: 2400, height: 1600, format: 'jpeg', hue: 170 },
    { name: 'Bildschirmfoto 2026-10-17 um 09.20.05', width: 500, height: 700, format: 'png', hue: 0 },
    { name: 'A really long file name that should be truncated with an ellipsis in captions', width: 640, height: 480, format: 'jpeg', hue: 90 },
    { name: 'café – ünïcödé & spaces', width: 640, height: 480, format: 'webp', hue: 290 },
    { name: 'UPPERCASE-EXTENSION', width: 480, height: 360, format: 'jpeg', hue: 230, upperCaseExt: true },
];

/** Number of small images generated for pagination / lazy-loading tests */
const TEST_LAB_BULK_COUNT = 36;
const BULK_SIZES: Array<[number, number]> = [[320, 240], [240, 320], [300, 300], [400, 200]];

export class ShowcaseGenerator {
    private app: App;
    private basePath = 'GalleryDemo';
    private assetsPath = 'GalleryDemo/Assets';
    private testLabPath = 'GalleryDemo/_assets';

    constructor(app: App) {
        this.app = app;
    }

    async generateShowcase(): Promise<void> {
        try {
            // Check if folder already exists
            const existingFolder = this.app.vault.getAbstractFileByPath(this.basePath);
            if (existingFolder) {
                new Notice(`${this.basePath} already exists. Delete or rename it if you want to regenerate the showcase.`);
                return;
            }

            // Create folders
            await this.createFolderSafe(this.basePath);
            await this.createFolderSafe(this.assetsPath);
            await this.createFolderSafe(`${this.assetsPath}/Nature`);
            await this.createFolderSafe(`${this.assetsPath}/Travel`);
            await this.createFolderSafe(`${this.assetsPath}/EmptyFolder`);
            await this.createFolderSafe(this.testLabPath);
            await this.createFolderSafe(`${this.testLabPath}/Bulk`);

            // Write dummy assets into sub-folders too
            await this.writeDummyAssets();
            await this.writeTestLabAssets();

            // Create showcase notes
            await this.createWelcomeNote();
            await this.createLocalSourceNote();
            await this.createRelativePathNote();
            await this.createExternalUrlsNote();
            await this.createViewsNote();
            await this.createMixedSourcesNote();
            await this.createSortAndLimitNote();
            await this.createRecursiveAndFiltersNote();
            await this.createImmichAuthenticatedNote();
            await this.createImmichFavoritesRecentNote();
            await this.createImmichAlbumsNote();
            await this.createImmichSharedLinkNote();
            await this.createImmichPasswordNote();
            await this.createNextcloudAuthenticatedNote();
            await this.createNextcloudRecursiveAndFiltersNote();
            await this.createNextcloudSharedLinkNote();
            await this.createErrorStatesNote();
            await this.createLocalTestLabNote();

            new Notice('Gallery view showcase generated successfully in gallerydemo');
        } catch (error) {
            console.error('Failed to generate showcase:', error);
            new Notice('Failed to generate showcase. Check console for details.');
        }
    }

    private async createFolderSafe(path: string): Promise<void> {
        const exists = await this.app.vault.adapter.exists(path);
        if (!exists) {
            await this.app.vault.adapter.mkdir(path);
        }
    }

    private async writeDummyAssets(): Promise<void> {
        // Split assets across root, Nature, and Travel sub-folders
        const subFolders = [this.assetsPath, `${this.assetsPath}/Nature`, `${this.assetsPath}/Travel`];
        for (let i = 0; i < DUMMY_ASSETS.length; i++) {
            const base64Data = DUMMY_ASSETS[i];
            const binaryString = window.atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
            }
            const folder = subFolders[i % subFolders.length];
            await this.app.vault.createBinary(`${folder}/demo-${i + 1}.jpg`, bytes.buffer);
        }
    }

    private async writeTestLabAssets(): Promise<void> {
        const bulkSpecs: DemoImageSpec[] = Array.from({ length: TEST_LAB_BULK_COUNT }, (_, i) => {
            const [width, height] = BULK_SIZES[i % BULK_SIZES.length];
            return {
                name: `bulk-${String(i + 1).padStart(2, '0')}`,
                width,
                height,
                format: 'jpeg',
                hue: Math.round((i * 360) / TEST_LAB_BULK_COUNT)
            };
        });

        const batches: Array<[string, DemoImageSpec[]]> = [
            [this.testLabPath, TEST_LAB_IMAGES],
            [`${this.testLabPath}/Bulk`, bulkSpecs]
        ];

        for (const [folder, specs] of batches) {
            for (const spec of specs) {
                const file = await renderDemoImage(spec);
                if (!file) {
                    Logger.warn('Canvas rendering unavailable; skipping generated test lab images');
                    return;
                }
                await this.app.vault.createBinary(`${folder}/${file.fileName}`, file.data);
            }
        }

        // Animated GIF (canvas cannot encode GIFs, so this one is embedded)
        const gif = Uint8Array.from(window.atob(ANIMATED_GIF_BASE64), c => c.charCodeAt(0));
        await this.app.vault.createBinary(`${this.testLabPath}/animated.gif`, gif.buffer);

        // A file with an image extension but invalid contents, to exercise the error tile
        const broken = Uint8Array.from('This is not an image.', c => c.charCodeAt(0));
        await this.app.vault.createBinary(`${this.testLabPath}/broken-image.jpg`, broken.buffer);
    }

    private async createWelcomeNote(): Promise<void> {
        const content = `\
# Welcome to Gallery View Showcase

This folder (\`GalleryDemo/\`) was generated by the **Gallery View** plugin to help you explore its features.

You are safe to edit, move, or delete any of these files!

> 💡 **Tip:** Use the **"Insert gallery"** command (Cmd/Ctrl + P → "Insert gallery") to build gallery blocks interactively without writing YAML by hand.

## What is this?
These notes contain examples of how to configure image galleries inside your vault.

### 🖼 Local & External Demos
These notes render images immediately:
- [[01 - Local source]] — Load images from a folder in your vault.
- [[Nature (folder note demo)]] — Resolve \`path\` relative to the current note (\`.\`, \`./\`, \`../\`) instead of a hardcoded folder.
- [[02 - External URLs]] — Load images from web URLs.
- [[03 - Views]] — Layout types (thumbnail, masonry, justified, carousel, embed) and pagination for large collections.
- [[04 - Mixed sources]] — Combine local + external in one gallery.
- [[05 - Sort and limit]] — Control order and count of displayed images, including local \`sort\`/\`limit\`.
- [[06 - Recursive and filters]] — Scan sub-folders and filter by filename glob, size, or date — for local files and Immich.

### 🔐 Immich — Authenticated
Connect to your own Immich server using an API key configured in plugin settings:
- [[07 - Immich authenticated]] — People, tags, and date filters.
- [[08 - Immich favorites and recent]] — Favorites and recent photo feeds.
- [[09 - Immich albums]] — Album-based gallery (template).

### 🔗 Immich — Shared Links
No account required, just a public share URL:
- [[10 - Immich shared link]] — Public shared album.
- [[11 - Password-protected Immich share]] — Password-protected share.

### ☁️ Nextcloud — Authenticated
Connect to your Nextcloud server using connection settings (\`nextcloud-demo\`):
- [[12 - Nextcloud authenticated]] — Path selection, subfolders, and carousel and justified layouts.
- [[13 - Nextcloud recursive and filters]] — Sub-folder scanning, globs, MIME types, sizes, and date filtering.

### 🔗 Nextcloud — Shared Links
No connection settings required, just a public Nextcloud share URL:
- [[14 - Nextcloud shared link]] — Public and password-protected Nextcloud share links.

### ⚠️ Error States Reference
See every compact error the plugin can show — great for debugging your own galleries:
- [[15 - Error states]] — One intentionally broken gallery per error type.

### 🧪 Local Test Lab
Generated images in many shapes, sizes, and formats for checking layouts by eye:
- [[16 - Local test lab]] — Aspect ratios, formats (PNG/JPEG/WebP/GIF), long and Unicode file names, a broken file, and 36 extra images for pagination.

## Next Steps
Want to learn more? Check out the full [Documentation](https://mkshp-dev.github.io/obsidian-gallery-plugin/)!
`;
        await this.app.vault.create(`${this.basePath}/00 - Welcome.md`, content);
    }

    private async createLocalSourceNote(): Promise<void> {
        const content = `\
# Local Source Demo

This gallery loads images directly from a folder inside your Obsidian vault.

\`\`\`obs-gallery
sources:
  - type: local
    path: GalleryDemo/Assets
view:
  type: thumbnail
\`\`\`

## How it works
- \`type: local\` tells the plugin to look for images in your vault.
- \`path: GalleryDemo/Assets\` points to the folder containing the images.
- Change the \`path\` to any folder in your vault that contains images.
- Add \`recursive: true\` to scan all sub-folders as well.
`;
        await this.app.vault.create(`${this.basePath}/01 - Local source.md`, content);
    }

    private async createRelativePathNote(): Promise<void> {
        const content = `\
# Relative Path Demo (Folder Notes)

Unlike the previous note, **this note lives inside \`${this.assetsPath}/Nature\`** — right next to its own images — instead of pointing at a hardcoded vault path. Rename or move this note along with the \`Nature\` folder and the galleries below keep working.

### This folder's own images (\`path: "."\`)

\`\`\`obs-gallery
sources:
  - type: local
    path: "."
view:
  type: masonry
\`\`\`

### A sibling folder's images (\`path: "../Travel"\`)

\`\`\`obs-gallery
sources:
  - type: local
    path: "../Travel"
view:
  type: thumbnail
\`\`\`

## How it works
- \`path: "."\` resolves to the folder that contains **this note** — not a hardcoded vault path.
- \`path: "./Subfolder"\` reaches into a subfolder of the note's folder.
- \`path: "../Sibling"\` steps up one level per \`..\` and reaches into a sibling folder (\`../../Sibling\` steps up two levels, and so on).
- Because the path is resolved relative to the note, renaming or moving this note together with its folder doesn't break the gallery — unlike a hardcoded path such as \`${this.assetsPath}/Nature\`.

> This mirrors the classic "folder note" pattern, where a note shares a name with (and lives inside) the folder it describes.
`;
        await this.app.vault.create(`${this.assetsPath}/Nature/Nature (folder note demo).md`, content);
    }

    private async createExternalUrlsNote(): Promise<void> {
        const content = `\
# External URLs Demo

This gallery loads images directly from web URLs.

> **Note:** Remote image loading must be enabled in the Gallery View settings.

\`\`\`obs-gallery
sources:
  - type: external
    urls:
      - https://picsum.photos/400/300?random=1
      - https://picsum.photos/400/300?random=2
      - https://picsum.photos/400/300?random=3
      - https://picsum.photos/400/300?random=4
      - https://picsum.photos/400/300?random=5
      - https://picsum.photos/400/300?random=6
view:
  type: masonry
\`\`\`

## How it works
- \`type: external\` tells the plugin these are remote web links.
- Provide a list of direct image links under \`urls\`.
- External images depend on an internet connection to load.
`;
        await this.app.vault.create(`${this.basePath}/02 - External URLs.md`, content);
    }

    private async createViewsNote(): Promise<void> {
        const content = `\
# Views Showcase

The same set of images can be displayed using different layout views.

### Thumbnail View
A responsive grid of uniform tiles — good for large collections.

\`\`\`obs-gallery
sources:
  - type: local
    path: GalleryDemo/Assets
view:
  type: thumbnail
\`\`\`

---

### Masonry View
A Pinterest-style layout: equal-width columns, each image at its natural height. (\`type: grid\` from older versions shows this view.)

\`\`\`obs-gallery
sources:
  - type: local
    path: GalleryDemo/Assets
view:
  type: masonry
\`\`\`

---

### Justified View
Rows of equal height that fill the width, each image uncropped — like Immich or Google Photos.

\`\`\`obs-gallery
sources:
  - type: local
    path: GalleryDemo/Assets
view:
  type: justified
\`\`\`

---

### Carousel View
A horizontal scrolling strip — ideal for a curated set of highlights.

\`\`\`obs-gallery
sources:
  - type: local
    path: GalleryDemo/Assets
view:
  type: carousel
\`\`\`

---

### Embed View
A continuous, borderless vertical stack at natural image size — feels like part of the note, similar to a native \`![[image]]\` embed.

\`\`\`obs-gallery
sources:
  - type: local
    path: GalleryDemo/Assets
view:
  type: embed
\`\`\`

---

### Pagination
For large collections, add \`pagination: true\` (with an optional \`itemsPerPage\`) to any of the views above to show a fixed number of images per page with Prev/Next controls, instead of lazy-loading everything into one long scroll. Below, \`itemsPerPage: 2\` splits this demo's 4 images across 2 pages so you can see the controls in action — in a real gallery you'd use a larger number like \`24\`.

\`\`\`obs-gallery
sources:
  - type: local
    path: GalleryDemo/Assets
    recursive: true
view:
  type: masonry
  pagination: true
  itemsPerPage: 2
\`\`\`

Pagination can also be turned on for every gallery by default in **Settings → Gallery View → Pagination** — the per-gallery \`pagination\`/\`itemsPerPage\` keys shown above override that default.
`;
        await this.app.vault.create(`${this.basePath}/03 - Views.md`, content);
    }

    private async createMixedSourcesNote(): Promise<void> {
        const content = `\
# Mixed Sources Demo

You can combine multiple sources into a single gallery. The plugin aggregates all images in order.

\`\`\`obs-gallery
sources:
  - type: local
    path: GalleryDemo/Assets
  - type: external
    urls:
      - https://picsum.photos/400/300?random=10
      - https://picsum.photos/400/300?random=11
      - https://picsum.photos/400/300?random=12
view:
  type: masonry
\`\`\`

## How it works
- The \`sources\` property is a list — add as many entries as you like.
- You can mix \`local\`, \`external\`, \`immich\`, and \`immich-share\` sources freely.
- Images from each source are shown in declaration order, deduplicated by path.
`;
        await this.app.vault.create(`${this.basePath}/04 - Mixed sources.md`, content);
    }

    private async createSortAndLimitNote(): Promise<void> {
        const content = `\
# Sort and Limit Demo

Control how many images are shown and in what order.

### Local — Most recently modified 4 images

\`\`\`obs-gallery
sources:
  - type: local
    path: GalleryDemo/Assets
    sort:
      by: modified
      order: desc
    limit: 4
view:
  type: thumbnail
\`\`\`

### Local — Alphabetical order, oldest naming first

\`\`\`obs-gallery
sources:
  - type: local
    path: GalleryDemo/Assets
    sort:
      by: name
      order: asc
view:
  type: masonry
\`\`\`

### Immich — Latest 10 photos, sorted oldest to newest

\`\`\`obs-gallery
sources:
  - type: immich
    connection: home
    limit: 10
    sort:
      by: createdAt
      order: asc
view:
  type: carousel
\`\`\`

## Options
| Source | Key | Values | Description |
|---|---|---|---|
| \`local\` | \`sort.by\` | \`name\` / \`modified\` / \`size\` | Field to sort files by |
| \`local\` | \`sort.order\` | \`asc\` / \`desc\` | Ascending or descending |
| \`local\` | \`limit\` | any number | Maximum images to display |
| \`immich\` | \`sort.by\` | \`createdAt\` | Field to sort by |
| \`immich\` | \`sort.order\` | \`asc\` / \`desc\` | Ascending or descending |
| \`immich\` | \`limit\` | any number | Maximum images to display |
`;
        await this.app.vault.create(`${this.basePath}/05 - Sort and limit.md`, content);
    }

    private async createRecursiveAndFiltersNote(): Promise<void> {
        const content = `\
# Recursive Scan and Filters Demo

### Scan all sub-folders recursively

The \`Assets\` folder contains \`Nature/\` and \`Travel/\` sub-folders.
Adding \`recursive: true\` picks up images from all of them.

\`\`\`obs-gallery
sources:
  - type: local
    path: GalleryDemo/Assets
    recursive: true
view:
  type: masonry
\`\`\`

### Compare: non-recursive (top-level only)

\`\`\`obs-gallery
sources:
  - type: local
    path: GalleryDemo/Assets
    recursive: false
view:
  type: masonry
\`\`\`

---

### Local — Filename glob pattern

Only load images whose names match the glob pattern \`demo-1*\`.

\`\`\`obs-gallery
sources:
  - type: local
    path: GalleryDemo/Assets
    recursive: true
    filenameFilter: "demo-1*"
view:
  type: thumbnail
\`\`\`

---

### Local — Size and modified-date filters

Only load images that are at least 1 KB, modified since the start of this year.

\`\`\`obs-gallery
sources:
  - type: local
    path: GalleryDemo/Assets
    recursive: true
    filters:
      minSizeKb: 1
      modifiedAfter: "2025-01-01"
view:
  type: masonry
\`\`\`

---

### Immich — Images only, taken this year

\`\`\`obs-gallery
sources:
  - type: immich
    connection: home
    filters:
      assetType: image
      createdAfter: "2025-01-01"
    limit: 20
view:
  type: thumbnail
\`\`\`

## Filter options

### Local
| Filter | Example | Description |
|---|---|---|
| \`filenameFilter\` | \`"IMG_*"\` / \`"*.png"\` | Glob pattern filter for file names |
| \`filters.minSizeKb\` / \`maxSizeKb\` | \`10\` / \`5000\` | Filter by file size range in KB |
| \`filters.modifiedAfter\` / \`modifiedBefore\` | \`"2024-01-01"\` | Filter by modification date |

### Immich
| Filter | Example | Description |
|---|---|---|
| \`assetType\` | \`image\` or \`video\` | Restrict to photos or videos |
| \`createdAfter\` | \`2025-01-01\` | Only assets after this date (YYYY-MM-DD) |
| \`createdBefore\` | \`2025-12-31\` | Only assets before this date |
| \`isFavorite\` | \`true\` | Only favorited assets |
`;
        await this.app.vault.create(`${this.basePath}/06 - Recursive and filters.md`, content);
    }

    private async createImmichAuthenticatedNote(): Promise<void> {
        const content = `\
# Immich — Authenticated Gallery

Connect Gallery View to your own Immich server with an API key.
Set up your connection in **Settings → Gallery View → Immich Connections** first.

---

### Photos featuring specific people

Use human-readable names — the plugin resolves them to Immich person IDs automatically.

\`\`\`obs-gallery
sources:
  - type: immich
    connection: home
    filters:
      people:
        - John Doe
        - Mom
        - Dad
view:
  type: thumbnail
\`\`\`

---

### Photos by tag

Tag names are matched against your Immich tag library automatically.

\`\`\`obs-gallery
sources:
  - type: immich
    connection: home
    filters:
      tags:
        - photography
view:
  type: masonry
\`\`\`

---

### Work photos

\`\`\`obs-gallery
sources:
  - type: immich
    connection: home
    filters:
      tags:
        - work
    limit: 30
    sort:
      by: createdAt
      order: desc
view:
  type: masonry
\`\`\`

---

### Study materials (images only, last 2 years)

\`\`\`obs-gallery
sources:
  - type: immich
    connection: home
    filters:
      tags:
        - study
      assetType: image
      createdAfter: "2023-01-01"
    limit: 50
view:
  type: carousel
\`\`\`

---

### Combined — Family & photography tag together

\`\`\`obs-gallery
sources:
  - type: immich
    connection: home
    filters:
      people:
        - John Doe
        - Mom
        - Dad
      tags:
        - photography
    limit: 20
    sort:
      by: createdAt
      order: desc
view:
  type: masonry
\`\`\`

## How it works
- \`connection: home\` refers to the connection key set in plugin settings.
- \`people\` — list of person names as they appear in Immich (case-sensitive).
- \`tags\` — list of tag names as they appear in your Immich tag library.
- Multiple filters are combined (AND logic).
`;
        await this.app.vault.create(`${this.basePath}/07 - Immich authenticated.md`, content);
    }

    private async createImmichFavoritesRecentNote(): Promise<void> {
        const content = `\
# Immich — Favorites and Recent

### All favorited photos

\`\`\`obs-gallery
sources:
  - type: immich
    connection: home
    filters:
      isFavorite: true
view:
  type: masonry
\`\`\`

---

### Recent 20 photos (newest first)

\`\`\`obs-gallery
sources:
  - type: immich
    connection: home
    limit: 20
    sort:
      by: createdAt
      order: desc
view:
  type: carousel
\`\`\`

---

### Favorite photos of specific people

\`\`\`obs-gallery
sources:
  - type: immich
    connection: home
    filters:
      isFavorite: true
      people:
        - John Doe
    limit: 15
view:
  type: thumbnail
\`\`\`

---

### Favorites from this year

\`\`\`obs-gallery
sources:
  - type: immich
    connection: home
    filters:
      isFavorite: true
      createdAfter: "2025-01-01"
    sort:
      by: createdAt
      order: desc
view:
  type: justified
\`\`\`
`;
        await this.app.vault.create(`${this.basePath}/08 - Immich favorites and recent.md`, content);
    }

    private async createImmichAlbumsNote(): Promise<void> {
        const content = `\
# Immich — Albums (Template)

Gallery View can display images from a specific Immich album using the album's ID.

> **Note:** This is a template. Replace \`your-album-id-here\` with an actual album ID from your Immich instance.
> You can find the album ID in the Immich web interface URL when you open an album.

\`\`\`obs-gallery
sources:
  - type: immich
    connection: home
    filters:
      albumIds:
        - your-album-id-here
view:
  type: justified
\`\`\`

### Multiple albums in one gallery

\`\`\`obs-gallery
sources:
  - type: immich
    connection: home
    filters:
      albumIds:
        - your-first-album-id
        - your-second-album-id
    sort:
      by: createdAt
      order: asc
view:
  type: thumbnail
\`\`\`

## How to find an album ID
1. Open Immich in your browser.
2. Navigate to the album you want.
3. Copy the UUID from the URL (e.g. \`https://your-immich.com/albums/abc-123-def\` → ID is \`abc-123-def\`).
4. Paste it into the \`albumIds\` list above.

> 💡 **Tip:** Use the **"Insert gallery"** command for an interactive picker that finds album IDs for you.
`;
        await this.app.vault.create(`${this.basePath}/09 - Immich albums.md`, content);
    }

    private async createImmichSharedLinkNote(): Promise<void> {
        const content = `\
# Immich Shared Link (Template)

Gallery View can pull images directly from a public Immich shared album — no API key needed.

> **Note:** This is a template. Replace the \`url\` with your own Immich share link.

\`\`\`obs-gallery
sources:
  - type: immich-share
    url: https://your-immich-host.com/share/abcdef123456
view:
  type: justified
\`\`\`

\`justified\` lays the photos out in even rows like Immich's own web view. Use \`masonry\` for Pinterest-style columns instead.

## How to use
1. Create a shared link in your Immich instance (Share → Create link).
2. Paste the full share URL into the \`url\` field above.
3. Gallery View will automatically fetch the images in the share.
`;
        await this.app.vault.create(`${this.basePath}/10 - Immich shared link.md`, content);
    }

    private async createImmichPasswordNote(): Promise<void> {
        const content = `\
# Password-protected Immich Share (Template)

If your Immich shared link requires a password, configure it like this:

> **Note:** This is a template. Replace the \`url\` and \`password\` with your own values.

\`\`\`obs-gallery
sources:
  - type: immich-share
    url: https://your-immich-host.com/share/abcdef123456
    password: my-secret-password
view:
  type: masonry
\`\`\`

## How to use
1. Make sure your Immich share is password protected.
2. Paste the share link into \`url\`.
3. Provide the password in the \`password\` field.
`;
        await this.app.vault.create(`${this.basePath}/11 - Password-protected Immich share.md`, content);
    }

    private async createNextcloudAuthenticatedNote(): Promise<void> {
        const content = `\
# Nextcloud — Authenticated Gallery

Connect Gallery View to your Nextcloud instance using connection settings configured in **Settings → Gallery View → Nextcloud Connections**.

> **Note:** Configure a Nextcloud connection with key \`nextcloud-demo\` in plugin settings to preview these galleries.

---

### Root gallery folder (\`/Gallery-Test\`)

Loads images from the \`/Gallery-Test\` folder on your Nextcloud server.

\`\`\`obs-gallery
sources:
  - type: nextcloud
    connection: nextcloud-demo
    path: /Gallery-Test
view:
  type: masonry
\`\`\`

---

### Specific subfolder (\`/Gallery-Test/Vacation\`)

\`\`\`obs-gallery
sources:
  - type: nextcloud
    connection: nextcloud-demo
    path: /Gallery-Test/Vacation
view:
  type: thumbnail
\`\`\`

---

### Carousel view layout

\`\`\`obs-gallery
sources:
  - type: nextcloud
    connection: nextcloud-demo
    path: /Gallery-Test
view:
  type: carousel
\`\`\`

---

### Justified view layout

Even rows that fill the width. Nextcloud thumbnails keep each photo's shape, so nothing is cropped.

\`\`\`obs-gallery
sources:
  - type: nextcloud
    connection: nextcloud-demo
    path: /Gallery-Test
view:
  type: justified
\`\`\`

## How it works
- \`type: nextcloud\` tells the plugin to load images from Nextcloud via WebDAV.
- \`connection: nextcloud-demo\` refers to the connection key configured in Nextcloud settings.
- \`path\` specifies the folder path on your Nextcloud server.
`;
        await this.app.vault.create(`${this.basePath}/12 - Nextcloud authenticated.md`, content);
    }

    private async createNextcloudRecursiveAndFiltersNote(): Promise<void> {
        const content = `\
# Nextcloud — Recursive Scan and Filters

Combine Nextcloud sources with advanced filters, glob pattern matching, and sorting options.

---

### Recursive scanning (all subfolders)

Adding \`recursive: true\` scans sub-folders such as \`Vacation/\`, \`Nature/\`, and \`Archive/2023/\`.

\`\`\`obs-gallery
sources:
  - type: nextcloud
    connection: nextcloud-demo
    path: /Gallery-Test
    recursive: true
view:
  type: masonry
\`\`\`

---

### Filename pattern matching (\`filenameFilter\`)

Only load images whose names match the glob pattern \`IMG_*\`.

\`\`\`obs-gallery
sources:
  - type: nextcloud
    connection: nextcloud-demo
    path: /Gallery-Test
    recursive: true
    filenameFilter: "IMG_*"
view:
  type: thumbnail
\`\`\`

---

### Filter by MIME types & file size

Only load JPEG and PNG files that are at least 10 KB in size.

\`\`\`obs-gallery
sources:
  - type: nextcloud
    connection: nextcloud-demo
    path: /Gallery-Test
    recursive: true
    filters:
      mimeTypes:
        - image/jpeg
        - image/png
      minSizeKb: 10
      maxSizeKb: 5000
view:
  type: masonry
\`\`\`

---

### Sorting & limit

Show the 10 most recently modified images.

\`\`\`obs-gallery
sources:
  - type: nextcloud
    connection: nextcloud-demo
    path: /Gallery-Test
    recursive: true
    sort:
      by: lastModified
      order: desc
    limit: 10
view:
  type: carousel
\`\`\`

## Filter options
| Option | Example | Description |
|---|---|---|
| \`recursive\` | \`true\` / \`false\` | Scan subdirectories recursively |
| \`filenameFilter\` | \`"IMG_*"\` / \`"*.png"\` | Glob pattern filter for file names |
| \`filters.mimeTypes\` | \`["image/jpeg", "image/png"]\` | Filter by image MIME type |
| \`filters.minSizeKb\` / \`maxSizeKb\` | \`10\` / \`5000\` | Filter by file size range in KB |
| \`filters.modifiedAfter\` / \`modifiedBefore\` | \`"2024-01-01"\` | Filter by modification date |
| \`sort.by\` | \`name\` / \`size\` / \`lastModified\` | Field to sort files by |
| \`sort.order\` | \`asc\` / \`desc\` | Ascending or descending order |
| \`limit\` | \`10\` | Maximum number of images to fetch |
`;
        await this.app.vault.create(`${this.basePath}/13 - Nextcloud recursive and filters.md`, content);
    }

    private async createNextcloudSharedLinkNote(): Promise<void> {
        const content = `\
# Nextcloud Shared Links (Public & Password-Protected)

Gallery View can display images directly from a public Nextcloud share link — no account or login settings required.

---

### Standard Public Share Link

Paste any public Nextcloud folder share URL.

\`\`\`obs-gallery
sources:
  - type: nextcloud-share
    url: https://use23.thegood.cloud/s/YOUR_SHARE_TOKEN
view:
  type: masonry
\`\`\`

---

### Password-Protected Nextcloud Share

If your Nextcloud public share link is protected with a password, specify it in the \`password\` field.

\`\`\`obs-gallery
sources:
  - type: nextcloud-share
    url: https://use23.thegood.cloud/s/YOUR_PROTECTED_SHARE_TOKEN
    password: my-secret-password
view:
  type: masonry
\`\`\`

---

### Nextcloud Photos App Public Album

If you create a public album link in the Nextcloud Photos app:

\`\`\`obs-gallery
sources:
  - type: nextcloud-share
    url: https://use23.thegood.cloud/apps/photos/public/YOUR_ALBUM_TOKEN
view:
  type: thumbnail
\`\`\`

## How to use
1. Open Nextcloud in your browser.
2. Select a folder or photo album and click **Share**.
3. Create a public share link (optionally set a password).
4. Copy and paste the share URL into the \`url\` field above.
`;
        await this.app.vault.create(`${this.basePath}/14 - Nextcloud shared link.md`, content);
    }

    private async createErrorStatesNote(): Promise<void> {
        const lines: string[] = [
            '# Error States Reference',
            '',
            'This note intentionally triggers every possible gallery error so you can see exactly',
            'what the compact error line looks like for each case.',
            '',
            'Each section shows the expected message in a callout, then the broken gallery block that produces it.',
            '',
            '---',
            '',
            '## Config Errors',
            '',
            'These appear when the YAML block itself is malformed.',
            '',
            '### 1 — Empty code block',
            '> [!NOTE] Expected output',
            '> `\u26a0\ufe0f gallery: Gallery configuration cannot be empty`',
            '',
            '```obs-gallery',
            '```',
            '',
            '---',
            '',
            '### 2 — Bad YAML syntax',
            '> [!NOTE] Expected output',
            '> `\u26a0\ufe0f gallery: Gallery configuration is empty` or a YAML parse error',
            '',
            '```obs-gallery',
            ': this is not valid yaml [',
            '```',
            '',
            '---',
            '',
            '### 3 — Invalid view type',
            '> [!NOTE] Expected output',
            '> `\u26a0\ufe0f gallery: View type must be a string (Use one of: thumbnail, carousel, masonry, justified, embed)`',
            '',
            '```obs-gallery',
            'sources:',
            '  - type: local',
            '    path: GalleryDemo/Assets',
            'view:',
            '  type: slideshow',
            '```',
            '',
            '---',
            '',
            '### 4 — No sources, path, or URLs provided',
            '> [!NOTE] Expected output',
            "> `\u26a0\ufe0f gallery: Either 'path', 'urls', or 'sources' must be provided`",
            '',
            '```obs-gallery',
            'view:',
            '  type: masonry',
            '```',
            '',
            '---',
            '',
            '### 5 — Unknown key in config',
            '> [!NOTE] Expected output',
            '> `\u26a0\ufe0f gallery: Unknown configuration keys: typo_key`',
            '',
            '```obs-gallery',
            'typo_key: oops',
            'sources:',
            '  - type: local',
            '    path: GalleryDemo/Assets',
            '```',
            '',
            '---',
            '',
            '## Content / Path Errors',
            '',
            'These appear when the config is valid but the content cannot be loaded.',
            '',
            '### 6 — Path does not exist',
            '> [!NOTE] Expected output',
            '> `\u26a0\ufe0f gallery: Path not found: "GalleryDemo/DoesNotExist"`',
            '',
            '```obs-gallery',
            'sources:',
            '  - type: local',
            '    path: GalleryDemo/DoesNotExist',
            'view:',
            '  type: thumbnail',
            '```',
            '',
            '---',
            '',
            '### 7 — Folder exists but is empty',
            '> [!NOTE] Expected output',
            '> `\u26a0\ufe0f gallery: No images found in "GalleryDemo/Assets/EmptyFolder"`',
            '',
            '```obs-gallery',
            'sources:',
            '  - type: local',
            '    path: GalleryDemo/Assets/EmptyFolder',
            'view:',
            '  type: thumbnail',
            '```',
            '',
            '---',
            '',
            '### 8 — Unknown source type',
            '> [!NOTE] Expected output',
            '> `\u26a0\ufe0f gallery: Unsupported source type: dropbox`',
            '',
            '```obs-gallery',
            'sources:',
            '  - type: dropbox',
            '    path: /some/path',
            'view:',
            '  type: masonry',
            '```',
            '',
            '---',
            '',
            '## External / Remote Errors',
            '',
            '### 9 — External images blocked by settings',
            '> [!NOTE] Expected output (when "Allow remote images" is **OFF** in settings)',
            '> `\u26a0\ufe0f gallery: External images blocked — enable "Allow remote images" in plugin settings`',
            '',
            '> **Tip:** Toggle **Settings → Gallery View → Allow remote images** to make this error appear and disappear.',
            '',
            '```obs-gallery',
            'sources:',
            '  - type: external',
            '    urls:',
            '      - https://picsum.photos/400/300?random=99',
            'view:',
            '  type: thumbnail',
            '```',
            '',
            '---',
            '',
            '## Immich Errors',
            '',
            '### 10 — Connection key not found in settings',
            '> [!NOTE] Expected output',
            "> `\u26a0\ufe0f gallery: Immich connection with key 'nonexistent' not found in settings.`",
            '',
            '```obs-gallery',
            'sources:',
            '  - type: immich',
            '    connection: nonexistent',
            'view:',
            '  type: masonry',
            '```',
            '',
            '---',
            '',
            '### 11 — Person name not recognised',
            '> [!NOTE] Expected output',
            "> `\u26a0\ufe0f gallery: Person not found: 'Unknown Person'.`",
            '',
            '```obs-gallery',
            'sources:',
            '  - type: immich',
            '    connection: home',
            '    filters:',
            '      people:',
            '        - Unknown Person',
            'view:',
            '  type: thumbnail',
            '```',
            '',
            '---',
            '',
            '### 12 — Tag name not recognised',
            '> [!NOTE] Expected output',
            "> `\u26a0\ufe0f gallery: Tag not found: 'nonexistenttag'.`",
            '',
            '```obs-gallery',
            'sources:',
            '  - type: immich',
            '    connection: home',
            '    filters:',
            '      tags:',
            '        - nonexistenttag',
            'view:',
            '  type: masonry',
            '```',
            '',
            '---',
            '',
            '### 13 — Ambiguous tag name (matches multiple)',
            '> [!NOTE] Expected output',
            "> `\u26a0\ufe0f gallery: Ambiguous tag name: 'photography' matches multiple tags. Please make the name unique in Immich.`",
            '',
            '```obs-gallery',
            'sources:',
            '  - type: immich',
            '    connection: home',
            '    filters:',
            '      tags:',
            '        - photography',
            'view:',
            '  type: masonry',
            '```',
            '',
            '---',
            '',
            '### 14 — Immich share: unreachable host',
            '> [!NOTE] Expected output',
            '> `\u26a0\ufe0f gallery: [network or parsing error message]`',
            '',
            '```obs-gallery',
            'sources:',
            '  - type: immich-share',
            '    url: https://not-a-real-immich-host.invalid/share/abc123',
            'view:',
            '  type: masonry',
            '```',
            '',
            '---',
            '',
            '## Nextcloud Errors',
            '',
            '### 15 — Nextcloud: Missing connection reference',
            '> [!NOTE] Expected output',
            "> `\u26a0\ufe0f gallery: Nextcloud source is missing a 'connection' reference.`",
            '',
            '```obs-gallery',
            'sources:',
            '  - type: nextcloud',
            '    path: /Gallery-Test',
            'view:',
            '  type: masonry',
            '```',
            '',
            '---',
            '',
            '### 16 — Nextcloud: Connection key not found in settings',
            '> [!NOTE] Expected output',
            "> `\u26a0\ufe0f gallery: Nextcloud connection with key 'nonexistent' not found in settings.`",
            '',
            '```obs-gallery',
            'sources:',
            '  - type: nextcloud',
            '    connection: nonexistent',
            'view:',
            '  type: masonry',
            '```',
            '',
            '---',
            '',
            '### 17 — Nextcloud share: Missing URL',
            '> [!NOTE] Expected output',
            '> `\u26a0\ufe0f gallery: Nextcloud share source is missing a URL.`',
            '',
            '```obs-gallery',
            'sources:',
            '  - type: nextcloud-share',
            'view:',
            '  type: masonry',
            '```',
            '',
            '---',
            '',
            '### 18 — Nextcloud share: Invalid URL format',
            '> [!NOTE] Expected output',
            '> `\u26a0\ufe0f gallery: Invalid Nextcloud share URL: https://invalid-share-link.example.com`',
            '',
            '```obs-gallery',
            'sources:',
            '  - type: nextcloud-share',
            '    url: https://invalid-share-link.example.com',
            'view:',
            '  type: masonry',
            '```',
            '',
            '---',
            '',
            '## Error display mode',
            '',
            'You can control whether errors are shown at all in **Settings → Gallery View → Error display mode**:',
            '',
            '| Mode | What you see |',
            '|---|---|',
            '| Full *(default)* | Compact `\u26a0\ufe0f gallery: …` line |',
            '| Text | Same compact line |',
            '| Hidden | Nothing — errors are silently suppressed |'
        ];

        const content = lines.join('\n') + '\n';
        await this.app.vault.create(`${this.basePath}/15 - Error states.md`, content);
    }

    private async createLocalTestLabNote(): Promise<void> {
        const content = `\
# Local Test Lab

A workbench for checking layouts by eye. The images in \`${this.testLabPath}/\` were generated with deliberately awkward properties, and each one is labelled with its own name, size, and format:

| File | Size | Tests |
|---|---|---|
| \`landscape-16x9.png\` | 800×450 | Standard landscape |
| \`portrait-9x16.jpg\` | 450×800 | Tall portrait |
| \`square.webp\` | 600×600 | Square, WebP format |
| \`panorama.jpg\` | 1600×320 | Extreme wide ratio |
| \`tall-strip.png\` | 240×1000 | Extreme tall ratio |
| \`tiny-icon.png\` | 48×48 | Smaller than a tile (upscaling) |
| \`large-photo.jpg\` | 2400×1600 | Large file (size filters, sorting) |
| \`Bildschirmfoto 2026-10-17 um 09.20.05.png\` | 500×700 | Spaces and dots in the name |
| \`A really long file name … in captions.jpg\` | 640×480 | Caption truncation |
| \`café – ünïcödé & spaces.webp\` | 640×480 | Unicode and symbols in the name |
| \`UPPERCASE-EXTENSION.JPG\` | 480×360 | Upper-case extension |
| \`animated.gif\` | 240×160 | Animated GIF |
| \`broken-image.jpg\` | — | Not a real image: should show an error tile |

The white corner squares and border show whether an image is being cropped. A further ${TEST_LAB_BULK_COUNT} images live in \`_assets/Bulk/\` for pagination tests.

> 💡 Captions are controlled in **Settings → Gallery View → Captions**. Try toggling **Show captions** and changing **Caption max lines** while this note is open.

---

## Thumbnail view

All tiles should be the same width, captions should end with an ellipsis when too long, and each card should be only as tall as its image box plus caption.

\`\`\`obs-gallery
sources:
  - type: local
    path: ./_assets
    recursive: false
view:
  type: thumbnail
\`\`\`

---

## Masonry view

Each image keeps its natural aspect ratio in equal-width columns. Check that the tall strip doesn't leave gaps in the other columns.

\`\`\`obs-gallery
sources:
  - type: local
    path: ./_assets
view:
  type: masonry
\`\`\`

---

## Justified view

Rows fill the width at an even height. Check that the panorama gets a row of its own and the last row isn't stretched.

\`\`\`obs-gallery
sources:
  - type: local
    path: ./_assets
view:
  type: justified
\`\`\`

---

## Carousel view

Check that the panorama and the tall strip don't break the slide height.

\`\`\`obs-gallery
sources:
  - type: local
    path: ./_assets
view:
  type: carousel
\`\`\`

---

## Embed view

Natural size, no card chrome. The tiny icon should stay small and the large photo should shrink to the note width.

\`\`\`obs-gallery
sources:
  - type: local
    path: ./_assets
    filenameFilter: "{tiny,large,panorama,tall}*"
view:
  type: embed
\`\`\`

---

## Pagination

${TEST_LAB_BULK_COUNT} images, 12 per page: there should be 3 pages.

\`\`\`obs-gallery
sources:
  - type: local
    path: ./_assets/Bulk
view:
  type: thumbnail
  pagination: true
  itemsPerPage: 12
\`\`\`

Same images in the masonry view, 10 per page (the last page is a partial page of 6):

\`\`\`obs-gallery
sources:
  - type: local
    path: ./_assets/Bulk
view:
  type: masonry
  pagination: true
  itemsPerPage: 10
\`\`\`

And in the justified view, 8 per page (the last page has 4, and its row should not be stretched to the full width):

\`\`\`obs-gallery
sources:
  - type: local
    path: ./_assets/Bulk
view:
  type: justified
  pagination: true
  itemsPerPage: 8
\`\`\`

---

## Recursive scan

\`_assets\` plus \`_assets/Bulk\` together, with no pagination, to exercise lazy loading.

\`\`\`obs-gallery
sources:
  - type: local
    path: ./_assets
    recursive: true
view:
  type: thumbnail
\`\`\`

---

## Sort and limit

The three largest files first (\`large-photo.jpg\` should lead):

\`\`\`obs-gallery
sources:
  - type: local
    path: ./_assets
    sort:
      by: size
      order: desc
    limit: 3
view:
  type: thumbnail
\`\`\`

Reverse alphabetical order:

\`\`\`obs-gallery
sources:
  - type: local
    path: ./_assets
    sort:
      by: name
      order: desc
view:
  type: thumbnail
\`\`\`

---

## Filters

PNG files only (\`*.png\`):

\`\`\`obs-gallery
sources:
  - type: local
    path: ./_assets
    filenameFilter: "*.png"
view:
  type: thumbnail
\`\`\`

Match by extension regardless of case (\`*.{jpg,webp}\` also matches \`UPPERCASE-EXTENSION.JPG\`):

\`\`\`obs-gallery
sources:
  - type: local
    path: ./_assets
    filenameFilter: "*.{jpg,webp}"
view:
  type: thumbnail
\`\`\`

Files of at least 40 KB, which should leave just \`large-photo.jpg\`:

\`\`\`obs-gallery
sources:
  - type: local
    path: ./_assets
    filters:
      minSizeKb: 40
view:
  type: thumbnail
\`\`\`
`;
        await this.app.vault.create(`${this.basePath}/16 - Local test lab.md`, content);
    }
}
