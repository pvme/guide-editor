// Offline security investigation: only synthetic sessions, keys and provider replies.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const currentSource = fs.readFileSync(require.resolve('./index.js'), 'utf8');
const oldKey = 'synthetic-before-rotation';
const newKey = 'synthetic-after-rotation';
const tokenMarker = 'synthetic-provider-credential';
function harness(source = currentSource) {
  const logs = [];
  const env = { AUTH_COOKIE_SECRET: oldKey, DRY_RUN: 'true',
    ALLOWED_ORIGIN: 'https://pvme.io', TRUSTED_ORIGIN: 'https://pvme.io',
    GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_ID: 'synthetic-app',
    GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET: 'synthetic-app-secret',
    GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI: 'https://guide-api.pvme.io/auth/github/callback' };
  const sandbox = { exports: {}, require(name) {
    assert.equal(name, 'node:crypto'); return crypto;
  }, process: { env }, Buffer, URL, URLSearchParams,
  console: { error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
  fetch: async () => { throw new Error('External networking forbidden'); } };
  vm.runInNewContext(source, sandbox, { timeout: 2000 });
  return { env, sandbox, logs, handle: sandbox.exports.submitGuideUpdate };
}
function profile(provider) {
  return { provider, githubId: '123', githubLogin: 'synthetic-user', discordId: '456',
    username: 'synthetic-user', globalName: '', avatar: '', githubToken: tokenMarker,
    githubScopes: ['repo', 'read:user'], csrfToken: 'synthetic-csrf',
    pvmeMember: true, pvmeGuildId: '534508796639182860', pvmeRoles: ['synthetic-role'],
    discordToken: 'synthetic-discord-credential', clientSecret: 'synthetic-client-secret',
    exp: Math.floor(Date.now() / 1000) + 3600 };
}
function signed(value, key = oldKey) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return payload + '.' + crypto.createHmac('sha256', key).update(payload).digest('base64url');
}
function cookie(value, key = oldKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update(key).digest(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return ['v2', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}
function req(url = '/auth/me', sessionCookie = '', extra = {}) {
  const headers = { origin: 'https://pvme.io', cookie: sessionCookie ? 'pvme_guide_session=' + sessionCookie : '',
    'x-pvme-csrf-token': 'synthetic-csrf', ...extra.headers };
  return { method: 'GET', url, query: {}, body: {}, ip: 'synthetic-test',
    ...extra, get: name => headers[name.toLowerCase()] || '' };
}
function res() {
  return { statusCode: 200, headers: {}, set(name, value) { this.headers[name.toLowerCase()] = value; },
    append(name, value) { (this.headers[name.toLowerCase()] ||= []).push(value); },
    status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; },
    redirect(value) { this.location = value; } };
}
function noCredentials(body) {
  const text = JSON.stringify(body);
  for (const marker of [tokenMarker, 'synthetic-role', 'synthetic-discord-credential', 'synthetic-client-secret'])
    assert.ok(!text.includes(marker), 'Public response must omit private session values');
}
for (const revision of ['a34dc27', 'b0d0212^']) {
  test('historical source ' + revision + ' reproduces GitHub credential exposure without external calls', async t => {
    let source;
    try {
      source = execFileSync('git', ['show', revision + ':cloud-functions/guide-pr/index.js'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      t.skip('Historical Git object unavailable in this checkout; run in the full investigation checkout');
      return;
    }
    const h = harness(source);
    const github = res(); await h.handle(req('/auth/me', cookie(profile('github'))), github);
    assert.equal(github.statusCode, 200);
    assert.ok(github.body.user.githubToken === tokenMarker, 'Historical endpoint returned the internal OAuth credential');
    assert.equal(github.headers['cache-control'], undefined);
    const discord = res(); await h.handle(req('/auth/me', cookie(profile('discord'))), discord);
    assert.equal(discord.body.user.discordToken, undefined);
    assert.ok(Array.isArray(discord.body.user.pvmeRoles));
  });
}
for (const provider of ['github', 'discord']) {
  test(provider + ' current session and strict dry-run responses expose only public user fields', async () => {
    const h = harness(); const session = cookie(profile(provider));
    for (const route of ['/auth/me', '/submitGuideUpdate/auth/me', '/v2/submissions']) {
      const response = res();
      const options = route === '/v2/submissions' ? { method: 'POST', body: {
        type: 'update', repo: 'pvme/pvme-guides', baseBranch: 'master', path: 'test.txt',
        originalContent: 'Old', content: 'New', notes: 'Synthetic security check',
        source: 'master', branch: 'master', contractVersion: 2,
        expectedContributor: provider + (provider === 'github' ? ':123' : ':456'),
        expectedReview: { state: 'unverified' }, replaceExistingReview: false, sourcePreservation: 'exact' } } : {};
      await h.handle(req(route, session, options), response);
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers['cache-control'], 'no-store');
      noCredentials(response.body);
      const keys = provider === 'github'
        ? ['provider', 'githubId', 'githubLogin', 'username', 'globalName', 'avatar', 'csrfToken', 'canReviewPrs', 'displayName']
        : ['provider', 'discordId', 'username', 'globalName', 'avatar', 'pvmeMember', 'csrfToken', 'canReviewPrs', 'displayName'];
      assert.deepEqual(Object.keys(response.body.user).sort(), keys.sort());
    }
  });
  for (const legacy of provider === 'discord' ? [false, true] : [false]) {
    test(provider + (legacy ? ' signed legacy' : ' encrypted') + ' session is invalidated by secret rotation', async () => {
      const h = harness(); const oldCookie = legacy ? signed(profile(provider)) : cookie(profile(provider));
      const before = res(); await h.handle(req('/auth/me', oldCookie), before); assert.ok(before.body.user);
      h.env.AUTH_COOKIE_SECRET = newKey;
      const after = res(); await h.handle(req('/auth/me', oldCookie), after); assert.equal(after.body.user, null);
      const mutation = res(); await h.handle(req('/v2/submissions', oldCookie, { method: 'POST' }), mutation);
      assert.equal(mutation.statusCode, 401);
      const fresh = res(); await h.handle(req('/auth/me', cookie(profile(provider), newKey)), fresh);
      assert.ok(fresh.body.user); noCredentials(fresh.body);
    });
  }
}
test('rotation invalidates in-progress OAuth state and never exchanges its code', async () => {
  const h = harness(); const start = res(); await h.handle(req('/auth/github/start'), start);
  const state = new URL(start.location).searchParams.get('state');
  const nonceCookie = start.headers['set-cookie'].split(';')[0];
  h.env.AUTH_COOKIE_SECRET = newKey;
  h.sandbox.fetch = async () => { assert.fail('Old state must not exchange provider credentials'); };
  const returned = res(); await h.handle(req('/auth/github/callback', '', {
    query: { state, code: 'synthetic-code' }, headers: { cookie: nonceCookie } }), returned);
  assert.ok(new URL(returned.location).searchParams.has('authError'));
});
test('early denials and reviewer errors are uncached, and raw exceptions never enter logs', async () => {
  const h = harness();
  for (const request of [req('/auth/me', '', { headers: { origin: 'https://untrusted.invalid' } }), req('/reviews/pulls')]) {
    const response = res(); await h.handle(request, response);
    assert.ok([401, 403].includes(response.statusCode)); assert.equal(response.headers['cache-control'], 'no-store');
  }
  h.env.DRY_RUN = 'false';
  h.sandbox.fetch = async () => { const error = new Error(tokenMarker); error.headers = { Authorization: tokenMarker }; throw error; };
  const failed = res(); await h.handle(req('/guides/load', cookie(profile('github')), { query: { path: 'test.txt', source: 'master' } }), failed);
  assert.equal(failed.statusCode, 500); noCredentials(failed.body);
  assert.ok(h.logs.length > 0); noCredentials(h.logs);
  assert.ok(h.logs.every(entry => entry[0] === 'Guide API diagnostic'));
});
test('provider exchange diagnostics cannot echo provider error descriptions or objects', async () => {
  const h = harness(); const started = res(); await h.handle(req('/auth/github/start'), started);
  const state = new URL(started.location).searchParams.get('state');
  h.sandbox.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: tokenMarker }) });
  const response = res(); await h.handle(req('/auth/github/callback', '', {
    query: { state, code: 'synthetic-code' }, headers: { cookie: started.headers['set-cookie'].split(';')[0] } }), response);
  noCredentials(h.logs); assert.ok(h.logs.length > 0);
  assert.equal(response.headers['cache-control'], 'no-store');
});