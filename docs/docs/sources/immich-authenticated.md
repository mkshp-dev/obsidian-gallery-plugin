---
sidebar_position: 4
---

# Immich Authenticated Sources

Gallery View supports directly displaying albums and favorites from your personal Immich library using an authenticated connection.

This is different from [Immich Shared Links](./immich-shared-links.md) because it uses your personal API key and requires no public share links.

## Requirements

1. **Configure a Connection**: First, you must add an Immich Connection in the Gallery View plugin settings.
2. **Set a Key**: Assign a short, memorable `key` (like `home`) to your connection in the plugin settings. This key is how you refer to the connection in your notes.
3. **Generate an API Key**: Ensure you have created an API Key in your Immich account settings and entered it in the plugin settings.

## Common Behavior

- **View-Aware Loading**: The plugin intelligently fetches lighter thumbnail or preview assets depending on your active `view` to improve rendering speed, avoiding large original asset downloads for large grids.
- **Inline Error Behavior**: If an asset fails to load, the gallery handles it inline gracefully, and can retry if the asset becomes available.
- **Separate from Shared Links**: The `immich` authenticated source is entirely separate from `immich-share` and does not use public shared links. It exclusively uses your securely stored API keys.

## Supported Authenticated Sources

### Authenticated Album

To show an entire authenticated album, use the `immich` source type, reference your connection `key`, and specify the album `id`. The `id` field is required for this source type.

```yaml
sources:
  - type: immich
    connection: home
    filters:
      albumIds:
        - 6f671c26-3693-4a1e-84b2-2e6ddde2a2bb
view:
  type: grid
```

#### Finding your Album ID

To find your album ID:
1. Open your Immich web interface.
2. Navigate to the album you want to embed.
3. Look at the URL in your browser's address bar.
4. The ID is the long string of letters and numbers at the end of the URL. (e.g., in `https://immich.example.com/albums/6f671c26-3693-4a1e-84b2-2e6ddde2a2bb`, the ID is `6f671c26-3693-4a1e-84b2-2e6ddde2a2bb`).

### Authenticated Favorites

To show all your favorited assets, use the `immich` source type, reference your connection `key`, and specify `type: favorites`. It does not require an album ID or any extra fields.

```yaml
sources:
  - type: immich
    connection: home
    filters:
      isFavorite: true
view:
  type: grid
```

**Note:** If you have no favorites in your Immich library, the gallery will be empty. This is expected behavior and will not produce an error.

### Authenticated Recent

To show your recently added assets, use the `immich` source type, reference your connection `key`, and specify `type: recent`. Like favorites, it does not require an album ID.

You can also provide an optional `limit` field to control how many recent assets are fetched (defaults to 20).

```yaml
sources:
  - type: immich
    connection: home
    limit: 50
    sort:
      by: createdAt
      order: desc
view:
  type: grid
```

**Note:** The assets returned will be empty if your library has no assets. This is expected behavior and will not produce an error.


### Authenticated Tags

You can filter assets by Immich tags by providing one or more tag IDs in the `tagIds` array. Like other filters, `tagIds` can be combined with `albumIds`, `isFavorite`, or date filters.

```yaml
sources:
  - type: immich
    connection: home
    filters:
      tagIds:
        - 550e8400-e29b-41d4-a716-446655440000
        - 7b2d56a1-3e4b-4a5c-8d1e-2c9a8b7f6e5d
view:
  type: grid
```


### Authenticated People

You can filter assets by Immich people by providing one or more person IDs in the `personIds` array. Like other filters, `personIds` can be combined with `albumIds`, `isFavorite`, or date filters.

```yaml
sources:
  - type: immich
    connection: home
    filters:
      personIds:
        - 110e8400-e29b-41d4-a716-446655440000
        - 2b2d56a1-3e4b-4a5c-8d1e-2c9a8b7f6e5d
view:
  type: grid
```

### Date Range Filters

You can filter assets by their creation date using `createdAfter` and `createdBefore`. The dates must be in `YYYY-MM-DD` format. These filters can be used on their own or combined with other filters like `albumIds` or `isFavorite`.

```yaml
sources:
  - type: immich
    connection: home
    filters:
      createdAfter: 2025-01-01
      createdBefore: 2025-12-31
view:
  type: grid
```

**Note:** Date filtering currently supports the *created date* (the date the asset was uploaded or created in the system), rather than the captured/taken date.

### Asset Type Filters

You can filter assets by their type using `assetType`. This allows you to request only images or only videos. The supported values are `image` and `video`. Like date range filters, these can be used on their own or combined with other filters.

Only videos from a specific album:
```yaml
sources:
  - type: immich
    connection: home
    filters:
      albumIds:
        - 6f671c26-3693-4a1e-84b2-2e6ddde2a2bb
      assetType: video
view:
  type: grid
```

Favorite images only:
```yaml
sources:
  - type: immich
    connection: home
    filters:
      isFavorite: true
      assetType: image
view:
  type: grid
```

Recent videos:
```yaml
sources:
  - type: immich
    connection: home
    filters:
      assetType: video
    limit: 20
    sort:
      by: createdAt
      order: desc
view:
  type: grid
```

## Privacy and Security

- Your API Key is stored locally in Obsidian's plugin settings.
- The `immich` source type creates temporary, authenticated preview URLs to render images within Obsidian.
- These URLs expire when you close the note and are never embedded into the Markdown document, ensuring your photos remain private.

## Troubleshooting

- **Gallery shows error "Authentication failed"**: Your API key may have expired or been revoked. Generate a new API key in Immich and update the plugin settings.
- **Gallery shows error "Connection 'home' not found"**: Ensure the `connection` key in your gallery block perfectly matches the `key` you assigned to the connection in the plugin settings.
- **Gallery is blank/empty**: The album or favorites list may be empty. If using an album, the Album ID might be incorrect. Double check the ID from the Immich URL.
