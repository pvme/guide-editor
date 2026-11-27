const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const crypto = require('node:crypto');
const { gzipSync, deflateSync } = require('node:zlib');
const { rawRequest } = require('./fixtures/local-http.cjs');

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

test('Functions Framework starts locally and handles safe requests with external networking disabled', { timeout: 20000 }, async t => {
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
    const strictPayload = { type: 'update', repo: 'pvme/pvme-guides', baseBranch: 'master',
      path: 'mock/guide.txt', originalContent: original, content: original.replace('1', '2'),
      notes: 'Mock strict JSON edit', source: 'master', branch: 'master', sourcePreservation: 'exact',
      contractVersion: 2, expectedContributor: 'github:123', expectedReview: { state: 'unverified' },
      replaceExistingReview: false };
    const strict = await localRequest(port, '/v2/submissions', 'POST', strictPayload, headers);
    assert.equal(strict.status, 200); assert.equal(strict.body.contractVersion, 2);
    assert.equal(strict.body.contributor, 'github:123'); assert.equal(strict.body.reviewStateVerified, false);
    assert.equal((await localRequest(port, '/v2/submissions', 'POST', strictPayload,
      { Cookie: headers.Cookie })).body.code, 'CSRF_INVALID');
    assert.equal((await localRequest(port, '/', 'POST', strictPayload, headers)).body.code, 'STRICT_ROUTE_REQUIRED');
    for (const [encoding, encode] of [['identity', bytes => bytes], ['gzip', gzipSync], ['deflate', deflateSync]]) {
      await t.test(`actual Framework parses ${encoding} strict JSON without changing source bytes`, async () => {
        const response = await rawRequest(port, '/v2/submissions', encode(Buffer.from(JSON.stringify(strictPayload))),
          { ...headers, 'Content-Encoding': encoding });
        assert.equal(response.status, 200);
        assert.equal(response.body.contractVersion, 2);
        assert.equal(response.body.originalContentBytes, Buffer.byteLength(original));
        assert.equal(response.body.contentBytes, Buffer.byteLength(strictPayload.content));
      });
    }
    await t.test('actual Framework rejects malformed JSON and compressed input and stays available', async () => {
      assert.equal((await rawRequest(port, '/v2/submissions', Buffer.from('{"unfinished":'), headers)).status, 400);
      assert.equal((await rawRequest(port, '/v2/submissions', Buffer.from('invalid gzip'),
        { ...headers, 'Content-Encoding': 'gzip' })).status, 400);
      assert.equal((await rawRequest(port, '/v2/submissions', Buffer.from('{}'),
        { ...headers, 'Content-Encoding': 'unsupported' })).status, 415);
      const compressed = gzipSync(Buffer.from(JSON.stringify(strictPayload)));
      const trailing = Buffer.from([0xff, 0xff, 0xff, 0xff]);
      // Local-only advisory regression: decoder errors may reject input before a
      // response or arrive after it. Neither case may terminate the worker.
      for (const chunks of [null, [compressed, trailing]]) {
        const response = await rawRequest(port, '/v2/submissions', Buffer.concat([compressed, trailing]),
          { ...headers, 'Content-Encoding': 'gzip' }, chunks);
        assert.ok([200, 400].includes(response.status));
        assert.equal(child.exitCode, null);
        assert.equal((await localRequest(port, '/')).status, 200);
      }
    });
    await t.test('actual Framework preserves the 2 MiB application limit after inflation', async () => {
      const boundary = { ...strictPayload, content: 'x'.repeat(2 * 1024 * 1024) };
      assert.equal((await localRequest(port, '/v2/submissions', 'POST', boundary, headers)).status, 200);
      const oversized = Buffer.from(JSON.stringify({ ...boundary, content: boundary.content + 'x' }));
      assert.equal((await rawRequest(port, '/v2/submissions', oversized, headers)).status, 413);
      assert.equal((await rawRequest(port, '/v2/submissions', gzipSync(oversized),
        { ...headers, 'Content-Encoding': 'gzip' })).status, 413);
      assert.equal((await localRequest(port, '/')).status, 200);
    });
  } finally {
    child.kill();
    if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
  }
});
