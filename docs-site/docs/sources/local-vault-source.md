---
sidebar_position: 1
---

# Local vault source

The local source type allows you to display images stored directly in your Obsidian vault.

## Configuration

To use a local source, set the `type` to `local` and provide the `path` to the folder or file relative to your vault root.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | — | **Required**. Must be `local`. |
| `path` | string | — | **Required**. Vault-relative path to folder or file. |
| `recursive` | boolean | `true` | Include images in subfolders. |

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
