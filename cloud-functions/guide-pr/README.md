# Guide PR Backend

Google Cloud Function for guide submissions.

It:

- authenticates contributors with Discord
- writes branches/PRs with the GitHub App
- reuses one PR per Discord user per guide file
- keeps GitHub and Discord secrets server-side

## Local Run

```powershell
cd cloud-functions/guide-pr
npm install

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

## Deploy

Secrets live in Google Secret Manager:

```text
github-guide-editor-private-key
discord-client-secret
guide-editor-auth-cookie-secret
```

Deploy from repo root:

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

## Notes

- GitHub writes use the GitHub App only.
- Contributor identity comes from the signed Discord session, not the browser payload.
- Branch format: `guide-editor/discord-{discordId}/{file-slug}`.
