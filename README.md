# PvME Guide Editor

Web editor for PvME Discord guides. It loads existing guide files, previews Discord-style output, checks common guide issues, and submits updates for review through the Guide PR backend.

https://github.com/user-attachments/assets/78ac849d-f7a6-4abb-bf52-49314a083d31

## Editing Guides

1. Open the [guide editor](https://pvme.io/guide-editor/) and load a guide.
2. Make your changes and check the preview and any reported issues.
3. Log in, describe what changed, and select **Submit update**.

If asked to sync your GitHub fork, select **Open your fork to sync**, then **Sync fork → Update branch** on GitHub. Return to the editor and submit again. Your draft stays in the editor.

## Install

Use Node.js 24 (see `.nvmrc`), matching the frontend deployment workflow.
The frontend dependencies require Node.js 20 or newer; Node.js 18 is unsupported.

```powershell
npm ci
npm --prefix cloud-functions/guide-pr ci
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
$env:AUTH_COOKIE_SAMESITE = "Lax"
npm start
```

Discord local callback:

```text
http://localhost:5173/api/guide-pr/auth/discord/callback
```

Keep `VITE_GUIDE_PR_ENDPOINT_LOCAL` set for local OAuth testing with `DRY_RUN=true`. Leaving it empty selects the configured live backend for legacy proxy requests; production authentication no longer accepts local return/session completion. Local requests never fall back to production.

### Test GitHub submissions locally

Use a development GitHub OAuth app and set `GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_ID`, `GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET` and `GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI` in the backend terminal. The recommended callback is `http://localhost:8080/auth/github/callback`; the existing `http://localhost:5173/api/guide-pr/auth/github/callback` also works while that frontend proxy is running. Use localhost consistently.

Keep `DRY_RUN=true`. Automated integration tests mock GitHub writes and require no credentials. Dry-run submission checks sessions, CSRF and payloads, but skips existing PR detection, source freshness and live GitHub permissions. Review-source loading and reviewer writes are unavailable in dry-run.

## Publish Backend

The backend is a Google Cloud Function in `cloud-functions/guide-pr`. Discord contributors submit through the GitHub App; GitHub contributors use their own OAuth identity and fork.

Required Google Secret Manager secrets:

```text
github-guide-editor-private-key
discord-client-secret
GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET_SECRET
guide-editor-auth-cookie-secret
```

From repo root, in a separate PowerShell terminal from local development. The deployment script also loads local environment files; explicitly set the production values below so they take precedence:

```powershell
$env:PVME_SUBMIT_SECRET = "..."
$env:DISCORD_CLIENT_ID = "..."
$env:GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_ID = "..."
$env:DISCORD_REDIRECT_URI = "https://guide-api.pvme.io/auth/discord/callback"
$env:GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI = "https://guide-api.pvme.io/auth/github/callback"
$env:FRONTEND_ORIGIN = "https://pvme.io/guide-editor/"
$env:ALLOWED_ORIGIN = "https://pvme.io"
$env:TRUSTED_ORIGIN = "https://pvme.io"
$env:AUTH_COOKIE_SECURE = "true"
$env:AUTH_COOKIE_SAMESITE = "None"
$env:DRY_RUN = "false"
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

Store the client secret as `GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET_SECRET` in Secret Manager and set `GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_ID` when deploying. Requested scopes: `repo read:user`. GitHub submissions use the contributor's fork and account for both commits and PRs; no workflow permission is requested.

Deploy with submission writes disabled (this still deploys the real Cloud Function):

```powershell
$env:DRY_RUN = "true"
npm run deploy:guide-pr
```

Live deploy:

```powershell
$env:DRY_RUN = "false"
npm run deploy:guide-pr
```

Health check:

```powershell
Invoke-RestMethod https://guide-api.pvme.io
```

## Checks

```powershell
npm test
npm run build
npm run check:guide-pr
npm --prefix cloud-functions/guide-pr test
```

## Publish Frontend

Build locally by pushing to `main` branch - this will auto-deploy the app to `https://pvme.io/guide-editor/`.
