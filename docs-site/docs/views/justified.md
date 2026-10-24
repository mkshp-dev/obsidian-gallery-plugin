---
sidebar_position: 4
---

# Justified view

Rows of equal height that exactly fill the width of the note, with every image shown uncropped at its own width. This is the layout photo apps such as Immich, Google Photos and Flickr use for their timelines.

````markdown
```obs-gallery
sources:
  - type: immich-share
    url: https://immich.example.com/share/your-share-key
view:
  type: justified
```
````

How it lays out images:

- Each row is scaled so its images fill the width exactly, at a height close to the target row height.
- The last row is not stretched. If it is short, its images keep the target height and the row stays left-aligned.
- A panorama too wide for a single row gets a row of its own.
- Captions appear over the bottom of each image when you hover over it or focus it with the keyboard. On touch devices they are always shown. Turn them off with **Settings → Gallery View → Show captions**.

For `immich`, `immich-share` and `nextcloud` sources the plugin fetches thumbnails rather than full-size images. For Immich sources it also knows each image's size before it downloads, so rows don't shift as images load. For other sources, rows below an image may reflow once it loads and its real size is known.

### Pagination

Add `pagination: true` (optionally with `itemsPerPage`) to page through large collections. See the [Masonry view](./masonry.md#pagination) page for the config keys — they work the same way here.

### Customizing with CSS

The target row height and spacing are CSS variables, so a [CSS snippet](https://help.obsidian.md/snippets) can change them:

```css
.gallery-justified-layout {
  --gallery-justified-row-height: 280px; /* target row height (default 220px) */
  --gallery-justified-gap: 2px;          /* space between images (default 4px) */
}
```
