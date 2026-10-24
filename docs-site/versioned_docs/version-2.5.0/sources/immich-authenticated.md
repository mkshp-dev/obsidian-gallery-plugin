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

:::tip Try it without your own server
The examples on this page use the connection key `immich-demo` and the albums, tags and people of the public, read-only [demo server](../demo-servers.md). Add that connection to run them as they are, or replace `immich-demo` and the IDs with your own.
:::

## Common Behavior

- **View-Aware Loading**: The plugin fetches lighter assets depending on your `view`: thumbnails for the `thumbnail`, `masonry` and `justified` views, and previews for `carousel`. This avoids downloading large originals for big galleries.
- **Stable layouts**: Immich reports each photo's size, so the `masonry` and `justified` views place photos correctly before they download.
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
      takenAfter: YYYY-MM-DD    # date the photo was taken
      takenBefore: YYYY-MM-DD
      createdAfter: YYYY-MM-DD  # date it was uploaded to Immich
      createdBefore: YYYY-MM-DD
      assetType: image  # or: video
    limit: 50
    sort:
      by: createdAt
      order: desc  # or: asc
view:
  type: masonry
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `immich`. |
| `connection` | string | Yes | The `key` of a connection you configured in Settings → Providers. |
| `filters.albumIds` | list of strings | No | One or more Immich album UUIDs. |
| `filters.isFavorite` | boolean | No | When `true`, only returns assets you have marked as favorites. |
| `filters.tags` | list of strings | No | Human-readable tag names (e.g. `Photography`). The plugin resolves names to IDs automatically. |
| `filters.people` | list of strings | No | Human-readable person names (e.g. `Alice`). The plugin resolves names to IDs automatically. |
| `filters.tagIds` | list of strings | No | Tag UUIDs, as an alternative to `tags`. Useful when two tags share a name. |
| `filters.personIds` | list of strings | No | Person UUIDs, as an alternative to `people`. Useful for people without a name in Immich. |
| `filters.takenAfter` | string (YYYY-MM-DD) | No | Only return photos **taken** on or after this date (the date stored in the photo's EXIF data). |
| `filters.takenBefore` | string (YYYY-MM-DD) | No | Only return photos **taken** on or before this date. |
| `filters.createdAfter` | string (YYYY-MM-DD) | No | Only return assets **uploaded** to Immich on or after this date. |
| `filters.createdBefore` | string (YYYY-MM-DD) | No | Only return assets **uploaded** to Immich on or before this date. |
| `filters.assetType` | `image` or `video` | No | Filter by asset type. |
| `limit` | number | No | Maximum number of assets to fetch. |
| `sort.by` | `createdAt` | No | Sort field. Currently only `createdAt` is supported. |
| `sort.order` | `asc` or `desc` | No | Sort direction. `desc` = newest first. |

> [!IMPORTANT]
> Filters are combined using **AND** logic as per Immich API rules. For example, if you filter by `albumIds` **and** `isFavorite` **and** `assetType` in the same source block, only assets that meet *all* specified criteria will be returned. The same applies inside `tags` and `people`: listing two people returns only photos that include both. (`albumIds` is the exception: several albums are combined.)

---

## Supported Authenticated Sources

### Authenticated Album

To show an entire authenticated album, provide the album UUID in `filters.albumIds`.

```yaml
sources:
  - type: immich
    connection: immich-demo
    filters:
      albumIds:
        - 0fe76d50-18b3-4f74-8f7c-3ede043982de
view:
  type: justified
```

You can include **multiple albums** by listing more than one ID:

```yaml
sources:
  - type: immich
    connection: immich-demo
    filters:
      albumIds:
        - 0a33a817-9389-45f5-a99d-6ac12f56dc7f
        - 882fef37-436a-49c1-af1a-e444d0216ee0
view:
  type: masonry
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
    connection: immich-demo
    filters:
      isFavorite: true
view:
  type: masonry
```

**Note:** If you have no favorites in your Immich library, the gallery will be empty. This is expected behavior and will not produce an error.

### Recent Assets

To show your most recently added assets, use `sort` with `order: desc` and an optional `limit` to control how many are shown.

```yaml
sources:
  - type: immich
    connection: immich-demo
    limit: 50
    sort:
      by: createdAt
      order: desc
view:
  type: masonry
```

**Note:** The assets returned will be empty if your library has no assets. This is expected behavior.

### Authenticated Tags

You can filter assets by Immich tags by providing one or more **tag names** in `filters.tags`. The plugin automatically resolves these names to Immich internal tag IDs, so you never need to look up UUIDs.

```yaml
sources:
  - type: immich
    connection: immich-demo
    filters:
      tags:
        - Nature
view:
  type: masonry
```

Listing several tags returns only assets that carry **all** of them, not any of them.

### Authenticated People

You can filter assets by recognized people by providing one or more **person names** in `filters.people`. Like tags, the plugin resolves names to Immich internal IDs automatically.

```yaml
sources:
  - type: immich
    connection: immich-demo
    filters:
      people:
        - Alice
view:
  type: masonry
```

Listing several people returns only photos that include **all** of them. To show photos of Alice *or* Bob, add two `immich` sources to the gallery, one per person.

### Date Range Filters

There are two pairs of date filters. Both take a date in `YYYY-MM-DD` format (or a full `YYYY-MM-DDTHH:mm:ssZ` timestamp), include the whole day they name, and can be combined with other filters.

| Filters | Date they check |
|---|---|
| `takenAfter` / `takenBefore` | When the photo was **taken**, from its EXIF data (Immich's `fileCreatedAt`). |
| `createdAfter` / `createdBefore` | When the asset was **uploaded** to Immich (Immich's `createdAt`). |

For most galleries you want `takenAfter` / `takenBefore`. Photos are often uploaded long after they were taken, for example when importing an old library, and then every photo shares the same upload date.

Photos taken in 2025:

```yaml
sources:
  - type: immich
    connection: immich-demo
    filters:
      takenAfter: 2025-01-01
      takenBefore: 2025-12-31
view:
  type: masonry
```

Assets uploaded since a given day:

```yaml
sources:
  - type: immich
    connection: immich-demo
    filters:
      createdAfter: 2026-10-01
view:
  type: masonry
```

### Asset Type Filters

You can filter assets by their type using `assetType`. Supported values are `image` and `video`. This can be combined with any other filter.

Only videos from a specific album:
```yaml
sources:
  - type: immich
    connection: immich-demo
    filters:
      albumIds:
        - 882fef37-436a-49c1-af1a-e444d0216ee0
      assetType: video
view:
  type: masonry
```

Favorite images only:
```yaml
sources:
  - type: immich
    connection: immich-demo
    filters:
      isFavorite: true
      assetType: image
view:
  type: masonry
```

Recent videos:
```yaml
sources:
  - type: immich
    connection: immich-demo
    filters:
      assetType: video
    limit: 20
    sort:
      by: createdAt
      order: desc
view:
  type: masonry
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
- **Gallery shows error "Connection 'immich-demo' not found"**: Ensure the `connection` key in your gallery block perfectly matches the `key` you assigned to the connection in the plugin settings.
- **Gallery is blank/empty**: The album or favorites list may be empty. If using an album, the Album ID might be incorrect. Double check the ID from the Immich URL. If you list several tags or people, only assets matching all of them are shown.
- **A date filter matches every photo or none**: `createdAfter` / `createdBefore` check the upload date. Use `takenAfter` / `takenBefore` to filter by the date the photo was taken.
- **Tags or people not resolving**: Ensure the names match exactly as they appear in Immich. Names are case-sensitive. Use the Gallery Builder to browse and select available tags and people from live lists.
