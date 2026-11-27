const crypto = require("node:crypto");

const DISCORD_API = "https://discord.com/api";
const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_API = "https://api.github.com";
const GITHUB_GRAPHQL_API = "https://api.github.com/graphql";
const REPO = "pvme/pvme-guides";
const BASE_BRANCH = "master";
const MAX_CONTENT_BYTES = 2 * 1024 * 1024;
const MAX_TITLE_CHARS = 120;
const MAX_NOTES_CHARS = 2000;
const MAX_PR_BODY_CHARS = 9000;
const MAX_PR_SUMMARIES = 5;
const MAX_REVIEW_PRS = 50;
const MAX_REVIEW_COMMIT_MESSAGE_CHARS = 160;
const PVME_GUILD_ID = "534508796639182860";
const DISCORD_OAUTH_SCOPE = "identify guilds.members.read";
const GITHUB_OAUTH_SCOPE = "repo read:user";
const DEFAULT_TRUSTED_ORIGIN = "https://pvme.io";
const DEFAULT_ALLOWED_ORIGIN = "http://localhost:5173,http://localhost:4321,https://pvme.io";
const SESSION_COOKIE = "pvme_guide_session";
const ANON_GUIDE_USAGE_COOKIE = "pvme_guide_anon_loads";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
const ANON_GUIDE_LOAD_LIMIT = 2;
const ANON_GUIDE_USAGE_MAX_AGE_SECONDS = 24 * 60 * 60;
const MAX_SESSION_ROLES = 40;
const authRateLimits = new Map();

exports.submitGuideUpdate = async (req, res) => {
  if (!setCorsHeaders(req, res)) {
    sendJson(res, 403, {
      error: "Guide update submission is not authorized from this origin.",
    });
    return;
  }

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const route = getRoute(req);
  if (route.startsWith("/auth/")) res.set("Cache-Control", "no-store");

  try {
    if (route === "/auth/discord/callback") {
      await handleDiscordCallback(req, res);
      return;
    }

    if (route === "/auth/github/callback") {
      await handleGithubCallback(req, res);
      return;
    }

    if (route === "/auth/dev-session" && req.method === "POST") {
      handleDevSession(req, res);
      return;
    }

    if (route === "/" && req.method === "GET") {
      sendJson(res, 200, {
        ok: true,
        service: "pvme-guide-editor-pr",
        repo: REPO,
        baseBranch: BASE_BRANCH,
        mode: isDryRun() ? "dry-run" : "live",
        githubAppConfigured: Boolean(
          process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY,
        ),
        discordConfigured: Boolean(
          process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET,
        ),
        githubOAuthConfigured: Boolean(
          getGithubOAuthClientId() && getGithubOAuthClientSecret(),
        ),
        submitSecretConfigured: Boolean(process.env.PVME_SUBMIT_SECRET),
        trustedOrigins: getTrustedOrigins(),
      });
      return;
    }

    if (route === "/auth/discord/start" && req.method === "GET") {
      enforceRateLimit(req, "auth:start", 10, 10 * 60);
      handleDiscordStart(req, res);
      return;
    }

    if (route === "/auth/github/start" && req.method === "GET") {
      enforceRateLimit(req, "auth:start", 10, 10 * 60);
      handleGithubStart(req, res);
      return;
    }

    validateRequestAccess(req);

    if (route === "/auth/me" && req.method === "GET") {
      sendJson(res, 200, { user: publicUser(getSessionUser(req)) });
      return;
    }

    if (route === "/auth/logout" && req.method === "POST") {
      const user = getSessionUser(req);
      if (user) validateCsrfToken(req, user, { allowTrustedOriginFallback: true });
      clearSessionCookie(res);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (route === "/guides/load" && req.method === "GET") {
      await handleLoadGuide(req, res);
      return;
    }

    if (route.startsWith("/reviews/pulls")) {
      await handleReviewRoute(req, res, route);
      return;
    }

    if (
      (route === "/" || route === "/submit-guide-update" || route === "/v2/submissions") &&
      req.method === "POST"
    ) {
      await handleSubmitGuideUpdate(req, res, route === "/v2/submissions");
      return;
    }

    sendJson(res, 404, { error: "Route not found." });
  } catch (err) {
    const status = err.status || 500;
    const message =
      status === 500 ? "Guide update submission failed." : err.message;

    if (status === 500) {
      console.error(err);
    }

    sendJson(res, status, {
      error: message,
      ...(err.code ? { code: err.code } : {}),
    });
  }
};

async function handleSubmitGuideUpdate(req, res, strict = false) {
  res.set("Cache-Control", "no-store");
  // Capture once. Every authorization, client, branch and author uses this session.
  const user = requirePvmeMemberSession(req);
  if (!strict && ["contractVersion", "expectedContributor", "expectedReview"].some(key =>
    Object.prototype.hasOwnProperty.call(req.body || {}, key))) {
    throw contractError("STRICT_ROUTE_REQUIRED", "Strict submissions must use /v2/submissions.");
  }
  try {
    validateCsrfToken(req, user, { allowTrustedOriginFallback: !strict });
  } catch (err) {
    if (strict) err.code = "CSRF_INVALID";
    throw err;
  }
  const payload = normalizePayload(req.body);

  const [owner, repo] = REPO.split("/");
  const reviewBranch = createReviewBranchNameForUser(user, payload.path);
  const contributor = contributorIdentity(user);
  if (strict) validateStrictSubmission(req.body, payload, contributor, reviewBranch, user);
  validatePayload(payload);
  validateSubmissionSource(payload, reviewBranch);

  if (isDryRun()) {
    sendJson(res, 200, {
      dryRun: true,
      message:
        "Guide update payload passed validation. No GitHub changes were made.",
      path: payload.path,
      title: payload.title || `Update ${payload.path}`,
      user: publicUser(user),
      contentBytes: Buffer.byteLength(payload.content, "utf8"),
      originalContentBytes: Buffer.byteLength(payload.originalContent, "utf8"),
      source: payload.source,
      branch: payload.branch,
      reviewBranch,
      ...(strict ? { contractVersion: 2, contributor, reviewStateVerified: false } : {}),
    });
    return;
  }

  const github = await createSubmitGithubClient(user, owner, repo);
  const baseRef = await github(`/repos/${owner}/${repo}/git/ref/heads/${BASE_BRANCH}`);
  const baseSha = baseRef.object.sha;
  // Read and check consent before ensureGithubFork can create anything.
  const writeRepo = strict ? getReviewWriteRepo(user, owner, repo)
    : await getSubmissionWriteRepo(github, user, owner, repo);
  const head = writeRepo.owner === owner
    ? reviewBranch
    : `${writeRepo.owner}:${reviewBranch}`;
  const branchRef = await getBranchRef(github, writeRepo.owner, writeRepo.repo, reviewBranch);
  const existingPr = (branchRef || strict)
    ? await getOpenPullRequest(github, owner, repo, reviewBranch, writeRepo.owner)
    : null;
  if (strict) assertReviewState(payload.expectedReview,
    reviewState(branchRef, existingPr, writeRepo, reviewBranch));
  const staleReviewBranch = Boolean(branchRef && !existingPr);
  let resetReviewBranchFromBase = !branchRef || staleReviewBranch;

  if (payload.source === "master") {
    const currentMasterFile = await getFile(
      github,
      owner,
      repo,
      payload.path,
      baseSha,
    );

    if (currentMasterFile.text !== payload.originalContent) {
      throw (strict ? submissionConflict() : httpError(
        409,
        "This guide has changed since it was loaded. You must reload the guide and apply your edits again to submit a guide update.",
      ));
    }

    if (existingPr && !payload.replaceExistingReview) {
      throw (strict ? submissionConflict() : httpError(
        409,
        "This will replace your existing submitted update with this version based on the live guide.",
      ));
    }

    if (existingPr && payload.replaceExistingReview) {
      resetReviewBranchFromBase = true;
    }
  } else if (payload.source === "user-pr") {
    if (!branchRef || staleReviewBranch) {
      throw httpError(
        409,
        "Your existing submitted update could not be found. Reload the live guide and try again.",
      );
    }

    const currentReviewFile = await getFile(
      github,
      writeRepo.owner,
      writeRepo.repo,
      payload.path,
      branchRef.object.sha,
    );

    if (currentReviewFile.text !== payload.originalContent) {
      throw (strict ? submissionConflict() : httpError(
        409,
        "Your submitted update has changed since it was loaded. You must reload it and apply your edits again to submit a guide update.",
      ));
    }
  }

  // Build from immutable snapshots. Publish only a child of the captured head:
  // a concurrent sibling commit makes the non-force ref update fail atomically.
  const parentSha = branchRef?.object.sha || baseSha;
  const treeSourceSha = resetReviewBranchFromBase ? baseSha : parentSha;
  const treeSourceOwner = resetReviewBranchFromBase ? owner : writeRepo.owner;
  const snapshot = await getFile(github, treeSourceOwner, repo, payload.path, treeSourceSha);
  if (snapshot.text !== payload.originalContent) throw submissionConflict();
  const treeSource = await github(`/repos/${treeSourceOwner}/${repo}/git/commits/${treeSourceSha}`);
  if (strict) {
    await recheckReviewState(github, owner, repo, writeRepo, reviewBranch, payload.expectedReview);
    if (user.provider === "github") await ensureGithubFork(github, owner, repo, user.githubLogin);
  }
  const tree = await github(`/repos/${writeRepo.owner}/${writeRepo.repo}/git/trees`, {
    method: "POST",
    body: {
      base_tree: treeSource.tree.sha,
      tree: [{
        path: payload.path,
        mode: "100644",
        type: "blob",
        content: payload.sourcePreservation === "exact"
          ? payload.content
          : preserveLineEndings(payload.content, snapshot.text),
      }],
    },
  });
  const author = createCommitAuthor(user);
  const commit = await github(`/repos/${writeRepo.owner}/${writeRepo.repo}/git/commits`, {
    method: "POST",
    body: {
      message: createCommitMessage(payload, user),
      tree: tree.sha,
      // Explicit replacement uses the chosen master tree, without merging text.
      // Record master ancestry so upstream changes are not shown as contributor edits.
      parents: resetReviewBranchFromBase && branchRef && parentSha !== baseSha
        ? [parentSha, baseSha] : [parentSha],
      ...(author ? { author } : {}),
    },
  });
  // Recheck upstream immediately before publishing a master-based submission.
  // Later upstream changes remain normal PR divergence, never overwritten master.
  if (payload.source === "master") {
    const latest = await getFile(github, owner, repo, payload.path, BASE_BRANCH);
    if (latest.text !== payload.originalContent) throw submissionConflict();
  }
  if (strict) await recheckReviewState(github, owner, repo, writeRepo, reviewBranch, payload.expectedReview);
  try {
    await setSubmissionReviewBranch(github, user, writeRepo, reviewBranch,
      commit.sha, Boolean(branchRef), baseSha);
  } catch (err) {
    if ([409, 422].includes(err.status) && !err.code) throw submissionConflict();
    throw err;
  }

  const openPr =
    strict ? existingPr : existingPr || (await getOpenPullRequest(github, owner, repo, reviewBranch, writeRepo.owner));
  // Detect PR closure/replacement after ref publication. A conflict here may
  // already have published source; refs and PR metadata are not transactional.
  if (strict) {
    const currentPr = await getOpenPullRequest(github, owner, repo, reviewBranch, writeRepo.owner);
    assertReviewPrIdentity(payload.expectedReview, currentPr);
  }
  const prTitle = payload.title || `Update ${payload.path}`;
  const prBody = createPullRequestBody(payload, user, openPr?.body || "");
  const pr = openPr
    ? await github(`/repos/${owner}/${repo}/pulls/${openPr.number}`, {
        method: "PATCH",
        body: {
          title: prTitle,
          body: prBody,
        },
      })
    : await github(`/repos/${owner}/${repo}/pulls`, {
        method: "POST",
        body: {
          title: prTitle,
          head,
          base: BASE_BRANCH,
          body: prBody,
        },
      });

  sendJson(res, openPr ? 200 : 201, {
    prUrl: pr.html_url,
    branch: reviewBranch,
    path: payload.path,
    reusedReview: Boolean(openPr),
    ...(strict ? { contractVersion: 2, contributor } : {}),
  });
}

async function handleLoadGuide(req, res) {
  res.set("Cache-Control", "no-store");
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
      dryRun: true,
      reviewState: { state: "unverified" },
    });
    return;
  }

  if (isDryRun() && source === "review") {
    throw httpError(404, "Review drafts cannot be loaded in dry-run mode.");
  }

  const [owner, repo] = REPO.split("/");
  const github = user?.provider === "github"
    ? createGithubClient(user.githubToken)
    : await createGithubAppInstallationClient(owner, repo);
  let existingReview = null;

  if (user) {
    const reviewBranch = createReviewBranchNameForUser(user, path);
    const writeRepo = getReviewWriteRepo(user, owner, repo);
    const branchRef = await getBranchRef(github, writeRepo.owner, writeRepo.repo, reviewBranch);
    const openPr = await getOpenPullRequest(github, owner, repo, reviewBranch, writeRepo.owner);
    const version = reviewState(branchRef, openPr, writeRepo, reviewBranch);

    if (branchRef && openPr) {
      existingReview = {
        reviewBranch,
        writeRepo,
        prUrl: openPr.html_url,
        version,
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
      baseBranch: BASE_BRANCH,
      reviewState: existingReview.version,
    });
    return;
  }

  if (source === "review") {
    if (!user || !existingReview) {
      throw httpError(404, "No submitted update was found for this guide.");
    }

    const reviewFile = await getFile(
      github,
      existingReview.writeRepo.owner,
      existingReview.writeRepo.repo,
      path,
      existingReview.version.headSha,
    );
    sendJson(
      res,
      200,
      createLoadedGuide({
        path,
        text: reviewFile.text,
        source: "user-pr",
        branch: existingReview.reviewBranch,
        prUrl: existingReview.prUrl,
        reviewState: existingReview.version,
      }),
    );
    return;
  }

  const masterFile = await getFile(github, owner, repo, path, BASE_BRANCH);
  const loadedGuide = createLoadedGuide({
    path,
    text: masterFile.text,
    source: "master",
    branch: BASE_BRANCH,
    prUrl: "",
    reviewState: existingReview?.version || { state: "none" },
  });

  if (existingReview) {
    loadedGuide.existingReviewBranch = existingReview.reviewBranch;
    loadedGuide.existingReviewUrl = existingReview.prUrl;
  }

  sendJson(res, 200, loadedGuide);
}

async function handleReviewRoute(req, res, route) {
  const user = requireReviewerSession(req);
  enforceRateLimit(req, `review:${user.githubId}`, 120, 60);
  if (["POST", "PUT"].includes(req.method)) {
    validateCsrfToken(req, user);
    if (isDryRun()) throw httpError(403, "Reviewer writes are disabled in dry-run mode.");
  }
  const github = createGithubClient(user.githubToken);
  const [owner, repo] = REPO.split("/");
  const match = route.match(/^\/reviews\/pulls(?:\/(\d+))?(?:\/([^/]+))?$/);

  if (!match) {
    throw httpError(404, "Review route not found.");
  }

  const prNumber = match[1] ? Number(match[1]) : null;
  const action = match[2] || "";

  if (!prNumber && !action && req.method === "GET") {
    sendJson(res, 200, {
      pulls: await listReviewPulls(github, owner, repo),
    });
    return;
  }

  if (!prNumber) {
    throw httpError(404, "Review pull request not found.");
  }

  if (!action && req.method === "GET") {
    sendJson(res, 200, await getReviewPullDetail(github, owner, repo, prNumber));
    return;
  }

  if (action === "checks" && req.method === "GET") {
    sendJson(res, 200, await getReviewPullChecks(github, owner, repo, prNumber));
    return;
  }

  if (action === "comment" && req.method === "POST") {
    const body = normalizeReviewText(req.body, "Comment");
    const comment = await github(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
      method: "POST",
      body: { body },
    });
    sendJson(res, 201, { url: comment.html_url });
    return;
  }

  if (action === "review" && req.method === "POST") {
    const event = String(req.body?.event || "").toUpperCase();
    if (!["APPROVE", "COMMENT", "REQUEST_CHANGES"].includes(event)) {
      throw httpError(400, "Review action is invalid.");
    }

    const body = normalizeReviewText(
      req.body,
      event === "APPROVE" ? "Review note" : "Review comment",
      event === "APPROVE",
    );
    const review = await github(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
      method: "POST",
      body: { event, body },
    });
    sendJson(res, 201, { url: review.html_url });
    return;
  }

  if (action === "file" && req.method === "PUT") {
    sendJson(res, 200, await updateReviewPullFile(github, user, owner, repo, prNumber, req.body));
    return;
  }

  if (action === "merge" && req.method === "POST") {
    const pr = await getReviewPull(github, owner, repo, prNumber);
    await validateReviewPullCanMerge(github, pr);
    const { result: merge, actor } = await mergeReviewPullWithFallback(
      github,
      owner,
      repo,
      pr,
    );
    sendJson(res, 200, {
      merged: merge.merged === true,
      message: merge.message || "",
      sha: merge.sha || "",
      actor,
    });
    return;
  }

  if (action === "close" && req.method === "POST") {
    const reason = normalizeReviewText(req.body, "Close reason");
    const pr = await getReviewPull(github, owner, repo, prNumber);
    const { comment, closed, actor } = await closeReviewPullWithFallback(
      github,
      user,
      owner,
      repo,
      pr,
      reason,
    );
    sendJson(res, 200, {
      closed: closed.state === "closed",
      number: pr.number,
      url: closed.html_url || pr.html_url || "",
      commentUrl: comment.html_url || "",
      actor,
    });
    return;
  }

  throw httpError(404, "Review route not found.");
}

function handleDiscordStart(req, res) {
  requireDiscordConfig();

  const redirectUri = getDiscordRedirectUri(req);
  const returnTo = getSafeReturnTo(req);
  const state = createOAuthState(res, "discord", { returnTo, redirectUri });

  const params = new URLSearchParams({
    client_id: getDiscordClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DISCORD_OAUTH_SCOPE,
    state,
  });

  res.redirect(`${DISCORD_AUTHORIZE_URL}?${params}`);
}

async function handleDiscordCallback(req, res) {
  requireDiscordConfig();
  enforceRateLimit(req, "auth:callback", 20, 10 * 60);

  if (req.query.error) {
    redirectAuthFailure(
      req,
      res,
      "Discord login was cancelled. You must log in with Discord to submit a guide update.",
    );
    return;
  }

  const code = String(req.query.code || "");
  const state = readOAuthState(req, "discord");
  if (!code || !state) {
    redirectAuthFailure(req, res, "Discord login could not be verified.");
    return;
  }
  clearOAuthState(res, "discord");

  const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: getDiscordClientId(),
      client_secret: getDiscordClientSecret(),
      grant_type: "authorization_code",
      code,
      redirect_uri: state.redirectUri,
    }),
  });
  const tokenData = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok || !tokenData.access_token) {
    console.warn(
      "Discord OAuth token exchange failed:",
      getDiscordOAuthError(tokenData) || tokenRes.status,
    );
    redirectAuthFailure(req, res, "Discord login could not be verified.");
    return;
  }

  const userRes = await fetch(`${DISCORD_API}/users/@me`, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });
  const discordUser = await userRes.json().catch(() => ({}));

  if (!userRes.ok || !discordUser.id) {
    redirectAuthFailure(req, res, "Discord login could not be verified.");
    return;
  }

  const guildMember = await fetchPvmeGuildMember(tokenData.access_token);

  if (!guildMember.ok) {
    if (guildMember.notMember) {
      redirectAuthFailure(
        req,
        res,
        "You must be a member of the PvME Discord server to submit guide changes.",
      );
      return;
    }

    redirectAuthFailure(req, res, "Discord login could not be verified.");
    return;
  }

  setSessionCookie(res, {
    provider: "discord",
    csrfToken: createSessionCsrfToken(),
    discordId: String(discordUser.id),
    username: String(discordUser.username || ""),
    globalName: discordUser.global_name ? String(discordUser.global_name) : "",
    avatar: discordUser.avatar ? String(discordUser.avatar) : "",
    pvmeMember: true,
    pvmeGuildId: PVME_GUILD_ID,
    pvmeRoles: getSessionRoles(guildMember.member),
    exp: nowSeconds() + SESSION_MAX_AGE_SECONDS,
  });

  res.redirect(state.returnTo || getFrontendOrigin(req));
}

function handleGithubStart(req, res) {
  requireGithubOAuthConfig();

  const redirectUri = getGithubRedirectUri(req);
  const returnTo = getSafeReturnTo(req);
  const state = createOAuthState(res, "github", { returnTo, redirectUri });

  const params = new URLSearchParams({
    client_id: getGithubOAuthClientId(),
    redirect_uri: redirectUri,
    scope: GITHUB_OAUTH_SCOPE,
    state,
  });

  res.redirect(`${GITHUB_AUTHORIZE_URL}?${params}`);
}

async function handleGithubCallback(req, res) {
  requireGithubOAuthConfig();
  enforceRateLimit(req, "auth:callback", 20, 10 * 60);

  if (req.query.error) {
    redirectAuthFailure(
      req,
      res,
      "GitHub login was cancelled. You must log in to submit a guide update.",
    );
    return;
  }

  const code = String(req.query.code || "");
  const state = readOAuthState(req, "github");
  if (!code || !state) {
    redirectAuthFailure(req, res, "GitHub login could not be verified.");
    return;
  }
  clearOAuthState(res, "github");

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: getGithubOAuthClientId(),
      client_secret: getGithubOAuthClientSecret(),
      code,
      redirect_uri: state.redirectUri,
    }),
  });
  const tokenData = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok || !tokenData.access_token) {
    console.warn(
      "GitHub OAuth token exchange failed:",
      tokenData.error || tokenRes.status,
    );
    redirectAuthFailure(req, res, "GitHub login could not be verified.");
    return;
  }

  const githubUserRes = await fetch(`${GITHUB_API}/user`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "pvme-guide-editor",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const githubUser = await githubUserRes.json().catch(() => ({}));

  if (!githubUserRes.ok || !githubUser.id || !githubUser.login) {
    redirectAuthFailure(req, res, "GitHub login could not be verified.");
    return;
  }

  const session = {
    provider: "github",
    csrfToken: createSessionCsrfToken(),
    githubId: String(githubUser.id),
    githubLogin: String(githubUser.login || ""),
    username: String(githubUser.login || ""),
    globalName: githubUser.name ? String(githubUser.name) : "",
    avatar: githubUser.avatar_url ? String(githubUser.avatar_url) : "",
    githubToken: String(tokenData.access_token),
    githubScopes: parseGithubOAuthScopes(tokenData.scope),
    exp: nowSeconds() + SESSION_MAX_AGE_SECONDS,
  };
  session.canReviewPrs = isReviewerUser(session);

  if (isLocalReturnTo(state.returnTo)) {
    const returnUrl = new URL(state.returnTo);
    returnUrl.searchParams.set("githubSession", createDevSessionToken(session, returnUrl.origin));
    res.redirect(returnUrl.toString());
    return;
  }

  setSessionCookie(res, session);

  res.redirect(state.returnTo || getFrontendOrigin(req));
}

function handleDevSession(req, res) {
  validateRequestAccess(req);
  if (!isDryRun() || !getProxyOrigin(req)) throw httpError(403, "Development sessions require a local dry-run proxy.");
  const token = String(req.body?.token || "");
  const session = verifyDevSessionToken(token, getProxyOrigin(req));

  if (!session) {
    throw httpError(400, "GitHub login could not be verified.");
  }

  setSessionCookie(res, {
    ...session,
    exp: nowSeconds() + SESSION_MAX_AGE_SECONDS,
  });
  sendJson(res, 200, { user: publicUser(session) });
}

async function fetchPvmeGuildMember(accessToken) {
  const memberRes = await fetch(
    `${DISCORD_API}/v10/users/@me/guilds/${PVME_GUILD_ID}/member`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if ([401, 403, 404].includes(memberRes.status)) {
    return { ok: false, notMember: true };
  }

  if (!memberRes.ok) {
    console.warn(
      "Discord PvME guild membership check failed:",
      memberRes.status,
    );
    return { ok: false, notMember: false };
  }

  const member = await memberRes.json().catch(() => ({}));
  return { ok: true, member };
}

function getSessionRoles(member) {
  if (!Array.isArray(member?.roles)) {
    return [];
  }

  return member.roles.map(String).filter(Boolean).slice(0, MAX_SESSION_ROLES);
}

function createOAuthState(res, provider, data) {
  const nonce = crypto.randomBytes(32).toString("base64url");
  res.set("Set-Cookie", serializeCookie(`pvme_oauth_${provider}`, nonce, {
    httpOnly: true, secure: isCookieSecure(), sameSite: "Lax", path: "/",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  }));
  res.set("Cache-Control", "no-store");
  return signJson({ ...data, provider, nonce, exp: nowSeconds() + OAUTH_STATE_MAX_AGE_SECONDS });
}

function readOAuthState(req, provider) {
  const state = verifySignedJson(String(req.query.state || ""));
  const nonce = parseCookies(req.get("cookie") || "")[`pvme_oauth_${provider}`] || "";
  if (!state || state.provider !== provider || !Number.isFinite(state.exp)
    || state.exp <= nowSeconds() || !state.redirectUri || !state.nonce
    || !secureCompare(nonce, state.nonce)) return null;
  return state;
}

function clearOAuthState(res, provider) {
  res.append("Set-Cookie", serializeCookie(`pvme_oauth_${provider}`, "", {
    httpOnly: true, secure: isCookieSecure(), sameSite: "Lax", path: "/", maxAge: 0,
  }));
}

function redirectAuthFailure(req, res, message) {
  const provider = getRoute(req).includes("/github/") ? "github" : "discord";
  const state = readOAuthState(req, provider);
  const fallback = getFrontendOrigin(req);
  const candidate = state?.returnTo || fallback;
  let redirectUrl;
  try { redirectUrl = new URL(candidate, fallback); } catch { redirectUrl = new URL(fallback); }
  if (redirectUrl.username || redirectUrl.password ||
      !(getTrustedOrigins().includes(redirectUrl.origin) || isLocalReturnTo(redirectUrl.toString()))) {
    redirectUrl = new URL(fallback);
  }
  clearOAuthState(res, provider);
  redirectUrl.searchParams.set("submit", "1");
  redirectUrl.searchParams.set("authError", message);
  res.redirect(redirectUrl.toString());
}

function createLoadedGuide({ path, text, source, branch, prUrl, reviewState }) {
  return {
    path,
    name: guideNameFromPath(path),
    repo: REPO,
    source,
    branch,
    baseBranch: BASE_BRANCH,
    prUrl,
    originalText: text,
    reviewState,
  };
}

function submissionConflict() {
  const err = httpError(409, "The guide or review branch changed during submission. Keep your draft and reload the source before trying again.");
  err.code = "SOURCE_CONFLICT";
  return err;
}

function contractError(code, message, status = 400) {
  const err = httpError(status, message);
  err.code = code;
  return err;
}

function contributorIdentity(user) {
  return user.provider === "github" ? `github:${user.githubId}` : `discord:${user.discordId}`;
}

const REVIEW_VERSION_KEYS = ["state", "repository", "branch", "headSha", "prId", "prNumber", "prUrl"];
function validReviewVersion(value) {
  return value && !Array.isArray(value) && value.state === "present"
    && Object.keys(value).length === REVIEW_VERSION_KEYS.length
    && REVIEW_VERSION_KEYS.every(key => Object.prototype.hasOwnProperty.call(value, key))
    && typeof value.repository === "string" && typeof value.branch === "string"
    && typeof value.headSha === "string" && /^[a-f0-9]{40}$/.test(value.headSha)
    && Number.isSafeInteger(value.prId) && value.prId > 0
    && Number.isSafeInteger(value.prNumber) && value.prNumber > 0
    && value.prUrl === `https://github.com/${REPO}/pull/${value.prNumber}`;
}

function validateStrictSubmission(body, payload, contributor, branch, user) {
  if (body.contractVersion !== 2) throw contractError("INVALID_CONTRACT", "contractVersion must be 2.");
  if (typeof payload.expectedContributor !== "string"
    || !/^(github|discord):[1-9]\d*$/.test(payload.expectedContributor)) {
    throw contractError("INVALID_CONTRIBUTOR", "A provider-qualified expectedContributor is required.");
  }
  if (payload.expectedContributor !== contributor) {
    throw contractError("CONTRIBUTOR_MISMATCH", "Your account changed. Keep your draft and sign in with the expected contributor.", 409);
  }
  if (!["type", "repo", "baseBranch", "path", "content", "originalContent", "notes", "source", "branch"]
    .every(key => typeof body[key] === "string")
    || (body.title !== undefined && typeof body.title !== "string")
    || (body.existingReviewBranch !== undefined && typeof body.existingReviewBranch !== "string")) {
    throw contractError("INVALID_CONTRACT", "Strict submission fields must use their documented types.");
  }
  if (body.sourcePreservation !== "exact" || typeof body.replaceExistingReview !== "boolean") {
    throw contractError("INVALID_CONTRACT", "Strict submissions require exact source preservation and boolean replacement consent.");
  }
  const expected = payload.expectedReview;
  const emptyState = expected && !Array.isArray(expected) && Object.keys(expected).length === 1
    && (expected.state === "none" || (isDryRun() && expected.state === "unverified"));
  const [owner, repo] = REPO.split("/");
  const writeRepo = getReviewWriteRepo(user, owner, repo);
  if (!emptyState && !(validReviewVersion(expected) && expected.branch === branch
    && expected.repository === `${writeRepo.owner}/${writeRepo.repo}`)) {
    throw contractError("INVALID_REVIEW_STATE", "An explicit expectedReview version or no-review assertion is required.");
  }
  if (payload.source === "user-pr" && expected.state !== "present") {
    throw contractError("INVALID_REVIEW_STATE", "Review-source updates require an existing review version.");
  }
  if (payload.source === "master" && expected.state === "present" && !payload.replaceExistingReview) {
    throw contractError("REPLACEMENT_CONSENT_REQUIRED", "Confirm replacement of the loaded review before submitting.", 409);
  }
  if (payload.replaceExistingReview && (payload.source !== "master" || expected.state !== "present")) {
    throw contractError("INVALID_REVIEW_STATE", "Replacement consent must identify an existing review on a master-source update.");
  }
}

function reviewConflict() {
  return contractError("REVIEW_STATE_CONFLICT", "Your review changed or is no longer available. Keep your draft, reload the source and obtain fresh replacement consent.", 409);
}

function reviewState(branchRef, pr, writeRepo, branch) {
  if (!pr) return { state: "none" };
  const version = {
    state: "present", repository: `${writeRepo.owner}/${writeRepo.repo}`, branch,
    headSha: branchRef?.object?.sha, prId: pr.id, prNumber: pr.number, prUrl: pr.html_url,
  };
  // PR metadata and refs are separate resources: fail closed on inconsistent reads.
  if (!validReviewVersion(version) || pr.state !== "open" || pr.head?.sha !== version.headSha
    || pr.head?.ref !== branch || pr.head?.repo?.full_name !== version.repository
    || pr.base?.ref !== BASE_BRANCH || pr.base?.repo?.full_name !== REPO) throw reviewConflict();
  return version;
}

function assertReviewState(expected, actual) {
  const keys = expected.state === "present" ? REVIEW_VERSION_KEYS : ["state"];
  if (keys.some(key => expected[key] !== actual[key])) throw reviewConflict();
}

function assertReviewPrIdentity(expected, pr) {
  if (expected.state === "none") {
    if (pr) throw reviewConflict();
  } else if (!pr || pr.state !== "open" || pr.id !== expected.prId
    || pr.number !== expected.prNumber || pr.html_url !== expected.prUrl
    || pr.head?.ref !== expected.branch || pr.head?.repo?.full_name !== expected.repository
    || pr.base?.ref !== BASE_BRANCH || pr.base?.repo?.full_name !== REPO) throw reviewConflict();
}

async function recheckReviewState(github, owner, repo, writeRepo, branch, expected) {
  const ref = await getBranchRef(github, writeRepo.owner, writeRepo.repo, branch);
  const pr = await getOpenPullRequest(github, owner, repo, branch, writeRepo.owner);
  assertReviewState(expected, reviewState(ref, pr, writeRepo, branch));
}

function preserveLineEndings(content, existingContent) {
  // Keep exact patches (including mixed endings). Legacy CodeMirror LF output
  // still inherits the EOL of a uniformly CRLF original.
  if (content.includes("\r") || /(?<!\r)\n/.test(existingContent) || /\r(?!\n)/.test(existingContent)) return content;
  const lineEnding = existingContent.includes("\r\n") ? "\r\n" : "\n";
  return content.replace(/\r\n/g, "\n").replace(/\n/g, lineEnding);
}

function normalizePayload(body) {
  if (!body || typeof body !== "object") {
    throw httpError(400, "Request body must be JSON.");
  }

  return {
    expectedContributor: body.expectedContributor,
    expectedReview: body.expectedReview && typeof body.expectedReview === "object"
      ? { ...body.expectedReview } : body.expectedReview,
    sourcePreservation: body.sourcePreservation,
    type: String(body.type || ""),
    repo: String(body.repo || ""),
    baseBranch: String(body.baseBranch || ""),
    path: String(body.path || ""),
    content: typeof body.content === "string" ? body.content : null,
    originalContent:
      typeof body.originalContent === "string" ? body.originalContent : null,
    title: String(body.title || "").trim(),
    notes: String(body.notes || "").trim(),
    source: String(body.source || ""),
    branch: String(body.branch || ""),
    existingReviewBranch: String(body.existingReviewBranch || ""),
    replaceExistingReview: body.replaceExistingReview === true,
  };
}

function validatePayload(payload) {
  if (payload.sourcePreservation !== undefined && payload.sourcePreservation !== "exact") {
    throw httpError(400, "The source preservation mode is invalid.");
  }
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
    throw httpError(
      400,
      "You must make a guide change to submit a guide update.",
    );
  }

  if (Buffer.byteLength(payload.content, "utf8") > MAX_CONTENT_BYTES) {
    throw httpError(413, "Guide content is too large.");
  }

  if (Buffer.byteLength(payload.originalContent, "utf8") > MAX_CONTENT_BYTES) {
    throw httpError(413, "Original guide content is too large.");
  }

  if (payload.title.length > MAX_TITLE_CHARS) {
    throw httpError(
      400,
      `Update title must be ${MAX_TITLE_CHARS} characters or fewer.`,
    );
  }

  if (!payload.notes) {
    throw httpError(
      400,
      "You must describe what changed to submit a guide update.",
    );
  }

  if (payload.notes.length > MAX_NOTES_CHARS) {
    throw httpError(
      400,
      `Update summary must be ${MAX_NOTES_CHARS} characters or fewer.`,
    );
  }
}

function validateSubmissionSource(payload, reviewBranch) {
  if (payload.source === "master") {
    if (payload.branch !== BASE_BRANCH) {
      throw httpError(400, "The loaded guide source is invalid.");
    }

    if (
      payload.existingReviewBranch &&
      payload.existingReviewBranch !== reviewBranch
    ) {
      throw httpError(403, "You cannot replace another user's review branch.");
    }

    return;
  }

  if (payload.source === "user-pr") {
    if (payload.branch !== reviewBranch) {
      throw httpError(
        403,
        "You cannot submit against another user's review branch.",
      );
    }

    return;
  }

  throw httpError(400, "The loaded guide source is invalid.");
}

async function listReviewPulls(github, owner, repo) {
  const params = new URLSearchParams({
    state: "open",
    base: BASE_BRANCH,
    per_page: String(MAX_REVIEW_PRS),
    sort: "updated",
    direction: "desc",
  });
  const pulls = await github(`/repos/${owner}/${repo}/pulls?${params}`);
  const results = [];

  for (const pr of Array.isArray(pulls) ? pulls : []) {
    const files = await github(`/repos/${owner}/${repo}/pulls/${pr.number}/files?per_page=100`);
    const guideFiles = files
      .filter((file) => isSafeGuidePath(file.filename || ""))
      .map((file) => summarizeReviewFile(file));
    const fallbackGuideFile = getGuidePathFromPullBody(pr);

    if (guideFiles.length === 0 && !fallbackGuideFile) continue;

    results.push({
      number: pr.number,
      title: pr.title || "",
      url: pr.html_url || "",
      author: pr.user?.login || "",
      draft: pr.draft === true,
      updatedAt: pr.updated_at || "",
      headOwner: pr.head?.repo?.owner?.login || pr.head?.user?.login || "",
      headRepo: pr.head?.repo?.name || "",
      headBranch: pr.head?.ref || "",
      headSha: pr.head?.sha || "",
      guideFiles: guideFiles.length > 0
        ? guideFiles
        : [{
          path: fallbackGuideFile,
          status: "unchanged",
          additions: 0,
          deletions: 0,
          changes: 0,
          patch: "",
        }],
      otherFilesCount: files.length - guideFiles.length,
    });
  }

  return results;
}

async function getReviewPullDetail(github, owner, repo, prNumber) {
  const pr = await getReviewPull(github, owner, repo, prNumber);
  const files = await github(`/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`);
  const guideFiles = [];
  const otherFiles = [];
  const fallbackGuideFile = getGuidePathFromPullBody(pr);

  for (const file of files) {
    if (!isSafeGuidePath(file.filename || "")) {
      otherFiles.push(summarizeReviewFile(file));
      continue;
    }

    const status = String(file.status || "");
    const basePath = status === "renamed" && file.previous_filename
      ? file.previous_filename
      : file.filename;
    const headContent = status === "removed"
      ? ""
      : await getFileTextIfExists(github, pr.head.repo.owner.login, pr.head.repo.name, file.filename, pr.head.ref);
    const baseContent = status === "added"
      ? ""
      : await getFileTextIfExists(github, owner, repo, basePath, BASE_BRANCH);

    guideFiles.push({
      ...summarizeReviewFile(file),
      previousPath: file.previous_filename || "",
      baseContent,
      headContent,
      editable: status !== "removed",
    });
  }

  if (guideFiles.length === 0 && fallbackGuideFile) {
    const headContent = await getFileTextIfExists(
      github,
      pr.head.repo.owner.login,
      pr.head.repo.name,
      fallbackGuideFile,
      pr.head.ref,
    );
    const baseContent = await getFileTextIfExists(
      github,
      owner,
      repo,
      fallbackGuideFile,
      BASE_BRANCH,
    );

    guideFiles.push({
      path: fallbackGuideFile,
      status: "unchanged",
      additions: 0,
      deletions: 0,
      changes: 0,
      patch: "",
      previousPath: "",
      baseContent,
      headContent,
      editable: true,
    });
  }

  const checks = await getReviewPullChecksForPr(github, pr);

  return {
    pr: summarizeReviewPull(pr),
    files: guideFiles,
    otherFiles,
    checks,
  };
}

async function getReviewPullChecks(github, owner, repo, prNumber) {
  return {
    checks: await getReviewPullChecksForPr(github, await getReviewPull(github, owner, repo, prNumber)),
  };
}

async function getReviewPullChecksForPr(github, pr) {
  const baseRepoPath = `/repos/${REPO}`;
  const headRepoPath = `/repos/${pr.head.repo.owner.login}/${pr.head.repo.name}`;
  const statusPath = getGithubApiPath(pr.statuses_url)
    || `${baseRepoPath}/commits/${pr.head.sha}/status`;
  const [statuses, checkRuns] = await Promise.all([
    github(statusPath)
      .catch(() => github(`${headRepoPath}/commits/${pr.head.sha}/status`))
      .catch(() => ({ state: "unknown", statuses: [] })),
    github(`${baseRepoPath}/commits/${pr.head.sha}/check-runs`)
      .catch(() => github(`${headRepoPath}/commits/${pr.head.sha}/check-runs`))
      .catch(() => ({ check_runs: [] })),
  ]);
  const runs = Array.isArray(checkRuns.check_runs) ? checkRuns.check_runs : [];
  const statusItems = Array.isArray(statuses.statuses) ? statuses.statuses : [];
  const failingRun = runs.some((run) => ["failure", "cancelled", "timed_out", "action_required"].includes(run.conclusion));
  const pendingRun = runs.some((run) => run.status !== "completed");
  const failingStatus = statusItems.some((status) => ["failure", "error"].includes(status.state));
  const pendingStatus = statusItems.some((status) => ["pending"].includes(status.state));
  let state = "passing";

  if (failingRun || failingStatus) {
    state = "failing";
  } else if (pendingRun || pendingStatus) {
    state = "pending";
  } else if (runs.length === 0 && statusItems.length === 0) {
    state = "unknown";
  }

  return {
    state,
    headSha: pr.head.sha,
    statuses: statusItems.map((status) => ({
      context: status.context || "",
      state: status.state || "",
      description: status.description || "",
      url: status.target_url || "",
    })),
    checkRuns: runs.map((run) => ({
      name: run.name || "",
      status: run.status || "",
      conclusion: run.conclusion || "",
      url: run.html_url || "",
    })),
  };
}

function getGithubApiPath(url) {
  try {
    const parsed = new URL(String(url || ""));
    const api = new URL(GITHUB_API);
    if (parsed.origin !== api.origin || !parsed.pathname.startsWith(api.pathname)) {
      return "";
    }

    return `${parsed.pathname.slice(api.pathname.length - 1)}${parsed.search}`;
  } catch {
    return "";
  }
}

async function updateReviewPullFile(github, user, owner, repo, prNumber, body) {
  const pr = await getReviewPull(github, owner, repo, prNumber);
  const path = String(body?.path || "");
  const content = typeof body?.content === "string" ? body.content : null;
  const commitMessage = normalizeReviewCommitMessage(body);

  if (!isSafeGuidePath(path)) {
    throw httpError(400, "Review file path is invalid.");
  }

  if (content === null) {
    throw httpError(400, "Review file content is missing.");
  }

  if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) {
    throw httpError(413, "Review file content is too large.");
  }

  const files = await github(`/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`);
  const file = files.find((item) => item.filename === path && isSafeGuidePath(item.filename || ""));

  if (!file || file.status === "removed") {
    throw httpError(400, "This pull request file cannot be edited.");
  }

  const headOwner = pr.head.repo.owner.login;
  const headRepo = pr.head.repo.name;
  const fileSha = file.sha || "";
  const updatePath = `/repos/${headOwner}/${headRepo}/contents/${encodePath(path)}`;
  const updateBody = {
    message: createReviewCommitMessage(commitMessage),
    content: Buffer.from(content, "utf8").toString("base64"),
    ...(fileSha ? { sha: fileSha } : {}),
    branch: pr.head.ref,
  };
  const update = await updateReviewPullFileContent(github, updatePath, updateBody)
    .catch(async (err) => {
      if (err.status === 404 && pr.head?.repo?.full_name !== pr.base?.repo?.full_name) {
        return commitReviewPullFileWithGraphql(user, pr, path, content, commitMessage)
          .catch((graphqlErr) => {
            throw httpError(403, createForkPrUpdateError(user, graphqlErr));
          });
      }
      throw err;
    });

  return {
    path,
    sha: update.commit?.sha || "",
  };
}

async function mergeReviewPullWithFallback(github, owner, repo, pr) {
  try {
    return {
      result: await mergeReviewPullWithGithub(github, owner, repo, pr),
      actor: "user",
    };
  } catch (err) {
    if (!shouldFallbackToGithubApp(err)) {
      throw err;
    }

    console.warn("Reviewer OAuth merge failed; falling back to GitHub App:", err.status || "", err.message || err);
    const appGithub = await createGithubAppInstallationClient(owner, repo);
    return {
      result: await mergeReviewPullWithGithub(appGithub, owner, repo, pr),
      actor: "bot",
    };
  }
}

async function mergeReviewPullWithGithub(github, owner, repo, pr) {
  return github(`/repos/${owner}/${repo}/pulls/${pr.number}/merge`, {
    method: "PUT",
    body: {
      sha: pr.head.sha,
      merge_method: "squash",
    },
  });
}

async function closeReviewPullWithFallback(github, user, owner, repo, pr, reason) {
  let comment;

  try {
    comment = await commentReviewCloseWithGithub(github, user, owner, repo, pr, reason);
  } catch (err) {
    if (!shouldFallbackToGithubApp(err)) {
      throw err;
    }

    console.warn("Reviewer OAuth close comment failed; falling back to GitHub App:", err.status || "", err.message || err);
    const appGithub = await createGithubAppInstallationClient(owner, repo);
    comment = await commentReviewCloseWithGithub(appGithub, user, owner, repo, pr, reason);
    return {
      comment,
      closed: await closeReviewPullWithGithub(appGithub, owner, repo, pr),
      actor: "bot",
    };
  }

  try {
    return {
      comment,
      closed: await closeReviewPullWithGithub(github, owner, repo, pr),
      actor: "user",
    };
  } catch (err) {
    if (!shouldFallbackToGithubApp(err)) {
      throw err;
    }

    console.warn("Reviewer OAuth close failed; falling back to GitHub App:", err.status || "", err.message || err);
    const appGithub = await createGithubAppInstallationClient(owner, repo);
    return {
      comment,
      closed: await closeReviewPullWithGithub(appGithub, owner, repo, pr),
      actor: "bot",
    };
  }
}

async function commentReviewCloseWithGithub(github, user, owner, repo, pr, reason) {
  return github(`/repos/${owner}/${repo}/issues/${pr.number}/comments`, {
    method: "POST",
    body: {
      body: createReviewCloseComment(user, reason),
    },
  });
}

async function closeReviewPullWithGithub(github, owner, repo, pr) {
  return github(`/repos/${owner}/${repo}/pulls/${pr.number}`, {
    method: "PATCH",
    body: {
      state: "closed",
    },
  });
}

function shouldFallbackToGithubApp(err) {
  const message = String(err?.message || "");
  return (
    [401, 403, 404].includes(Number(err?.status)) ||
    /OAuth App access restrictions|Resource not accessible|not accessible by integration|must grant/i.test(message)
  );
}

async function commitReviewPullFileWithGraphql(user, pr, path, content, commitMessage) {
  const mutation = `
    mutation UpdatePullRequestBranchFile($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) {
        commit {
          oid
          url
        }
      }
    }
  `;

  const data = await githubGraphql(user.githubToken, mutation, {
    input: {
      branch: {
        repositoryNameWithOwner: pr.head.repo.full_name,
        branchName: pr.head.ref,
      },
      expectedHeadOid: pr.head.sha,
      message: {
        headline: commitMessage,
        body: "Reviewer edit via https://pvme.io/guide-editor/",
      },
      fileChanges: {
        additions: [{
          path,
          contents: Buffer.from(content, "utf8").toString("base64"),
        }],
      },
    },
  });

  return {
    commit: {
      sha: data.createCommitOnBranch?.commit?.oid || "",
    },
  };
}

function normalizeReviewCommitMessage(body) {
  const message = String(body?.commitMessage || "").trim().replace(/\s+/g, " ");

  if (!message) {
    throw httpError(400, "Describe what changed before committing to the PR.");
  }

  if (message.length > MAX_REVIEW_COMMIT_MESSAGE_CHARS) {
    throw httpError(400, `Commit message must be ${MAX_REVIEW_COMMIT_MESSAGE_CHARS} characters or fewer.`);
  }

  return message;
}

function createReviewCommitMessage(commitMessage) {
  return `${commitMessage}\n\nReviewer edit via https://pvme.io/guide-editor/`;
}

async function updateReviewPullFileContent(github, path, body) {
  return github(path, {
    method: "PUT",
    body,
  });
}

function createForkPrUpdateError(user, err) {
  const scopes = new Set(user.githubScopes || []);
  if (!scopes.has("repo")) {
    return "Please log in with GitHub again, then try again.";
  }

  const detail = err?.message ? ` GitHub said: ${err.message}` : "";
  return `GitHub would not allow the guide editor to update this contributor fork branch, even though the PR says maintainers can edit it.${detail}`;
}

async function validateReviewPullCanMerge(github, pr) {
  if (pr.draft === true) {
    throw httpError(409, "Draft pull requests cannot be merged from the guide editor.");
  }

  if (pr.mergeable === false || pr.mergeable_state === "dirty") {
    throw httpError(409, "This pull request has merge conflicts.");
  }

  const files = await github(`/repos/${REPO}/pulls/${pr.number}/files?per_page=100`);
  const otherFiles = files.filter((file) => !isSafeGuidePath(file.filename || ""));

  if (otherFiles.length > 0) {
    throw httpError(409, "This pull request changes non-guide files and must be merged on GitHub.");
  }

  const checks = await getReviewPullChecksForPr(github, pr);
  if (!["passing", "unknown"].includes(checks.state)) {
    throw httpError(409, `Checks are ${checks.state}. Merge from GitHub after checks pass.`);
  }
}

async function getReviewPull(github, owner, repo, prNumber) {
  const pr = await github(`/repos/${owner}/${repo}/pulls/${prNumber}`);

  if (pr.base?.repo?.full_name !== REPO || pr.base?.ref !== BASE_BRANCH || pr.state !== "open") {
    throw httpError(404, "Review pull request was not found.");
  }

  return pr;
}

function summarizeReviewPull(pr) {
  return {
    number: pr.number,
    title: pr.title || "",
    url: pr.html_url || "",
    author: pr.user?.login || "",
    draft: pr.draft === true,
    mergeable: pr.mergeable,
    mergeableState: pr.mergeable_state || "",
    updatedAt: pr.updated_at || "",
    headOwner: pr.head?.repo?.owner?.login || pr.head?.user?.login || "",
    headRepo: pr.head?.repo?.name || "",
    headBranch: pr.head?.ref || "",
    headSha: pr.head?.sha || "",
  };
}

function summarizeReviewFile(file) {
  return {
    path: file.filename || "",
    status: file.status || "",
    additions: Number(file.additions) || 0,
    deletions: Number(file.deletions) || 0,
    changes: Number(file.changes) || 0,
    patch: file.patch || "",
  };
}

function getGuidePathFromPullBody(pr) {
  const match = String(pr?.body || "").match(/Guide file:\s*`([^`]+)`/i);
  const path = match?.[1] || "";
  return isSafeGuidePath(path) ? path : "";
}

async function getFileTextIfExists(github, owner, repo, path, ref) {
  try {
    return (await getFile(github, owner, repo, path, ref)).text;
  } catch (err) {
    if (err.status === 404) return "";
    throw err;
  }
}

function normalizeReviewText(body, label, allowEmpty = false) {
  const text = String(body?.body ?? body?.reason ?? "").trim();

  if (!text && !allowEmpty) {
    throw httpError(400, `${label} is required.`);
  }

  return text;
}

function createReviewCloseComment(user, reason) {
  const reviewer = user?.githubLogin
    ? `@${user.githubLogin}`
    : userDisplayName(user);

  return [
    `Closed by ${reviewer} from https://pvme.io/guide-editor/.`,
    "",
    reason,
  ].join("\n");
}

function isSafeGuidePath(path) {
  return (
    Boolean(path) &&
    path.endsWith(".txt") &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.includes("..") &&
    !/[<>:"|?*\u0000-\u001f]/.test(path) &&
    path.split("/").every(part => part && part !== ".")
  );
}

async function getFile(github, owner, repo, path, ref) {
  const file = await github(
    `/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
  );

  if (file.type !== "file" || !file.sha || typeof file.content !== "string") {
    throw httpError(
      400,
      "The submitted path does not resolve to a guide file.",
    );
  }

  return {
    sha: file.sha,
    text: Buffer.from(file.content.replace(/\s/g, ""), "base64").toString(
      "utf8",
    ),
  };
}

async function getPublicMasterFile(path) {
  const res = await fetch(
    `https://raw.githubusercontent.com/${REPO}/${BASE_BRANCH}/${encodePath(path)}`,
  );

  if (!res.ok) {
    throw httpError(
      res.status,
      "The submitted path does not resolve to a guide file.",
    );
  }

  return res.text();
}

async function getBranchRef(github, owner, repo, branch) {
  try {
    return await github(
      `/repos/${owner}/${repo}/git/ref/heads/${encodeGitRef(branch)}`,
    );
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// GitHub's Git ref endpoint treats each slash-separated part of a branch name
// as a path segment. Encode the parts, but preserve the separating slashes.
function encodeGitRef(ref) {
  return ref.split("/").map(encodeURIComponent).join("/");
}

async function getOpenPullRequest(github, owner, repo, branch, headOwner = owner) {
  const params = new URLSearchParams({
    state: "open",
    head: `${headOwner}:${branch}`,
    base: BASE_BRANCH,
  });
  const prs = await github(`/repos/${owner}/${repo}/pulls?${params}`);

  return Array.isArray(prs) && prs.length > 0 ? prs[0] : null;
}

async function createSubmitGithubClient(user, owner, repo) {
  if (user.provider === "github") {
    if (!user.githubToken) {
      throw httpError(401, "Please log in with GitHub again, then try again.");
    }

    const scopes = new Set(user.githubScopes || []);
    if (!scopes.has("repo") && !scopes.has("public_repo")) {
      throw httpError(
        403,
        "Please log in with GitHub again, then try again.",
      );
    }

    return createGithubClient(user.githubToken);
  }

  return createGithubAppInstallationClient(owner, repo);
}

async function setSubmissionReviewBranch(github, user, writeRepo, branch, sha, exists, baseSha = sha) {
  const repoPath = `/repos/${writeRepo.owner}/${writeRepo.repo}`;
  try {
    await github(exists ? `${repoPath}/git/refs/heads/${encodeGitRef(branch)}` : `${repoPath}/git/refs`, {
      method: exists ? "PATCH" : "POST",
      body: exists ? { sha, force: false } : { ref: `refs/heads/${branch}`, sha },
    });
  } catch (err) {
    // Do not mistake every GitHub 404 for a workflow permission failure.
    // Diagnose only failed ref writes, and confirm a workflow mismatch first.
    if (user.provider === "github" && [403, 404, 422].includes(err.status)) {
      try {
        const [upstream, fork] = await Promise.all([
          getWorkflowFiles(github, REPO, baseSha),
          getWorkflowFiles(github, `${writeRepo.owner}/${writeRepo.repo}`, BASE_BRANCH),
        ]);
        if (upstream.size !== fork.size || [...upstream].some(([path, hash]) => fork.get(path) !== hash)) {
          const syncError = httpError(409,
            "GitHub could not prepare your review branch, and your fork has different workflow files from the current PvME repository. Open your fork on GitHub, choose Sync fork then Update branch, and retry this submission. If GitHub reports conflicts, resolve them there first. Your draft stays in the editor. No additional workflow permission is needed.",
          );
          syncError.code = "FORK_SYNC_REQUIRED";
          throw syncError;
        }
      } catch (diagnosticError) {
        if (diagnosticError.code === "FORK_SYNC_REQUIRED") throw diagnosticError;
        // Preserve the original write error if the diagnostic reads fail.
      }
    }
    throw err;
  }
}

async function getWorkflowFiles(github, repository, ref) {
  let files;
  try {
    files = await github(`/repos/${repository}/contents/.github/workflows?ref=${encodeURIComponent(ref)}`);
  } catch (err) {
    if (err.status === 404) return new Map();
    throw err;
  }
  if (!Array.isArray(files)) throw httpError(502, "GitHub returned an invalid workflow directory.");
  return new Map(files.filter(file => file.type === "file" && /\.ya?ml$/i.test(file.name))
    .map(file => [file.path, file.sha]));
}

function getReviewWriteRepo(user, owner, repo) {
  if (user.provider === "github") {
    return {
      owner: user.githubLogin,
      repo,
    };
  }

  return { owner, repo };
}

async function getSubmissionWriteRepo(github, user, owner, repo) {
  const writeRepo = getReviewWriteRepo(user, owner, repo);

  if (user.provider !== "github") {
    return writeRepo;
  }

  await ensureGithubFork(github, owner, repo, user.githubLogin);
  return writeRepo;
}

async function ensureGithubFork(github, owner, repo, login) {
  const repoPath = `/repos/${encodeURIComponent(login)}/${repo}`;
  const branchPath = `/repos/${encodeURIComponent(login)}/${repo}/git/ref/heads/${encodeURIComponent(BASE_BRANCH)}`;

  try {
    await github(branchPath);
    return;
  } catch (err) {
    if (err.status !== 404) throw err;
  }

  await github(`/repos/${owner}/${repo}/forks`, { method: "POST" });

  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(1500);

    try {
      await github(branchPath);
      return;
    } catch (err) {
      if (err.status !== 404) throw err;
    }
  }

  throw httpError(409, "Your GitHub fork is still being created. Please try submitting again in a moment.");
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
  const installationId =
    process.env.GITHUB_INSTALLATION_ID ||
    (await appGithub(`/repos/${owner}/${repo}/installation`)).id;

  if (!installationId) {
    throw httpError(500, "GitHub App installation ID could not be resolved.");
  }

  const installation = await appGithub(
    `/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      body: {
        repositories: [repo],
        permissions: {
          contents: "write",
          pull_requests: "write",
        },
      },
    },
  );

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
    iss: appId,
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
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "pvme-guide-editor",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        data.message || `GitHub request failed with status ${res.status}.`;
      console.warn("GitHub request failed:", options.method || "GET", path, res.status, message);
      throw httpError(res.status, message);
    }

    return data;
  };
}

async function githubGraphql(token, query, variables = {}) {
  const res = await fetch(GITHUB_GRAPHQL_API, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "pvme-guide-editor",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || Array.isArray(data.errors)) {
    const message = Array.isArray(data.errors) && data.errors.length > 0
      ? data.errors.map((error) => error.message || "Unknown GraphQL error.").join("; ")
      : data.message || `GitHub GraphQL request failed with status ${res.status}.`;
    console.warn("GitHub GraphQL request failed:", res.status, message);
    throw httpError(res.status || 502, message);
  }

  return data.data || {};
}

function createReviewBranchNameForUser(user, path) {
  if (user.provider === "github") {
    return `guide-editor/github-${user.githubId}/${createFileSlug(path)}`;
  }

  return `guide-editor/discord-${user.discordId}/${createFileSlug(path)}`;
}

function createFileSlug(path) {
  return (
    path
      .replace(/\.txt$/i, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 72) || "guide"
  );
}

function createCommitMessage(payload, user) {
  const lines = [`Update ${payload.path}`];

  if (payload.notes) {
    lines.push("", payload.notes);
  }

  lines.push(
    "",
    createSubmittedByLine(user),
    "Submitted via: https://pvme.io/guide-editor/",
  );

  return lines.join("\n");
}

function createCommitAuthor(user) {
  if (user.provider === "github") {
    return null;
  }

  const name = user.username || user.globalName;

  if (!name) {
    throw httpError(
      400,
      "Please log in with Discord again, then try again.",
    );
  }

  return {
    name,
    email: `${user.discordId}@discord.pvme.io`,
  };
}

function createSubmittedByLine(user) {
  if (user.provider === "github") {
    return `Submitted by GitHub user: ${user.githubLogin} (${user.githubId})`;
  }

  return `Submitted by Discord user: ${userDisplayName(user)} (${user.discordId})`;
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
    user.provider === "github"
      ? `GitHub user: \`${user.githubLogin}\` (${user.githubId})`
      : `Discord user ID: \`${user.discordId}\``,
  ];

  if (visibleSummaries.length > 0) {
    lines.push("", "Update summaries:");
    visibleSummaries.forEach((summary, index) => {
      lines.push(`${index + 1}. ${formatSummaryListItem(summary)}`);
    });
  }

  lines.push(
    "",
    "This automated submission updates one existing guide file only.",
  );

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
  const allowedOrigin = process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN;
  const allowedOrigins = allowedOrigin
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const origin = req.get("origin");

  if (origin && (!allowedOrigins.includes(origin) || allowedOrigins.includes("*"))) {
    res.set("Vary", "Origin");
    return false;
  }

  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Credentials", "true");
  }

  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-PVME-Submit-Secret, X-PVME-CSRF-Token");
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
    throw httpError(
      500,
      "PVME_SUBMIT_SECRET is required for non-pvme.io submissions.",
    );
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

  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function requireDiscordConfig() {
  if (!getDiscordClientId() || !getDiscordClientSecret()) {
    throw httpError(500, "Discord OAuth is not configured.");
  }

  if (!process.env.AUTH_COOKIE_SECRET) {
    throw httpError(500, "AUTH_COOKIE_SECRET is not configured.");
  }
}

function requireGithubOAuthConfig() {
  if (!getGithubOAuthClientId() || !getGithubOAuthClientSecret()) {
    throw httpError(500, "GitHub OAuth is not configured.");
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

function getGithubOAuthClientId() {
  return String(process.env.GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_ID || process.env.GITHUB_OAUTH_CLIENT_ID || "").trim();
}

function getGithubOAuthClientSecret() {
  return String(process.env.GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET || process.env.GITHUB_OAUTH_CLIENT_SECRET || "").trim();
}

function getDiscordRedirectUri(req) {
  return getOAuthRedirectUri(req, "discord", process.env.DISCORD_REDIRECT_URI);
}

function getGithubRedirectUri(req) {
  return getOAuthRedirectUri(
    req,
    "github",
    process.env.GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI || process.env.GITHUB_OAUTH_REDIRECT_URI,
  );
}

function getOAuthRedirectUri(req, provider, configuredRedirectUri) {
  if (provider === "github" && configuredRedirectUri) {
    return configuredRedirectUri;
  }

  const proxyOrigin = getProxyOrigin(req);

  if (proxyOrigin) {
    return `${proxyOrigin}/api/guide-pr/auth/${provider}/callback`;
  }

  const localReturnOrigin = getLocalReturnOrigin(req);

  if (localReturnOrigin) {
    return `${localReturnOrigin}/api/guide-pr/auth/${provider}/callback`;
  }

  if (configuredRedirectUri) {
    return configuredRedirectUri;
  }

  const proto = req.get("x-forwarded-proto") || req.protocol || "https";
  const host = req.get("x-forwarded-host") || req.get("host");
  const path = new URL(req.url, "https://guide-editor.local").pathname || "";

  if (path.endsWith(`/auth/${provider}/start`)) {
    return `${proto}://${host}${path.replace(new RegExp(`/auth/${provider}/start$`), `/auth/${provider}/callback`)}`;
  }

  return `${proto}://${host}/auth/${provider}/callback`;
}

function getProxyOrigin(req) {
  const origin = req.get("x-pvme-proxy-origin") || "";
  if (!origin) return "";

  const secret = process.env.PVME_SUBMIT_SECRET || "";
  return isDryRun() && isLocalReturnTo(origin) && secret
    && secureCompare(req.get("x-pvme-submit-secret") || "", secret) ? origin : "";
}

function getSafeReturnTo(req) {
  const returnTo = String(req.query.returnTo || "");
  const frontendUrl = getLocalReturnOrigin(req) || getFrontendOrigin(req);
  const allowedOrigin = getUrlOrigin(frontendUrl);

  try {
    const url = new URL(returnTo || frontendUrl, frontendUrl);
    if (!url.username && !url.password && url.origin === allowedOrigin) return url.toString();
  } catch {
    // Ignore invalid returnTo and fall back below.
  }

  return frontendUrl;
}

function getLocalReturnOrigin(req) {
  const returnTo = String(req.query.returnTo || "");

  try {
    const origin = new URL(returnTo).origin;
    return isLocalReturnTo(returnTo) ? origin : "";
  } catch {
    return "";
  }
}

function getFrontendOrigin(req) {
  const proxyOrigin = getProxyOrigin(req);
  if (proxyOrigin) return proxyOrigin;
  return (
    process.env.FRONTEND_ORIGIN ||
    getTrustedOrigins()[0] ||
    DEFAULT_TRUSTED_ORIGIN
  );
}

function getUrlOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function getSessionUser(req) {
  const cookie = parseCookies(req.get("cookie") || "")[SESSION_COOKIE];
  if (!cookie) return null;

  const session = verifySessionCookie(cookie);
  if (!session || !Number.isFinite(session.exp) || session.exp <= nowSeconds() || session.devSession) {
    return null;
  }

  if (session.provider === "github") {
    if (!session.githubId || !session.githubLogin || !session.githubToken) {
      return null;
    }

    return {
      provider: "github",
      githubId: String(session.githubId),
      githubLogin: String(session.githubLogin),
      username: String(session.username || session.githubLogin || ""),
      globalName: String(session.globalName || ""),
      avatar: String(session.avatar || ""),
      githubToken: String(session.githubToken),
      githubScopes: Array.isArray(session.githubScopes)
        ? session.githubScopes.map(String)
        : parseGithubOAuthScopes(session.githubScopes),
      csrfToken: String(session.csrfToken || ""),
      canReviewPrs: session.canReviewPrs === true,
      exp: Number(session.exp),
    };
  }

  if (!session.discordId) {
    return null;
  }

  return {
    provider: "discord",
    discordId: String(session.discordId),
    username: String(session.username || ""),
    globalName: String(session.globalName || ""),
    avatar: String(session.avatar || ""),
    pvmeMember: session.pvmeMember === true,
    pvmeGuildId: String(session.pvmeGuildId || ""),
    pvmeRoles: Array.isArray(session.pvmeRoles)
      ? session.pvmeRoles.map(String)
      : [],
    csrfToken: String(session.csrfToken || ""),
    exp: Number(session.exp),
  };
}

function isLocalReturnTo(value) {
  try {
    return isDryRun() && ["http://localhost:5173", "http://localhost:4321"].includes(new URL(value).origin);
  } catch {
    return false;
  }
}

function requireSession(req) {
  const user = getSessionUser(req);

  if (!user) {
    throw httpError(
      401,
      "You must log in to submit a guide update.",
    );
  }

  return user;
}

function requirePvmeMemberSession(req) {
  const user = requireSession(req);

  if (user.provider === "github") {
    return user;
  }

  if (user.pvmeMember !== true || user.pvmeGuildId !== PVME_GUILD_ID) {
    throw httpError(
      403,
      "You must be a member of the PvME Discord server or log in with GitHub to submit guide changes.",
    );
  }

  return user;
}

function requireReviewerSession(req) {
  const user = requireSession(req);

  if (!isReviewerUser(user)) {
    throw httpError(403, "You must log in with an authorized GitHub reviewer account.");
  }

  return user;
}

function isReviewerUser(user) {
  if (user?.provider !== "github" || !user.githubLogin) {
    return false;
  }

  const logins = getReviewerGithubLogins();
  if (logins.includes(user.githubLogin.toLowerCase())) {
    return true;
  }

  return user.canReviewPrs === true;
}

function getReviewerGithubLogins() {
  return String(process.env.GUIDE_EDITOR_REVIEWER_GITHUB_LOGINS || "")
    .split(",")
    .map((login) => login.trim().toLowerCase())
    .filter(Boolean);
}

function parseGithubOAuthScopes(value) {
  return String(value || "")
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function validateCsrfToken(req, user, { allowTrustedOriginFallback = false } = {}) {
  const expected = user.csrfToken || "";
  const actual = req.get("x-pvme-csrf-token") || "";

  if (!expected || !secureCompare(actual, expected)) {
    if (allowTrustedOriginFallback && !actual && isTrustedOrigin(req)) {
      return;
    }

    throw httpError(403, "Your login session could not be verified. Refresh the page and try again.");
  }
}

function enforceAnonymousGuideLoadLimit(req, res) {
  const usage = getAnonymousGuideUsage(req);
  const count = Number(usage.count || 0);

  if (count >= ANON_GUIDE_LOAD_LIMIT) {
    throw httpError(
      401,
      "Please log in with Discord to continue loading guides.",
    );
  }

  setAnonymousGuideUsage(res, {
    count: count + 1,
    exp: nowSeconds() + ANON_GUIDE_USAGE_MAX_AGE_SECONDS,
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
    exp: Number(usage.exp),
  };
}

function setAnonymousGuideUsage(res, usage) {
  res.set(
    "Set-Cookie",
    serializeCookie(ANON_GUIDE_USAGE_COOKIE, signJson(usage), {
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: getCookieSameSite(),
      path: "/",
      maxAge: ANON_GUIDE_USAGE_MAX_AGE_SECONDS,
    }),
  );
}

function setSessionCookie(res, session) {
  res.append(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE, sealJson(session), {
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: getCookieSameSite(),
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    }),
  );
}

function clearSessionCookie(res) {
  res.set(
    "Set-Cookie",
    createClearCookieHeaders(SESSION_COOKIE, {
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: getCookieSameSite(),
    }),
  );
}

function createClearCookieHeaders(name, options) {
  const base = {
    ...options,
    maxAge: 0,
  };
  const headers = [
    serializeCookie(name, "", { ...base, path: "/" }),
    serializeCookie(name, "", { ...base, path: "/submitGuideUpdate" }),
  ];
  const configuredDomain = getCookieDomain();
  const domains = [configuredDomain, "pvme.io"]
    .filter(Boolean)
    .filter((domain, index, values) => values.indexOf(domain) === index);

  for (const domain of domains) {
    headers.push(serializeCookie(name, "", { ...base, path: "/", domain }));
    headers.push(serializeCookie(name, "", { ...base, path: "/submitGuideUpdate", domain }));
  }

  return headers;
}

function serializeCookie(name, value, options) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path || "/"}`,
    `Max-Age=${options.maxAge || 0}`,
    `SameSite=${options.sameSite || "Lax"}`,
  ];

  const domain = options.domain !== undefined ? options.domain : getCookieDomain();
  if (domain) parts.push(`Domain=${domain}`);
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
    try { if (name) cookies[name] = decodeURIComponent(value); } catch { /* Ignore malformed cookies. */ }
    return cookies;
  }, {});
}

function getCookieSameSite() {
  return process.env.AUTH_COOKIE_SAMESITE || "None";
}

function getCookieDomain() {
  return String(process.env.AUTH_COOKIE_DOMAIN || "").trim();
}

function isCookieSecure() {
  return process.env.AUTH_COOKIE_SECURE !== "false" || !isDryRun();
}

function signJson(value) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createSignature(payload);
  return `${payload}.${signature}`;
}

function sealJson(value) {
  const key = getCookieEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v2",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function verifySessionCookie(value) {
  const encrypted = openJson(value);
  if (encrypted) return encrypted;
  const legacy = verifySignedJson(value);
  return legacy?.provider === "github" ? null : legacy;
}

function createDevSessionToken(session, devOrigin) {
  return sealJson({
    ...session,
    devSession: true,
    devOrigin,
    exp: nowSeconds() + 2 * 60,
  });
}

function verifyDevSessionToken(value, origin) {
  const session = openJson(value);

  if (!session || session.provider !== "github" || session.devSession !== true
    || session.devOrigin !== origin || !Number.isFinite(session.exp) || session.exp <= nowSeconds()) {
    return null;
  }

  delete session.devSession;
  delete session.devOrigin;
  return session;
}

function openJson(value) {
  if (!process.env.AUTH_COOKIE_SECRET) {
    return null;
  }

  const [version, iv, tag, encrypted] = String(value || "").split(".");
  if (version !== "v2" || !iv || !tag || !encrypted) {
    return null;
  }

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getCookieEncryptionKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return null;
  }
}

function verifySignedJson(value) {
  if (!process.env.AUTH_COOKIE_SECRET) {
    return null;
  }

  const [payload, signature] = String(value || "").split(".");
  if (
    !payload ||
    !signature ||
    !secureCompare(signature, createSignature(payload))
  ) {
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

function createSessionCsrfToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function getCookieEncryptionKey() {
  return crypto
    .createHash("sha256")
    .update(process.env.AUTH_COOKIE_SECRET || "")
    .digest();
}

function publicUser(user) {
  if (!user) return null;
  if (user.provider === "github") {
    return {
      provider: "github",
      githubId: user.githubId,
      githubLogin: user.githubLogin,
      username: user.username,
      globalName: user.globalName,
      avatar: user.avatar,
      csrfToken: user.csrfToken,
      canReviewPrs: isReviewerUser(user),
      displayName: userDisplayName(user),
    };
  }

  return {
    provider: "discord",
    discordId: user.discordId,
    username: user.username,
    globalName: user.globalName,
    avatar: user.avatar,
    pvmeMember: user.pvmeMember === true,
    csrfToken: user.csrfToken,
    canReviewPrs: false,
    displayName: userDisplayName(user),
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
    throw httpError(
      429,
      "Too many login attempts. Please wait a few minutes and try again.",
    );
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
  return (
    forwardedFor.split(",")[0].trim() ||
    req.get("fastly-client-ip") ||
    req.get("x-real-ip") ||
    req.ip ||
    req.connection?.remoteAddress ||
    "unknown"
  );
}

function getDiscordOAuthError(data) {
  if (!data || typeof data !== "object") return "";

  const error = typeof data.error === "string" ? data.error : "";
  const description =
    typeof data.error_description === "string" ? data.error_description : "";

  return [error, description].filter(Boolean).join(" - ");
}

function userDisplayName(user) {
  if (user.provider === "github") {
    return user.globalName || user.githubLogin || user.username || `GitHub user ${user.githubId}`;
  }

  return user.globalName || user.username || `Discord user ${user.discordId}`;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
