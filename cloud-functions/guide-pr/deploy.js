const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const appId = process.env.GITHUB_APP_ID || "3553040";
const installationId = process.env.GITHUB_INSTALLATION_ID;
const project = process.env.GCLOUD_PROJECT_ID || "pvmebackend";
const region = process.env.GCLOUD_REGION || "europe-west1";
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:5173,https://pvme.io";
const trustedOrigin = process.env.TRUSTED_ORIGIN || "https://pvme.io";
const privateKeySecret = process.env.GITHUB_APP_PRIVATE_KEY_SECRET || "github-guide-editor-private-key";
const discordClientSecretName = process.env.DISCORD_CLIENT_SECRET_SECRET;
const authCookieSecretName = process.env.AUTH_COOKIE_SECRET_SECRET;
const dryRun = process.env.DRY_RUN;
const submitSecret = process.env.PVME_SUBMIT_SECRET;

if (!submitSecret) {
  console.error("PVME_SUBMIT_SECRET is required. Non-pvme.io submissions use it for authorization.");
  process.exit(1);
}

const envVars = [
  ["GITHUB_APP_ID", appId],
  ["ALLOWED_ORIGIN", allowedOrigin],
  ["TRUSTED_ORIGIN", trustedOrigin],
  ["PVME_SUBMIT_SECRET", submitSecret]
];

const secretBindings = [
  `GITHUB_APP_PRIVATE_KEY=${privateKeySecret}:latest`
];

if (installationId) {
  envVars.push(["GITHUB_INSTALLATION_ID", installationId]);
}

if (dryRun) {
  envVars.push(["DRY_RUN", dryRun]);
}

addOptionalEnv("DISCORD_CLIENT_ID");
addOptionalEnv("DISCORD_REDIRECT_URI");
addOptionalEnv("FRONTEND_ORIGIN");
addOptionalEnv("AUTH_COOKIE_SAMESITE");
addOptionalEnv("AUTH_COOKIE_SECURE");
addOptionalEnv("AUTH_COOKIE_DOMAIN");

if (discordClientSecretName) {
  secretBindings.push(`DISCORD_CLIENT_SECRET=${discordClientSecretName}:latest`);
} else {
  addOptionalEnv("DISCORD_CLIENT_SECRET");
}

if (authCookieSecretName) {
  secretBindings.push(`AUTH_COOKIE_SECRET=${authCookieSecretName}:latest`);
} else {
  addOptionalEnv("AUTH_COOKIE_SECRET");
}

const args = [
  "functions",
  "deploy",
  "submitGuideUpdate",
  "--gen2",
  "--project",
  project,
  "--runtime",
  "nodejs22",
  "--region",
  region,
  "--source",
  "cloud-functions/guide-pr",
  "--entry-point",
  "submitGuideUpdate",
  "--trigger-http",
  "--allow-unauthenticated",
  "--set-secrets",
  secretBindings.join(","),
  "--env-vars-file",
  createEnvVarsFile(envVars)
];

const result = spawnSync("gcloud", args, {
  stdio: "inherit",
  shell: process.platform === "win32"
});

process.exit(result.status ?? 1);

function addOptionalEnv(name) {
  if (process.env[name]) {
    envVars.push([name, process.env[name]]);
  }
}

function createEnvVarsFile(values) {
  const file = path.join(os.tmpdir(), `pvme-guide-pr-env-${Date.now()}.yaml`);
  const body = values
    .map(([name, value]) => `${name}: ${JSON.stringify(String(value))}`)
    .join("\n");

  fs.writeFileSync(file, `${body}\n`, "utf8");
  return file;
}
