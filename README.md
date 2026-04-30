# PvME Guide Editor

Web editor for PvME Discord guides. It loads existing guide files, previews Discord-style output, checks common issues, and submits updates through the Guide PR backend.

## Local Setup

```powershell
npm install
npm run dev
```

Create `.env.development`:

```env
VITE_GUIDE_PR_ENDPOINT_LOCAL=http://localhost:8080
VITE_GUIDE_PR_ENDPOINT_LIVE=https://europe-west1-pvmebackend.cloudfunctions.net/submitGuideUpdate
PVME_SUBMIT_SECRET=...
```

`PVME_SUBMIT_SECRET` is used only by the Vite dev proxy. Never put secrets in `VITE_*` vars.

## Production Build

`.env.production`:

```env
VITE_GUIDE_PR_ENDPOINT_LIVE=https://europe-west1-pvmebackend.cloudfunctions.net/submitGuideUpdate
```

Build:

```powershell
npm run build
```

## Backend

The submit backend is in [cloud-functions/guide-pr](./cloud-functions/guide-pr).

Quick checks:

```powershell
npm run build
npm run check:guide-pr
```
