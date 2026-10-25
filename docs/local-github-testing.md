# Local GitHub Submission Testing

Install the frontend and backend dependencies using the [README](../README.md#install).

1. Create a development GitHub OAuth app with callback URL `http://localhost:5173/api/guide-pr/auth/github/callback`.
2. Set `VITE_GUIDE_PR_ENDPOINT_LOCAL=http://localhost:8080` in `.env.development` and start the frontend with `npm run dev`.
3. In another PowerShell terminal, start the backend with your development app credentials:

```powershell
cd cloud-functions/guide-pr
$env:DRY_RUN = "false"
$env:PVME_SUBMIT_SECRET = "same-as-root-env"
$env:AUTH_COOKIE_SECRET = "local-dev-cookie-secret"
$env:AUTH_COOKIE_SECURE = "false"
$env:GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_ID = "your-development-oauth-client-id"
$env:GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET = "your-development-oauth-client-secret"
$env:GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI = "http://localhost:5173/api/guide-pr/auth/github/callback"
npm start
```

Open `http://localhost:5173/guide-editor/`, log in with GitHub, and submit a guide change. This creates a real commit and PR under your account. GitHub App credentials are not needed. Use `DRY_RUN=true` to validate the form without creating a commit or PR.

If prompted to sync your fork, open the link, choose **Sync fork → Update branch**, and retry the same draft. Resolve any conflicts reported by GitHub first.

After submitting, reload your review draft and make another change. Confirm that the editor updates the same PR and that GitHub lists your account as the commit and PR author.
