# PvME Guide Editor

Web editor for [PvME Discord guides](https://pvme.io/guide-editor/), built with Svelte, Vite, Tailwind CSS, CodeMirror and the PvME guide parser. Load guides, edit exact source, preview Discord output, check formatting, recover local drafts and submit updates for review. Authorised reviewers can inspect and edit contributions through the separate review workflow.

https://github.com/user-attachments/assets/78ac849d-f7a6-4abb-bf52-49314a083d31

## Editing Guides

1. Open the [guide editor](https://pvme.io/guide-editor/) and load a guide.
2. Make your changes and check the preview and any reported issues.
3. Log in, describe what changed, and select **Submit update**.

If asked to sync your GitHub fork, select **Open your fork to sync**, then **Sync fork → Update branch** on GitHub. Return to the editor and submit again. Your draft stays in the editor.

## Local setup

Use Node.js 24 (`.nvmrc`) for the frontend and Node.js 22 for the Cloud Function. Install each dependency tree with its supported runtime:

```powershell
npm ci
npm --prefix cloud-functions/guide-pr ci
```

Create an ignored root `.env.development` with local configuration:

```env
VITE_GUIDE_PR_ENDPOINT_LOCAL=http://localhost:8080
VITE_GUIDE_PR_ENDPOINT_LIVE=https://guide-api.pvme.io
PVME_SUBMIT_SECRET=local-proxy-secret
```

Run `npm run dev` at `http://localhost:5173/guide-editor/`. In a separate Node.js 22 terminal:

```powershell
cd cloud-functions/guide-pr
$env:DRY_RUN = "true"
$env:PVME_SUBMIT_SECRET = "local-proxy-secret"
$env:AUTH_COOKIE_SECRET = "local-only-cookie-secret"
$env:AUTH_COOKIE_SECURE = "false"
$env:AUTH_COOKIE_SAMESITE = "Lax"
npm start
```

Keep local configuration and credentials out of Git. Only public endpoint URLs belong in `VITE_*` variables; never put server secrets there. The dev proxy forwards cookies, explicit CSRF, paths and redirects, adds the server submission secret, and adjusts cookies only for development. A configured local upstream never falls back to production. An empty local endpoint selects the configured live upstream; use the local backend for development authentication.

## Authentication and configuration

GitHub contributors authenticate with OAuth and submit from their own forks. Discord contributors authenticate with Discord, require PvME membership and submit through the GitHub App. Reviewer access uses `GUIDE_EDITOR_REVIEWER_GITHUB_LOGINS`.

| Backend setting | Purpose |
| --- | --- |
| `PVME_SUBMIT_SECRET`, `AUTH_COOKIE_SECRET` | Server/proxy access and encrypted, expiring sessions |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` | Discord OAuth |
| `GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_ID`, `GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET`, `GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI` | GitHub OAuth; legacy `GITHUB_OAUTH_*` aliases remain supported |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, optional `GITHUB_INSTALLATION_ID` | GitHub App access for Discord submissions and reviews |
| `ALLOWED_ORIGIN`, `TRUSTED_ORIGIN`, `FRONTEND_ORIGIN` | CORS, trusted origin and default frontend return URL |
| `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, optional `AUTH_COOKIE_DOMAIN` | Cookie policy; prefer host-only cookies |
| `DRY_RUN` | Local simulation only; production must use `false` |

Use separate development OAuth applications. Set their client IDs/secrets in the backend terminal and use localhost consistently. Recommended local callbacks are `http://localhost:8080/auth/github/callback` and `http://localhost:5173/api/guide-pr/auth/discord/callback`. GitHub also supports the running frontend proxy callback at `http://localhost:5173/api/guide-pr/auth/github/callback`.

Production callbacks are `https://guide-api.pvme.io/auth/github/callback` and `https://guide-api.pvme.io/auth/discord/callback`. GitHub requests `repo read:user`, without workflow permission. Both `/guide-editor/` and `/pvme-website/` share authentication on `https://pvme.io`, using API-host HttpOnly, Secure, SameSite=None cookies. Trusted/CORS origins contain no path prefixes. Auth, guide loads and submission responses use no-store caching; clients include credentials. Development session handoffs cannot authenticate production sessions.

Dry-run validates sessions, CSRF and strict request/response shapes without publishing. It does not verify live review versions, source freshness, GitHub permissions or PR lifecycle. Review-source loading and reviewer mutations are unavailable. `unverified` review metadata requires a development build on localhost/127.0.0.1, an explicit HTTP loopback backend, `dryRun:true` on the source, and a fresh uncached health check confirming dry-run, the expected repository and master branch. It never becomes a live no-review assertion.

## Strict submission contract

Production uses `https://guide-api.pvme.io`. All contributor entry points call `submitGuideUpdateStrict` in `src/guidePrApi.js`, posting only to `/v2/submissions`, with an explicit `X-PVME-CSRF-Token`. There is no automatic submission retry or legacy fallback, including on an outdated backend's 404. Reviewer endpoints remain separate under `/reviews/pulls`.

Requests require `contractVersion:2`, captured `expectedContributor` (`github:<id>` or `discord:<id>`), explicit `expectedReview`, `sourcePreservation:'exact'`, boolean `replaceExistingReview`, and the update fields: `type:'update'`, `repo:'pvme/pvme-guides'`, `baseBranch:'master'`, safe relative `.txt` path, `originalContent`, `content`, notes, source and branch. Title and legacy `existingReviewBranch` metadata are optional. Notes must be nonempty and at most 2,000 characters; title at most 120; each source at most 2 MiB UTF-8, with a nonempty changed result.

Retain the complete `/guides/load` result and the identity captured around that load. A review assertion is either `{state:'none'}` or `{state:'present',repository,branch,headSha,prId,prNumber,prUrl}`. The head is a full lowercase commit SHA and the positive PR identifiers/link identify the same open review. Every field is immutable for the edit session. Master source uses branch `master`; review source uses its captured branch/version. Consent to replace a review from master must bind the contributor, guide, selected source, exact original text and complete review version, and show the captured PR. Review-source updates use replacement false. A changed head invalidates consent even if text is identical; newly appeared, disappeared, closed or replaced reviews require a fresh load and fresh consent.

Real responses validate contract version, captured identity, path, owned branch, PR URL, reused-review metadata and status (201 new, 200 reused). Dry-run additionally validates public identity, source, title, byte counts and `reviewStateVerified:false`. See `src/submission-contract.js` and backend regression tests for executable validation. API errors are JSON `{error,code?}`:

| Codes / outcomes | Recovery |
| --- | --- |
| `INVALID_CONTRACT`, `STRICT_ROUTE_REQUIRED`, `INVALID_CONTRIBUTOR`, `INVALID_REVIEW_STATE` | Correct integration or reload through a v2 backend; preserve draft |
| `CONTRIBUTOR_MISMATCH`, `CSRF_INVALID`, 401/403 | Deliberately refresh authentication as the original contributor and revalidate source |
| `REPLACEMENT_CONSENT_REQUIRED`, `REVIEW_STATE_CONFLICT`, `SOURCE_CONFLICT` | Inspect contribution, reload fresh source, apply edits manually and obtain fresh consent |
| `FORK_SYNC_REQUIRED` | Sync the fork on GitHub, then reload source and consent |
| 400/413, 404, 429 | Correct/export input, check source/backend availability, or wait before a manual retry |
| Network failure, malformed result, 5xx or conflict after publication | Publication may be uncertain; inspect the contribution before any manual retry |

All outcomes retain drafts, including success and dry-run. A receipt cannot fabricate the next review head or clean up another account's draft/newer edits. Old or anonymous drafts remain recoverable through **Validate recovered draft source**, which captures identity/version only after exact source validation. Changed source requires keeping/exporting the old draft and applying edits to a fresh source manually; there is no silent merge or rebase. Existing CRLF, mixed/lone CR, Unicode, whitespace and final newlines survive source loading; newly typed line breaks use LF.

GitHub refs, forks and PR metadata are separate resources, so rechecks cannot make publication atomic. Non-force/create-only publication and immutable checks reduce races, but failures can leave objects or published source. There is no exactly-once guarantee or automatic rollback. Inspect uncertain outcomes.

Legacy backend `POST /` and `POST /submit-guide-update` remain temporarily available for cached/deployment-compatible clients; strict fields on them are rejected with `STRICT_ROUTE_REQUIRED`. After both strict clients are deployed and verified, monitor legacy usage over an agreed compatibility window, then retire contributor POST routes in a separately reviewed backend change with an explicit migration error and no writes. Never redirect or manufacture v2 assertions. Preserve health, auth and reviewer routes.

## Verification

```powershell
npm test
npm --prefix cloud-functions/guide-pr test
npm run check:guide-pr
npm run build
npm audit
npm --prefix cloud-functions/guide-pr audit
npm run test:browser
node scripts/verify-production-release.mjs
node scripts/review-release-artifacts.cjs
git diff --check
```

Run backend checks under Node.js 22. Backend tests start the actual Functions Framework in isolated dry-run mode with synthetic configuration and external networking blocked, including parsing, compressed-body, strict-v2, reviewer, OAuth/session and deployment-safety regressions. Browser checks use an existing Playwright installation and Chrome/Chromium, intercept all API/external requests, and load no repository environment files. Set `PLAYWRIGHT_MODULE` to an existing installation and optionally `BROWSER_EXECUTABLE` to the browser executable. The production-bundle check requires a fresh build. Artifact inspection compares secret patterns and local credential values in memory without printing values; it cannot prove absence of every possible encoding.

The backend lock includes patched parsing/proxy dependencies and an intentional scoped override: `cloudevents@8.0.3` uses `uuid@11.1.1`. Parent API/bounds compatibility is covered by `dependency-security.test.cjs`; reassess the exception when updating CloudEvents rather than removing it merely because audit is clean. Do not force audit fixes or unrelated major upgrades.

## Deployment

Pushing `main` automatically publishes the frontend at `https://pvme.io/guide-editor/` through `.github/workflows/deploy.yml`: Node.js 24, clean engine-strict install, frontend tests, production build and GitHub Pages upload of `dist` only. Backend tests require their separate installation/runtime; frontend CI deliberately discovers only frontend/proxy tests. Review the production bundle's effective API origin before release; public Vite endpoint overrides are build-time settings. `npm run preview` serves a local build.

The backend is the existing Gen 2 `submitGuideUpdate` function in `pvmebackend` / `europe-west1`, using Node.js 22. Deploy only with `npm run deploy:guide-pr`, from the repository root and an authorised GCP account. It updates the existing function, preserves deployed credentials, Secret Manager references, reviewer settings, runtime service account and IAM, verifies effective callbacks/configuration drift, and cleans up sensitive temporary configuration. It does not create infrastructure. Only production-specific env files are loaded; exported variables take precedence. Never bypass these protections or copy production credentials locally.

Required explicit production deployment settings:

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
# Only when deployment is explicitly authorised:
npm run deploy:guide-pr
```

Upload contents are limited by `.gcloudignore` to `index.js`, `package.json` and `package-lock.json`. After an authorised deployment, verify revision/traffic, configuration/secret bindings/identity/IAM preservation, safe health/auth/CORS/negative routing and recent runtime errors. `node scripts/smoke-guide-pr-production.mjs` checks public health and anonymous strict-v2 rejection only; it sends no valid update, credentials or provider exchange. Do not roll back to token-exposing or dependency-vulnerable revisions.

Before genuine production OAuth acceptance or public website enablement, complete separately authorised historical OAuth grant revocation, session-secret rotation/invalidation and cache/log review. Keep website release switches closed until security and acceptance gates are accepted. Genuine GitHub/Discord cookie/account-switch checks across both clients, reviewer acceptance, mobile/browser interaction and separately authorised disposable-repository PR lifecycle/concurrency/network-loss tests remain necessary; local mocks and anonymous smoke checks cannot establish them.
