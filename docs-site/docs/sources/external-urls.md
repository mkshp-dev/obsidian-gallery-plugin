---
sidebar_position: 2
---

# External URLs

You can include remotely hosted images and videos in your gallery by using the `external` source type.

> [!WARNING]
> Remote images and videos are disabled by default to protect your privacy. You must enable **Allow remote images** in **Settings → Gallery View** before external sources will load.

## Configuration

To use external URLs, set the `type` to `external` and provide a list of `urls`. URLs can be plain strings or `{ url, caption, video }` objects.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `external`. |
| `urls` | list of strings or objects | Yes | List of remote image or video URLs, or `{ url, caption, video }` objects. Set `video: true` for a video whose URL doesn't end in a video file extension. |

## Example

````markdown
```obs-gallery
sources:
  - type: external
    urls:
      - url: https://example.com/photos/cover.jpg
        caption: "Sunset over the Pacific"
      - https://cdn.example.org/gallery/img123.webp
view:
  type: thumbnail
```
````

## Videos

A URL ending in `.mp4`, `.m4v`, `.webm`, `.mov` or `.ogv` is a video (a query string after it is fine). For a video URL without one of those endings, add `video: true`:

````markdown
```obs-gallery
sources:
  - type: external
    urls:
      - https://cdn.example.org/clips/waves.mp4
      - url: https://media.example.org/stream/1234
        caption: "Launch day"
        video: true
view:
  type: masonry
```
````

- **Playing**: the [image viewer](../views/image-viewer.md#videos) streams the video straight from the website, so it starts quickly and plays at any size (the **Largest remote video to play** limit doesn't apply).
- **Still frames**: the tile shows a frame from about a second into the video. A website has to allow other sites to read its videos (CORS) for the frame to be taken straight away. If it doesn't, a video up to 50 MB is downloaded once to take the frame (not on phones or tablets), and larger ones, or ones whose size the site doesn't report, show a dark placeholder with the play badge.
- Pages that embed a player (YouTube, Vimeo and similar) aren't video files and can't be shown.

## Notes

- Remote images are not downloaded into your vault. To keep permanent local copies, mirror the assets manually.
- Enable **Validate remote content type** in Settings to have the plugin perform a lightweight HEAD request before loading each URL. This reduces accidental loading of non-image resources at the cost of one extra network request per URL. Videos pass when the site reports a `video/` type.
- The **Remote load timeout** setting controls how long the plugin waits before giving up on a slow URL. You can change it in the settings.
