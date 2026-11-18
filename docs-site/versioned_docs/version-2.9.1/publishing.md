---
sidebar_position: 4.5
---

# Publishing galleries

> [!NOTE]
> This feature is **experimental**. Try it on a copy of a note first.

Obsidian Publish, and other places that show your notes without running plugins, can't draw a gallery: they show its `obs-gallery` code block instead of the photos. **Burning** a note's galleries replaces each one with a picture of how it looks, so the page can be published with its galleries.

## Burn a note's galleries

1. Open the note.
2. Run **Burn galleries in this note (experimental)** from the command palette.
3. Read the dialog: it says how many galleries the note has and where the images will be saved. Click **Burn gallery** (or **Burn N galleries**).

For each gallery in the note, the plugin:

1. Draws it as a WebP image: its frame, rounded corners, how each photo is cropped, captions and the play badge on videos, at twice the size it has on screen so it stays sharp.
2. Saves the image in the folder set under **Settings → Gallery View → General → Burned galleries** (the vault root by default).
3. Replaces the gallery's code block in the note with an embed of the image, written the way your vault writes links (a `[[wikilink]]` or a Markdown link).

A notice counts the galleries as they're drawn and says where the images went.

````markdown
Before:

```obs-gallery
sources:
  - type: local
    path: Photos/Iceland
view: justified
```

After:

![[Gallery View - Iceland trip - 2026-11-11 143005.webp]]
````

Images are named after the plugin, the note and the date and time of the burn. When a note has more than one gallery, each name ends with the gallery's position in the note (` - 1`, ` - 2`, ...).

Every source works: vault folders, external URLs, Immich and Nextcloud (including share links). Photos are read from where the gallery got them, so a photo the gallery can show can be burned.

## What a burned gallery keeps

- **Everything in the note is burned in one run**, including galleries you haven't scrolled to: those are drawn off-screen at the width the note's galleries have.
- **A gallery you're looking at is burned as it is**: a carousel keeps the slide that is showing and a paged gallery keeps the current page. Galleries further down start from their first slide or page.
- **Captions under images are kept.** Captions that only appear when you hover over a photo are left out.
- **Pagination bars, carousel arrows and dots are left out**, since a picture can't be clicked.

## It's a one-way step

The code block is removed from the note, so:

- The image won't change when photos are added to or removed from the source.
- There's no image viewer, slideshow or pages.

If you'd like to keep the live gallery as well, copy its code block somewhere first (another note, or a copy of the note you burn). Obsidian's **File recovery** core plugin also keeps earlier versions of notes for a while.

If a gallery can't be drawn, its code block is left in the note and a notice says why.

## Publishing the note

Burned notes are ordinary notes with image embeds, which Obsidian Publish supports:

- Publish recommends `.webp` (with `.svg` and `.png`) for images.
- When you select the note in the **Publish changes** dialog, Publish also selects the images it embeds. Check they're ticked the first time.
- Publish accepts files up to 50 MB. A burned gallery is usually a few MB.

See Obsidian's help on [Publish media files](https://obsidian.md/help/publish/media) and [publishing your content](https://obsidian.md/help/publish/publish).
