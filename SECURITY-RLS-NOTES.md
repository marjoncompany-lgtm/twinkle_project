# Cloudflare security and RLS notes for TWINKLE Studio

## Verified scope (2026-10-11)
- Existing Cloudflare Pages project: `video-music`
- Project ID: `b5a93e40-04f7-4b08-a84d-88f4c1d0eccc`
- Production branch: `main`
- Build command: `npm run build`
- Output directory: `dist`
- No Pages deployments were returned by the Cloudflare API during this check.
- No D1 binding is configured on `video-music`.
- Build and tests passed locally: 3 tests passed; `npm run build` produced `dist/index.html` and `dist/src/production.js`.

## RLS boundary
Cloudflare D1 is SQLite-based and does not provide PostgreSQL-style native row-level-security policies (`CREATE POLICY`). Since `video-music` has no D1 binding, adding RLS here would not resolve the 522 and would incorrectly target an unrelated layer. If the application later adds tenant/user data, enforce authorization in server-side Worker/Pages Functions for each read/write/list/export path and use bound SQL parameters. Do not treat client-side gates as authentication.

## Current app-level security limitation
The current TWINKLE Studio release is a static browser app. Its email/passkey gate is client-side demo logic, not secure authentication. It does not currently persist generated assets to a cloud database or storage service. Do not put secrets, private identity data, or payment data into this static release. Production auth, per-user authorization, private storage, Google Drive integration, and verified payment processing require server-side services and a separate review.

## Deploy
Run `DEPLOY-VIDEO-MUSIC.ps1` in PowerShell on a trusted machine with Node/npm and an authenticated Wrangler session. If not authenticated, run `npx wrangler login` interactively, then rerun the script. The script deploys only the existing `dist` output to the existing `video-music` Pages project, production branch `main`, and checks the live HTTP response afterward.
