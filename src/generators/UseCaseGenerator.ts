import { App, Notice } from 'obsidian';
import type { ShowcaseOptions } from './ShowcaseGenerator';
import { DEMO } from './DemoServers';
import { downloadSamplePhotos, fetchPhotoManifest, SAMPLE_PHOTOS_HOST } from './SamplePhotos';
import { Logger } from '../utils/Logger';

const DOCS_URL = 'https://docs.mkshp.dev/obsidian-gallery-plugin/docs';
const FENCE = '```';

/** Photo sets the notes use; each gets a folder under _photos/ even when nothing was downloaded */
const PHOTO_SETS = ['iceland', 'cabin', 'recipe', 'design'];

/** What happened to the sample photos, reported at the top of Start here */
export type PhotoStatus =
    | { kind: 'skipped' }
    | { kind: 'unavailable'; reason: string }
    | { kind: 'downloaded'; saved: number; failed: number };

/** A gallery block as it appears in a note */
const gallery = (yaml: string) => `${FENCE}obs-gallery\n${yaml}${FENCE}`;

/**
 * The collapsed callout under a use-case gallery: the block's YAML, what each option does, and a
 * docs link. Kept below the gallery so the part of the note above the fold looks like a real note.
 */
function setupCallout(yaml: string, notes: string[], docs: { title: string; path: string }): string {
    const lines = [
        '[!info]- How this gallery is set up',
        `${FENCE}yaml`,
        ...yaml.trimEnd().split('\n'),
        FENCE,
        ...notes.map(n => `- ${n}`),
        '',
        `Docs: [${docs.title}](${DOCS_URL}/${docs.path})`
    ];
    return lines.map(line => (line ? `> ${line}` : '>')).join('\n');
}

const frontmatter = (tags: string[], created: string) =>
    `---\ntags:\n${tags.map(t => `  - ${t}`).join('\n')}\ncreated: ${created}\n---\n`;

const RELATIVE_PATH_NOTE = '`path: ./_photos/…` is relative to this note, so the gallery keeps working if you move the `Use cases` folder.';

export const USE_CASE_BLOCKS = {
    icelandJustified: `\
sources:
  - type: local
    path: ./_photos/iceland
view:
  type: justified
  rowHeight: 240
  captions: false
`,
    icelandMasonry: `\
sources:
  - type: local
    path: ./_photos/iceland
view:
  type: masonry
`,
    icelandThumbnail: `\
sources:
  - type: local
    path: ./_photos/iceland
view:
  type: thumbnail
`,
    icelandCarousel: `\
sources:
  - type: local
    path: ./_photos/iceland
view:
  type: carousel
  height: 480
`,
    icelandEmbed: `\
sources:
  - type: local
    path: ./_photos/iceland
    limit: 3
view:
  type: embed
`,
    cabin: `\
sources:
  - type: local
    path: ./_photos/cabin
view:
  type: masonry
  columnWidth: 220
  gap: 8
  frame: false
`,
    recipe: `\
sources:
  - type: local
    path: ./_photos/recipe
    sort:
      by: name
      order: asc
view:
  type: embed
  captions: true
`,
    design: `\
sources:
  - type: local
    path: ./_photos/design
view:
  type: thumbnail
  pagination: true
  itemsPerPage: 6
`,
    highlights: `\
sources:
  - type: local
    path: ./_photos/iceland
    limit: 8
view:
  type: carousel
  height: 520
`,
    immich: `\
sources:
  - type: immich
    connection: ${DEMO.immichKey}
    filters:
      tags:
        - Iceland
      takenAfter: "2026-08-24"
view:
  type: justified
`
};

/**
 * Writes GalleryDemo/Use cases/: notes that look like real people's notes, built on real photos
 * downloaded from the docs site. They show what the plugin is for (the numbered showcase notes show
 * what each option does) and hold every promo screenshot.
 */
export class UseCaseGenerator {
    static readonly folder = 'GalleryDemo/Use cases';
    private photosPath = `${UseCaseGenerator.folder}/_photos`;

    constructor(private app: App) {}

    /** True when the use-case folder is already in the vault (generating again does nothing) */
    exists(): boolean {
        return !!this.app.vault.getAbstractFileByPath(UseCaseGenerator.folder);
    }

    /**
     * Create the use-case notes, downloading the sample photos first when `options.downloadPhotos`
     * is set. Returns false without changing anything when the folder already exists.
     */
    async generate(options: ShowcaseOptions): Promise<boolean> {
        if (this.exists()) return false;

        await this.createFolderSafe('GalleryDemo');
        await this.createFolderSafe(UseCaseGenerator.folder);
        await this.createFolderSafe(this.photosPath);
        // Created even when the photos aren't downloaded, so the galleries show as empty instead of "folder not found"
        for (const set of PHOTO_SETS) {
            await this.createFolderSafe(`${this.photosPath}/${set}`);
        }

        const status = options.downloadPhotos ? await this.downloadPhotos() : { kind: 'skipped' as const };

        const immichReady = options.demoConnections === 'added' &&
            !(options.conflicts ?? []).some(c => c.key === DEMO.immichKey);

        const notes: Array<[string, string]> = [
            ['Start here', this.startHere(status)],
            ['Iceland road trip', this.icelandRoadTrip()],
            ['Iceland — five layouts', this.fiveLayouts()],
            ['Change the layout', this.changeTheLayout()],
            ['Cabin mood board', this.cabinMoodBoard()],
            ['Shakshuka', this.shakshuka()],
            ['Design references', this.designReferences()],
            ['Trip highlights', this.tripHighlights()],
            ['Family album (Immich)', this.familyAlbum(immichReady)]
        ];
        for (const [name, content] of notes) {
            await this.app.vault.create(`${UseCaseGenerator.folder}/${name}.md`, content);
        }
        return true;
    }

    private async createFolderSafe(path: string): Promise<void> {
        if (!(await this.app.vault.adapter.exists(path))) {
            await this.app.vault.adapter.mkdir(path);
        }
    }

    private async downloadPhotos(): Promise<PhotoStatus> {
        const notice = new Notice('Downloading sample photos…', 0);
        try {
            let manifest;
            try {
                manifest = await fetchPhotoManifest();
            } catch (error) {
                Logger.warn('Sample photo manifest could not be loaded:', error);
                return { kind: 'unavailable', reason: error instanceof Error ? error.message : String(error) };
            }

            const { saved, failed } = await downloadSamplePhotos(
                manifest.photos,
                (photo, data) => this.app.vault.createBinary(`${this.photosPath}/${photo.set}/${photo.name}`, data).then(() => undefined),
                (done, total) => notice.setMessage(`Downloading sample photos ${done}/${total}`)
            );
            return { kind: 'downloaded', saved: saved.length, failed: failed.length };
        } finally {
            notice.hide();
        }
    }

    private startHere(status: PhotoStatus): string {
        const rerun = 'To try again, delete this `Use cases` folder and run the **Create use-case notes** command.';
        let callout = '';
        if (status.kind === 'skipped') {
            callout = `> [!note] No sample photos\n> You chose not to download the sample photos, so the galleries in these notes are empty. ${rerun}\n\n`;
        } else if (status.kind === 'unavailable') {
            callout = `> [!warning] The sample photos didn't download\n> The photo list on ${SAMPLE_PHOTOS_HOST} couldn't be loaded (${status.reason}), so the galleries in these notes are empty. Check your connection, then run the command again. ${rerun}\n\n`;
        } else if (status.failed > 0) {
            callout = `> [!warning] Some sample photos didn't download\n> ${status.failed} of ${status.saved + status.failed} photos couldn't be downloaded, so some galleries have gaps. ${rerun}\n\n`;
        }

        return `${callout}# Use cases

Real notes with real photos, to show what Gallery View is for. For what each option does, see the numbered notes in \`GalleryDemo\` (start with [[00 - Welcome]]).

- [[Iceland road trip]] — a travel journal with the trip's photos in tidy rows.
- [[Iceland — five layouts]] — the same folder in all five layouts, one after the other.
- [[Change the layout]] — change one word and the gallery redraws.
- [[Cabin mood board]] — a borderless masonry board for collecting a look.
- [[Shakshuka]] — a recipe with a full-width photo of the dish under the method.
- [[Design references]] — a paged grid for a folder that keeps growing.
- [[Trip highlights]] — a carousel of the best eight photos.
- [[Family album (Immich)]] — photos straight from an Immich server, without copying them into the vault.

Every note ends with a collapsed **How this gallery is set up** section showing its gallery block. The photos are in \`_photos\`; the photographers are credited on the [use cases page](${DOCS_URL}/use-cases#photo-credits).
`;
    }

    private icelandRoadTrip(): string {
        const yaml = USE_CASE_BLOCKS.icelandJustified;
        return `${frontmatter(['travel', 'iceland'], '2026-08-31')}
# Iceland road trip

Seven days on the Ring Road, clockwise from Reykjavík. We had rain on three of them and didn't care: the spray at Skógafoss, the ice at Jökulsárlón, and a puffin that sat still for exactly one photo.

${gallery(yaml)}

Next time: two more days in the east fjords, and book the Vík guesthouse earlier. Day-by-day notes are in the trip planner.

${setupCallout(yaml, [
    '`view: justified` lays the photos out in rows of equal height that fill the width, each photo uncropped, like a photo app timeline.',
    '`rowHeight: 240` sets the target row height in pixels.',
    '`captions: false` hides the file names; each one shows over its photo on hover.',
    RELATIVE_PATH_NOTE,
    'Click a photo to open the full-screen viewer, then use the arrow keys or swipe.'
], { title: 'Justified view', path: 'views/justified' })}
`;
    }

    private fiveLayouts(): string {
        const sections: Array<[string, string, string]> = [
            ['Masonry', USE_CASE_BLOCKS.icelandMasonry, 'Columns of uncropped photos, like a pinboard.'],
            ['Justified', USE_CASE_BLOCKS.icelandJustified, 'Rows of equal height that fill the width.'],
            ['Thumbnail', USE_CASE_BLOCKS.icelandThumbnail, 'Every photo whole, in an even grid of matching cards.'],
            ['Carousel', USE_CASE_BLOCKS.icelandCarousel, 'One photo at a time, on a stage of fixed height.'],
            ['Embed', USE_CASE_BLOCKS.icelandEmbed, 'Photos at full width, one under the other, like images pasted into the note.']
        ];
        const body = sections.map(([title, yaml, line]) => `## ${title}\n\n${line}\n\n${gallery(yaml)}`).join('\n\n');
        return `${frontmatter(['travel', 'iceland'], '2026-09-01')}
# Iceland — five layouts

Same folder, five ways to show it.

${body}

${setupCallout(USE_CASE_BLOCKS.icelandCarousel, [
    'Every gallery here reads the same folder; only `view: type` changes.',
    '`height: 480` sets the carousel stage height in pixels.',
    'In the embed gallery, `limit: 3` on the source shows only the first three photos.',
    RELATIVE_PATH_NOTE
], { title: 'Gallery block syntax', path: 'gallery-block-syntax' })}
`;
    }

    private changeTheLayout(): string {
        const yaml = USE_CASE_BLOCKS.icelandMasonry;
        return `${frontmatter(['travel', 'iceland'], '2026-09-02')}
# Change the layout

Put the cursor in the gallery below and change \`masonry\` to \`justified\` or \`carousel\`. The gallery redraws as soon as you leave the block.

${gallery(yaml)}

The five layouts are \`thumbnail\`, \`masonry\`, \`justified\`, \`carousel\` and \`embed\`.

${setupCallout(yaml, [
    '`view: type` picks the layout. Nothing else in the block has to change.',
    'Options that only apply to one layout, such as `rowHeight` for justified, are ignored by the others and noted under the gallery.',
    RELATIVE_PATH_NOTE
], { title: 'Gallery block syntax', path: 'gallery-block-syntax' })}
`;
    }

    private cabinMoodBoard(): string {
        const yaml = USE_CASE_BLOCKS.cabin;
        return `${frontmatter(['home', 'moodboard'], '2026-09-14')}
# Cabin mood board

Warm wood, linen, and lamps you'd actually read by. Everything here is going in the bedroom at the cabin, so if it doesn't fit the palette, it goes.

${gallery(yaml)}

Still deciding between the oak and the walnut for the shelves. The ceramics are from the market in town.

${setupCallout(yaml, [
    '`view: masonry` stacks the photos in columns, each at its own height.',
    '`columnWidth: 220` sets the narrowest a column can be, in pixels; wider notes get more columns.',
    '`gap: 8` sets the space between photos.',
    '`frame: false` drops the gallery border and background, so the board sits directly in the note.',
    RELATIVE_PATH_NOTE
], { title: 'Masonry view', path: 'views/masonry' })}
`;
    }

    private shakshuka(): string {
        const yaml = USE_CASE_BLOCKS.recipe;
        return `${frontmatter(['recipe', 'breakfast'], '2026-08-02')}
# Shakshuka

Sunday breakfast for four. One pan, about 30 minutes, and it's better with too much bread.

## Ingredients

- 2 tbsp olive oil
- 1 onion and 1 red pepper, sliced
- 3 garlic cloves
- 1 tsp each cumin and smoked paprika
- 2 tins chopped tomatoes
- 6 eggs
- Feta, parsley, and crusty bread to serve

## Steps

1. Soften the onion and pepper in the oil for 8 minutes, then add the garlic and spices.
2. Add the tomatoes and simmer for 10 minutes until thick. Season well.
3. Make six hollows, crack in the eggs, cover, and cook for 6–8 minutes until the whites set.
4. Crumble over the feta and parsley and take the pan to the table.

${gallery(yaml)}

${setupCallout(yaml, [
    '`view: embed` shows the photos at full width, one under the other, like images pasted into the note.',
    '`captions: true` shows each file name under its photo.',
    '`sort` with `by: name` orders the photos by file name: add a photo per step, named `1 – …`, `2 – …`, and they stay in order.',
    RELATIVE_PATH_NOTE
], { title: 'Embed view', path: 'views/embed' })}
`;
    }

    private designReferences(): string {
        const yaml = USE_CASE_BLOCKS.design;
        return `${frontmatter(['design', 'references'], '2026-10-03')}
# Design references

Screens, type, and buildings I keep coming back to. New finds go straight into the folder; the gallery picks them up.

${gallery(yaml)}

${setupCallout(yaml, [
    '`view: thumbnail` shows an even grid of tiles.',
    '`pagination: true` splits the folder into pages, and `itemsPerPage: 6` shows six photos per page.',
    'Pagination keeps a long note quick to open: only the current page loads.',
    RELATIVE_PATH_NOTE
], { title: 'Thumbnail view', path: 'views/thumbnail' })}
`;
    }

    private tripHighlights(): string {
        const yaml = USE_CASE_BLOCKS.highlights;
        return `${frontmatter(['travel', 'iceland'], '2026-09-03')}
# Trip highlights

The eight we printed for the fridge.

${gallery(yaml)}

${setupCallout(yaml, [
    '`view: carousel` shows one photo at a time, with arrows, a position badge, and dots.',
    '`height: 520` sets the stage height in pixels; every slide uses it, so the note doesn\'t jump.',
    '`limit: 8` on the source shows only the first eight photos in the folder.',
    RELATIVE_PATH_NOTE
], { title: 'Carousel view', path: 'views/carousel' })}
`;
    }

    private familyAlbum(immichReady: boolean): string {
        const yaml = USE_CASE_BLOCKS.immich;
        const notice = immichReady ? '' : `
> [!warning] Needs the \`${DEMO.immichKey}\` connection
> This gallery loads photos from the public Immich demo server through the \`${DEMO.immichKey}\` connection, which isn't in your settings. Add it in **Settings → Gallery View → Providers** with the details on the [demo servers page](${DOCS_URL}/demo-servers).
`;
        return `${frontmatter(['family', 'photos', 'iceland'], '2026-10-12')}
# Family album
${notice}
The Iceland trip, straight from the family Immich library: everything tagged Iceland since we landed. The photos stay on the server; this note just shows them.

${gallery(yaml)}

Anything the others upload and tag shows up here the next time the note opens.

${setupCallout(yaml, [
    `\`type: immich\` reads photos from an Immich server through the \`${DEMO.immichKey}\` connection set up in **Settings → Gallery View → Providers**. Nothing is copied into the vault.`,
    '`tags` only shows photos with that Immich tag, and `takenAfter` only those taken on or after that date. Immich sources can also filter by album, person, and favorites.',
    '`view: justified` lays the photos out in rows like a photo app timeline.'
], { title: 'Immich (authenticated)', path: 'sources/immich-authenticated' })}
`;
    }
}
