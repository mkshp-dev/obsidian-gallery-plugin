---
sidebar_position: 2.6
---

# Use cases

What people use galleries for, each with the block behind it. Run **Create use-case notes** (or **Create showcase notes**) to get all of them as notes in `GalleryDemo/Use cases/`, with real photos to try them on. The photos are an optional download of about 10 MB; see [Network use](#network-use).

Every local example uses a path relative to the note (`./_photos/…`), so the gallery keeps working when the note and its folder move together.

## Travel journal

<!-- screenshot: A -->

A trip write-up with the photos in tidy rows of equal height, each one uncropped. Captions show on hover, so the rows stay clean.

````markdown
```obs-gallery
sources:
  - type: local
    path: ./_photos/iceland
view:
  type: justified
  rowHeight: 240
  captions: false
```
````

Click a photo to open the full-screen viewer.

<!-- screenshot: C -->

<!-- screenshot: G -->

## One folder, five layouts

<!-- screenshot: B -->

The same folder as `masonry`, `justified`, `thumbnail`, `carousel` (`height: 480`) and `embed` (with `limit: 3` on the source). Only `view: type` changes.

<!-- screenshot: H -->

To switch layouts, change one word:

````markdown
```obs-gallery
sources:
  - type: local
    path: ./_photos/iceland
view:
  type: masonry   # or justified, thumbnail, carousel, embed
```
````

## Mood board

<!-- screenshot: F -->

A borderless masonry board that sits straight in the note.

````markdown
```obs-gallery
sources:
  - type: local
    path: ./_photos/cabin
view:
  type: masonry
  columnWidth: 220
  gap: 8
  frame: false
```
````

## Recipe

Full-width photos under the method, with captions. Sorting by name keeps step photos in order when they are numbered (`1 – …`, `2 – …`).

````markdown
```obs-gallery
sources:
  - type: local
    path: ./_photos/recipe
    sort:
      by: name
      order: asc
view:
  type: embed
  captions: true
```
````

## Reference library

<!-- screenshot: thumbnail recapture -->

A paged grid for a folder that keeps growing. Only the current page loads.

````markdown
```obs-gallery
sources:
  - type: local
    path: ./_photos/design
view:
  type: thumbnail
  pagination: true
  itemsPerPage: 6
```
````

## Highlights carousel

<!-- screenshot: carousel recapture -->

The first eight photos of a folder, one at a time on a fixed-height stage.

````markdown
```obs-gallery
sources:
  - type: local
    path: ./_photos/iceland
    limit: 8
view:
  type: carousel
  height: 520
```
````

## Family album from Immich

<!-- screenshot: E -->

Photos straight from an Immich server, without copying them into the vault: here, the trip's photos picked out by tag and date. This one uses the [demo server](demo-servers.md).

````markdown
```obs-gallery
sources:
  - type: immich
    connection: immich-demo
    filters:
      tags:
        - Iceland
      takenAfter: "2026-08-24"
view:
  type: justified
```
````

## Network use

The use-case notes' photos are downloaded from `docs.mkshp.dev`, the host of these docs, only if you leave **Download sample photos** on in the dialog that **Create showcase notes** and **Create use-case notes** show first. They are saved in `GalleryDemo/Use cases/_photos/` and load from your vault after that. If the download fails, the notes are still created, and **Start here** explains how to try again.

## Photo credits

All 39 sample photos are from [Unsplash](https://unsplash.com), free to use under the [Unsplash License](https://unsplash.com/license). Thanks to the photographers below. The same list is in [CREDITS.md](pathname:///demo-photos/use-cases/CREDITS.md) next to the photos.

<details>
<summary>Iceland (20)</summary>

| Photo | Photographer | Source | License |
|---|---|---|---|
| Aurora over Kirkjufell.jpg | Landon Arnold | [Unsplash](https://unsplash.com/photos/snow-capped-mountain-under-aurora-PMdiRXbAbhY) | [Unsplash License](https://unsplash.com/license) |
| Behind Seljalandsfoss.jpg | jossemio | [Unsplash](https://unsplash.com/photos/brown-rock-formation-under-white-clouds-during-daytime-9gbMS5A_oKY) | [Unsplash License](https://unsplash.com/license) |
| Black sand at Reynisfjara.jpg | With Paul | [Unsplash](https://unsplash.com/photos/a-large-rock-formation-on-a-beach-next-to-the-ocean-IT6MIkeDr3o) | [Unsplash License](https://unsplash.com/license) |
| Canyon of Fjaðrárgljúfur.jpg | Thomas Fatin | [Unsplash](https://unsplash.com/photos/person-in-blue-jacket-and-blue-denim-jeans-walking-on-green-grass-covered-hill-during-daytime-FHpP-fCpIoo) | [Unsplash License](https://unsplash.com/license) |
| Church above Vík.jpg | Jon Flobrant | [Unsplash](https://unsplash.com/photos/aerial-view-photography-of-white-and-red-concrete-house-near-village-ljKaPW3hFZA) | [Unsplash License](https://unsplash.com/license) |
| Diamond Beach ice.jpg | Andy Mai | [Unsplash](https://unsplash.com/photos/ice-blocks-on-black-stone-fragment-4knR_YzeUVc) | [Unsplash License](https://unsplash.com/license) |
| Drifting icebergs at Jökulsárlón.jpg | Jeremy Bishop | [Unsplash](https://unsplash.com/photos/ice-bergs-and-alp-mountains-facing-calm-body-of-water-h7bQ8VEZtws) | [Unsplash License](https://unsplash.com/license) |
| Face to face with an Icelandic horse.jpg | kyler trautner | [Unsplash](https://unsplash.com/photos/macro-photography-of-brown-horse-uvz0Z9bXGhg) | [Unsplash License](https://unsplash.com/license) |
| Glacier view at Jökulsárlón.jpg | Denys Nevozhai | [Unsplash](https://unsplash.com/photos/brown-soil-and-glacier-mountain-4EV9u4Ru8EQ) | [Unsplash License](https://unsplash.com/license) |
| Hallgrímskirkja against a blue sky.jpg | Toby Elliott | [Unsplash](https://unsplash.com/photos/gray-concrete-pyramid-building-under-blue-sky-12k5U6k2mrQ) | [Unsplash License](https://unsplash.com/license) |
| Icebergs in a glacier lagoon.jpg | Gian-Reto Tarnutzer | [Unsplash](https://unsplash.com/photos/iceberg-on-body-of-water-d8ddeWAc4z4) | [Unsplash License](https://unsplash.com/license) |
| Northern lights at Kirkjufell.jpg | Joshua Earle | [Unsplash](https://unsplash.com/photos/man-standing-beside-the-body-of-water-with-aurora-lights-in-the-sky-Hn8N4I4eHA0) | [Unsplash License](https://unsplash.com/license) |
| Puffin on a rock.jpg | Ray Hennessy | [Unsplash](https://unsplash.com/photos/selective-focus-photography-of-black-and-white-puffin-bird-mpw37yXc_WQ) | [Unsplash License](https://unsplash.com/license) |
| Road through the lava fields.jpg | Tom Podmore | [Unsplash](https://unsplash.com/photos/gray-concrete-road-near-mountain-under-white-sky-during-daytime-ZkWsC63ultE) | [Unsplash License](https://unsplash.com/license) |
| Skógafoss from above.jpg | Adrian Fiodor | [Unsplash](https://unsplash.com/photos/aerial-view-of-a-powerful-waterfall-cascading-over-rocks-dEmsn8I3dHw) | [Unsplash License](https://unsplash.com/license) |
| Skógafoss up close.jpg | Karsten Winegeart | [Unsplash](https://unsplash.com/photos/a-person-standing-in-front-of-a-large-waterfall-v0Py1h6M--c) | [Unsplash License](https://unsplash.com/license) |
| Svartifoss and its basalt columns.jpg | Bailey Galindo | [Unsplash](https://unsplash.com/photos/rocky-waterfalls-ctlDIzk3mRU) | [Unsplash License](https://unsplash.com/license) |
| Svínafellsjökull glacier panorama.jpg | Joseph Corl | [Unsplash](https://unsplash.com/photos/majestic-glacier-flowing-down-a-green-mountainous-landscape-RKVw8t0FEUo) | [Unsplash License](https://unsplash.com/license) |
| The Blue Lagoon.jpg | F D | [Unsplash](https://unsplash.com/photos/calm-water-beside-mountain-under-white-clouds-and-blue-sky-vCqclUnCg_8) | [Unsplash License](https://unsplash.com/license) |
| Vestrahorn above the Stokksnes dunes.jpg | Wanderlust in Frame | [Unsplash](https://unsplash.com/photos/brown-grass-field-near-brown-mountain-under-blue-sky-during-daytime-WXlReafPRQQ) | [Unsplash License](https://unsplash.com/license) |

</details>

<details>
<summary>Cabin (10)</summary>

| Photo | Photographer | Source | License |
|---|---|---|---|
| Bedroom window over rolling hills.jpg | Caroline Badran | [Unsplash](https://unsplash.com/photos/cozy-bedroom-with-a-large-window-overlooking-rolling-green-hills-J5U46LqUNlw) | [Unsplash License](https://unsplash.com/license) |
| Cabin kitchen in dark wood.jpg | Hans | [Unsplash](https://unsplash.com/photos/a-kitchen-with-two-stools-next-to-a-counter-xPAoehM2YkU) | [Unsplash License](https://unsplash.com/license) |
| Ceramic lamp with dried branches.jpg | Caroline Badran | [Unsplash](https://unsplash.com/photos/a-lamp-rests-beside-books-and-dried-flowers-l6QhSMrHfSY) | [Unsplash License](https://unsplash.com/license) |
| Hanging fireplace and string lights.jpg | Hans | [Unsplash](https://unsplash.com/photos/a-living-room-with-a-wood-burning-stove-33ML-Z9JsLo) | [Unsplash License](https://unsplash.com/license) |
| Living room facing the green hills.jpg | Caroline Badran | [Unsplash](https://unsplash.com/photos/cozy-living-room-with-view-of-green-landscape-DM6PeV_pyyQ) | [Unsplash License](https://unsplash.com/license) |
| Pendant lamps over the dining nook.jpg | Caroline Badran | [Unsplash](https://unsplash.com/photos/modern-living-space-with-wooden-walls-and-loft-f7TsUnnLGMg) | [Unsplash License](https://unsplash.com/license) |
| Pillows under a slanted window.jpg | Caroline Badran | [Unsplash](https://unsplash.com/photos/view-of-rolling-green-hills-through-a-window-YhYd9HNvNyE) | [Unsplash License](https://unsplash.com/license) |
| Plaid blanket on the cabin bed.jpg | Hans | [Unsplash](https://unsplash.com/photos/a-bed-sitting-in-a-bedroom-next-to-a-wooden-wall-ffGdB-Yfy_4) | [Unsplash License](https://unsplash.com/license) |
| Sofa and knitted throw under a wooden ceiling.jpg | Caroline Badran | [Unsplash](https://unsplash.com/photos/modern-living-room-with-wood-paneling-and-sofa-75b60epaBAs) | [Unsplash License](https://unsplash.com/license) |
| Wooden loft with a trailing plant.jpg | Caroline Badran | [Unsplash](https://unsplash.com/photos/modern-interior-with-wooden-walls-and-a-mezzanine-Ck_ixSEDOaE) | [Unsplash License](https://unsplash.com/license) |

</details>

<details>
<summary>Recipe (1)</summary>

| Photo | Photographer | Source | License |
|---|---|---|---|
| Shakshuka served for brunch.jpg | Sara Dubler | [Unsplash](https://unsplash.com/photos/steam-pasta-beside-tomatoes-and-plate-NjmhU8Om3C4) | [Unsplash License](https://unsplash.com/license) |

</details>

<details>
<summary>Design (8)</summary>

| Photo | Photographer | Source | License |
|---|---|---|---|
| Barbican Estate courtyard.jpg | Daniel Moore | [Unsplash](https://unsplash.com/photos/a-river-running-through-a-city-next-to-tall-buildings-EnEvA02Oz4M) | [Unsplash License](https://unsplash.com/license) |
| Chalkboard quote on a yellow wall.jpg | Far Chinberdiev | [Unsplash](https://unsplash.com/photos/poster-on-yellow-wall-with-text-mgI626ojtK4) | [Unsplash License](https://unsplash.com/license) |
| Corner of Boston City Hall.jpg | Mark McLaughlin | [Unsplash](https://unsplash.com/photos/gray-concrete-building-under-blue-sky-during-daytime-8_UDWAPHISM) | [Unsplash License](https://unsplash.com/license) |
| Curved white walls by a pool.jpg | Leo Manjarrez | [Unsplash](https://unsplash.com/photos/woman-standing-in-front-of-white-building--vygi0Cvz_c) | [Unsplash License](https://unsplash.com/license) |
| National Theatre against a pale sky.jpg | Simone Hutsch | [Unsplash](https://unsplash.com/photos/landscape-photography-of-gray-concrete-building-XK0faa4_mCQ) | [Unsplash License](https://unsplash.com/license) |
| Painted wooden prayer plaque.jpg | CR | [Unsplash](https://unsplash.com/photos/a-picture-of-a-cat-hanging-on-a-wall-2n0MA_bZyUM) | [Unsplash License](https://unsplash.com/license) |
| White stairs in a plaster stairwell.jpg | Alesia Kazantceva | [Unsplash](https://unsplash.com/photos/minimalist-concrete-staircase-with-vase-0B7ijYKaKcE) | [Unsplash License](https://unsplash.com/license) |
| WHO ARE YOU in painted letters.jpg | New York Said | [Unsplash](https://unsplash.com/photos/black-poster-with-white-text-asking-who-are-you-muWdEV7l7R4) | [Unsplash License](https://unsplash.com/license) |

</details>
