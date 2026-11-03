---
sidebar_position: 1
---

# Local vault source

The local source type allows you to display images stored directly in your Obsidian vault.

## Configuration

To use a local source, set the `type` to `local` and provide the `path` to the folder or file relative to your vault root.

```yaml
sources:
  - type: local
    path: Photos/Vacation2024
    recursive: true
    filenameFilter: "IMG_*"
    filters:
      minSizeKb: 10
      maxSizeKb: 5000
      modifiedAfter: "2024-01-01"
      modifiedBefore: "2024-12-31"
    sort:
      by: modified  # name | size | modified
      order: desc   # asc | desc
    limit: 50
view:
  type: masonry
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | — | **Required**. Must be `local`. |
| `path` | string | — | **Required**. Vault-relative path to folder or file. |
| `recursive` | boolean | `true` | Include images in subfolders. |
| `filenameFilter` | string | — | Glob pattern for filename matching (e.g. `IMG_*`, `*.png`). |
| `filters.minSizeKb` | number | — | Minimum file size in kilobytes. |
| `filters.maxSizeKb` | number | — | Maximum file size in kilobytes. |
| `filters.modifiedAfter` | string (ISO / YYYY-MM-DD) | — | Only include files modified after this date. |
| `filters.modifiedBefore` | string (ISO / YYYY-MM-DD) | — | Only include files modified before this date. |
| `sort.by` | `name`, `size`, or `modified` | — | Field to sort files by. |
| `sort.order` | `asc` or `desc` | — | Sort order. `desc` = descending. |
| `limit` | number | — | Maximum number of images to fetch. |

## Supported formats

Images in JPEG, PNG, GIF (including animated), WebP, AVIF and SVG, and videos (see below). Other files in the folder are skipped. When some of them are photos or videos in a format galleries can't show (HEIC, TIFF, BMP, camera RAW files, or AVI, MKV and similar videos), a line under the gallery says how many and which formats, for example *2 files weren't shown: HEIC and RAW aren't supported.* Notes, PDFs and other documents are skipped without a mention. Files that `filenameFilter` leaves out aren't counted.

SVGs are drawn as images, so any scripts inside them don't run. An SVG with only a `viewBox` (no width or height) keeps the shape the `viewBox` gives it, and in the [image viewer](../views/image-viewer.md) SVGs are scaled up to fill the screen. Photo details (date taken, camera, lens) are read from JPEG, PNG and WebP files; AVIF files don't show them yet.

## Videos

Video files in the folder (`.mp4`, `.m4v`, `.webm`, `.mov`, `.ogv`) are part of the gallery too. Each tile shows a still frame from about a second into the video, with a play icon and the video's length in the corner. Click it to play the video in the [image viewer](../views/image-viewer.md#videos).

To show only videos, or only images, filter by file name:

```yaml
sources:
  - type: local
    path: Clips
    filenameFilter: "*.mp4"
```

Large videos are fine: they play straight from disk, and the still frame is taken by jumping to that point rather than reading the whole file. If Obsidian doesn't allow the frame to be taken that way, files up to 50 MB are read to take it; larger ones, and every video on a phone or tablet, show a dark placeholder with the play badge instead.

Videos play in Obsidian's built-in player, so they need a format it can play: MP4 (H.264) and WebM work everywhere. A `.mov` from an iPhone is often HEVC, which some computers can't play; its tile then shows a dark placeholder, and the viewer shows that instead of playing it.

## Examples

### Folder gallery

Display all images in a folder:

````markdown
```obs-gallery
sources:
  - type: local
    path: Photos/Vacation2024
view:
  type: thumbnail
```
````

### Recursive scan

Include images from all subfolders by setting `recursive: true` on your local source configuration:

````markdown
```obs-gallery
sources:
  - type: local
    path: Projects
    recursive: true
view:
  type: masonry
```
````

### Recently modified photos, newest first

Combine `sort`, `filters`, and `limit` to show only your 12 most recently modified screenshots:

````markdown
```obs-gallery
sources:
  - type: local
    path: Screenshots
    filenameFilter: "*.png"
    sort:
      by: modified
      order: desc
    limit: 12
view:
  type: masonry
```
````

### Single file

Point directly at one image file path:

````markdown
```obs-gallery
sources:
  - type: local
    path: Assets/cover.png
view:
  type: thumbnail
```
````

### Relative to the current note

`path` can also be given relative to the note the gallery block is written in, instead of a full vault path. This is useful for folder notes, since the gallery keeps working if the note or folder is later renamed or moved.

| Value | Resolves to |
|-------|-------------|
| `.` | The note's own folder |
| `./Subfolder` | A subfolder of the note's folder |
| `../Sibling` | A folder next to the note's folder (one `..` per level up) |

For example, a folder note at `Gaming/Doom & Heretic/Log/2026/Altruze.md` with images stored alongside it:

````markdown
```obs-gallery
sources:
  - type: local
    path: "."
view:
  type: masonry
```
````

Relative paths are only supported for `sources[].path` with `type: local` — not the legacy top-level `path:` shorthand.
