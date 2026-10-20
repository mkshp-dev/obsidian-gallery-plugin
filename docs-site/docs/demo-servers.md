---
sidebar_position: 2.5
---

# Try it with the demo servers

You can try every Immich and Nextcloud source without running your own server. Public demo servers hold a small library of photos, and the examples in these docs and the plugin's showcase notes (**Create showcase notes** command) point at them.

:::info Read-only, for trying the plugin only
The demo servers are read-only: the credentials below can view photos but cannot change anything. They are run by the plugin's author, so your requests (and your IP address) reach that server. Don't rely on them for anything beyond trying the plugin; they may change or go away.
:::

## Share links (no setup)

Share links need no connection. Paste any of these into a gallery block:

| Source | URL | Password |
|---|---|---|
| `immich-share` (Landscapes album) | `https://demo-immich.mkshp.dev/share/7XBAej6IyThZOS7izb78XcEJX7QhYwQBmxtHxaBz7TaaqiP5pxWyZQrN6TIvUGRhI9g` | — |
| `immich-share` (Travel album) | `https://demo-immich.mkshp.dev/share/RAHL6jLQTkqIDaSYjdlHdcbJ4W25u002dyorCdqYVDmoar8xyB7wiE8GARi4QH2eqWw` | `gallery-demo` |
| `nextcloud-share` (folder) | `https://demo-nextcloud.mkshp.dev/s/DAxM47SmHesMTqa` | — |
| `nextcloud-share` (folder) | `https://demo-nextcloud.mkshp.dev/s/ZSBpcMLfaQPCi2Y` | `gallery-demo` |
| `nextcloud-share` (Photos app album) | `https://demo-nextcloud.mkshp.dev/apps/photos/public/wD9fLmI1TP6KEq76Yvs9fZrBdfDu8gfc` | — |

````markdown
```obs-gallery
sources:
  - type: immich-share
    url: https://demo-immich.mkshp.dev/share/7XBAej6IyThZOS7izb78XcEJX7QhYwQBmxtHxaBz7TaaqiP5pxWyZQrN6TIvUGRhI9g
view:
  type: justified
```
````

## Connections (for `immich` and `nextcloud` sources)

The quickest way to get them: run the **Create showcase notes** command and choose **Add connections**. The plugin adds both connections to your settings (it never changes an existing connection with the same key) and writes example notes that use them.

To add them by hand instead, use **Settings → Gallery View → Providers** (see [Settings](./settings.md#providers-tab)). Use exactly these keys, because the docs examples and showcase notes refer to them. Remove the connections there when you are done trying the plugin.

### Immich

| Field | Value |
|---|---|
| Key | `immich-demo` |
| Base URL | `https://demo-immich.mkshp.dev` |
| API key | `Y8jMqmnnv5ME9wJl78U1D4cIgSGcigtMemcgWMxxE` |

What's on the server: 57 assets (55 photos, 2 videos) taken between January 2024 and October 2026, 10 of them favorites.

| Kind | Values |
|---|---|
| Albums | Landscapes `0fe76d50-18b3-4f74-8f7c-3ede043982de` (9) · City `0a33a817-9389-45f5-a99d-6ac12f56dc7f` (6, one video) · Travel `882fef37-436a-49c1-af1a-e444d0216ee0` (7, one video) · People `9a714fd1-36f8-4b3a-ba48-2f3101895dee` (25) |
| Tags | `Photography` (30) · `Nature` (9) · `Architecture` (5) · `Portraits` (25) |
| People | `Alice` · `Bob` · `Carol` · `Dave` (7 photos each) |

### Nextcloud

| Field | Value |
|---|---|
| Key | `nextcloud-demo` |
| Base URL | `https://demo-nextcloud.mkshp.dev` |
| Username | `demo` |
| App password | `psMXy2P4j2YZSjJuALSukdyzkjhIBAAqgUkQVFavPQPyRqkZfrkAXZhIknna8IIpLHsVgr8M` |

What's on the server: 40 images (JPEG, PNG and WebP, 14 KB to 2.5 MB) in `/Gallery-Demo/Landscapes`, `/Gallery-Demo/City` and `/Gallery-Demo/Camera`. `Camera` uses phone-style names (`IMG_2024…`, `IMG_2025…`) for trying `filenameFilter`, and modified dates range from 2024 to 2026 for trying `modifiedAfter` / `modifiedBefore`.

````markdown
```obs-gallery
sources:
  - type: nextcloud
    connection: nextcloud-demo
    path: /Gallery-Demo/Camera
    filenameFilter: "IMG_2024*"
view:
  type: masonry
```
````
