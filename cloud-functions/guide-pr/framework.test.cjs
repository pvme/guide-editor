const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const crypto = require('node:crypto');

function localRequest(port, route, method = 'GET', body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port, path: route, method,
      headers: { Origin: 'https://pvme.io', 'Content-Type': 'application/json', ...headers } }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

test('Functions Framework starts locally and handles safe requests with external networking disabled', { timeout: 15000 }, async () => {
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, 'localhost', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const child = spawn(process.execPath, ['--require', path.join(__dirname, 'fixtures/offline-network.cjs'),
    path.join(__dirname, 'node_modules/@google-cloud/functions-framework/build/src/main.js'),
    '--target=submitGuideUpdate', `--port=${port}`], {
    cwd: __dirname, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
      DRY_RUN: 'true', AUTH_COOKIE_SECRET: 'framework-only-nonsecret', ALLOWED_ORIGIN: 'https://pvme.io', TRUSTED_ORIGIN: 'https://pvme.io' },
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  try {
    let health;
    for (let i = 0; i < 100; i++) {
      try { health = await localRequest(port, '/'); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.ok(health, output);
    assert.equal(health.body.mode, 'dry-run');
    assert.equal((await localRequest(port, '/auth/me')).body.user, null);
    assert.equal((await localRequest(port, '/', 'POST', {})).status, 401);
    assert.equal((await localRequest(port, '/guides/load?path=../secret.txt')).status, 400);
    assert.equal((await localRequest(port, '/guides/load?path=guide.txt&source=review')).status, 404);
    const session = { provider: 'github', githubId: '123', githubLogin: 'mock-contributor',
      githubToken: 'mock-oauth-token', csrfToken: 'mock-csrf', exp: Math.floor(Date.now() / 1000) + 3600 };
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update('framework-only-nonsecret').digest(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
    const cookie = ['v2', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
    const headers = { Cookie: `pvme_guide_session=${cookie}`, 'X-PVME-CSRF-Token': 'mock-csrf' };
    const me = await localRequest(port, '/auth/me', 'GET', undefined, headers);
    assert.equal(me.body.user.githubLogin, 'mock-contributor');
    assert.equal(me.body.user.githubToken, undefined);
    const original = ' Mock Unicode \u00e9\r\n{ "x" : 1 }\n---\r\n';
    for (const source of ['auto', 'master']) {
      const guide = await localRequest(port, `/guides/load?path=mock/guide.txt&source=${source}`, 'GET', undefined, headers);
      assert.equal(guide.body.originalText, original);
    }
    const submitted = await localRequest(port, '/', 'POST', { type: 'update', repo: 'pvme/pvme-guides',
      baseBranch: 'master', path: 'mock/guide.txt', originalContent: original, content: original.replace('1', '2'),
      notes: 'Mock JSON edit', source: 'master', branch: 'master', sourcePreservation: 'exact' }, headers);
    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.dryRun, true);
    assert.equal(submitted.body.user.githubToken, undefined);
  } finally {
    child.kill();
    if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
  }
});
