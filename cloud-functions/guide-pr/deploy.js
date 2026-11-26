const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const TARGET = Object.freeze({ project: "pvmebackend", region: "europe-west1", name: "submitGuideUpdate" });
const PRODUCTION = Object.freeze({
  ALLOWED_ORIGIN: "https://pvme.io",
  TRUSTED_ORIGIN: "https://pvme.io",
  FRONTEND_ORIGIN: "https://pvme.io/guide-editor/",
  DISCORD_REDIRECT_URI: "https://guide-api.pvme.io/auth/discord/callback",
  GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI: "https://guide-api.pvme.io/auth/github/callback",
  AUTH_COOKIE_SECURE: "true",
  AUTH_COOKIE_SAMESITE: "None",
  DRY_RUN: "false",
});
const CREDENTIAL_KEYS = ["PVME_SUBMIT_SECRET", "AUTH_COOKIE_SECRET", "DISCORD_CLIENT_SECRET",
  "GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET", "GITHUB_OAUTH_CLIENT_SECRET", "GITHUB_APP_PRIVATE_KEY"];
const PRESERVED_KEYS = [...CREDENTIAL_KEYS, "DISCORD_CLIENT_ID", "GITHUB_APP_ID", "GITHUB_INSTALLATION_ID",
  "GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_ID", "GUIDE_EDITOR_REVIEWER_GITHUB_LOGINS", "AUTH_COOKIE_DOMAIN"];
const SECRET_OPTIONS = {
  GITHUB_APP_PRIVATE_KEY_SECRET: "GITHUB_APP_PRIVATE_KEY",
  DISCORD_CLIENT_SECRET_SECRET: "DISCORD_CLIENT_SECRET",
  GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET_SECRET: "GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET",
  GITHUB_OAUTH_CLIENT_SECRET_SECRET: "GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET",
  AUTH_COOKIE_SECRET_SECRET: "AUTH_COOKIE_SECRET",
};

function loadProductionEnv(root, exported = process.env) {
  const values = {};
  // Generic and development env files may contain local credentials/settings.
  for (const file of [".env.production", ".env.production.local"]) {
    const fullPath = path.join(root, file);
    if (fs.existsSync(fullPath)) Object.assign(values, parseEnvFile(fs.readFileSync(fullPath, "utf8")));
  }
  return { ...values, ...exported };
}

function isPlaceholder(value) {
  return /^(?:\.{3}|changeme|change-me|same-as-root-env)$/i.test(value)
    || /^(?:local|test|mock|example|your|dev|framework)[-_ ]/i.test(value)
    || /placeholder|change[-_ ]?me/i.test(value);
}

function buildDeploymentPlan(env, current) {
  for (const [key, expected] of Object.entries(PRODUCTION)) {
    if (env[key] !== expected) throw new Error(`${key} must explicitly match the production configuration.`);
  }
  if (env.GITHUB_OAUTH_REDIRECT_URI !== undefined
    && env.GITHUB_OAUTH_REDIRECT_URI !== PRODUCTION.GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI) {
    throw new Error("GITHUB_OAUTH_REDIRECT_URI must match the production callback.");
  }
  if ((env.GCLOUD_PROJECT_ID && env.GCLOUD_PROJECT_ID !== TARGET.project)
    || (env.GCLOUD_REGION && env.GCLOUD_REGION !== TARGET.region)) {
    throw new Error("Deployment target does not match the existing production function.");
  }
  const resource = `projects/${TARGET.project}/locations/${TARGET.region}/functions/${TARGET.name}`;
  if (current.name !== resource || current.environment !== "GEN_2" || current.state !== "ACTIVE"
    || current.buildConfig?.runtime !== "nodejs22" || current.buildConfig?.entryPoint !== TARGET.name
    || current.eventTrigger || !current.serviceConfig?.revision || !current.serviceConfig.serviceAccountEmail) {
    throw new Error("The existing production function target, runtime or service account could not be verified.");
  }
  const existing = current.serviceConfig.environmentVariables || {};
  const bindings = current.serviceConfig.secretEnvironmentVariables || [];
  const bound = new Map(bindings.map(binding => [binding.key, binding]));
  for (const key of CREDENTIAL_KEYS) {
    if ([env[key], existing[key]].some(value => value && isPlaceholder(String(value)))) {
      throw new Error(`${key} contains a development placeholder.`);
    }
  }
  for (const key of PRESERVED_KEYS) {
    if (env[key] === undefined) continue;
    const binding = bound.get(key);
    if (env[key] !== (binding ? binding.secret : existing[key])) {
      throw new Error(`${key} must preserve the existing production value or secret binding.`);
    }
  }
  for (const [option, key] of Object.entries(SECRET_OPTIONS)) {
    if (env[option] !== undefined && env[option] !== bound.get(key)?.secret) {
      throw new Error(`${option} must preserve the existing Secret Manager binding.`);
    }
  }
  for (const key of ["PVME_SUBMIT_SECRET", "AUTH_COOKIE_SECRET", "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET",
    "GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY", "GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_ID",
    "GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET", "GUIDE_EDITOR_REVIEWER_GITHUB_LOGINS"]) {
    if (!existing[key] && !bound.has(key)) throw new Error(`Required existing production setting ${key} is missing.`);
  }
  for (const binding of bindings) {
    if (!binding.key || !binding.secret || !binding.version || !binding.projectId) {
      throw new Error("An existing Secret Manager binding is incomplete.");
    }
  }
  const environment = { ...existing };
  const verifyCallbacks = [];
  for (const [key, value] of Object.entries(PRODUCTION)) {
    if (bound.has(key)) {
      if (key !== "GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI") {
        throw new Error(`${key} is secret-bound and cannot be verified by this deployment procedure.`);
      }
      // Preserve this binding; verify its effective public value via OAuth start.
      verifyCallbacks.push({ provider: "github", expected: value });
    } else environment[key] = value;
  }
  return { environment, verifyCallbacks, revision: current.serviceConfig.revision,
    serviceAccount: current.serviceConfig.serviceAccountEmail };
}

function runGcloud(args) {
  return spawnSync("gcloud", args, { encoding: "utf8", shell: process.platform === "win32",
    windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
}

function describeFunction(execute) {
  const result = execute(["functions", "describe", TARGET.name, "--gen2", `--project=${TARGET.project}`,
    `--region=${TARGET.region}`, "--format=json", "--quiet"]);
  if (result.error || result.status !== 0) throw new Error("Could not inspect the existing production function. No deployment was started.");
  try { return JSON.parse(result.stdout); }
  catch { throw new Error("The production function description is invalid. No deployment was started."); }
}

async function verifyCallback({ provider, expected }, fetchFn) {
  const response = await fetchFn(`https://guide-api.pvme.io/auth/${provider}/start?returnTo=${encodeURIComponent(PRODUCTION.FRONTEND_ORIGIN)}`,
    { redirect: "manual", signal: AbortSignal.timeout(15000) });
  let location;
  try { location = new URL(response.headers.get("location")); } catch { /* Report a safe error below. */ }
  if (response.status !== 302 || location?.origin !== "https://github.com"
    || location.searchParams.get("redirect_uri") !== expected) {
    throw new Error("The existing secret-bound GitHub callback does not match the production callback.");
  }
}

async function deploy({ env = process.env, root = path.resolve(__dirname, "../.."),
  execute = runGcloud, fetchFn = globalThis.fetch, tempRoot = os.tmpdir() } = {}) {
  const config = loadProductionEnv(root, env);
  // Validate explicit settings before any cloud access.
  for (const [key, expected] of Object.entries(PRODUCTION)) {
    if (config[key] !== expected) throw new Error(`${key} must explicitly match the production configuration.`);
  }
  const current = describeFunction(execute);
  const plan = buildDeploymentPlan(config, current);
  for (const callback of plan.verifyCallbacks) await verifyCallback(callback, fetchFn);
  let temporaryDirectory;
  try {
    temporaryDirectory = fs.mkdtempSync(path.join(tempRoot, "pvme-guide-pr-env-"));
    const envFile = path.join(temporaryDirectory, "environment.json");
    // JSON is valid YAML. Secrets never enter shell arguments or console output.
    fs.writeFileSync(envFile, JSON.stringify(plan.environment), { encoding: "utf8", mode: 0o600, flag: "wx" });
    const latest = describeFunction(execute);
    if (latest.serviceConfig.revision !== plan.revision || latest.updateTime !== current.updateTime
      || JSON.stringify(latest.serviceConfig) !== JSON.stringify(current.serviceConfig)) {
      throw new Error("Production configuration changed during preflight. No deployment was started.");
    }
    const result = execute(["functions", "deploy", TARGET.name, "--gen2", `--project=${TARGET.project}`,
      `--region=${TARGET.region}`, "--runtime=nodejs22", `--source=${__dirname}`, `--entry-point=${TARGET.name}`,
      `--service-account=${plan.serviceAccount}`, `--env-vars-file=${envFile}`, "--quiet",
      "--format=json(name,state,serviceConfig.revision)"]);
    // Do not pass --set-secrets, IAM flags or clear flags: preserve all existing
    // secret env/volume bindings, public invoker policy and infrastructure settings.
    if (result.error || result.status !== 0) {
      throw new Error("Production deployment failed. Inspect the function/build status; raw CLI output was withheld to protect configuration values.");
    }
    return { previousRevision: plan.revision };
  } finally {
    if (temporaryDirectory) {
      const target = path.resolve(temporaryDirectory);
      if (!target.startsWith(`${path.resolve(tempRoot)}${path.sep}`)
        || !path.basename(target).startsWith("pvme-guide-pr-env-")) {
        throw new Error("Refusing to clean up an unexpected deployment temporary path.");
      }
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
}

function parseEnvFile(contents) {
  const values = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    values[match[1]] = parseEnvValue(match[2]);
  }

  return values;
}

function parseEnvValue(value) {
  const trimmed = value.trim();
  const quote = trimmed[0];

  if ((quote === "\"" || quote === "'" || quote === "`") && trimmed.endsWith(quote)) {
    const unquoted = trimmed.slice(1, -1);
    return quote === "\""
      ? unquoted.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\"/g, "\"").replace(/\\\\/g, "\\")
      : unquoted;
  }

  return trimmed.replace(/\s+#.*$/, "");
}

module.exports = { TARGET, PRODUCTION, loadProductionEnv, buildDeploymentPlan, deploy };

if (require.main === module) {
  deploy().then(result => {
    console.log(`Production deployment completed. Previous revision: ${result.previousRevision}`);
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
