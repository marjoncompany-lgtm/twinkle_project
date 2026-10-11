# Project TWINKLE Studio — Production Release

## Requirements
- Node.js 20+ (Node.js 22 recommended)
- npm only
- No Bun runtime or Bun lockfiles

## Commands
```sh
npm install
npm test
npm run build
```

The static Cloudflare Pages output directory is `dist`. Build command: `npm run build`. This project intentionally uses a small Node build script and has no bundler dependency, so it can build offline after checkout.

## Current working exports
- Song-Nah: generates a locally synthesized PCM WAV file (up to 210 seconds).
- Lyric Video: records a simple animated 1280×720, up-to-30-fps WebM visual with user-entered lyrics, plus a companion SRT captions file.
- Music Video: records a simple animated 1280×720, up-to-30-fps WebM visual with user-entered scene text.
- Horse Long-Form: exports user-provided manuscript/episode notes as a text file.
- Filename sanitization, timestamped SRT generation, and WAV header generation are covered by Node tests.

## Important limits
This is a browser-only starter implementation, not a connected AI production platform. These outputs are local synthetic/animated exports, not Suno/FLUX/Grok/Gemini-generated content. Generated files download to the user's device; the current static build does not upload to Google Drive or persist media blobs in a cloud vault. The email/passkey gate is client-side demo logic and is not secure authentication. Storage-extension requests are saved only in browser storage; no GCash payment is processed or verified. Do not enter sensitive personal, credential, or payment data.

To make the named cloud/AI features production-grade, connect a server-side authentication service, protected database/object storage, Google Drive OAuth/API integration, and authorized AI/media providers. Keep all secrets server-side and implement verified payment callbacks before changing actual storage quotas.
