# Release guide

All releases go through `main`. The `main` branch is protected — no direct pushes. All changes, including version bumps, must come in via a pull request from `Dev`.

Pushing a version tag to `main` triggers the GitHub Actions release workflow, which builds the plugin and creates a draft GitHub release.

---

## One-time setup

These steps only need to be done once.

### 1. Enable workflow write permissions

1. Go to your repository on GitHub.
2. Open **Settings → Actions → General**.
3. Scroll to **Workflow permissions**.
4. Select **Read and write permissions** and save.

### 2. Enable GitHub Pages (for documentation)

1. Go to **Settings → Pages**.
2. Under **Source**, select **GitHub Actions**.
3. Save. The docs deploy automatically on every push to `Dev`.

### 3. Add the CI status check to branch protection (after the first PR)

The CI workflow (`Build` job) must run at least once before GitHub recognises it as a required status check.

1. Open a PR from `Dev` → `main` (even a trivial one) to trigger CI.
2. After CI runs, go to **Settings → Branches → main → Edit**.
3. Under **Require status checks to pass**, search for and add **Build**.
4. Save.

From that point on, PRs that fail the build or tests cannot be merged.

### 4. Submit to the community store (first release only)

Before submitting, make sure `main` has `manifest.json` committed with:
- `id`: `image-gallery`
- `version`: your release version (e.g. `1.0.0`)

Then:
1. Go to [community.obsidian.md](https://community.obsidian.md), sign in, and link your GitHub account.
2. Go to **Plugins → New plugin**.
3. Enter `https://github.com/mkshp-dev/obsidian-gallery-plugin`.
4. Agree to the developer policies and submit.

---

## Making a release

### Step 1 — Bump the version on Dev

On the `Dev` branch, run one of the following depending on what changed:

| Command | When to use | Example |
|---------|-------------|---------|
| `npm version patch --no-git-tag-version` | Bug fixes only | `1.0.0` → `1.0.1` |
| `npm version minor --no-git-tag-version` | New features, backwards-compatible | `1.0.1` → `1.1.0` |
| `npm version major --no-git-tag-version` | Breaking changes | `1.1.0` → `2.0.0` |

The `--no-git-tag-version` flag bumps `package.json`, syncs `manifest.json`, and stages both files — without creating a commit or tag yet (those happen after the PR is merged to `main`).

```bash
npm version patch --no-git-tag-version
git commit -m "chore: release x.y.z"
git push origin Dev
```

### Step 2 — Open a pull request

Open a PR from `Dev` → `main` on GitHub. CI will run automatically. Once it passes, merge the PR.

### Step 3 — Tag the release from main

After the PR is merged, pull `main` locally and push the version tag:

```bash
git checkout main
git pull origin main
git tag -a x.y.z -m "x.y.z"
git push origin x.y.z
```

Pushing the tag triggers the release workflow, which builds the plugin and creates a draft release with `main.js`, `manifest.json`, and `styles.css` attached.

### Step 4 — Publish the draft release

1. Go to your repository on GitHub and open the **Releases** tab.
2. Click the pencil icon on the draft release.
3. Write release notes describing what changed.
4. Click **Publish release**.

Obsidian notifies users of the update automatically.

---

## Quick reference

```bash
# 1. Bump version on Dev
git checkout Dev
npm version patch --no-git-tag-version
git commit -m "chore: release x.y.z"
git push origin Dev

# 2. Open PR on GitHub → merge

# 3. Tag from main
git checkout main && git pull origin main
git tag -a x.y.z -m "x.y.z"
git push origin x.y.z

# 4. Publish the draft on GitHub → Releases
```
