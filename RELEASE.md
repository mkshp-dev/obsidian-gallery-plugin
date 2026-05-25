# Release guide

Releases are automated via GitHub Actions. Pushing a version tag to `main` triggers a build and creates a draft GitHub release with the compiled plugin assets attached.

The `npm version` command handles version bumping — it updates `package.json`, automatically syncs `manifest.json` via the `version` lifecycle script, commits both files, and creates a local git tag in one step.

---

## One-time setup

These steps only need to be done once before the first release.

### 1. Enable workflow write permissions

1. Go to your repository on GitHub.
2. Open **Settings → Actions → General**.
3. Scroll to **Workflow permissions**.
4. Select **Read and write permissions** and save.

### 2. Enable GitHub Pages (for documentation)

1. Go to **Settings → Pages**.
2. Under **Source**, select **GitHub Actions**.
3. Save. The docs site will be published automatically on the next push to `Dev`.

### 3. Submit to the community store (first release only)

Before submitting, make sure `main` has the final `manifest.json` committed with:
- `id`: `image-gallery`
- `version`: your release version (e.g. `1.0.0`)

Then:
1. Go to [community.obsidian.md](https://community.obsidian.md), sign in, and link your GitHub account.
2. Go to **Plugins → New plugin**.
3. Enter `https://github.com/mkshp-dev/obsidian-gallery-plugin`.
4. Agree to the developer policies and submit.

The automated review runs against the `main` branch. Once it passes, your plugin is listed and users can install it from within Obsidian.

---

## Making a release

### Step 1 — Work on Dev, then merge to main

```bash
git checkout main
git merge Dev
git push origin main
```

### Step 2 — Bump the version

Choose the bump type based on what changed:

| Command | When to use | Example |
|---------|-------------|---------|
| `npm version patch` | Bug fixes only | `1.0.0` → `1.0.1` |
| `npm version minor` | New features, backwards-compatible | `1.0.1` → `1.1.0` |
| `npm version major` | Breaking changes | `1.1.0` → `2.0.0` |

```bash
npm version patch   # or minor / major
```

This single command:
- Bumps the version in `package.json`
- Syncs the same version into `manifest.json` (via the `version` npm lifecycle script)
- Creates a git commit with both files staged
- Creates a local annotated tag matching the version

### Step 3 — Push the commit and tag

```bash
git push origin main --follow-tags
```

`--follow-tags` pushes both the version commit and the tag in one go. The tag triggers the GitHub Actions release workflow.

### Step 4 — Publish the draft release

1. Go to your repository on GitHub and open the **Releases** tab.
2. You will see a **draft release** created by the workflow with `main.js`, `manifest.json`, and `styles.css` attached.
3. Click the pencil icon to edit it.
4. Write release notes describing what changed.
5. Click **Publish release**.

Obsidian picks up the new version automatically — users who have the plugin installed will be notified of the update.

---

## Quick reference

```bash
# Full release flow
git checkout main
git merge Dev
git push origin main
npm version patch          # or minor / major
git push origin main --follow-tags
# Then publish the draft on GitHub → Releases
```
