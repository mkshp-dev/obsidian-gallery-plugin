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

## Photo credits

Every photo and video on the demo servers is free to use. Thanks to the photographers below.

- **CC0 1.0** ([deed](https://creativecommons.org/publicdomain/zero/1.0/)): 51 photos from [StockSnap](https://stocksnap.io) and 2 videos from [Wikimedia Commons](https://commons.wikimedia.org). The videos were converted to MP4 without audio, and some Nextcloud copies were resized or converted to PNG/WebP.
- **[Unsplash License](https://unsplash.com/license)**: 44 photos from [Unsplash](https://unsplash.com), served by [Lorem Picsum](https://picsum.photos). The `IMG_…` names in the Nextcloud `Camera` folder are made up for the `filenameFilter` examples; the dates in them are not when the photos were taken.

The names `Alice`, `Bob`, `Carol` and `Dave` in the Immich demo are invented labels for the face-recognition examples, not the names of the people photographed.

<details>
<summary>Immich demo (57 assets)</summary>

| File | Author | Source | Licence |
|---|---|---|---|
| `picsum-30.jpg` | Shyamanta Baruah | [Unsplash](https://unsplash.com/photos/aeVA-j1y2BY) | [Unsplash License](https://unsplash.com/license) |
| `picsum-31.jpg` | How-Soon Ngu | [Unsplash](https://unsplash.com/photos/7Vz3DtQDT3Q) | [Unsplash License](https://unsplash.com/license) |
| `picsum-32.jpg` | Rodrigo Melo | [Unsplash](https://unsplash.com/photos/eG3k60PrTGY) | [Unsplash License](https://unsplash.com/license) |
| `picsum-33.jpg` | Alejandro Escamilla | [Unsplash](https://unsplash.com/photos/LBI7cgq3pbM) | [Unsplash License](https://unsplash.com/license) |
| `picsum-34.jpg` | Aleks Dorohovich | [Unsplash](https://unsplash.com/photos/zZvsEMPxjIA) | [Unsplash License](https://unsplash.com/license) |
| `picsum-35.jpg` | Shane Colella | [Unsplash](https://unsplash.com/photos/znM0ujn2RUA) | [Unsplash License](https://unsplash.com/license) |
| `picsum-36.jpg` | Vadim Sherbakov | [Unsplash](https://unsplash.com/photos/osSryggkso4) | [Unsplash License](https://unsplash.com/license) |
| `picsum-37.jpg` | Austin Neill | [Unsplash](https://unsplash.com/photos/erTjj730fMk) | [Unsplash License](https://unsplash.com/license) |
| `picsum-38.jpg` | Allyson Souza | [Unsplash](https://unsplash.com/photos/JabLtzJl8bc) | [Unsplash License](https://unsplash.com/license) |
| `picsum-39.jpg` | Luke Chesser | [Unsplash](https://unsplash.com/photos/pFqrYbhIAXs) | [Unsplash License](https://unsplash.com/license) |
| `picsum-40.jpg` | Ryan Mcguire | [Unsplash](https://unsplash.com/photos/N-1XGL54pQg) | [Unsplash License](https://unsplash.com/license) |
| `picsum-41.jpg` | Nithya Ramanujam | [Unsplash](https://unsplash.com/photos/fTKetYpEKNQ) | [Unsplash License](https://unsplash.com/license) |
| `picsum-42.jpg` | Luke Chesser | [Unsplash](https://unsplash.com/photos/KR2mdHJ5qMg) | [Unsplash License](https://unsplash.com/license) |
| `picsum-43.jpg` | Oleg Chursin | [Unsplash](https://unsplash.com/photos/IoCWq07GaG4) | [Unsplash License](https://unsplash.com/license) |
| `picsum-44.jpg` | Christopher Sardegna | [Unsplash](https://unsplash.com/photos/R1E6x8U83Ho) | [Unsplash License](https://unsplash.com/license) |
| `picsum-45.jpg` | Alan Haverty | [Unsplash](https://unsplash.com/photos/-XA-fTYYfV0) | [Unsplash License](https://unsplash.com/license) |
| `picsum-46.jpg` | Jeffrey Kam | [Unsplash](https://unsplash.com/photos/Nzw3HHsNHYU) | [Unsplash License](https://unsplash.com/license) |
| `picsum-47.jpg` | Christopher Sardegna | [Unsplash](https://unsplash.com/photos/uDUiRS8YroY) | [Unsplash License](https://unsplash.com/license) |
| `picsum-48.jpg` | Luke Chesser | [Unsplash](https://unsplash.com/photos/1uxV8fAfhVM) | [Unsplash License](https://unsplash.com/license) |
| `picsum-49.jpg` | Margaret Barley | [Unsplash](https://unsplash.com/photos/Qo51KwK1dKg) | [Unsplash License](https://unsplash.com/license) |
| `picsum-50.jpg` | Tyler Wanlass | [Unsplash](https://unsplash.com/photos/L7MpmBGpM94) | [Unsplash License](https://unsplash.com/license) |
| `picsum-51.jpg` | Ireneuilia | [Unsplash](https://unsplash.com/photos/knYQ6arClBE) | [Unsplash License](https://unsplash.com/license) |
| `picsum-52.jpg` | Cierra | [Unsplash](https://unsplash.com/photos/57vHdjeZ0yg) | [Unsplash License](https://unsplash.com/license) |
| `picsum-53.jpg` | J Duclos | [Unsplash](https://unsplash.com/photos/6qORI5j_6n8) | [Unsplash License](https://unsplash.com/license) |
| `picsum-54.jpg` | Nicholas Swanson | [Unsplash](https://unsplash.com/photos/d19by2PLaPc) | [Unsplash License](https://unsplash.com/license) |
| `picsum-55.jpg` | Tyler Wanlass | [Unsplash](https://unsplash.com/photos/akbHiqZy4Pg) | [Unsplash License](https://unsplash.com/license) |
| `picsum-56.jpg` | Sebastian Muller | [Unsplash](https://unsplash.com/photos/VLdaxYyXJvw) | [Unsplash License](https://unsplash.com/license) |
| `picsum-57.jpg` | Nicholas Swanson | [Unsplash](https://unsplash.com/photos/SyBYM8R6VU4) | [Unsplash License](https://unsplash.com/license) |
| `picsum-58.jpg` | Tony Naccarato | [Unsplash](https://unsplash.com/photos/-kEr-QltARg) | [Unsplash License](https://unsplash.com/license) |
| `picsum-59.jpg` | Art Wave | [Unsplash](https://unsplash.com/photos/algEQavPY4M) | [Unsplash License](https://unsplash.com/license) |
| `stocksnap-01.jpg` | Direct Media | [StockSnap](https://stocksnap.io/photo/business-working-URDSGNSKMP) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-02.jpg` | Direct Media | [StockSnap](https://stocksnap.io/photo/business-people-JQCQP5J6LP) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-03.jpg` | Direct Media | [StockSnap](https://stocksnap.io/photo/business-woman-FPQIEQBMPA) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-04.jpg` | Direct Media | [StockSnap](https://stocksnap.io/photo/business-people-HXDODYZKFS) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-05.jpg` | Direct Media | [StockSnap](https://stocksnap.io/photo/business-people-VVHC8FPSU8) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-06.jpg` | Direct Media | [StockSnap](https://stocksnap.io/photo/business-women-BOWOZQBREK) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-07.jpg` | Direct Media | [StockSnap](https://stocksnap.io/photo/business-people-DUXISHKTT3) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-08.jpg` | Mike Moloney | [StockSnap](https://stocksnap.io/photo/man-smartphone-QDJDQOP3R0) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-09.jpg` | Matt Moloney | [StockSnap](https://stocksnap.io/photo/man-portrait-ZTNVVRFBWS) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-10.jpg` | Matt Moloney | [StockSnap](https://stocksnap.io/photo/man-thinking-IA9FDDNLU5) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-11.jpg` | Matt Moloney | [StockSnap](https://stocksnap.io/photo/confident-business-TMACJ6VLZH) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-12.jpg` | Matt Moloney | [StockSnap](https://stocksnap.io/photo/male-portrait-LHZMZE0JL0) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-13.jpg` | Matt Moloney | [StockSnap](https://stocksnap.io/photo/smiling-man-3LMPSCJQGQ) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-14.jpg` | Matt Moloney | [StockSnap](https://stocksnap.io/photo/confident-business-4Q1S53WMQ6) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-15.jpg` | Kristin Hardwick | [StockSnap](https://stocksnap.io/photo/girl-portrait-LMKLOZE1TO) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-16.jpg` | Kristin Hardwick | [StockSnap](https://stocksnap.io/photo/girl-portrait-NXIPZ4C0UB) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-17.jpg` | Kristin Hardwick | [StockSnap](https://stocksnap.io/photo/girl-portrait-ERRML58VJY) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-18.jpg` | Kristin Hardwick | [StockSnap](https://stocksnap.io/photo/girl-portrait-N9QDZ5ZOUV) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-19.jpg` | Kristin Hardwick | [StockSnap](https://stocksnap.io/photo/girl-portrait-NKVGZGFOJW) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-20.jpg` | Kristin Hardwick | [StockSnap](https://stocksnap.io/photo/girl-portrait-J5WDVQRQ6Y) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-21.jpg` | Kristin Hardwick | [StockSnap](https://stocksnap.io/photo/girl-portrait-GA46UB3Q4F) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-22.jpg` | Direct Media | [StockSnap](https://stocksnap.io/photo/business-man-YA8MFMHUYG) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-23.jpg` | Direct Media | [StockSnap](https://stocksnap.io/photo/business-team-W6PNBNYHM6) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-24.jpg` | Direct Media | [StockSnap](https://stocksnap.io/photo/business-man-NHW7CBJDFM) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stocksnap-25.jpg` | Direct Media | [StockSnap](https://stocksnap.io/photo/business-man-DAAZROYMQN) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `ocean-sommaroy.mp4` | Netha Hussain | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Ocean_in_Sommaroy.webm) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `city-timelapse-albury.mp4` | Thennicke | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Wodonga_Place_timelapse_Albury_NSW.webm) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

</details>

<details>
<summary>Nextcloud demo, <code>/Gallery-Demo</code> (40 files)</summary>

| File | Author | Source | Licence |
|---|---|---|---|
| `Landscapes/mountain-mountains-landscape-1.jpg` | Matt Flores | [StockSnap](https://stocksnap.io/photo/mountains-landscape-52TDQG1GNL) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `Landscapes/mountain-mountain-landscape-2.webp` | Kristoffer Fredriksson | [StockSnap](https://stocksnap.io/photo/mountain-landscape-S2JLQ3IWFS) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `Landscapes/mountain-mountain-landscape-3.jpg` | Robert Lukeman | [StockSnap](https://stocksnap.io/photo/mountain-landscape-978C9IB8S8) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `Landscapes/mountain-mountain-landscape-4.png` | Johannes Plenio | [StockSnap](https://stocksnap.io/photo/mountain-landscape-9EMKZ5SQ2K) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `Landscapes/lake-lake-landscape-1.jpg` | Tricia Gray | [StockSnap](https://stocksnap.io/photo/lake-landscape-XDKGOZGXVY) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `Landscapes/lake-lake-landscape-2.webp` | Sergei Gussev | [StockSnap](https://stocksnap.io/photo/lake-landscape-ZSXZEB0SWX) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `Landscapes/lake-lake-landscape-3.jpg` | Joe deSousa | [StockSnap](https://stocksnap.io/photo/lake-landscape-CBH3T3LNP0) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `Landscapes/lake-lake-landscape-4.png` | Tricia Gray | [StockSnap](https://stocksnap.io/photo/lake-landscape-NU9SHNC6XM) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `Landscapes/forest-enchanting-forest-1.jpg` | Johannes Plenio | [StockSnap](https://stocksnap.io/photo/enchanting-forest-1CFKSWRR5X) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `Landscapes/forest-dock-lake-2.webp` | Tj Holowaychuk | [StockSnap](https://stocksnap.io/photo/dock-lake-BB5OTE559V) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `Landscapes/forest-girl-woman-3.jpg` | Caleb Frith | [StockSnap](https://stocksnap.io/photo/girl-woman-LP6E5BCIJP) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `Landscapes/beach-beach-sunset-1.jpg` | Ken Cooper | [StockSnap](https://stocksnap.io/photo/beach-sunset-AMXMQQWNQJ) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `Landscapes/beach-beach-sunset-2.webp` | Fré Sonneveld | [StockSnap](https://stocksnap.io/photo/beach-sunset-Y98XKZNQ63) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `Landscapes/beach-beach-sunset-3.jpg` | Kristin Hardwick | [StockSnap](https://stocksnap.io/photo/beach-sunset-E51N1IF81B) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `City/skyline-city-skyline-1.jpg` | Joe deSousa | [StockSnap](https://stocksnap.io/photo/city-skyline-KFA0ZJHD66) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `City/skyline-city-skyline-2.webp` | Matt Bango | [StockSnap](https://stocksnap.io/photo/city-skyline-YZPGLUEBRO) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `City/skyline-city-skyline-3.jpg` | Matt Bango | [StockSnap](https://stocksnap.io/photo/city-skyline-HVKT6YLKOJ) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `City/skyline-city-skyline-4.png` | Matt Bango | [StockSnap](https://stocksnap.io/photo/city-skyline-VXO9P3MDVP) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `City/skyline-city-skyline-5.jpg` | Burst | [StockSnap](https://stocksnap.io/photo/city-skyline-BYWZW9SCNZ) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `City/skyline-city-skyline-6.jpg` | Mike Moloney | [StockSnap](https://stocksnap.io/photo/city-skyline-CE6KCWDZJV) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `City/street-city-street-1.jpg` | Zachary Staines | [StockSnap](https://stocksnap.io/photo/city-street-YHT5EIS8XR) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `City/street-city-streets-2.webp` | Jeffrey Betts | [StockSnap](https://stocksnap.io/photo/city-streets-MSVLDUQDB6) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `City/street-city-streets-3.jpg` | Jeffrey Betts | [StockSnap](https://stocksnap.io/photo/city-streets-UJ82B81FZA) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `City/street-city-street-4.png` | Lerone Pieters | [StockSnap](https://stocksnap.io/photo/city-street-LAVXQK6AUP) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `City/street-city-streets-5.jpg` | Kevin Lee | [StockSnap](https://stocksnap.io/photo/city-streets-IYMT7L9XSG) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `City/street-city-streets-6.jpg` | Markus Spiske | [StockSnap](https://stocksnap.io/photo/city-streets-BM105L55C6) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `Camera/IMG_20240103_222.jpg` | Arvee Marie | [Unsplash](https://unsplash.com/photos/YnfGtpt2gf4) | [Unsplash License](https://unsplash.com/license) |
| `Camera/IMG_20240306_037.jpg` | Tina Rataj | [Unsplash](https://unsplash.com/photos/pwaaqfoMibI) | [Unsplash License](https://unsplash.com/license) |
| `Camera/IMG_20240308_259.jpg` | Lukas Schweizer | [Unsplash](https://unsplash.com/photos/9VWOr22LhVI) | [Unsplash License](https://unsplash.com/license) |
| `Camera/IMG_20240511_074.jpg` | Christian Bardenhorst | [Unsplash](https://unsplash.com/photos/8lMhzUjD1Wk) | [Unsplash License](https://unsplash.com/license) |
| `Camera/IMG_20240716_111.jpg` | Ben Moore | [Unsplash](https://unsplash.com/photos/pJILiyPdrXI) | [Unsplash License](https://unsplash.com/license) |
| `Camera/IMG_20240921_148.png` | Ilham Rahmansyah | [Unsplash](https://unsplash.com/photos/DwTZwZYi9Ww) | [Unsplash License](https://unsplash.com/license) |
| `Camera/IMG_20241126_185.jpg` | Dyaa Eldin | [Unsplash](https://unsplash.com/photos/2fl-ocJ5MOA) | [Unsplash License](https://unsplash.com/license) |
| `Camera/IMG_20250105_444.png` | Zugr | [Unsplash](https://unsplash.com/photos/kmF_Aq8gkp0) | [Unsplash License](https://unsplash.com/license) |
| `Camera/IMG_20250310_481.jpg` | Zugr | [Unsplash](https://unsplash.com/photos/yZf1quatKCA) | [Unsplash License](https://unsplash.com/license) |
| `Camera/IMG_20250513_296.png` | Florian Klauer | [Unsplash](https://unsplash.com/photos/t1mqA3V3-7g) | [Unsplash License](https://unsplash.com/license) |
| `Camera/IMG_20250515_518.jpg` | Brian Gonzalez | [Unsplash](https://unsplash.com/photos/llYg8Ni43fc) | [Unsplash License](https://unsplash.com/license) |
| `Camera/IMG_20250718_333.jpg` | Zwaddi | [Unsplash](https://unsplash.com/photos/YvYBOSiBJE8) | [Unsplash License](https://unsplash.com/license) |
| `Camera/IMG_20250923_370.jpg` | Kenneth Thewissen | [Unsplash](https://unsplash.com/photos/D76DklsG-5U) | [Unsplash License](https://unsplash.com/license) |
| `Camera/IMG_20251128_407.jpg` | Gabe Rodriguez | [Unsplash](https://unsplash.com/photos/eLUegVAjN7s) | [Unsplash License](https://unsplash.com/license) |

</details>
