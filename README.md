# Gallery View

Create interactive image galleries in your Obsidian notes using simple code blocks. Display images from your vault folders with thumbnail grids and click-to-expand modal viewing.

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![Obsidian](https://img.shields.io/badge/obsidian-0.15.0+-purple)

## Features

- **Thumbnail galleries** — Display images in responsive grid layouts
- **Modal viewer** — Click thumbnails to view full-size images
- **Multiple Sources** — Load images from local folders, external URLs, Immich shared links, or authenticated Immich albums
- **Simple syntax** — Easy `obs-gallery` code blocks with `sources` + `view` schema
- **Responsive design** — Works on desktop and mobile
- **Performance** — Lazy loading for large image collections
- **Clean styling** — Integrates seamlessly with Obsidian themes
- **Error handling** — Graceful fallbacks for missing paths

## Quick start

### Installation

1. Download the plugin files (`main.js`, `manifest.json`, `styles.css`)
2. Create folder: `YourVault/.obsidian/plugins/gallery-view/`
3. Copy files to the plugin folder
4. Enable "Gallery View" in Obsidian Settings → Community Plugins

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
3. Open the generated `GalleryDemo/` folder in your vault to explore working examples of local sources, external URLs, views, and template configurations for Immich shared links.

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
├── main.ts              # Main plugin code
├── main.js              # Compiled plugin
├── manifest.json        # Plugin metadata
├── styles.css           # Gallery styling
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
└── src/                 # Advanced architecture (future)
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