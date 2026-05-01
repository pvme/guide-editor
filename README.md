# PvME Guide Editor

Web editor for PvME Discord guides. It loads existing guide files, previews Discord-style output, checks common guide issues, and submits updates for review through the Guide PR backend.

<video src="./example-vid.mp4" controls muted playsinline width="100%">
  Demo video: PvME Guide Editor in action.
</video>

## Install

```powershell
npm install
npm --prefix cloud-functions/guide-pr install
```

Create `.env.development`:

```env
VITE_GUIDE_PR_ENDPOINT_LOCAL=http://localhost:8080
VITE_GUIDE_PR_ENDPOINT_LIVE=https://europe-west1-pvmebackend.cloudfunctions.net/submitGuideUpdate
PVME_SUBMIT_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
```

`PVME_SUBMIT_SECRET` and `DISCORD_CLIENT_SECRET` are server/dev-proxy secrets. Never expose secrets in `VITE_*` variables.

## Run Locally

Frontend:

```powershell
npm run dev
```

Backend, optional for full local testing:

```powershell
cd cloud-functions/guide-pr
$env:DRY_RUN = "true"
$env:PVME_SUBMIT_SECRET = "same-as-root-env"
$env:DISCORD_CLIENT_ID = "..."
$env:DISCORD_CLIENT_SECRET = "..."
$env:AUTH_COOKIE_SECRET = "local-dev-cookie-secret"
$env:AUTH_COOKIE_SECURE = "false"
npm start
```

Discord local callback:

```text
http://localhost:5173/api/guide-pr/auth/discord/callback
```

If the local backend is not running, the dev proxy falls back to the live backend using `PVME_SUBMIT_SECRET`.

## Publish Backend

The backend is a Google Cloud Function in `cloud-functions/guide-pr`. It uses Discord OAuth for identity and the GitHub App to write branches and PRs.

Required Google Secret Manager secrets:

```text
github-guide-editor-private-key
discord-client-secret
guide-editor-auth-cookie-secret
```

From repo root:

```powershell
$env:PVME_SUBMIT_SECRET = "..."
$env:DISCORD_CLIENT_ID = "..."
$env:DISCORD_REDIRECT_URI = "https://europe-west1-pvmebackend.cloudfunctions.net/submitGuideUpdate/auth/discord/callback"
$env:FRONTEND_ORIGIN = "https://pvme.io/guide-editor/"
$env:GITHUB_INSTALLATION_ID = "128427383"

$env:GITHUB_APP_PRIVATE_KEY_SECRET = "github-guide-editor-private-key"
$env:DISCORD_CLIENT_SECRET_SECRET = "discord-client-secret"
$env:AUTH_COOKIE_SECRET_SECRET = "guide-editor-auth-cookie-secret"

npm run deploy:guide-pr
```

Dry-run deploy:

```powershell
$env:DRY_RUN = "true"
npm run deploy:guide-pr
```

Live deploy:

```powershell
Remove-Item Env:\DRY_RUN -ErrorAction SilentlyContinue
npm run deploy:guide-pr
```

Health check:

```powershell
Invoke-RestMethod https://europe-west1-pvmebackend.cloudfunctions.net/submitGuideUpdate
```

## Publish Frontend

Set `VITE_GUIDE_PR_ENDPOINT_LIVE` as a GitHub Actions repository variable:

```text
https://europe-west1-pvmebackend.cloudfunctions.net/submitGuideUpdate
```

Build locally:

```powershell
npm run build
```

The production site is served from `https://pvme.io/guide-editor/`.

## Checks

```powershell
npm run build
npm run check:guide-pr
```

## Notes

- GitHub writes are always performed by the GitHub App.
- Contributors do not need GitHub accounts.
- Contributor identity comes from Discord OAuth and PvME Discord membership.
- One Discord user plus one guide file reuses one branch/PR.
- Branch format: `guide-editor/discord-{discordId}/{file-slug}`.
