---
sidebar_position: 1
---

# What is Gallery View

**Gallery View** is an Obsidian plugin that lets you create interactive image galleries directly in your notes using `obs-gallery` code blocks.

## Features

- Display images in thumbnail grids, carousels, or masonry layouts
- Click thumbnails to open a full-size modal viewer
- Scan folders recursively for large collections
- Load images from external URLs or Immich shared links

## Supported Source Types

The plugin supports multiple image source types today:
- **Local vault images** (`local`) - load images from folders and files in your vault.
- **External URLs** (`external`) - load images from remote URLs.
- **Immich shared links** (`immich-share`) - load images directly from public Immich shares.

## Quick Example

The plugin uses a `sources + view` configuration model inside an `obs-gallery` block. Here is a simple example:

````markdown
```obs-gallery
sources:
  - type: local
    path: Photos/Vacation
view:
  type: thumbnail
```
````

## Where to go next

- [Installation](./installation) — how to install the plugin
- [Gallery block syntax](./gallery-block-syntax) — how to configure the code blocks
- [Sources](./category/sources) — see all supported image sources
- [Views](./category/views) — see all supported view types
