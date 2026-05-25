---
sidebar_position: 4
---

# Usage

## Folder gallery

Display all images in a folder:

````markdown
```obs-gallery
path: Photos/Vacation2024
view: thumbnail
```
````

## Recursive scan

Include images from all subfolders:

````markdown
```obs-gallery
path: Projects
view: grid
recursive: true
```
````

## Carousel

Horizontal scrolling view with prev/next controls:

````markdown
```obs-gallery
path: Images/Screenshots
view: carousel
```
````

## External URLs

Mix local and remote images (requires **Allow remote images** in settings):

````markdown
```obs-gallery
path: Photos/Local
urls:
  - https://example.com/image1.jpg
  - https://cdn.example.org/photo.webp
view: grid
```
````

## Single file

Point directly at one image file:

````markdown
```obs-gallery
path: Assets/cover.png
view: thumbnail
```
````
