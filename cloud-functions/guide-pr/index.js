const crypto = require("node:crypto");

const DISCORD_API = "https://discord.com/api";
const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const GITHUB_API = "https://api.github.com";
const REPO = "pvme/pvme-guides";
const BASE_BRANCH = "master";
const MAX_CONTENT_BYTES = 2 * 1024 * 1024;
const MAX_TITLE_CHARS = 120;
const MAX_NOTES_CHARS = 2000;
const MAX_PR_BODY_CHARS = 9000;
const MAX_PR_SUMMARIES = 5;
const PVME_GUILD_ID = "534508796639182860";
const DISCORD_OAUTH_SCOPE = "identify guilds.members.read";
const DEFAULT_TRUSTED_ORIGIN = "https://pvme.io";
const DEFAULT_ALLOWED_ORIGIN = "http://localhost:5173,https://pvme.io";
const SESSION_COOKIE = "pvme_guide_session";
const ANON_GUIDE_USAGE_COOKIE = "pvme_guide_anon_loads";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
const ANON_GUIDE_LOAD_LIMIT = 2;
const ANON_GUIDE_USAGE_MAX_AGE_SECONDS = 24 * 60 * 60;
const authRateLimits = new Map();

exports.submitGuideUpdate = async (req, res) => {
  if (!setCorsHeaders(req, res)) {
    sendJson(res, 403, { error: "Guide update submission is not authorized from this origin." });
    return;
  }

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const route = getRoute(req);

  try {
    if (route === "/auth/discord/callback") {
      await handleDiscordCallback(req, res);
      return;
    }

    if (route === "/" && req.method === "GET") {
      sendJson(res, 200, {
        ok: true,
        service: "pvme-guide-editor-pr",
        repo: REPO,
        baseBranch: BASE_BRANCH,
        mode: isDryRun() ? "dry-run" : "live",
        githubAppConfigured: Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY),
        discordConfigured: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
        submitSecretConfigured: Boolean(process.env.PVME_SUBMIT_SECRET),
        trustedOrigins: getTrustedOrigins()
      });
      return;
    }

    if (route === "/auth/discord/start" && req.method === "GET") {
      enforceRateLimit(req, "auth:start", 10, 10 * 60);
      handleDiscordStart(req, res);
      return;
    }

    validateRequestAccess(req);

    if (route === "/auth/me" && req.method === "GET") {
      sendJson(res, 200, { user: getSessionUser(req) });
      return;
    }

    if (route === "/auth/logout" && req.method === "POST") {
      clearSessionCookie(res);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (route === "/guides/load" && req.method === "GET") {
      await handleLoadGuide(req, res);
      return;
    }

    if ((route === "/" || route === "/submit-guide-update") && req.method === "POST") {
      await handleSubmitGuideUpdate(req, res);
      return;
    }

    sendJson(res, 404, { error: "Route not found." });
  } catch (err) {
    const status = err.status || 500;
    const message = status === 500
      ? "Guide update submission failed."
      : err.message;

    if (status === 500) {
      console.error(err);
    }

    sendJson(res, status, { error: message });
  }
};

async function handleSubmitGuideUpdate(req, res) {
  const user = requirePvmeMemberSession(req);
  const payload = normalizePayload(req.body);
  validatePayload(payload);

  const [owner, repo] = REPO.split("/");
  const reviewBranch = createReviewBranchName(user.discordId, payload.path);
  validateSubmissionSource(payload, reviewBranch);

  if (isDryRun()) {
    sendJson(res, 200, {
      dryRun: true,
      message: "Guide update payload passed validation. No GitHub changes were made.",
      path: payload.path,
      title: payload.title || `Update ${payload.path}`,
      user: publicUser(user),
      contentBytes: Buffer.byteLength(payload.content, "utf8"),
      originalContentBytes: Buffer.byteLength(payload.originalContent, "utf8"),
      source: payload.source,
      branch: payload.branch,
      reviewBranch
    });
    return;
  }

  const github = await createGithubAppInstallationClient(owner, repo);
  const branchRef = await getBranchRef(github, owner, repo, reviewBranch);
  const existingPr = branchRef
    ? await getOpenPullRequest(github, owner, repo, reviewBranch)
    : null;

  if (payload.source === "master") {
    const currentMasterFile = await getFile(github, owner, repo, payload.path, BASE_BRANCH);

    if (currentMasterFile.text !== payload.originalContent) {
      throw httpError(
        409,
        "This guide has changed since it was loaded. You must reload the guide and apply your edits again to submit a guide update."
      );
    }

    if (existingPr && !payload.replaceExistingReview) {
      throw httpError(
        409,
        "This will replace your existing submitted update with this version based on the live guide."
      );
    }
  } else if (payload.source === "user-pr") {
    if (!branchRef) {
      throw httpError(409, "Your existing submitted update could not be found. Reload the guide and try again.");
    }

    const currentReviewFile = await getFile(github, owner, repo, payload.path, reviewBranch);

    if (currentReviewFile.text !== payload.originalContent) {
      throw httpError(
        409,
        "Your submitted update has changed since it was loaded. You must reload it and apply your edits again to submit a guide update."
      );
    }
  }

  if (!branchRef) {
    const baseRef = await github(
      `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(BASE_BRANCH)}`
    );

    await github(`/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: {
        ref: `refs/heads/${reviewBranch}`,
        sha: baseRef.object.sha
      }
    });
  }

  const currentBranchFile = await getFile(github, owner, repo, payload.path, reviewBranch);

  await github(`/repos/${owner}/${repo}/contents/${encodePath(payload.path)}`, {
    method: "PUT",
    body: {
      message: createCommitMessage(payload, user),
      content: Buffer.from(payload.content, "utf8").toString("base64"),
      sha: currentBranchFile.sha,
      branch: reviewBranch
    }
  });

  const openPr = existingPr || await getOpenPullRequest(github, owner, repo, reviewBranch);
  const prTitle = payload.title || `Update ${payload.path}`;
  const prBody = createPullRequestBody(payload, user, openPr?.body || "");
  const pr = openPr
    ? await github(`/repos/${owner}/${repo}/pulls/${openPr.number}`, {
      method: "PATCH",
      body: {
        title: prTitle,
        body: prBody
      }
    })
    : await github(`/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      body: {
        title: prTitle,
        head: reviewBranch,
        base: BASE_BRANCH,
        body: prBody
      }
    });

  sendJson(res, openPr ? 200 : 201, {
    prUrl: pr.html_url,
    branch: reviewBranch,
    path: payload.path,
    reusedReview: Boolean(openPr)
  });
}

async function handleLoadGuide(req, res) {
  const path = String(req.query.path || "");
  const source = String(req.query.source || "auto");
  const user = getSessionUser(req);

  if (!isSafeGuidePath(path)) {
    throw httpError(400, "The guide path is invalid.");
  }

  if (!["auto", "master", "review"].includes(source)) {
    throw httpError(400, "The guide source is invalid.");
  }

  if (!user) {
    enforceAnonymousGuideLoadLimit(req, res);
  }

  if (isDryRun() && source !== "review") {
    const fallbackText = await getPublicMasterFile(path);
    sendJson(res, 200, {
      path,
      name: guideNameFromPath(path),
      repo: REPO,
      source: "master",
      branch: BASE_BRANCH,
      baseBranch: BASE_BRANCH,
      prUrl: "",
      originalText: fallbackText,
      dryRun: true
    });
    return;
  }

  if (isDryRun() && source === "review") {
    throw httpError(404, "Review drafts cannot be loaded in dry-run mode.");
  }

  const [owner, repo] = REPO.split("/");
  const github = await createGithubAppInstallationClient(owner, repo);
  let existingReview = null;

  if (user) {
    const reviewBranch = createReviewBranchName(user.discordId, path);
    const branchRef = await getBranchRef(github, owner, repo, reviewBranch);
    const openPr = branchRef
      ? await getOpenPullRequest(github, owner, repo, reviewBranch)
      : null;

    if (branchRef && openPr) {
      existingReview = {
        reviewBranch,
        prUrl: openPr.html_url
      };
    }
  }

  if (source === "auto" && existingReview) {
    sendJson(res, 200, {
      hasExistingReview: true,
      path,
      name: guideNameFromPath(path),
      repo: REPO,
      reviewBranch: existingReview.reviewBranch,
      prUrl: existingReview.prUrl,
      liveBranch: BASE_BRANCH,
      baseBranch: BASE_BRANCH
    });
    return;
  }

  if (source === "review") {
    if (!user || !existingReview) {
      throw httpError(404, "No submitted update was found for this guide.");
    }

    const reviewFile = await getFile(github, owner, repo, path, existingReview.reviewBranch);
    sendJson(res, 200, createLoadedGuide({
      path,
      text: reviewFile.text,
      source: "user-pr",
      branch: existingReview.reviewBranch,
      prUrl: existingReview.prUrl
    }));
    return;
  }

  const masterFile = await getFile(github, owner, repo, path, BASE_BRANCH);
  const loadedGuide = createLoadedGuide({
    path,
    text: masterFile.text,
    source: "master",
    branch: BASE_BRANCH,
    prUrl: ""
  });

  if (existingReview) {
    loadedGuide.existingReviewBranch = existingReview.reviewBranch;
    loadedGuide.existingReviewUrl = existingReview.prUrl;
  }

  sendJson(res, 200, loadedGuide);
}

function handleDiscordStart(req, res) {
  requireDiscordConfig();

  const redirectUri = getDiscordRedirectUri(req);
  const returnTo = getSafeReturnTo(req);
  const state = signJson({
    exp: nowSeconds() + OAUTH_STATE_MAX_AGE_SECONDS,
    returnTo,
    redirectUri
  });

  const params = new URLSearchParams({
    client_id: getDiscordClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DISCORD_OAUTH_SCOPE,
    state
  });

  res.redirect(`${DISCORD_AUTHORIZE_URL}?${params}`);
}

async function handleDiscordCallback(req, res) {
  requireDiscordConfig();
  enforceRateLimit(req, "auth:callback", 20, 10 * 60);

  if (req.query.error) {
    redirectAuthFailure(req, res, "Discord login was cancelled. You must log in with Discord to submit a guide update.");
    return;
  }

  const code = String(req.query.code || "");
  const state = verifySignedJson(String(req.query.state || ""));

  if (!code || !state || state.exp < nowSeconds() || !state.redirectUri) {
    redirectAuthFailure(req, res, "Discord login could not be verified.");
    return;
  }

  const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: getDiscordClientId(),
      client_secret: getDiscordClientSecret(),
      grant_type: "authorization_code",
      code,
      redirect_uri: state.redirectUri
    })
  });
  const tokenData = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok || !tokenData.access_token) {
    console.warn("Discord OAuth token exchange failed:", getDiscordOAuthError(tokenData) || tokenRes.status);
    redirectAuthFailure(req, res, "Discord login could not be verified.");
    return;
  }

  const userRes = await fetch(`${DISCORD_API}/users/@me`, {
    headers: {
      "Authorization": `Bearer ${tokenData.access_token}`
    }
  });
  const discordUser = await userRes.json().catch(() => ({}));

  if (!userRes.ok || !discordUser.id) {
    redirectAuthFailure(req, res, "Discord login could not be verified.");
    return;
  }

  const guildMember = await fetchPvmeGuildMember(tokenData.access_token);

  if (!guildMember.ok) {
    if (guildMember.notMember) {
      redirectAuthFailure(req, res, "You must be a member of the PvME Discord server to submit guide changes.");
      return;
    }

    redirectAuthFailure(req, res, "Discord login could not be verified.");
    return;
  }

  setSessionCookie(res, {
    discordId: String(discordUser.id),
    username: String(discordUser.username || ""),
    globalName: discordUser.global_name ? String(discordUser.global_name) : "",
    avatar: discordUser.avatar ? String(discordUser.avatar) : "",
    pvmeMember: true,
    pvmeGuildId: PVME_GUILD_ID,
    pvmeRoles: Array.isArray(guildMember.member.roles)
      ? guildMember.member.roles.map(String)
      : [],
    exp: nowSeconds() + SESSION_MAX_AGE_SECONDS
  });

  res.redirect(state.returnTo || getFrontendOrigin(req));
}

async function fetchPvmeGuildMember(accessToken) {
  const memberRes = await fetch(`${DISCORD_API}/v10/users/@me/guilds/${PVME_GUILD_ID}/member`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });

  if ([401, 403, 404].includes(memberRes.status)) {
    return { ok: false, notMember: true };
  }

  if (!memberRes.ok) {
    console.warn("Discord PvME guild membership check failed:", memberRes.status);
    return { ok: false, notMember: false };
  }

  const member = await memberRes.json().catch(() => ({}));
  return { ok: true, member };
}

function redirectAuthFailure(req, res, message) {
  const state = verifySignedJson(String(req.query.state || ""));
  const fallback = getFrontendOrigin(req);
  const allowedOrigin = getUrlOrigin(fallback);
  let redirectUrl;

  try {
    redirectUrl = new URL(state?.returnTo || fallback, fallback);
  } catch {
    redirectUrl = new URL(fallback);
  }

  if (redirectUrl.origin !== allowedOrigin) {
    redirectUrl = new URL(fallback);
  }

  redirectUrl.searchParams.set("submit", "1");
  redirectUrl.searchParams.set("authError", message);
  res.redirect(redirectUrl.toString());
}

function createLoadedGuide({ path, text, source, branch, prUrl }) {
  return {
    path,
    name: guideNameFromPath(path),
    repo: REPO,
    source,
    branch,
    baseBranch: BASE_BRANCH,
    prUrl,
    originalText: text
  };
}

function normalizePayload(body) {
  if (!body || typeof body !== "object") {
    throw httpError(400, "Request body must be JSON.");
  }

  return {
    type: String(body.type || ""),
    repo: String(body.repo || ""),
    baseBranch: String(body.baseBranch || ""),
    path: String(body.path || ""),
    content: typeof body.content === "string" ? body.content : null,
    originalContent: typeof body.originalContent === "string" ? body.originalContent : null,
    title: String(body.title || "").trim(),
    notes: String(body.notes || "").trim(),
    source: String(body.source || ""),
    branch: String(body.branch || ""),
    existingReviewBranch: String(body.existingReviewBranch || ""),
    replaceExistingReview: body.replaceExistingReview === true
  };
}

function validatePayload(payload) {
  if (payload.type !== "update") {
    throw httpError(400, "Only guide update submissions are supported.");
  }

  if (payload.repo !== REPO) {
    throw httpError(400, "This endpoint only accepts pvme-guides updates.");
  }

  if (payload.baseBranch !== BASE_BRANCH) {
    throw httpError(400, "This endpoint only accepts updates against master.");
  }

  if (!isSafeGuidePath(payload.path)) {
    throw httpError(400, "The guide path is invalid.");
  }

  if (payload.content === null || payload.originalContent === null) {
    throw httpError(400, "Guide content is missing.");
  }

  if (payload.content.trim().length === 0) {
    throw httpError(400, "You must add guide text to submit a guide update.");
  }

  if (payload.content === payload.originalContent) {
    throw httpError(400, "You must make a guide change to submit a guide update.");
  }

  if (Buffer.byteLength(payload.content, "utf8") > MAX_CONTENT_BYTES) {
    throw httpError(413, "Guide content is too large.");
  }

  if (Buffer.byteLength(payload.originalContent, "utf8") > MAX_CONTENT_BYTES) {
    throw httpError(413, "Original guide content is too large.");
  }

  if (payload.title.length > MAX_TITLE_CHARS) {
    throw httpError(400, `Update title must be ${MAX_TITLE_CHARS} characters or fewer.`);
  }

  if (!payload.notes) {
    throw httpError(400, "You must describe what changed to submit a guide update.");
  }

  if (payload.notes.length > MAX_NOTES_CHARS) {
    throw httpError(400, `Update summary must be ${MAX_NOTES_CHARS} characters or fewer.`);
  }
}

function validateSubmissionSource(payload, reviewBranch) {
  if (payload.source === "master") {
    if (payload.branch !== BASE_BRANCH) {
      throw httpError(400, "The loaded guide source is invalid.");
    }

    if (payload.existingReviewBranch && payload.existingReviewBranch !== reviewBranch) {
      throw httpError(403, "You cannot replace another user's review branch.");
    }

    return;
  }

  if (payload.source === "user-pr") {
    if (payload.branch !== reviewBranch) {
      throw httpError(403, "You cannot submit against another user's review branch.");
    }

    return;
  }

  throw httpError(400, "The loaded guide source is invalid.");
}

function isSafeGuidePath(path) {
  return Boolean(path)
    && path.endsWith(".txt")
    && !path.startsWith("/")
    && !path.startsWith("\\")
    && !path.includes("..")
    && !/[<>:"|?*\u0000-\u001f]/.test(path)
    && path.split(/[\\/]/).every(Boolean);
}

async function getFile(github, owner, repo, path, ref) {
  const file = await github(
    `/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`
  );

  if (file.type !== "file" || !file.sha || typeof file.content !== "string") {
    throw httpError(400, "The submitted path does not resolve to a guide file.");
  }

  return {
    sha: file.sha,
    text: Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8")
  };
}

async function getPublicMasterFile(path) {
  const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${BASE_BRANCH}/${encodePath(path)}`);

  if (!res.ok) {
    throw httpError(res.status, "The submitted path does not resolve to a guide file.");
  }

  return res.text();
}

async function getBranchRef(github, owner, repo, branch) {
  try {
    return await github(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function getOpenPullRequest(github, owner, repo, branch) {
  const params = new URLSearchParams({
    state: "open",
    head: `${owner}:${branch}`,
    base: BASE_BRANCH
  });
  const prs = await github(`/repos/${owner}/${repo}/pulls?${params}`);

  return Array.isArray(prs) && prs.length > 0 ? prs[0] : null;
}

async function createGithubAppInstallationClient(owner, repo) {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = normalizePrivateKey(process.env.GITHUB_APP_PRIVATE_KEY);

  if (!appId) {
    throw httpError(500, "GITHUB_APP_ID is not configured.");
  }

  if (!privateKey) {
    throw httpError(500, "GITHUB_APP_PRIVATE_KEY is not configured.");
  }

  const appJwt = createAppJwt(appId, privateKey);
  const appGithub = createGithubClient(appJwt);
  const installationId = process.env.GITHUB_INSTALLATION_ID
    || (await appGithub(`/repos/${owner}/${repo}/installation`)).id;

  if (!installationId) {
    throw httpError(500, "GitHub App installation ID could not be resolved.");
  }

  const installation = await appGithub(`/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    body: {
      repositories: [repo],
      permissions: {
        contents: "write",
        pull_requests: "write"
      }
    }
  });

  if (!installation.token) {
    throw httpError(500, "GitHub App installation token could not be created.");
  }

  return createGithubClient(installation.token);
}

function createAppJwt(appId, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId
  };

  const unsignedToken = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(unsignedToken), privateKey)
    .toString("base64url");

  return `${unsignedToken}.${signature}`;
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function normalizePrivateKey(value) {
  if (!value) return "";
  return value.replace(/\\n/g, "\n");
}

function createGithubClient(token) {
  return async function github(path, options = {}) {
    const res = await fetch(`${GITHUB_API}${path}`, {
      method: options.method || "GET",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "pvme-guide-editor",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = data.message || `GitHub request failed with status ${res.status}.`;
      throw httpError(res.status, message);
    }

    return data;
  };
}

function createReviewBranchName(discordId, path) {
  return `guide-editor/discord-${discordId}/${createFileSlug(path)}`;
}

function createFileSlug(path) {
  return path
    .replace(/\.txt$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 72) || "guide";
}

function createCommitMessage(payload, user) {
  const lines = [
    `Update ${payload.path}`
  ];

  if (payload.notes) {
    lines.push("", payload.notes);
  }

  lines.push("", `Discord: ${userDisplayName(user)} (${user.discordId})`);

  return lines.join("\n");
}

function createPullRequestBody(payload, user, existingBody = "") {
  const summaries = getExistingUpdateSummaries(existingBody);
  if (payload.notes) {
    summaries.push(payload.notes);
  }
  const visibleSummaries = summaries.slice(-MAX_PR_SUMMARIES);

  const lines = [
    "Submitted from the PvME Guide Editor.",
    "",
    `Guide file: \`${payload.path}\``,
    `Submitted by: ${userDisplayName(user)}`,
    `Discord user ID: \`${user.discordId}\``
  ];

  if (visibleSummaries.length > 0) {
    lines.push("", "Update summaries:");
    visibleSummaries.forEach((summary, index) => {
      lines.push(`${index + 1}. ${formatSummaryListItem(summary)}`);
    });
  }

  lines.push("", "This automated submission updates one existing guide file only.");

  const body = lines.join("\n");
  return body.length > MAX_PR_BODY_CHARS
    ? `${body.slice(0, MAX_PR_BODY_CHARS - 120).trim()}\n\n_Update summary history was trimmed to keep this submission readable._`
    : body;
}

function getExistingUpdateSummaries(body) {
  const lines = String(body || "").split(/\r?\n/);
  const summaries = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "Update summaries:") {
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j];
        if (!line.trim()) break;
        const match = line.match(/^\d+\.\s+(.*)$/);
        if (match) summaries.push(match[1].trim());
      }
      return summaries;
    }

    if (lines[i] === "Update summary:") {
      const summary = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].trim()) break;
        summary.push(lines[j]);
      }
      if (summary.length > 0) summaries.push(summary.join("\n").trim());
      return summaries;
    }
  }

  return summaries;
}

function formatSummaryListItem(summary) {
  return String(summary || "")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function guideNameFromPath(path) {
  return path.split("/").pop() || path;
}

function getRoute(req) {
  const url = new URL(req.url, "https://guide-editor.local");
  let path = url.pathname || "/";

  if (path === "/submitGuideUpdate") return "/";
  if (path.startsWith("/submitGuideUpdate/")) {
    path = path.slice("/submitGuideUpdate".length);
  }

  return path || "/";
}

function setCorsHeaders(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  const allowedOrigins = allowedOrigin.split(",").map((value) => value.trim()).filter(Boolean);
  const origin = req.get("origin");

  if (!isDryRun() && origin && allowedOrigins.includes("*")) {
    res.set("Vary", "Origin");
    return false;
  }

  if (allowedOrigins.includes("*") && origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Credentials", "true");
  } else if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Credentials", "true");
  }

  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-PVME-Submit-Secret");
  res.set("Access-Control-Max-Age", "3600");
  return true;
}

function validateRequestAccess(req) {
  if (isTrustedOrigin(req)) {
    return;
  }

  const expected = process.env.PVME_SUBMIT_SECRET || "";
  const actual = req.get("x-pvme-submit-secret") || "";

  if (!expected) {
    throw httpError(500, "PVME_SUBMIT_SECRET is required for non-pvme.io submissions.");
  }

  if (!secureCompare(actual, expected)) {
    throw httpError(403, "Guide update submission is not authorized.");
  }
}

function isTrustedOrigin(req) {
  const origin = req.get("origin") || "";
  return getTrustedOrigins().includes(origin);
}

function getTrustedOrigins() {
  return (process.env.TRUSTED_ORIGIN || DEFAULT_TRUSTED_ORIGIN)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function secureCompare(actual, expected) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function requireDiscordConfig() {
  if (!getDiscordClientId() || !getDiscordClientSecret()) {
    throw httpError(500, "Discord OAuth is not configured.");
  }

  if (!process.env.AUTH_COOKIE_SECRET) {
    throw httpError(500, "AUTH_COOKIE_SECRET is not configured.");
  }
}

function getDiscordClientId() {
  return String(process.env.DISCORD_CLIENT_ID || "").trim();
}

function getDiscordClientSecret() {
  return String(process.env.DISCORD_CLIENT_SECRET || "").trim();
}

function getDiscordRedirectUri(req) {
  const proxyOrigin = getProxyOrigin(req);

  if (proxyOrigin) {
    return `${proxyOrigin}/api/guide-pr/auth/discord/callback`;
  }

  const localReturnOrigin = getLocalReturnOrigin(req);

  if (localReturnOrigin) {
    return `${localReturnOrigin}/api/guide-pr/auth/discord/callback`;
  }

  if (process.env.DISCORD_REDIRECT_URI) {
    return process.env.DISCORD_REDIRECT_URI;
  }

  const proto = req.get("x-forwarded-proto") || req.protocol || "https";
  const host = req.get("x-forwarded-host") || req.get("host");
  return `${proto}://${host}/submitGuideUpdate/auth/discord/callback`;
}

function getProxyOrigin(req) {
  const origin = req.get("x-pvme-proxy-origin") || "";
  if (!origin) return "";

  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin) ? origin : "";
}

function getSafeReturnTo(req) {
  const returnTo = String(req.query.returnTo || "");
  const frontendUrl = getLocalReturnOrigin(req) || getFrontendOrigin(req);
  const allowedOrigin = getUrlOrigin(frontendUrl);

  try {
    const url = new URL(returnTo || frontendUrl, frontendUrl);
    if (url.origin === allowedOrigin) return url.toString();
  } catch {
    // Ignore invalid returnTo and fall back below.
  }

  return frontendUrl;
}

function getLocalReturnOrigin(req) {
  const returnTo = String(req.query.returnTo || "");

  try {
    const origin = new URL(returnTo).origin;
    return origin.startsWith("http://localhost:") ? origin : "";
  } catch {
    return "";
  }
}

function getFrontendOrigin(req) {
  const proxyOrigin = getProxyOrigin(req);
  if (proxyOrigin) return proxyOrigin;
  return process.env.FRONTEND_ORIGIN || getTrustedOrigins()[0] || DEFAULT_TRUSTED_ORIGIN;
}

function getUrlOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getSessionUser(req) {
  const cookie = parseCookies(req.get("cookie") || "")[SESSION_COOKIE];
  if (!cookie) return null;

  const session = verifySignedJson(cookie);
  if (!session || session.exp < nowSeconds() || !session.discordId) {
    return null;
  }

  return {
    discordId: String(session.discordId),
    username: String(session.username || ""),
    globalName: String(session.globalName || ""),
    avatar: String(session.avatar || ""),
    pvmeMember: session.pvmeMember === true,
    pvmeGuildId: String(session.pvmeGuildId || ""),
    pvmeRoles: Array.isArray(session.pvmeRoles)
      ? session.pvmeRoles.map(String)
      : [],
    exp: Number(session.exp)
  };
}

function requireSession(req) {
  const user = getSessionUser(req);

  if (!user) {
    throw httpError(401, "You must log in with Discord to submit a guide update.");
  }

  return user;
}

function requirePvmeMemberSession(req) {
  const user = requireSession(req);

  if (user.pvmeMember !== true || user.pvmeGuildId !== PVME_GUILD_ID) {
    throw httpError(403, "You must be a member of the PvME Discord server to submit guide changes.");
  }

  return user;
}

function enforceAnonymousGuideLoadLimit(req, res) {
  const usage = getAnonymousGuideUsage(req);
  const count = Number(usage.count || 0);

  if (count >= ANON_GUIDE_LOAD_LIMIT) {
    throw httpError(401, "Please log in with Discord to continue loading guides.");
  }

  setAnonymousGuideUsage(res, {
    count: count + 1,
    exp: nowSeconds() + ANON_GUIDE_USAGE_MAX_AGE_SECONDS
  });
}

function getAnonymousGuideUsage(req) {
  const cookie = parseCookies(req.get("cookie") || "")[ANON_GUIDE_USAGE_COOKIE];
  if (!cookie) return { count: 0 };

  const usage = verifySignedJson(cookie);
  if (!usage || usage.exp < nowSeconds()) {
    return { count: 0 };
  }

  return {
    count: Math.max(0, Number(usage.count) || 0),
    exp: Number(usage.exp)
  };
}

function setAnonymousGuideUsage(res, usage) {
  res.set("Set-Cookie", serializeCookie(ANON_GUIDE_USAGE_COOKIE, signJson(usage), {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: getCookieSameSite(),
    path: "/",
    maxAge: ANON_GUIDE_USAGE_MAX_AGE_SECONDS
  }));
}

function setSessionCookie(res, session) {
  res.set("Set-Cookie", serializeCookie(SESSION_COOKIE, signJson(session), {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: getCookieSameSite(),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  }));
}

function clearSessionCookie(res) {
  res.set("Set-Cookie", serializeCookie(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: getCookieSameSite(),
    path: "/",
    maxAge: 0
  }));
}

function serializeCookie(name, value, options) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path || "/"}`,
    `Max-Age=${options.maxAge || 0}`,
    `SameSite=${options.sameSite || "Lax"}`
  ];

  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");

  return parts.join("; ");
}

function parseCookies(header) {
  return header.split(";").reduce((cookies, part) => {
    const index = part.indexOf("=");
    if (index === -1) return cookies;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function getCookieSameSite() {
  return process.env.AUTH_COOKIE_SAMESITE || "None";
}

function isCookieSecure() {
  return process.env.AUTH_COOKIE_SECURE !== "false";
}

function signJson(value) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createSignature(payload);
  return `${payload}.${signature}`;
}

function verifySignedJson(value) {
  if (!process.env.AUTH_COOKIE_SECRET) {
    return null;
  }

  const [payload, signature] = String(value || "").split(".");
  if (!payload || !signature || !secureCompare(signature, createSignature(payload))) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function createSignature(payload) {
  const secret = process.env.AUTH_COOKIE_SECRET || "";
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

function publicUser(user) {
  if (!user) return null;
  return {
    discordId: user.discordId,
    username: user.username,
    globalName: user.globalName,
    avatar: user.avatar,
    pvmeMember: user.pvmeMember === true,
    displayName: userDisplayName(user)
  };
}

function enforceRateLimit(req, bucket, limit, windowSeconds) {
  // TODO: For multi-instance production hardening, move this limiter to shared
  // storage such as Firestore, Redis, Cloud Armor, or an API gateway.
  const now = nowSeconds();
  const key = `${bucket}:${getRequestIp(req)}`;
  const entry = authRateLimits.get(key);

  pruneRateLimits(now);

  if (!entry || entry.resetAt <= now) {
    authRateLimits.set(key, { count: 1, resetAt: now + windowSeconds });
    return;
  }

  if (entry.count >= limit) {
    throw httpError(429, "Too many login attempts. Please wait a few minutes and try again.");
  }

  entry.count += 1;
}

function pruneRateLimits(now) {
  if (authRateLimits.size < 500) return;

  for (const [key, entry] of authRateLimits) {
    if (entry.resetAt <= now) {
      authRateLimits.delete(key);
    }
  }
}

function getRequestIp(req) {
  const forwardedFor = String(req.get("x-forwarded-for") || "");
  return forwardedFor.split(",")[0].trim()
    || req.get("fastly-client-ip")
    || req.get("x-real-ip")
    || req.ip
    || req.connection?.remoteAddress
    || "unknown";
}

function getDiscordOAuthError(data) {
  if (!data || typeof data !== "object") return "";

  const error = typeof data.error === "string" ? data.error : "";
  const description = typeof data.error_description === "string" ? data.error_description : "";

  return [error, description].filter(Boolean).join(" - ");
}

function userDisplayName(user) {
  return user.globalName || user.username || `Discord user ${user.discordId}`;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function isDryRun() {
  return process.env.DRY_RUN === "true";
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
