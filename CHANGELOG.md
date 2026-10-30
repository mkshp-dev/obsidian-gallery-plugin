# Changelog

## In-progress

- **New screenshots**: The README now opens with a GIF of a gallery and the viewer, and shows the five layouts, the viewer and the **Insert gallery** builder; images use absolute URLs so they also load in Obsidian's plugin browser. The docs pages for every view, the viewer, the builder, the Providers tab and the use cases have current screenshots, the docs site has a social card, and the five community-store images are real captures (in `docs-site/static/img/store/`). The plugin description no longer mentions the old grid view.

- **Use-case notes**: **Create showcase notes** now also writes `GalleryDemo/Use cases/`: notes that show what galleries are for (a travel journal, the same folder in all five layouts, a mood board, a recipe, a paged reference library, a highlights carousel and an Immich family album), each with its gallery block in a collapsed section under the gallery. Their real photos are an optional download (39 photos, about 10 MB, from `docs.mkshp.dev`); the dialog before the notes are created now has a **Download sample photos** toggle, and the notes are still created if the download fails. If you already have `GalleryDemo/`, run the new **Create use-case notes** command to add just these notes. The dialog's **Notes only** button is now **Skip connections**.
- **No tooltip over hover captions**: In the thumbnail, masonry, justified and embed views, Obsidian's tooltip with the file name appeared on top of the gallery's own hover caption after a moment. Screen readers still announce each image by name.
- **Focus ring only for keyboard users**: Clicking a tile or a carousel arrow (or closing the image viewer) no longer leaves an accent outline around it; the outline still shows when you move through the gallery with the keyboard.
- **Hover captions no longer clipped**: In the carousel and embed views, the caption over the image cut off the bottom of letters like "j" and "g".
- **Smoother wheel zoom**: Scrolling over the image viewer zooms about 1.25x per mouse-wheel notch, and touchpads zoom in small steps instead of jumping from fitted to close-up.
- **Insert button stays in view**: When **Insert gallery** is taller than the window, its **Cancel** and **Insert gallery block** buttons now stay at the bottom of the dialog instead of scrolling out of reach.
- **Use-case note wording**: The thumbnail section of "Iceland — five layouts" now reads "Every photo whole, in an even grid of matching cards." instead of describing square tiles.

## 2.6.2 - 2026-10-26

- **Hover captions stay hidden while editing**: With captions off (`captions: false` or **Show captions** off), every caption showed permanently in Live Preview while the editor had focus, as if captions were on. A caption over an image now shows only on hover or when that image has keyboard focus.
- **View options in the gallery builder**: **Insert gallery** now offers the per-gallery view options for the chosen view: captions and frame for every view, row height (justified), column width (masonry), carousel height, gap (masonry and justified) and pagination. Options left at their default aren't written, and the pagination toggle no longer appears for the carousel, which ignores it.


## 2.6.1 - 2026-10-25

- **No `:has()` in the stylesheet**: The carousel used a `:has()` selector to leave room for captions under the image, which Obsidian's review bot flags because it can slow down style updates. The carousel now marks those slides with a class instead; it looks the same.


## 2.6.0 - 2026-10-25

- **Galleries without a frame**: New **Show gallery frame** setting (Settings → Appearance) and `frame:` view option. With the frame off, a gallery drops its border, shadow, background and padding and sits directly in the note; thumbnail tiles keep their card look, and masonry and justified keep their gaps.
- **Immersive image viewer**: Clicking an image now opens a full-screen dark viewer instead of a framed window, giving the photo the whole screen. The top bar shows the position ("3 / 24") and file name, the caption appears under the photo, and the bar and arrows fade out when the mouse is still. Toolbar buttons use Obsidian's icons instead of emoji, and the arrows are redrawn and centred on the photo (single images have none). New: swipe between images on touch screens, double-click to zoom, and the images either side are preloaded so stepping through is quick. Fixed: the viewer left mouse listeners on the page every time it was opened.
- **Refreshed carousel**: The carousel now has a fixed-height stage (420 px; set it per gallery with `height`, or for all carousels with `--gallery-carousel-height`), so it no longer changes height between slides. The arrows are drawn chevrons that appear on hover and hide at the first and last slide, a "3 / 12" badge shows the position, and the dots are small with the current one stretched into an accent pill (galleries over 12 images show only the badge). Obsidian's button styles no longer distort the dots and arrows, the slide stays aligned when the pane is resized, and the slide animation respects reduced-motion settings.
- **Captions work the same in every view**: With **Show captions** on (or `captions: true`), captions now show under the images in the justified view too, and justified rows grow to fit them. With captions off, every view (thumbnail, carousel, masonry, justified, embed) shows a caption over the image while you hover over it or focus it with the keyboard; before, masonry, carousel and embed showed nothing, and justified always used the hover overlay and showed it on touch screens. Hover captions now show the image's caption rather than always the file name, and are hidden on touch screens.
- **More view options in gallery blocks**: `view:` now also takes `captions` (show or hide captions for one gallery), `rowHeight` (justified), `columnWidth` (masonry) and `gap` (both), in pixels. They override the settings and CSS snippets for that gallery only.
- **Warnings for ignored view options**: An unknown `view:` key (often a typo like `itemPerPage`) or one the view doesn't use (like `pagination` on a carousel) is now noted in a line under the gallery instead of being silently ignored. Out-of-range or wrongly typed values for known options stop the gallery with an error, as `pagination` and `itemsPerPage` already did.
- **Sharp images in the image viewer**: For Immich and Nextcloud galleries in the thumbnail, masonry and justified views, the viewer showed the gallery's small thumbnail (about 250 px) enlarged. It now shows that thumbnail at once and swaps in Immich's preview size (about 1440 px) or a 2048 px Nextcloud preview as soon as it loads. The 🔗 button (now "Open or save image") uses the larger version too.
- **Simpler error setting**: "Error display mode" had three options, but "Full" and "Text only" looked the same. It is now **Error messages: Show / Hide**; a saved "Text only" becomes "Show".
- **Redesigned Providers settings**: Immich and Nextcloud connections are now matching cards that show the key, server and last test result at a glance. Each card lists problems (missing or duplicate key, a server URL without `https://`, empty credentials), hides the Immich API key like the Nextcloud app password, shows the `connection:` line to copy into gallery blocks, and asks for a second click before removing. Edits now take effect right away: leaving a field clears that connection's cached listings and reloads only galleries that use it.


## 2.5.0 - 2026-10-24

- **Linting matches the Obsidian review bot**: Upgraded `eslint-plugin-obsidianmd` to 0.4.2 and switched to its stock `recommended` config with no rule overrides, so `npm run lint` reports the same issues as the plugin review bot.
- **Settings and builder text cleanup**: Fixed UI text that earlier lint autofixes had garbled (for example `Image/jpeg` and `Https://`), and reworded descriptions to pass the default sentence-case check: "API key", "Try again", "Gallery YAML copied to clipboard!", and shorter base-URL and MIME-type descriptions.
- **Remote images load on demand**: Immich and Nextcloud galleries (authenticated and share links) no longer download every image before the gallery appears. Each image is fetched when it scrolls into view, the current pagination page is shown, or a carousel slide comes near. An image that fails to fetch now shows the error tile with a retry button instead of silently disappearing. Authenticated Immich galleries also stop making one extra request per photo to look up captions.
- **Fewer refetches**: Adding, changing or removing an image in the vault now refreshes only local sources; remote sources keep their images. Changing a view setting (captions, pagination, timeout) re-renders galleries without fetching anything again, and editing a provider connection refreshes only galleries that use that provider.
- **Immich share links fixed**: `immich-share` images were downloaded twice (once by the plugin, then again by the browser), were treated as external URLs so they needed **Allow remote images**, and failed to load for password-protected shares. They are now downloaded once through the share session and no longer depend on that setting.
- **Memory leaks fixed**: Blob URLs for `immich-share` and `nextcloud-share` images were never released, and refreshing any remote gallery leaked one reference per image. Images now release their blob URLs when they are removed or the gallery closes.
- **Nextcloud thumbnail fallback**: When the Nextcloud preview endpoint fails (for example, preview generation is disabled), thumbnails now fall back to the original file as intended instead of failing.
- **Thumbnail pagination fix**: Going back to a page you had already viewed in the thumbnail view no longer shows blank tiles.
- **Source errors for every provider**: A failing source in a mixed gallery now shows its inline error for Nextcloud and local sources too, not just Immich.
- **Debug logging setting**: Debug logs were always on. They now follow the setting, renamed from **Enable lifecycle logging** to **Enable debug logging** (off by default).
- **New masonry and justified views**: `view: masonry` lays images out in equal-width columns at their natural heights (Pinterest-style), filling the shortest column next so there are no gaps under short images. `view: justified` lays them out in equal-height rows that exactly fill the width, uncropped, like Immich or Google Photos. Both reflow when the note is resized. Immich galleries know each image's size up front, so their rows don't shift as images load.
- **`grid` now renders as masonry**: The old grid view was documented as masonry but was a plain grid, which left gaps under every image shorter than the tallest one in its row. Existing `view: grid` blocks keep working and now get the real masonry layout. The builder, autocomplete and docs use `masonry` from now on.
- **`takenAfter` / `takenBefore` filters for Immich**: Authenticated `immich` sources can now filter by the date a photo was taken (its EXIF date). The existing `createdAfter` / `createdBefore` filters are unchanged, but they check the date a photo was *uploaded* to Immich, which the docs wrongly described as the creation date. For a library imported in one go, they match every photo or none. The gallery builder now has separate **Taken** and **Uploaded** date ranges.
- **Public demo servers**: The showcase notes and docs now use read-only Immich and Nextcloud demo servers, so every source type can be tried without a server of your own. Share-link examples work as they are. **Create showcase notes** now offers to add the `immich-demo` and `nextcloud-demo` connections the authenticated examples use (existing connections with those keys are left unchanged; if one points to another server, a notice and the welcome note say so); they are also listed on the new **Try it with the demo servers** docs page.
- **Nextcloud share links include sub-folders**: `nextcloud-share` sources ignored `recursive` and listed only the top level, so a shared folder that holds only sub-folders showed "No images found". Sub-folders are now included by default (`recursive: false` turns this off), and the documented `minSizeKb` / `maxSizeKb` filters now work for share links too.
- **Clearer Nextcloud folder errors**: A missing folder now shows `Folder '/Photos/' not found on https://cloud.example.com (connection 'home')` instead of `Request failed, status 404`, and a rejected login names the server and connection.
- **Uncropped Nextcloud thumbnails**: Nextcloud previews were requested cropped to a square. They now keep the image's aspect ratio, which the masonry and justified views need.


## 2.4.4 - 2026-10-18

- **Thumbnail layout fix** (#198): Every thumbnail tile now has the same width and a uniform image box. Previously the first item (and every 12th after it) spanned two columns on wide screens. Cards are also no longer stretched to fill a 420px minimum grid height, which left large empty gaps above the captions. A tile whose image fails to load now shows its error inside the image box instead of growing taller and stretching every card in its row, and images smaller than the tile are no longer enlarged.
- **Local test lab showcase**: `Create showcase notes` now also generates `16 - Local test lab` and a `GalleryDemo/_assets/` folder. The folder holds images in many aspect ratios and sizes, PNG/JPEG/WebP/animated GIF files, long, Unicode and upper-case-extension file names, an intentionally broken file, and 36 extra images for pagination tests. The images are drawn at runtime, so the plugin bundle stays small.


## 2.4.3 - 2026-09-17

- **README**: Added an install button and a live downloads badge, and replaced the stale hardcoded version badges with ones read from `manifest.json`.
- **pagination** (#193): Added the support for it in the gallery builder.


## 2.4.2 - 2026-09-17

- **Pagination** (#193): Grid, Thumbnail, and Embed views now support paging through large collections with Prev/Next controls instead of lazy-loading everything into one long scroll. Enable via `pagination`/`itemsPerPage` in a gallery's `view:` config, or set a plugin-wide default in Settings → Gallery View → Pagination. Off by default, so existing galleries render unchanged.
- **Local Source Filters, Sort & Limit**: The `local` source now supports `filenameFilter` (glob), `filters` (`modifiedAfter`/`modifiedBefore`/`minSizeKb`/`maxSizeKb`), `sort` (`name`/`modified`/`size`, `asc`/`desc`), and `limit` — bringing it to parity with the `nextcloud` and `immich` sources. The Gallery Builder modal's local source panel gained matching controls, and the showcase generator (`Create showcase notes`) now demonstrates local sorting, limiting, and filtering alongside the existing Immich examples.


## 2.4.1 - 2026-08-23

- **Note-relative Local Paths** (#191): `local` source `path` can now be given relative to the note containing the gallery block — `.` (the note's folder), `./Subfolder`, and `../Sibling` (any number of levels up) — so folder-note galleries keep working when the note or folder is renamed or moved. The Gallery Builder modal's local source picker gained a matching **"Keep relative to this note"** toggle, and the showcase generator (`Create showcase notes`) now includes a live folder-note demo.


## 2.4.0 - 2026-08-18

- **Embed View**: Added a new `embed` view type that renders images as a continuous, borderless vertical stack at natural size — no card chrome — so galleries feel like part of the note, similar to a native `![[image]]` embed.
- **Gallery Builder Modal Redesign**: Two-column layout with a sticky generated-code panel, collapsible filter groups for Immich/Nextcloud, paired fields on shared rows (e.g. min/max size, sort by/order), and native calendar (`type=date`) pickers for date-range filters.


## 2.3.0 - 2026-08-09

- **Nextcloud Filters UI**: Wired `nextcloud` and `nextcloud-share` filter and sort UI controls into the Gallery Builder Modal.
- **Nextcloud Filters**: Add limit field to nextcloud-share source
- **Nextcloud Filters**: Sort order (by name / lastModified / size) for nextcloud sources
- **Nextcloud Filters**: Added `filenameFilter` field to `nextcloud` and `nextcloud-share` sources allowing users to match filenames using glob patterns or extensions.

- **Nextcloud public shares**: Added support for resolving Nextcloud public share links via the `nextcloud-share` source type, including password-protected shares.
- **Nextcloud integration**: Added foundational Nextcloud type definitions, interfaces, configuration settings, and source lifecycle support.


## 2.2.7 - 2026-08-03


- **Immich Source Album Filtering**: Fixed a bug where the authenticated `immich` source type ignored `albumIds` filters and displayed all assets from the main server library instead of restricting results to the specified album(s).
- **Docs**: Verified versioned Docusaurus deployment workflow and automated changelog syncing.


## 2.2.6 - 2026-08-01

- **Persistent Image Captions**: Added persistent image caption rendering below images across Grid, Thumbnail, and Carousel views.
- **Global Caption Controls**: Added global `Show captions` toggle and `Caption max lines` (1–5 lines) settings in Settings → General.
- **Comprehensive Metadata & EXIF Extraction**: Automatically extracts image titles, descriptions, and EXIF metadata across local vault files, external URLs, authenticated Immich connections, and public Immich share links.
- **Gallery View Builder Modal (`Ctrl+P`)**: Completely redesigned the modal layout (`860px` width) with quick-add source pills, a single wide vault folder selector, live YAML codeblock preview with copy button, external URL caption fields, and square red `✕` action buttons.
- **Lightbox Hover Tooltips & Event Isolation**: Added hover tooltips (`Zoom In`, `Zoom Out`, `Reset Zoom`, `Play/Pause Slideshow`, `Toggle Info`, `Open Original`, `Close`) to all Lightbox controls and isolated click events to prevent Obsidian's native image preview from opening simultaneously.
- **Immich Password Authentication & Search**: Added password normalization and Bearer token/Cookie authorization for password-protected Immich share links (`immich-share`), with `POST /api/search/metadata` album resolution.


## 2.2.3 - 2026-07-03

- Collapsed/folded the details of Immich providers in settings tab to keep the interface compact, while allowing dynamic header updates and auto-expansion for new entries.
- Upgraded the gallery lightbox modal overlay with a premium glassmorphic blurred backdrop, centralized slideshow autoplay, interactive zoom/pan controls, and a detailed metadata side drawer.
- Added click-to-expand and keyboard accessibility support for images in the Grid View layout.
- Fixed multi-gallery rendering issue where only one gallery would display properly when a note contained multiple galleries pointing to the same folder path.
- Replaced all gallery error and empty-state blocks with a compact single-line message (`⚠️ gallery: …`) so errors are unobtrusive and don't push note content around.


## 2.2.2 - 2026-06-27

## 2.2.0 - 2026-06-27

- Cache albums, tags and people per authenticated connection.
- Polished Insert Gallery builder UX for authenticated Immich (logical groups, searchable multi-selects, live YAML preview).
- Allow users to write human-readable tag and people names in Gallery View YAML instead of Immich internal UUIDs.
- Added authenticated Immich people filters to canonical schema
- Add authenticated Immich tag filters on canonical schema.
- Updated the Insert Gallery builder flow to emit canonical authenticated Immich source configurations (filters, limit, sort) across album, favorites, and recent modes.
- Added authenticated Immich asset-type filter on canonical schema.
- Added authenticated Immich date-range filters (`createdAfter`, `createdBefore`) on canonical schema.
- Refactored authenticated Immich source schema to the canonical filters, limit, and sort model.
- Normalized and clarified the authenticated Immich source contract and documentation.
- Added authenticated Immich `recent` source support.
- Added authenticated Immich `favorites` source support.
- Restructured Gallery View's settings UI into distinct General and Providers tabs.
- Verified and finalized the Gallery builder modal and Immich insertion UX epic (#77).
- Verified and finalized the authenticated Immich album source MVP (#75).
- Verified and finalized the authenticated image delivery pipeline for Gallery View (#74).
- Added Gallery builder modal command to compose multiple sources with interactive UIs, rather than writing YAML directly.

- Immich connection model cleanup: remove display name, keep stable key, add migration.
- Replaced oversized broken image placeholders with exact source failure reasons and compact inline error UI for Immich galleries.
- Fixed gallery rendering lifecycle to reliably preserve galleries across note transitions and markdown re-renders.

- Improved authenticated Immich image loading so Gallery View uses lightweight thumbnails/previews instead of original assets where appropriate.
- Added authenticated Immich `album` support under the new `immich` provider path.
- Extracted shared helper utilities for Immich sources into an internal `ImmichTypes` and `ImmichHelpers` layer to reduce duplication without merging setup requirements.
- Added a test/validation flow for authenticated Immich connections in the plugin settings.
- Added an internal API client/service layer for authenticated Immich connections.
- Added an authenticated connection model and settings UI to support the authenticated `immich` provider path.
- Added a command to generate Gallery View showcase notes and demo assets inside the vault.
* Reorganized and refreshed Gallery View documentation to match the current `sources + view` schema, supported sources, and official plugin naming.


## 2.1.0 - 2026-06-22

* Added support for Immich shared-link galleries as a new `immich-share` source in Gallery View.
* Refactored gallery source loading into an internal resolver architecture to prepare for future source providers.


## 2.0.0 - 2026-06-21

- Reworked Gallery View codeblock syntax to support a new `sources` + `view` schema while keeping existing gallery blocks backward compatible.


## 1.0.10 - 2026-06-21

- Removed Roadmap from README
- Added Support section to README
- Optimize gallery rendering performance and improve array deduplication.
- Fix syntax and indentation issues in the jules-dispatch GitHub Actions workflow.
- Added attestation for release assets


## 1.0.9 - 2026-06-20

## 1.0.8 - 2026-06-15

- Improve GridView responsiveness and container initialization.
- Implement automated GitHub Actions release pipeline.


