---
sidebar_position: 1
---

# What is Gallery View

**Gallery View** is an Obsidian plugin that lets you create interactive image galleries directly in your notes using `obs-gallery` code blocks.

## Features

- Display images in thumbnail grids, carousels, or masonry layouts
- Click thumbnails to open a full-size modal viewer
- Scan folders recursively for large collections
- Load images from external URLs, Immich shared links, or your personal authenticated Immich library

## Supported Source Types

The plugin supports multiple image source types today:
- **Local vault images** (`local`) — load images from folders and files in your vault.
- **External URLs** (`external`) — load images from remote URLs.
- **Immich shared links** (`immich-share`) — load images directly from public Immich shares without any account configuration.
- **Immich authenticated** (`immich`) — connect to your personal Immich library using an API key to display albums, favorites, recent assets, and more.

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

## Editor Tools

Gallery View includes built-in editor tools to make writing gallery blocks faster:

### Insert Gallery (Builder Modal)

Instead of writing YAML by hand, use the **Gallery View: Insert gallery** command from the command palette. This opens an interactive modal where you can:
- Choose a view type (Grid, Thumbnail, Carousel)
- Add and configure one or more sources using form fields
- Preview the generated YAML in real time before inserting it.

### YAML Autocomplete

When your cursor is inside an `obs-gallery` code block, Gallery View provides IntelliSense-style completions for:
- `type:` — suggests valid source types (`local`, `immich`, `immich-share`)
- `connection:` — suggests your configured Immich connection keys
- `view:` — suggests valid view types
- `assetType:` — suggests `image` or `video`
- `sort.order:` — suggests `asc` or `desc`
- List items inside `albumIds`, `tags`, or `people` — fetches live data from your Immich server

## The Showcase Generator

If you want a hands-on way to explore the plugin's features, Gallery View includes a built-in showcase generator.

From the Obsidian command palette, run **Gallery View: Create showcase notes**. This will generate a safe-to-edit `GalleryDemo/` folder in your vault containing working examples of local sources, views, external URLs, and templates for Immich sharing.

## Where to go next

- [Installation](./installation) — how to install the plugin
- [Gallery block syntax](./gallery-block-syntax) — how to configure the code blocks
- [Sources](./category/sources) — see all supported image sources
- [Views](./category/views) — see all supported view types
- [Gallery Builder](./gallery-builder) — insert galleries without writing YAML
