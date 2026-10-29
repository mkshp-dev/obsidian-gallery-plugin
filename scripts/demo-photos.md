# Sample photos for the use-case notes

The notes in `GalleryDemo/Use cases/` (commands **Create showcase notes** and **Create use-case notes**) are built on real photos. The plugin downloads them, with the user's consent, from the docs site:

```
https://docs.mkshp.dev/obsidian-gallery-plugin/demo-photos/use-cases/manifest.json
```

They are not bundled into `main.js`. Until a manifest is published, the consent dialog doesn't offer the download and the use-case galleries are empty.

## TODO: photos still needed

Unsplash, Pexels or your own photos only. No AI images and no `picsum`. Mixed shapes matter: masonry and justified only look good with uneven ratios.

| Set | Count | Mix | Subjects |
|---|---|---|---|
| `iceland` | 20 | 6 portrait, 12 landscape, 1 panorama, 1 square | Skógafoss, Kirkjufell, Jökulsárlón, Diamond Beach, aurora, Icelandic horses, Reynisfjara basalt, Hallgrímskirkja, Vík church, puffin, lava-field road, Blue Lagoon |
| `cabin` | 10 | Mostly portrait | Wood, linen, plants, warm lamps, ceramics, fireplace: one warm palette |
| `recipe` | 1 (4 with steps) | Landscape, same table and light | The finished shakshuka; optionally the steps: ingredients, onions and peppers, eggs in the pan, served |
| `design` | 8 | Mixed | Architecture, typography, UI references |

Notes on names (the `name` column becomes the file name in the vault and the caption):

- `iceland`: the prose in `Iceland road trip.md` mentions Skógafoss, Jökulsárlón and a puffin, so include those. `Trip highlights.md` shows the first 8 in name order, and the embed in `Iceland — five layouts.md` the first 3, so pick names whose alphabetical order puts strong photos first.
- `recipe`: the gallery sorts by name, so if there are step photos, number them: `1 – Everything you need`, `2 – Onions and peppers`, `3 – Eggs in the pan`, `4 – Served`.
- Everything else: a readable phrase, such as `Kirkjufell from the falls`. No `/ \ : * ? " < > | # ^ [ ]`.

Total budget: **15 MB** (about 42 photos at a long edge of 1920 px, JPEG quality 80).

### Status (29 October 2026)

The source folder is `/home/homelab/demo-photo-sources/` on the demo VPS, with 39 photos in `credits.csv`, all Unsplash. Files no longer used are in its `unused/` folder.

| Set | Have | Notes |
|---|---|---|
| `iceland` | 20 (6 portrait, 12 landscape, 1 panorama, 1 square) | Complete. The square is the horse close-up cropped to 1:1; the uncropped original is kept in the folder |
| `cabin` | 10, all portrait | Complete: 7 by Caroline Badran, 3 by Hans, one warm wood palette |
| `recipe` | 1 | A single photo, "Shakshuka served for brunch". No stock photographer has a step-by-step series. To show steps, add your own photos named `1 – …`, `2 – …` |
| `design` | 8 (5 portrait, 3 landscape) | Complete, including 3 brutalist buildings |

All 20 Iceland photos are on the Immich demo (tag `Iceland`). Add any new Iceland photo there too, with the same tag and a date inside 24–30 August 2026. The demo's edge proxy limits requests to 10 MB, so larger originals have to be uploaded on the server itself.

unsplash.com blocks the VPS with a bot check, and Pexels returns 403, so download in a browser.

### Candidates

Unsplash and Pexels were blocked from the environment that collected these, so the links come from search results and nobody has opened them yet. On each page, check two things before downloading:

- **The license.** It must say "Free to use under the Unsplash License". Skip anything with an **Unsplash+** badge, which is paid and not allowed here.
- **The shape.** Check portrait or landscape against the set's mix.

The search links already filter to free photos (`license=free`) and the right orientation.

**Iceland**, specific photos:

| Subject | Link |
|---|---|
| Skógafoss | [Skogafoss falls, Iceland](https://unsplash.com/photos/skogafoss-falls-iceland-yEi3wQYMqAs) |
| Skógafoss with person (good for scale) | [Person in front of a large waterfall](https://unsplash.com/photos/a-person-standing-in-front-of-a-large-waterfall-v0Py1h6M--c) |
| Waterfall, aerial | [Aerial view of a waterfall](https://unsplash.com/photos/aerial-view-of-a-powerful-waterfall-cascading-over-rocks-dEmsn8I3dHw) |
| Kirkjufell, aurora | [Snow-capped mountain under aurora](https://unsplash.com/photos/PMdiRXbAbhY) |
| Kirkjufell, sunrise | [Kirkjufell at sunrise](https://unsplash.com/photos/kirkjufell-at-sunrise-in-iceland-beautiful-landscape-and-sunrise-HzFrrKQRGyg) (title style suggests Unsplash+, so check) |
| Aurora with person | [Man by water under aurora](https://unsplash.com/photos/man-standing-beside-the-body-of-water-with-aurora-lights-in-the-sky-Hn8N4I4eHA0) |
| Aurora on rock | [Man on rock under aurora](https://unsplash.com/photos/cGwfkwHmt98) |
| Jökulsárlón | [Icebergs and mountains on calm water](https://unsplash.com/photos/h7bQ8VEZtws) |
| Diamond Beach | [Ice blocks on black stone](https://unsplash.com/photos/ice-blocks-on-black-stone-fragment-4knR_YzeUVc) |
| Iceberg close-up | [Iceberg on water](https://unsplash.com/photos/d8ddeWAc4z4) |
| Glacier and black sand | [Brown soil and glacier mountain](https://unsplash.com/photos/brown-soil-and-glacier-mountain-4EV9u4Ru8EQ) |
| Icelandic horse (close-up, could be the square) | [Brown horse](https://unsplash.com/photos/uvz0Z9bXGhg) |

**Iceland**, the rest:

- Portraits: [Hallgrímskirkja](https://unsplash.com/s/photos/hallgrimskirkja?orientation=portrait&license=free) · [Svartifoss](https://unsplash.com/s/photos/svartifoss?orientation=portrait&license=free) · [Fjaðrárgljúfur](https://unsplash.com/s/photos/fjadrargljufur?orientation=portrait&license=free) · [Reynisfjara](https://unsplash.com/s/photos/reynisfjara?orientation=portrait&license=free) · [Puffin](https://unsplash.com/s/photos/puffin-iceland?orientation=portrait&license=free)
- Landscapes: [Vík church](https://unsplash.com/s/photos/vik-iceland-church?orientation=landscape&license=free) · [Seljalandsfoss](https://unsplash.com/s/photos/seljalandsfoss?orientation=landscape&license=free) · [Icelandic horses](https://unsplash.com/s/photos/icelandic-horse?orientation=landscape&license=free) · [Iceland road](https://unsplash.com/s/photos/iceland-road?orientation=landscape&license=free) · [Blue Lagoon](https://unsplash.com/s/photos/blue-lagoon-iceland?orientation=landscape&license=free) · [Reykjavík](https://unsplash.com/s/photos/reykjavik?orientation=landscape&license=free)
- Panorama: [Iceland panorama](https://unsplash.com/s/photos/iceland-panorama?orientation=landscape&license=free). Pick one at least 3:1 wide.

**Cabin**: [Cabin interior](https://unsplash.com/s/photos/cabin-interior?orientation=portrait&license=free) · [Cozy fireplace](https://unsplash.com/s/photos/cozy-fireplace?orientation=portrait&license=free) · [Linen bedding](https://unsplash.com/s/photos/linen-bedding?orientation=portrait&license=free) · [Ceramics](https://unsplash.com/s/photos/handmade-ceramics?orientation=portrait&license=free) · [Houseplants](https://unsplash.com/s/photos/houseplant-wood?orientation=portrait&license=free) · [Warm lamp](https://unsplash.com/s/photos/warm-lamp?orientation=portrait&license=free). Take several shots from 2–3 photographers so the colors match.

**Recipe**: stock sites rarely have step-by-step sets. Try [Unsplash shakshuka](https://unsplash.com/s/photos/shakshuka?orientation=landscape&license=free) and [Pexels shakshuka](https://www.pexels.com/search/shakshuka/?orientation=landscape) for one photographer with several shots of the same cook, or take four phone shots of your own next time you cook.

**Design**: [Architecture](https://unsplash.com/s/photos/minimal-architecture?license=free) · [Typography](https://unsplash.com/s/photos/typography-poster?license=free) · [Interior details](https://unsplash.com/s/photos/interior-design-detail?license=free) · [Brutalism](https://unsplash.com/s/photos/brutalism?license=free)

While downloading: pick **Large** (about 1920 px) in the "Download free" dropdown, and add each photo to `credits.csv` as you go. The source is the photo page URL, and the credit is the photographer's name on the page.

## The Iceland set on the demo Immich server

`Family album (Immich).md` shows the same trip from Immich, with this block:

```yaml
filters:
  tags:
    - Iceland
  takenAfter: "2026-08-24"
```

So on `demo-immich.mkshp.dev`:

1. Upload the 20 Iceland photos (the originals or the prepared copies; either works).
2. Tag all of them `Iceland`. The tag name must be unique on the server.
3. Set their dates to the trip, 24–30 August 2026 (select them, then **Change date**), in roughly the order of the road trip. Late August is when both the puffins and the first auroras can plausibly appear, so keep the aurora shots at night. Stock photos keep their real capture dates, which would be years apart and fall outside `takenAfter`. Nothing else on the server should be tagged `Iceland` and dated after 24 August 2026.
4. Update `docs-site/docs/demo-servers.md`: the asset count, the new tag in the tags row, and the 20 photos in the Immich credits table. Say that their dates were changed for the demo, as the page already does for the made-up `IMG_…` names.

Until the tag exists, the note shows "Tag not found: 'Iceland'", so do this before the release, together with publishing the photos.

## Publishing a set

1. Put the source photos in a folder outside the repo, with a `credits.csv`:

   ```csv
   file,name,set,credit,source,license
   DSC_0412.jpg,Skógafoss at dusk,iceland,Jane Doe,https://unsplash.com/photos/abc123,Unsplash License
   ```

2. Run the script:

   ```bash
   node scripts/prepare-demo-photos.mjs ~/demo-photo-sources
   ```

   It rotates, resizes, strips EXIF, and writes `docs-site/static/demo-photos/use-cases/` (photos, `manifest.json`, `CREDITS.md`). It also updates the count and size in `src/generators/SamplePhotoSet.ts`, which the consent dialog shows. It prints each set's count and shape mix against the table above. Re-running replaces the previous output.

3. Copy the credits into the **Photo credits** section of `docs-site/docs/use-cases.md`.
4. `npm test` (the manifest test checks the files, hashes and dialog constants), then commit the photos, manifest and `SamplePhotoSet.ts` together.
5. The docs deploy on push to `Dev`. Ship the plugin release after the photos are live, so the dialog never offers photos that can't be downloaded.

To try a set without touching the repo, pass `--out <folder>`; `SAMPLE_PHOTO_DIR=<folder> npx jest SamplePhotoManifest` then checks it.
