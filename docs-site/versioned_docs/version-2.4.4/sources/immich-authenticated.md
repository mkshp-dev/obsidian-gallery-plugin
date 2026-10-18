---
sidebar_position: 4
---

# Immich Authenticated Sources

Gallery View supports directly displaying albums and favorites from your personal Immich library using an authenticated connection.

This is different from [Immich Shared Links](./immich-shared-links.md) because it uses your personal API key and requires no public share links.

## Requirements

1. **Configure a Connection**: First, you must add an Immich Connection in the Gallery View plugin settings under **Settings → Gallery View → Providers**.
2. **Set a Key**: Assign a short, memorable `key` (like `home`) to your connection in the plugin settings. This key is how you refer to the connection in your notes.
3. **Generate an API Key**: Ensure you have created an API Key in your Immich account settings and entered it in the plugin settings.

See [Settings → Providers tab](../settings#providers-tab) for step-by-step instructions on adding a connection.

## Common Behavior

- **View-Aware Loading**: The plugin intelligently fetches lighter thumbnail or preview assets depending on your active `view` to improve rendering speed, avoiding large original asset downloads for large grids.
- **Inline Error Behavior**: If an asset fails to load, the gallery handles it inline gracefully, and can retry if the asset becomes available.
- **Separate from Shared Links**: The `immich` authenticated source is entirely separate from `immich-share` and does not use public shared links. It exclusively uses your securely stored API keys.

## The `immich` Source Schema

All authenticated Immich sources share the same schema. The `connection` key is always required; all other fields are optional filters or display options:

```yaml
sources:
  - type: immich
    connection: <your-connection-key>
    filters:
      albumIds:
        - <album-uuid>
      isFavorite: true
      tags:
        - Photography
      people:
        - Alice
      createdAfter: YYYY-MM-DD
      createdBefore: YYYY-MM-DD
      assetType: image  # or: video
    limit: 50
    sort:
      by: createdAt
      order: desc  # or: asc
view:
  type: grid
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `immich`. |
| `connection` | string | Yes | The `key` of a connection you configured in Settings → Providers. |
| `filters.albumIds` | list of strings | No | One or more Immich album UUIDs. |
| `filters.isFavorite` | boolean | No | When `true`, only returns assets you have marked as favorites. |
| `filters.tags` | list of strings | No | Human-readable tag names (e.g. `Photography`). The plugin resolves names to IDs automatically. |
| `filters.people` | list of strings | No | Human-readable person names (e.g. `Alice`). The plugin resolves names to IDs automatically. |
| `filters.createdAfter` | string (YYYY-MM-DD) | No | Only return assets created after this date. |
| `filters.createdBefore` | string (YYYY-MM-DD) | No | Only return assets created before this date. |
| `filters.assetType` | `image` or `video` | No | Filter by asset type. |
| `limit` | number | No | Maximum number of assets to fetch. |
| `sort.by` | `createdAt` | No | Sort field. Currently only `createdAt` is supported. |
| `sort.order` | `asc` or `desc` | No | Sort direction. `desc` = newest first. |

> [!IMPORTANT]
> Filters are combined using **AND** logic as per Immich API rules. For example, if you filter by `albumIds` **and** `isFavorite` **and** `assetType` in the same source block, only assets that meet *all* specified criteria will be returned.

---

## Supported Authenticated Sources

### Authenticated Album

To show an entire authenticated album, provide the album UUID in `filters.albumIds`.

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

You can include **multiple albums** by listing more than one ID:

```yaml
sources:
  - type: immich
    connection: home
    filters:
      albumIds:
        - 6f671c26-3693-4a1e-84b2-2e6ddde2a2bb
        - a1b2c3d4-0000-1111-2222-333344445555
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

To show all your favorited assets, set `filters.isFavorite: true`. No album ID or extra fields are required.

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

### Recent Assets

To show your most recently added assets, use `sort` with `order: desc` and an optional `limit` to control how many are shown.

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

**Note:** The assets returned will be empty if your library has no assets. This is expected behavior.

### Authenticated Tags

You can filter assets by Immich tags by providing one or more **tag names** in `filters.tags`. The plugin automatically resolves these names to Immich internal tag IDs, so you never need to look up UUIDs.

```yaml
sources:
  - type: immich
    connection: home
    filters:
      tags:
        - Photography
        - Family
view:
  type: grid
```

### Authenticated People

You can filter assets by recognized people by providing one or more **person names** in `filters.people`. Like tags, the plugin resolves names to Immich internal IDs automatically.

```yaml
sources:
  - type: immich
    connection: home
    filters:
      people:
        - Alice
        - Bob
view:
  type: grid
```

### Date Range Filters

You can filter assets by their creation date using `createdAfter` and `createdBefore`. The dates must be in `YYYY-MM-DD` format. These filters can be combined with other filters.

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

**Note:** Date filtering uses the *created date* (the date the asset was uploaded or created in the system), not the captured/taken date.

### Asset Type Filters

You can filter assets by their type using `assetType`. Supported values are `image` and `video`. This can be combined with any other filter.

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

---

## Using the Gallery Builder

Instead of writing YAML manually, you can use the **Gallery View: Insert gallery** command. When you add an `immich` source in the builder, it will:

- Show a dropdown of your configured connections.
- Let you select albums, tags, and people from searchable live lists fetched directly from your Immich server.
- Allow you to set filters, limit, and sort order using form controls.
- Preview the generated YAML in real time.

See [Gallery Builder](../gallery-builder) for full details.

---

## Privacy and Security

- Your API Key is stored locally in Obsidian's plugin settings.
- The `immich` source type creates temporary, authenticated preview URLs to render images within Obsidian.
- These URLs expire when you close the note and are never embedded into the Markdown document, ensuring your photos remain private.

## Troubleshooting

- **Gallery shows error "Authentication failed"**: Your API key may have expired or been revoked. Generate a new API key in Immich and update the plugin settings.
- **Gallery shows error "Connection 'home' not found"**: Ensure the `connection` key in your gallery block perfectly matches the `key` you assigned to the connection in the plugin settings.
- **Gallery is blank/empty**: The album or favorites list may be empty. If using an album, the Album ID might be incorrect. Double check the ID from the Immich URL.
- **Tags or people not resolving**: Ensure the names match exactly as they appear in Immich. Names are case-sensitive. Use the Gallery Builder to browse and select available tags and people from live lists.
