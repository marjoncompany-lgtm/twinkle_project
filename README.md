# TWINKLE Studio — Cloudflare Pages

This repository is prepared for Cloudflare Pages connected to GitHub.

## Cloudflare Pages settings
- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/` (repository root)
- Runtime: Node.js 22 or compatible current Node.js

## Build and test locally
```sh
npm ci
npm test
npm run build
```

The build produces `dist/index.html` and `dist/src/production.js`.

## Upload to GitHub
Extract this ZIP and upload the **contents of the extracted folder** to the root of `marjoncompany-lgtm/twinkle_project`. Do not upload only the ZIP itself or place all files inside an extra nested folder. Keep the `src/` directory and its `production.js` file.

Cloudflare Pages must already be connected to this GitHub repository and use the settings listed above. After the files are committed to `main`, Cloudflare should run the build automatically.
