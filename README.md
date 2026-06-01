# PvME Guide Editor

Web editor for PvME Discord guides. It loads existing guide files, previews Discord-style output, checks common guide issues, and submits updates for review through the Guide PR backend.

https://github.com/user-attachments/assets/78ac849d-f7a6-4abb-bf52-49314a083d31

## Install

```powershell
npm install
npm --prefix cloud-functions/guide-pr install
```

Create `.env.development`:

```env
VITE_GUIDE_PR_ENDPOINT_LOCAL=http://localhost:8080
VITE_GUIDE_PR_ENDPOINT_LIVE=https://guide-api.pvme.io
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
GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET_SECRET
guide-editor-auth-cookie-secret
```

From repo root:

```powershell
$env:PVME_SUBMIT_SECRET = "..."
$env:DISCORD_CLIENT_ID = "..."
$env:GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_ID = "..."
$env:DISCORD_REDIRECT_URI = "https://guide-api.pvme.io/auth/discord/callback"
$env:GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI = "https://guide-api.pvme.io/auth/github/callback"
$env:FRONTEND_ORIGIN = "https://pvme.io/guide-editor/"
$env:GITHUB_INSTALLATION_ID = "128427383"

$env:GITHUB_APP_PRIVATE_KEY_SECRET = "github-guide-editor-private-key"
$env:DISCORD_CLIENT_SECRET_SECRET = "discord-client-secret"
$env:GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET_SECRET = "GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET_SECRET"
$env:GUIDE_EDITOR_REVIEWER_GITHUB_LOGINS = "Crisnyc,Chrash1,Ferroric,Rcm37,rsnx222,Porfet,Tinky1rs,zzLinie,Mioneee"
$env:AUTH_COOKIE_SECRET_SECRET = "guide-editor-auth-cookie-secret"

npm run deploy:guide-pr
```

GitHub OAuth setup:

Create a GitHub OAuth app for the guide editor with:

```text
Homepage URL: https://pvme.io/guide-editor/
Authorization callback URL: https://guide-api.pvme.io/auth/github/callback
```

Store its client secret in Secret Manager as `GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET_SECRET`, then deploy with `GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_ID` set to the app's client ID. The guide editor requests GitHub OAuth scopes `repo read:user`; GitHub's contents API requires `repo` for OAuth app tokens that create or update files. GitHub-authenticated submissions use the user's OAuth token to create/update a branch in the user's `pvme-guides` fork and open the PR against `pvme/pvme-guides`, so GitHub shows the PR and commit activity as the signed-in GitHub user.

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
Invoke-RestMethod https://guide-api.pvme.io
```

## Checks

```powershell
npm run build
npm run check:guide-pr
```

## Publish Frontend

Build locally by pushing to `main` branch - this will auto-deploy the app to `https://pvme.io/guide-editor/`.
