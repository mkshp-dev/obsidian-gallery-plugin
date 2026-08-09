---
sidebar_position: 5
---

# Nextcloud Authenticated Sources

Gallery View supports displaying image collections directly from your personal or organization's Nextcloud server using an authenticated WebDAV connection.

This is separate from [Nextcloud Shared Links](./nextcloud-shared-links) because it connects using your Nextcloud account credentials or an App Password, granting full access to folders in your account without requiring public share links.

## Requirements

1. **Configure a Connection**: Add a Nextcloud Connection in Gallery View plugin settings under **Settings → Gallery View → Providers → Nextcloud Connections**.
2. **Set a Key**: Assign a short, unique `key` (such as `nextcloud-demo` or `my-cloud`) to your connection.
3. **Credentials**: Provide your Nextcloud server base URL, username, and an **App Password** (recommended) generated in your Nextcloud Account settings (**Settings → Security → Devices & sessions → Create new app password**).

See [Settings → Providers tab](../settings#providers-tab) for step-by-step instructions on managing connection settings.

---

## The `nextcloud` Source Schema

All authenticated Nextcloud sources use the `type: nextcloud` schema. The `connection` key is required; all other fields (path, recursive, filters, sorting, limit) are optional:

```yaml
sources:
  - type: nextcloud
    connection: nextcloud-demo
    path: /Photos/Vacation
    recursive: true
    filenameFilter: "IMG_*"
    filters:
      mimeTypes:
        - image/jpeg
        - image/png
      minSizeKb: 10
      maxSizeKb: 5000
      modifiedAfter: "2024-01-01"
      modifiedBefore: "2024-12-31"
    sort:
      by: lastModified  # name | size | lastModified
      order: desc       # asc | desc
    limit: 50
view:
  type: grid
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `nextcloud`. |
| `connection` | string | Yes | The `key` of a Nextcloud connection configured in Settings → Providers. |
| `path` | string | No | Folder path on your Nextcloud server (e.g., `/Photos`, `/Gallery-Test`). Defaults to `/`. |
| `recursive` | boolean | No | When `true`, scans subdirectories recursively. Defaults to `true`. |
| `filenameFilter` | string | No | Glob pattern for filename matching (e.g. `IMG_*`, `*.png`). |
| `filters.mimeTypes` | list of strings | No | Filter files by MIME types (e.g. `image/jpeg`, `image/png`, `image/webp`). |
| `filters.minSizeKb` | number | No | Minimum file size in kilobytes. |
| `filters.maxSizeKb` | number | No | Maximum file size in kilobytes. |
| `filters.modifiedAfter` | string (ISO / YYYY-MM-DD) | No | Only return files modified after this date. |
| `filters.modifiedBefore` | string (ISO / YYYY-MM-DD) | No | Only return files modified before this date. |
| `sort.by` | `name`, `size`, or `lastModified` | No | Field to sort files by. |
| `sort.order` | `asc` or `desc` | No | Sort order. `desc` = descending. |
| `limit` | number | No | Maximum number of images to fetch. |

---

## Features

- **WebDAV & Preview Integration**: Uses Nextcloud's native WebDAV protocol and efficient core preview API to render lightweight thumbnails fast.
- **Recursive Scanning**: Discover images across subdirectories without manually listing each folder.
- **Filename Globs & MIME Filtering**: Easily target specific file types or camera naming conventions.
- **Automatic Caching**: Results are cached in memory for optimal performance and low server load.

---

## Examples

### 1. Basic Nextcloud Gallery

```yaml
sources:
  - type: nextcloud
    connection: my-cloud
    path: /Photos
view:
  type: grid
```

### 2. Recursive Subfolder Scan with Camera Glob Filter

```yaml
sources:
  - type: nextcloud
    connection: my-cloud
    path: /Gallery-Test
    recursive: true
    filenameFilter: "IMG_2024*"
    limit: 20
view:
  type: thumbnail
```

---

## Troubleshooting

- **Connection Not Found**: Verify that the `connection` key in your YAML matches the connection key added in **Settings → Gallery View → Providers**.
- **Authentication Failure (401/403)**: Ensure your Nextcloud username and App Password are entered correctly. We recommend using a dedicated App Password from Nextcloud Security settings instead of your account password.
- **Path Not Found (404)**: Double check the folder path on your Nextcloud instance. Paths are relative to your user root (e.g., `/Photos/Summer`).
