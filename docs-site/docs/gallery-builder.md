---
sidebar_position: 4
---

# Gallery Builder

Gallery View includes an interactive **Gallery Builder** modal that lets you compose `obs-gallery` blocks visually — no YAML writing required.

## Opening the Builder

From the Obsidian command palette (**Ctrl+P** / **Cmd+P**), run:

> **Gallery View: Insert gallery**

The builder opens as a modal. When you click **Insert gallery** at the bottom, the generated YAML is inserted at your cursor position in the editor.

---

## Using the Builder

### 1. Choose a View Type

Select the gallery layout from the **View type** dropdown:

| Option | Description |
|--------|-------------|
| **Grid** | Masonry-style layout with variable-height images. |
| **Thumbnail** | Fixed-size thumbnail grid. Clicking an image opens the full-size modal viewer. |
| **Carousel** | Horizontally scrolling view with previous/next navigation. |

### 2. Add Sources

Click the **Add source** dropdown and select a source type. You can add as many sources as you need — the gallery will load images from all of them:

| Source Type | Description |
|-------------|-------------|
| **Local Vault** | Images from a folder or file in your vault. |
| **External URLs** | Remotely hosted images (requires **Allow remote images** to be enabled in Settings). |
| **Immich Share Link** | Images from a public Immich share URL. |
| **Immich Authenticated** | Albums, favorites, or filtered assets from your personal Immich library. |

Each source type shows its own configuration fields after being added.

#### Local Vault source options

| Field | Description |
|-------|-------------|
| **Path** | Vault-relative folder or file path, e.g. `Photos/Vacation`. |
| **Recursive** | Toggle to include images in subfolders (default: on). |

#### External URLs source options

Enter one or more remote image URLs. Use **Add URL** to add additional entries and **Remove** to delete them.

#### Immich Share Link source options

| Field | Description |
|-------|-------------|
| **Share URL** | The public Immich share link. |
| **Password** | (Optional) password if the share is protected. |

#### Immich Authenticated source options

> [!NOTE]
> You must have at least one Immich connection configured in **Settings → Gallery View → Providers** before this source type becomes available. If no connections are configured, the builder will prompt you to add one first.

| Section | Description |
|---------|-------------|
| **Connection** | Dropdown of your configured Immich connections. Changing the connection refreshes the Albums, Tags, and People lists. |
| **Favorites only** | Toggle to filter to only favorited assets. |
| **Asset type** | Choose `All`, `Image`, or `Video`. |
| **Created after / before** | Date range filters in `YYYY-MM-DD` format. |
| **Albums** | Searchable, multi-select list of your Immich albums. |
| **Tags** | Searchable, multi-select list of your Immich tags (human-readable names). |
| **People** | Searchable, multi-select list of recognized people in your Immich library. |
| **Limit** | Maximum number of assets to fetch. |
| **Sort order** | `Oldest first` (asc), `Newest first` (desc), or default. |

Use the **Refresh metadata** button to clear the builder's cache and re-fetch albums, tags, and people from Immich (useful if you have recently added new content).

### 3. Preview and Insert

The **Live preview** panel at the bottom of the modal shows the YAML that will be inserted. It updates in real time as you change settings.

Once you're happy with the configuration, click **Insert gallery**. The block is inserted at your cursor and the modal closes.

---

## YAML Autocomplete

In addition to the builder modal, Gallery View provides **IntelliSense-style completions** directly inside `obs-gallery` code blocks while you type.

Completions are triggered automatically when your cursor is inside an `obs-gallery` block. The following fields have autocomplete support:

| Field | Suggestions |
|-------|-------------|
| `type:` | `local`, `immich`, `immich-share` |
| `connection:` | Your configured Immich connection keys (with their base URLs shown as descriptions) |
| `view:` | `grid`, `carousel`, `thumbnail` |
| `assetType:` | `IMAGE`, `VIDEO` |
| `sort.order:` | `asc`, `desc` |
| Items in `albumIds:` list | Album names fetched live from Immich (inserts the UUID) |
| Items in `tags:` list | Tag names fetched live from Immich |
| Items in `people:` list | Person names fetched live from Immich |

> [!TIP]
> For `albumIds`, autocomplete shows human-readable album names but inserts the UUID. This makes it easy to find the right album without needing to copy IDs from the Immich web interface.
