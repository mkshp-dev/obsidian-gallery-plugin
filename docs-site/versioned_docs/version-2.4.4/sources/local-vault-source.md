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
  type: grid
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
  type: grid
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
  type: grid
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
  type: grid
```
````

Relative paths are only supported for `sources[].path` with `type: local` — not the legacy top-level `path:` shorthand.
