---
sidebar_position: 4
---

# Embed view

A continuous, borderless vertical stack. Images render at their natural size (scaled down only if wider than the note) with no card background, border, or shadow — so the gallery reads as part of the note itself, similar to a native `![[image]]` embed, rather than a distinct widget.

````markdown
```obs-gallery
sources:
  - type: local
    path: Photos/Journal
view:
  type: embed
```
````
