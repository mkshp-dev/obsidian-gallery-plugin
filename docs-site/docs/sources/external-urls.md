---
sidebar_position: 2
---

# External URLs

You can include remotely hosted images in your gallery by using the `external` source type.

> [!WARNING]
> Remote images are disabled by default to protect your privacy. You must enable **Allow remote images** in **Settings → Gallery View** before external sources will load.

## Configuration

To use external URLs, set the `type` to `external` and provide a list of `urls`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | — | **Required**. Must be `external`. |
| `urls` | list of strings | — | **Required**. List of remote image URLs to load. |

## Example

````markdown
```obs-gallery
sources:
  - type: external
    urls:
      - https://example.com/photos/cover.jpg
      - https://cdn.example.org/gallery/img123.webp
view:
  type: thumbnail
```
````

## Notes

- Remote images are not downloaded into your vault. To keep permanent local copies, mirror the assets manually.
- Enable **Validate remote content type** in Settings to have the plugin perform a lightweight HEAD request before loading each URL. This reduces accidental loading of non-image resources at the cost of one extra network request per URL.
- The **Remote load timeout** setting controls how long the plugin waits before giving up on a slow URL. You can change it in the settings.
