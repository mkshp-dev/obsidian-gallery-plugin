---
sidebar_position: 6
---

# Troubleshooting

## Gallery not appearing

- Verify the `path` exists in your vault and that the spelling and casing match exactly.
- Confirm images are in a supported format: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`.
- Try switching between reading and editing mode to trigger a re-render.

## Modal not opening

- Confirm `styles.css` is present in the plugin folder.
- Open the developer console (**Ctrl+Shift+I** / **Cmd+Option+I**) and check for errors.

## Path issues

- Use paths relative to the vault root, e.g. `Images/Photos`.
- Do not include a leading or trailing slash.

## Remote images not loading

- Ensure **Allow remote images** is enabled in Settings → Image Gallery.
- Check that the URL is publicly accessible and returns an image content type.
- Try enabling **Validate remote content type** to get early feedback on bad URLs.
- Increase the **Remote load timeout** if images are loading slowly.

## Performance with many images

- The plugin uses lazy loading automatically.
- Consider organizing large collections into subfolders and using `recursive: true` only when needed.
