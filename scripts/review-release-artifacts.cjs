// Read-only local release inspection. Credential values are compared in memory
// and are never printed. Does not access production.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? files(target) : [target];
  });
}
const artifactFiles = files('dist');
const bundle = artifactFiles.filter(file => /\.(?:js|css|html|json|map)$/.test(file));
const patterns = {
  privateKeyMaterial: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  providerCredential: /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-proj-[A-Za-z0-9_-]{20,})/,
};
const artifactPatterns = {
  ...patterns,
  developmentSecrets: /PVME_SUBMIT_SECRET|DISCORD_CLIENT_SECRET|AUTH_COOKIE_SECRET|GITHUB_APP_PRIVATE_KEY/,
  syntheticSessionData: /synthetic-release-csrf|explicit-csrf|csrf-from-session|captured-draft|mock-contributor|test-oauth-token|local-dev-cookie-secret/,
  developmentProxySecretsOrUpstream: /localhost:8080|127\.0\.0\.1:8080|X-PVME-Submit-Secret/,
  testSources: /verify-strict-browser\.mjs|framework\.test\.cjs|verify-production-release\.mjs/
};
function scan(targets, checks) {
  return Object.fromEntries(Object.entries(checks).map(([key, regex]) => [key,
    targets.filter(file => regex.test(fs.readFileSync(file, 'utf8'))).map(file => file.replaceAll('\\', '/'))]));
}
const candidates = [];
for (const file of ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*)$/);
    if (!match || !/^(PVME_SUBMIT_SECRET|AUTH_COOKIE_SECRET|DISCORD_CLIENT_SECRET|(?:GUIDE_EDITOR_)?GITHUB_OAUTH_CLIENT_SECRET|GITHUB_APP_PRIVATE_KEY)$/.test(match[1])) continue;
    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
    if (value.length >= 20 && !/^(?:local|test|mock|your|example|same-as)/i.test(value)) candidates.push(value);
  }
}
const localCredentialMatches = [...bundle, 'README.md'].filter(file => {
  const content = fs.readFileSync(file, 'utf8'); return candidates.some(value => content.includes(value));
}).map(file => file.replaceAll('\\', '/'));
const report = {
  checkedAt: new Date().toISOString(), artifactFiles: artifactFiles.map(file => file.replaceAll('\\', '/')),
  artifactFindings: scan(bundle, artifactPatterns),
  documentationFindings: scan(['README.md'], { ...patterns,
    sessionValues: /"(?:githubToken|access_token|refresh_token|csrfToken|cookie|token)"\s*:\s*"[^"\s]{12,}"/ }),
  localCredentialMatches,
  developmentSessionHelperCompiled: bundle.some(file => fs.readFileSync(file, 'utf8').includes('/auth/dev-session')),
  developmentProxyPathLiteralCompiled: bundle.some(file => fs.readFileSync(file, 'utf8').includes('/api/guide-pr')),
  limitations: 'Pattern and exact local-value scan, not proof against all secret encodings. Test scripts/fixtures remain source-only. Resource names, binding references and hashes are not secret values.'
};
assert.ok(Object.values(report.artifactFindings).every(matches => matches.length === 0));
assert.ok(Object.values(report.documentationFindings).every(matches => matches.length === 0));
assert.equal(localCredentialMatches.length, 0);
console.log(JSON.stringify(report, null, 2));
