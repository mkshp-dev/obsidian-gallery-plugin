---
sidebar_position: 4
---

# Usage

The plugin uses `obs-gallery` fenced code blocks with the v2 configuration schema. Legacy syntax is still supported for backward compatibility, but the v2 structure is preferred.

## Folder gallery

Display all images in a folder:

````markdown
```obs-gallery
sources:
  - type: local
    path: Photos/Vacation2024
view:
  type: thumbnail
```
````

## Recursive scan

Include images from all subfolders by setting `recursive: true` on your local source configuration:

````markdown
```obs-gallery
sources:
  - type: local
    path: Projects
    recursive: true
view:
  type: grid
```
````

## Carousel

Horizontal scrolling view with prev/next controls:

````markdown
```obs-gallery
sources:
  - type: local
    path: Images/Screenshots
view:
  type: carousel
```
````

## External URLs

Mix local folders and remote image lists together (requires enabling remote images in settings):

````markdown
```obs-gallery
sources:
  - type: local
    path: Photos/Local
  - type: external
    urls:
      - https://example.com/image1.jpg
      - https://cdn.example.org/photo.webp
view:
  type: grid
```
````

## Single file

Point directly at one image file path:

````markdown
```obs-gallery
sources:
  - type: local
    path: Assets/cover.png
view:
  type: thumbnail
```
````
