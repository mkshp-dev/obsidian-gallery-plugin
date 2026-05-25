---
sidebar_position: 5
---

# Remote images

Remote images are disabled by default to protect your privacy. To use them:

1. Open **Settings → Image Gallery**.
2. Enable **Allow remote images**.

Then add a `urls` list to your code block:

````markdown
```obs-gallery
view: thumbnail
urls:
  - https://example.com/photos/cover.jpg
  - https://cdn.example.org/gallery/img123.webp
```
````

## Notes

- Remote images are not downloaded into your vault. To keep permanent local copies, mirror the assets manually.
- Enable **Validate remote content type** to have the plugin perform a lightweight HEAD request before loading each URL. This reduces accidental loading of non-image resources at the cost of one extra network request per URL.
- The **Remote load timeout** setting controls how long the plugin waits before giving up on a slow URL.
