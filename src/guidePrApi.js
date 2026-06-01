const DEV_API_BASE = "/api/guide-pr";
const DEFAULT_LIVE_API_BASE = "https://guide-api.pvme.io";
const LIVE_API_BASE =
  import.meta.env.VITE_GUIDE_PR_ENDPOINT_LIVE ||
  import.meta.env.VITE_GUIDE_PR_ENDPOINT ||
  DEFAULT_LIVE_API_BASE;
let csrfToken = "";

export function getGuidePrApiBase() {
  return import.meta.env.DEV ? DEV_API_BASE : LIVE_API_BASE.replace(/\/$/, "");
}

export function getDiscordLoginUrl(options = {}) {
  return getLoginUrl("discord", options);
}

export function getGithubLoginUrl(options = {}) {
  return getLoginUrl("github", options);
}

function getLoginUrl(provider, { submitAfterLogin = false } = {}) {
  const returnUrl = new URL(window.location.href);
  returnUrl.searchParams.delete("submit");
  returnUrl.searchParams.delete("authError");
  returnUrl.searchParams.delete("githubSession");
  if (submitAfterLogin) {
    returnUrl.searchParams.set("submit", "1");
  }

  const params = new URLSearchParams({
    returnTo: returnUrl.toString()
  });

  return `${getGuidePrApiBase()}/auth/${provider}/start?${params}`;
}

export async function getAuthenticatedUser() {
  const data = await requestJson("/auth/me");
  csrfToken = data.user?.csrfToken || "";
  return data.user || null;
}

export async function logoutDiscord() {
  await requestJson("/auth/logout", { method: "POST" });
  csrfToken = "";
}

export async function completeGithubDevLogin(token) {
  const data = await requestJson("/auth/dev-session", {
    method: "POST",
    body: JSON.stringify({ token })
  });
  csrfToken = data.user?.csrfToken || "";
  return data.user || null;
}

export async function submitGuideUpdate(payload) {
  return requestJson("/", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function loadGuideForReview(path, source = "auto") {
  const params = new URLSearchParams({ path, source });
  return requestJson(`/guides/load?${params}`);
}

export async function listReviewPulls() {
  const data = await requestJson("/reviews/pulls");
  return data.pulls || [];
}

export async function getReviewPull(number) {
  return requestJson(`/reviews/pulls/${number}`);
}

export async function refreshReviewPullChecks(number) {
  const data = await requestJson(`/reviews/pulls/${number}/checks`);
  return data.checks || null;
}

export async function saveReviewPullFile(number, path, content, commitMessage) {
  return requestJson(`/reviews/pulls/${number}/file`, {
    method: "PUT",
    body: JSON.stringify({ path, content, commitMessage })
  });
}

export async function commentOnReviewPull(number, body) {
  return requestJson(`/reviews/pulls/${number}/comment`, {
    method: "POST",
    body: JSON.stringify({ body })
  });
}

export async function submitReviewPullReview(number, event, body = "") {
  return requestJson(`/reviews/pulls/${number}/review`, {
    method: "POST",
    body: JSON.stringify({ event, body })
  });
}

export async function mergeReviewPull(number) {
  return requestJson(`/reviews/pulls/${number}/merge`, {
    method: "POST"
  });
}

export async function closeReviewPull(number, reason) {
  return requestJson(`/reviews/pulls/${number}/close`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
}

async function requestJson(path, options = {}) {
  return requestJsonAttempt(path, options, true);
}

async function requestJsonAttempt(path, options = {}, canRetryAuth = false) {
  const base = getGuidePrApiBase();

  if (!base) {
    throw new Error("Guide update endpoint is not configured.");
  }

  const res = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-PVME-CSRF-Token": csrfToken } : {}),
      ...(options.headers || {})
    },
    credentials: "include",
    body: options.body
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (canRetryAuth && shouldRefreshSessionAndRetry(res, data, options)) {
      await refreshSessionToken();
      return requestJsonAttempt(path, options, false);
    }
    throw new Error(data.error || data.message || `Request failed with status ${res.status}.`);
  }

  return data;
}

function shouldRefreshSessionAndRetry(res, data, options) {
  const method = options.method || "GET";
  const message = data.error || data.message || "";
  return method !== "GET"
    && res.status === 403
    && message.includes("login session could not be verified");
}

async function refreshSessionToken() {
  const data = await requestJsonAttempt("/auth/me", {}, false);
  csrfToken = data.user?.csrfToken || "";

  if (!csrfToken) {
    throw new Error("You must log in to submit a guide update.");
  }
}
