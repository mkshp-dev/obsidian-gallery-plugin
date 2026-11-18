---
sidebar_position: 6
---

# Nextcloud Shared Links

You can display images from a public Nextcloud folder share or Photos app album directly in Gallery View without requiring any Nextcloud account or connection configuration.

The `nextcloud-share` source type is entirely separate from the authenticated `nextcloud` source type. It works using public share URLs created on a Nextcloud server.

---

## The `nextcloud-share` Source Schema

```yaml
sources:
  - type: nextcloud-share
    url: https://cloud.example.com/s/TOKEN
    password: "optional-share-password"
    recursive: true
    filenameFilter: "IMG_*"
    filters:
      mimeTypes:
        - image/jpeg
        - image/png
      minSizeKb: 10
      maxSizeKb: 5000
    sort:
      by: name          # name | size | lastModified
      order: asc        # asc | desc
    limit: 20
view:
  type: masonry
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `nextcloud-share`. |
| `url` | string | Yes | Public share URL from Nextcloud (standard `/s/TOKEN` or Photos app `/apps/photos/public/TOKEN`). |
| `password` | string | No | Password if the Nextcloud public share link is password-protected. |
| `recursive` | boolean | No | When `true`, scans subdirectories inside the share. Defaults to `true`. |
| `filenameFilter` | string | No | Glob pattern for filename matching (e.g. `IMG_*`, `*.png`). |
| `filters.mimeTypes` | list of strings | No | Filter files by MIME types (e.g. `image/jpeg`, `video/mp4`). `image/*` and `video/*` match every image or video type. |
| `filters.minSizeKb` | number | No | Minimum file size in kilobytes. |
| `filters.maxSizeKb` | number | No | Maximum file size in kilobytes. |
| `sort.by` | `name`, `size`, or `lastModified` | No | Field to sort files by. |
| `sort.order` | `asc` or `desc` | No | Sort order (`asc` or `desc`). |
| `limit` | number | No | Maximum number of images to display. |

---

## Supported URL Formats

Gallery View automatically parses and resolves several Nextcloud public share URL formats:

- **Standard Files Public Link**: `https://cloud.example.com/s/TOKEN` or `https://cloud.example.com/index.php/s/TOKEN`
- **Files App Share Link**: `https://cloud.example.com/apps/files/s/TOKEN`
- **Photos App Public Album Link**: `https://cloud.example.com/apps/photos/public/TOKEN`

---

## Videos

Videos in the share play in the [image viewer](../views/image-viewer.md#videos); their tiles show a still frame with a play icon. The still frame is Nextcloud's public preview of the video when the server makes video previews. For password-protected shares, or servers without video previews, a video up to 50 MB is downloaded once to take its frame (not on phones or tablets), and larger ones show a dark placeholder. Playing downloads the whole video, so videos over **Largest remote video to play** in [Settings](../settings.md) offer **Open in Nextcloud** (the share's page) instead.

## Examples

These examples use shares on the public, read-only [demo server](../demo-servers.md), so you can paste them into a note as they are.

### 1. Standard Public Share Link

```yaml
sources:
  - type: nextcloud-share
    url: https://demo-nextcloud.mkshp.dev/s/DAxM47SmHesMTqa
view:
  type: masonry
```

### 2. Password-Protected Share Link

```yaml
sources:
  - type: nextcloud-share
    url: https://demo-nextcloud.mkshp.dev/s/ZSBpcMLfaQPCi2Y
    password: "gallery-demo"
view:
  type: thumbnail
```

### 3. Nextcloud Photos App Public Album

```yaml
sources:
  - type: nextcloud-share
    url: https://demo-nextcloud.mkshp.dev/apps/photos/public/wD9fLmI1TP6KEq76Yvs9fZrBdfDu8gfc
view:
  type: justified
```

---

## Troubleshooting

- **Invalid Nextcloud Share URL**: Ensure the URL is a valid public share link copied from Nextcloud.
- **Authentication Failed / Password Protected**: If the share link requires a password, make sure to specify the `password` property in your YAML block.
- **Share Not Found or Expired**: The share link may have expired or been deleted by the owner on Nextcloud.
