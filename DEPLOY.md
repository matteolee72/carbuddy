# Chrome Web Store Deployment Guide

## Before You Start

Make sure all your changes are committed and you're on the branch you want to ship.

---

## Step 1 — Bump the Version Number

Open `manifest.json` and update the `"version"` field.

```json
"version": "2.1.0"  →  "version": "2.2.0"
```

Chrome Web Store requires the new version to be strictly greater than the current live version. Use semantic versioning:
- **Patch** (2.1.0 → 2.1.1): bug fixes only
- **Minor** (2.1.0 → 2.2.0): new features, backward compatible
- **Major** (2.1.0 → 3.0.0): breaking changes or major redesign

Save the file.

---

## Step 2 — Commit the Version Bump

```bash
git add manifest.json
git commit -m "chore: bump version to 2.2.0"
```

---

## Step 3 — Package the Extension as a ZIP

You need to ZIP the extension files. **Do not ZIP the whole repo folder** — ZIP the contents inside it.

### Files/folders to include:
```
assets/
components/
images/
scripts/
utils/
offscreen.js
service-worker.js
manifest.json
```

### Files/folders to EXCLUDE:
```
.git/
DEPLOY.md
README.md (if any)
node_modules/ (if any)
*.zip (any old packages)
```

### How to ZIP on Windows:
1. Open File Explorer and navigate to `D:\coding-projects\carbuddy`
2. Select all the files/folders listed above (hold Ctrl to multi-select)
3. Right-click → **Compress to ZIP file** (Windows 11) or **Send to → Compressed (zipped) folder**
4. Name it something like `carbuddy-v2.2.0.zip`

> **Important:** The `manifest.json` must be at the **root** of the ZIP, not inside a subfolder.

---

## Step 4 — Log In to the Chrome Web Store Developer Dashboard

1. Go to [https://chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
2. Sign in with the Google account that owns the extension (`shopsage.ai@gmail.com`)

---

## Step 5 — Open Your Extension Listing

1. You will see your published extensions on the dashboard
2. Click on **CarBuddy: Talk to Cars with AI**

---

## Step 6 — Upload the New Package

1. In the left sidebar, click **Package**
2. Click **Upload new package**
3. Select your `carbuddy-v2.2.0.zip` file
4. Wait for it to upload and validate — Google will check the manifest and flag any errors

If there are errors, fix them, re-zip, and re-upload.

---

## Step 7 — Update the Store Listing (if needed)

In the left sidebar, click **Store listing** if you want to update:
- Description
- Screenshots
- Promotional images
- What's new in this version

This is optional if nothing changed in the listing itself.

---

## Step 8 — Submit for Review

1. In the top-right corner, click **Submit for review**
2. Confirm any prompts Google shows you
3. The status will change to **Pending review**

Google's review typically takes **a few hours to a few days**.

---

## Step 9 — Monitor Review Status

- You will receive an email at `shopsage.ai@gmail.com` when the review is complete
- You can also check the dashboard — status will change to **Published** when live
- If rejected, Google will provide a reason — fix the issue and resubmit

---

## Quick Checklist

- [ ] Version number bumped in `manifest.json`
- [ ] Changes committed to git
- [ ] ZIP created with `manifest.json` at the root
- [ ] ZIP does **not** include `.git/` or other dev files
- [ ] Uploaded to Chrome Web Store dashboard
- [ ] Store listing updated (if needed)
- [ ] Submitted for review
