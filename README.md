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

The deployment command updates only the existing production function in `pvmebackend` / `europe-west1`. It reads the deployed configuration and preserves all credentials, Secret Manager bindings (including secret-bound GitHub client ID/callback), reviewer settings, runtime service account and IAM policy. It cannot create a new function or change credential bindings.

Only `.env.production` and `.env.production.local` are loaded; exported variables take precedence. Generic and development env files are never loaded. The production settings below must be explicit. `DRY_RUN=true`, local callbacks, insecure cookies, development placeholders and credential/binding changes are rejected.

From the repository root, using the authenticated production GCP account:

```powershell
$env:GCLOUD_PROJECT_ID = "pvmebackend"
$env:GCLOUD_REGION = "europe-west1"
$env:ALLOWED_ORIGIN = "https://pvme.io"
$env:TRUSTED_ORIGIN = "https://pvme.io"
$env:FRONTEND_ORIGIN = "https://pvme.io/guide-editor/"
$env:DISCORD_REDIRECT_URI = "https://guide-api.pvme.io/auth/discord/callback"
$env:GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI = "https://guide-api.pvme.io/auth/github/callback"
$env:AUTH_COOKIE_SECURE = "true"
$env:AUTH_COOKIE_SAMESITE = "None"
$env:DRY_RUN = "false"
npm run deploy:guide-pr
```

Existing credentials do not need to be copied into local environment files. The script merges the deployed environment before replacing it, leaves existing secret bindings untouched, verifies the effective secret-bound GitHub callback through the public OAuth start route, and aborts if configuration changes during preflight. Temporary sensitive configuration is deleted after success or failure. Raw CLI output is withheld to prevent configuration leakage; inspect function/build status if deployment fails.

The existing OAuth applications must retain these callbacks:

```text
Discord: https://guide-api.pvme.io/auth/discord/callback
GitHub: https://guide-api.pvme.io/auth/github/callback
```

Both `https://pvme.io/guide-editor/` and `https://pvme.io/pvme-website/` are supported return paths on the same trusted origin. GitHub scopes remain `repo read:user`; no workflow permission is requested. Production dry-run deployments are deliberately unsupported; use the local Functions Framework for dry-run integration tests.

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
