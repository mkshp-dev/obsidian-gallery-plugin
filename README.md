# Gallery View

Turn any folder of photos into a gallery inside your notes. Pick a layout (masonry, justified rows, thumbnails, a carousel or full-width embeds), click a photo to see it full screen, and pull images from your vault, the web, Immich or Nextcloud.

[![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22gallery-view%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=gallery-view) ![Version](https://img.shields.io/github/manifest-json/v/mkshp-dev/obsidian-gallery-plugin?label=version) ![Obsidian](https://img.shields.io/github/manifest-json/minAppVersion/mkshp-dev/obsidian-gallery-plugin?label=obsidian&color=purple)

[![Install in Obsidian](https://img.shields.io/badge/Install-Obsidian%20Community%20Plugins-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md/plugins?id=gallery-view)

![A justified photo gallery in an Obsidian note, opening a photo in the full-screen viewer](https://raw.githubusercontent.com/mkshp-dev/obsidian-gallery-plugin/main/docs-site/static/img/readme/hero.gif)

## Features

![The same folder of photos in masonry, justified, thumbnail, carousel and embed layouts](https://raw.githubusercontent.com/mkshp-dev/obsidian-gallery-plugin/main/docs-site/static/img/readme/five-layouts.png)

- **Five layouts.** Masonry columns, justified rows (like Google Photos or Immich), a thumbnail grid, a carousel and borderless embeds. Switch by changing one word.
- **Full-screen viewer.** Click any photo for a dark, distraction-free view with slideshow, zoom, photo details, keyboard arrows and swipe.
- **Your photos, wherever they are.** Vault folders (including subfolders and paths relative to the note), web URLs, Immich (shared links, or your library with albums, people, tags and dates) and Nextcloud (share links or WebDAV folders).
- **No YAML needed.** The **Insert gallery** command builds the block for you, and autocomplete helps if you'd rather type it.
- **Fast with big folders.** Images load as you scroll, with optional pagination.
- **Fits your notes.** Uses your theme, works on mobile, and can drop its frame so the gallery sits in the text.

![Full-screen image viewer with the details panel open](https://raw.githubusercontent.com/mkshp-dev/obsidian-gallery-plugin/main/docs-site/static/img/readme/viewer.png)

## Quick start

### Install

In Obsidian, open **Settings → Community plugins → Browse**, search for **Gallery View**, then install and enable it. Or [open it in Obsidian](https://obsidian.md/plugins?id=gallery-view).

<details>
<summary>Manual install</summary>

1. Download `main.js`, `manifest.json` and `styles.css` from the latest release.
2. Create the folder `YourVault/.obsidian/plugins/gallery-view/` and copy the files into it.
3. Enable **Gallery View** in **Settings → Community plugins**.
</details>

### Try it in 30 seconds

Run **Gallery View: Create showcase notes** from the command palette. It creates a `GalleryDemo/` folder with ready-made notes for every layout and source, including use cases built on real photos.

### Make your own

Run **Gallery View: Insert gallery**, pick a layout and a folder, and click **Insert gallery block**:

![Building a masonry gallery with the Insert gallery command](https://raw.githubusercontent.com/mkshp-dev/obsidian-gallery-plugin/main/docs-site/static/img/readme/builder.gif)

### Basic Usage

Create galleries in your notes using code blocks:

````markdown
```obs-gallery
sources:
  - type: local
    path: Images/Screenshots
view:
  type: thumbnail
```
````

> [!NOTE]
> The plugin fully supports the legacy v1 syntax (e.g., `path: Images/Screenshots`) for backward compatibility, but the v2 nested `sources` schema is preferred.

## Documentation

For full details on configuring the plugin, usage examples, and available settings, please refer to the [Gallery View documentation](https://mkshp-dev.github.io/obsidian-gallery-plugin/docs/what-is-gallery-view).

## Supported formats

- **JPEG** (`.jpg`, `.jpeg`)
- **PNG** (`.png`)
- **GIF** (`.gif`)
- **WebP** (`.webp`)

### Showcase Generator
Gallery View includes a built-in command to generate a set of interactive demo notes inside your vault. This is the fastest way to see what the plugin can do and to learn the configuration syntax.

1. Open the Obsidian command palette (`Ctrl+P` / `Cmd+P`)
2. Run **Gallery View: Create showcase notes**
3. Choose whether to add the read-only demo server connections (see below), or create the notes only.
4. Open the generated `GalleryDemo/` folder in your vault to explore working examples of local sources, external URLs, every view, and Immich and Nextcloud sources backed by public demo servers.

## Network use

Gallery View only makes network requests for sources you configure, or for demo notes you choose to create:

- **Your own sources:** `external`, `immich`, `immich-share`, `nextcloud` and `nextcloud-share` sources contact the server in their URL or connection. External image URLs load only when **Allow remote images** is on.
- **Demo servers:** the showcase notes for Immich and Nextcloud load photos from public, read-only demo servers run by the plugin's author (`demo-immich.mkshp.dev` and `demo-nextcloud.mkshp.dev`). **Create showcase notes** asks before adding their connections to your settings. When those notes are open, your IP address reaches that server; access logs are kept for about 14 days. See [Try it with the demo servers](https://mkshp-dev.github.io/obsidian-gallery-plugin/docs/demo-servers).
- **Sample web images:** the showcase's External URLs and Mixed sources notes load sample images from `picsum.photos` when **Allow remote images** is on.
- **Sample photos (optional):** **Create showcase notes** and **Create use-case notes** can download a set of 39 sample photos (about 10 MB) for the use-case notes from `docs.mkshp.dev`, the documentation site. This happens once, only when you run one of those commands and leave **Download sample photos** on in the dialog; the photos are then saved in your vault under `GalleryDemo/Use cases/_photos/`. See [Use cases](https://docs.mkshp.dev/obsidian-gallery-plugin/docs/use-cases).

The plugin has no telemetry and sends nothing anywhere else.

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Development build with watching
npm run dev

# Production build
npm run build

# Simple build (MVP version)
npm run build-mvp
```

### Project Structure

```
obsidian-gallery-plugin/
├── main.js              # Compiled plugin
├── manifest.json        # Plugin metadata
├── styles.css           # Gallery styling
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
└── src/                 # Source code
    ├── main.ts          # Main plugin code, lifecycle management
    ├── models/          # Data models
    ├── views/           # View components
    ├── services/        # Core services
    └── processors/      # Content processing
```

## Contributing

Contributions are welcome! Please feel free to:

- Share usage examples and feedback
- Help with documentation

### Development Setup

1. Clone the repository
2. Run `npm install` to install dependencies
3. Use `npm run dev` for development with auto-rebuilding
4. Test in your Obsidian vault

## License

MIT License — see [LICENSE](./LICENSE) for details.

## Acknowledgments

- Built for the [Obsidian](https://obsidian.md) community

## Support
If this project helps your workflow, consider supporting its development with a ☕

<a href="https://www.buymeacoffee.com/mkshp" target="_blank">
  <img
    src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=%E2%98%95&slug=mkshp&button_colour=5F7FFF&font_colour=ffffff&font_family=Cookie&outline_colour=000000&coffee_colour=FFDD00"
    alt="Buy me a coffee"
    height="45"
  />
</a>

<br/>

<a href="https://github.com/sponsors/mkshp-dev" target="_blank">
  <img
    src="https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?logo=github-sponsors&style=flat-square"
    alt="Sponsor mkshp-dev on GitHub"
    height="32"
  />
</a>

- **Bug reports**: [GitHub Issues](../../issues)
- **Feature requests**: [GitHub Discussions](../../discussions)
- **Documentation**: [Plugin docs](https://mkshp-dev.github.io/obsidian-gallery-plugin/docs/what-is-gallery-view)