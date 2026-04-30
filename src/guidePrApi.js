const DEV_API_BASE = "/api/guide-pr";
const LIVE_API_BASE = import.meta.env.VITE_GUIDE_PR_ENDPOINT_LIVE || "";

export function getGuidePrApiBase() {
  return import.meta.env.DEV ? DEV_API_BASE : LIVE_API_BASE.replace(/\/$/, "");
}

export function getDiscordLoginUrl() {
  const params = new URLSearchParams({
    returnTo: window.location.href
  });

  return `${getGuidePrApiBase()}/auth/discord/start?${params}`;
}

export async function getAuthenticatedUser() {
  const data = await requestJson("/auth/me");
  return data.user || null;
}

export async function logoutDiscord() {
  await requestJson("/auth/logout", { method: "POST" });
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

async function requestJson(path, options = {}) {
  const base = getGuidePrApiBase();

  if (!base) {
    throw new Error("Guide update endpoint is not configured.");
  }

  const res = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    credentials: "include",
    body: options.body
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}.`);
  }

  return data;
}
