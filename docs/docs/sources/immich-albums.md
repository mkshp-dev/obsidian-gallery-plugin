---
sidebar_position: 4
---

# Immich Authenticated Albums

Gallery View supports directly displaying albums from your personal Immich library using an authenticated connection.

This is different from [Immich Shared Links](./immich-shared-links.md) because it uses your personal API key and requires no public share links.

## Requirements

1. **Configure a Connection**: First, you must add an Immich Connection in the Gallery View plugin settings.
2. **Set a Key**: Assign a short, memorable `key` (like `home`) to your connection in the plugin settings. This key is how you refer to the connection in your notes.
3. **Generate an API Key**: Ensure you have created an API Key in your Immich account settings and entered it in the plugin settings.

## Basic usage

To show an entire authenticated album, use the `immich` source type, reference your connection `key`, and specify the album `id`.

```yaml
sources:
  - type: immich
    connection: home
    source:
      type: album
      id: 6f671c26-3693-4a1e-84b2-2e6ddde2a2bb
view:
  type: grid
```

### Finding your Album ID

To find your album ID:
1. Open your Immich web interface.
2. Navigate to the album you want to embed.
3. Look at the URL in your browser's address bar.
4. The ID is the long string of letters and numbers at the end of the URL. (e.g., in `https://immich.example.com/albums/6f671c26-3693-4a1e-84b2-2e6ddde2a2bb`, the ID is `6f671c26-3693-4a1e-84b2-2e6ddde2a2bb`).

## Privacy and Security

- Your API Key is stored locally in Obsidian's plugin settings.
- The `immich` source type creates temporary, authenticated preview URLs to render images within Obsidian.
- These URLs expire when you close the note and are never embedded into the Markdown document, ensuring your photos remain private.
- The plugin intelligently fetches lighter thumbnail or preview assets depending on your active `view` to improve rendering speed, avoiding large original asset downloads for large grids.

## Troubleshooting

- **Gallery shows error "Authentication failed"**: Your API key may have expired or been revoked. Generate a new API key in Immich and update the plugin settings.
- **Gallery shows error "Connection 'home' not found"**: Ensure the `connection` key in your gallery block perfectly matches the `key` you assigned to the connection in the plugin settings.
- **Gallery is blank/empty**: The album may be empty, or the Album ID might be incorrect. Double check the ID from the Immich URL.
