import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import svelteConfig from './svelte.config.js';

const DEV_API_PROXY_PREFIX = "/api/guide-pr";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      svelte(svelteConfig),
      guideSubmitProxy(env)
    ],
    base: '/guide-editor/'
  };
});

function guideSubmitProxy(env) {
  return {
    name: "pvme-guide-submit-proxy",
    configureServer(server) {
      server.middlewares.use(DEV_API_PROXY_PREFIX, async (req, res) => {
        if (!["GET", "POST"].includes(req.method || "")) {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Only GET and POST requests are supported." }));
          return;
        }

        const localAuthFailureRedirect = getLocalAuthFailureRedirect(req.url || "");
        if (localAuthFailureRedirect) {
          res.statusCode = 302;
          res.setHeader("Location", localAuthFailureRedirect);
          res.end("");
          return;
        }

        const endpoints = [
          env.VITE_GUIDE_PR_ENDPOINT_LOCAL,
          env.VITE_GUIDE_PR_ENDPOINT_LIVE
        ].filter(Boolean);

        if (endpoints.length === 0) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Guide update endpoint is not configured." }));
          return;
        }

        if (!env.PVME_SUBMIT_SECRET) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "PVME_SUBMIT_SECRET is not configured for the dev submit proxy." }));
          return;
        }

        const body = await readRequestBody(req);
        let networkError = null;
        const upstreamPath = getUpstreamPath(req.url || "/");

        for (const endpoint of [...new Set(endpoints)]) {
          try {
            const response = await fetch(`${endpoint.replace(/\/$/, "")}${upstreamPath}`, {
              method: req.method,
              headers: createProxyHeaders(env, req),
              body: req.method === "POST" ? body : undefined,
              redirect: "manual"
            });
            const responseBody = await response.text();

            res.statusCode = response.status;
            res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");
            copyHeader(response, res, "location");
            copyHeader(response, res, "set-cookie");
            res.end(responseBody);
            return;
          } catch (err) {
            networkError = err;
          }
        }

        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
          error: networkError?.message || "Guide update endpoint is unreachable."
        }));
      });
    }
  };
}

function getLocalAuthFailureRedirect(url) {
  const parsed = new URL(url, "http://localhost:5173");
  const path = parsed.pathname.startsWith(DEV_API_PROXY_PREFIX)
    ? parsed.pathname.slice(DEV_API_PROXY_PREFIX.length) || "/"
    : parsed.pathname || "/";

  if (path !== "/auth/discord/callback" || !parsed.searchParams.has("error")) {
    return "";
  }

  const fallback = "http://localhost:5173/guide-editor/";
  const stateReturnTo = getUnsignedStateReturnTo(parsed.searchParams.get("state"));
  let redirectUrl;

  try {
    redirectUrl = new URL(stateReturnTo || fallback, fallback);
  } catch {
    redirectUrl = new URL(fallback);
  }

  if (redirectUrl.origin !== "http://localhost:5173") {
    redirectUrl = new URL(fallback);
  }

  redirectUrl.searchParams.set("submit", "1");
  redirectUrl.searchParams.set(
    "authError",
    "Discord login was cancelled. You must log in with Discord to submit a guide update."
  );

  return redirectUrl.toString();
}

function getUnsignedStateReturnTo(state) {
  const [payload] = String(state || "").split(".");
  if (!payload) return "";

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof data.returnTo === "string" ? data.returnTo : "";
  } catch {
    return "";
  }
}

function getUpstreamPath(url) {
  const parsed = new URL(url, "http://localhost");
  const path = parsed.pathname.startsWith(DEV_API_PROXY_PREFIX)
    ? parsed.pathname.slice(DEV_API_PROXY_PREFIX.length) || "/"
    : parsed.pathname || "/";
  return `${path}${parsed.search}`;
}

async function readRequestBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function createProxyHeaders(env, req) {
  const headers = {
    "Content-Type": "application/json",
    "X-PVME-Submit-Secret": env.PVME_SUBMIT_SECRET,
    "X-PVME-Proxy-Origin": "http://localhost:5173"
  };

  if (req.headers.cookie) {
    headers.Cookie = req.headers.cookie;
  }

  return headers;
}

function copyHeader(response, res, header) {
  if (header === "set-cookie" && typeof response.headers.getSetCookie === "function") {
    const cookies = response.headers.getSetCookie().map(rewriteDevCookie);
    if (cookies.length > 0) {
      res.setHeader(header, cookies);
    }
    return;
  }

  const value = response.headers.get(header);
  if (value) {
    res.setHeader(header, header === "set-cookie" ? rewriteDevCookie(value) : value);
  }
}

function rewriteDevCookie(cookie) {
  return cookie
    .replace(/;\s*Secure/gi, "")
    .replace(/SameSite=None/gi, "SameSite=Lax");
}
