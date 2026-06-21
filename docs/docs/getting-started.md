---
sidebar_position: 1
---

# Image Gallery

**Image Gallery** is an Obsidian plugin that lets you create interactive image galleries directly in your notes using `obs-gallery` code blocks.

## What you can do

- Display images from vault folders in thumbnail grids, carousels, or masonry layouts
- Click thumbnails to open a full-size modal viewer
- Include images from external URLs (opt-in)
- Scan folders recursively for large collections

## Quick example

````markdown
```obs-gallery
sources:
  - type: local
    path: Photos/Vacation
view:
  type: thumbnail
```
````

> [!NOTE]
> The plugin fully supports the legacy v1 syntax (e.g., `path: Photos/Vacation`) for backward compatibility, but the v2 nested `sources` schema is preferred.

## Next steps

- [Installation](./installation) — how to install the plugin
- [Configuration](./configuration) — all available parameters
- [Usage](./usage) — more code block examples
