const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test, beforeEach } = require('node:test');
const { submitGuideUpdate } = require('./index.js');

const cookieSecret = 'submission-test-secret';
const branch = 'guide-editor/github-123/dpm-advice-dpm-advice-melee';
const path = 'dpm-advice/dpm-advice-melee.txt';
const originalContent = 'Original guide';
const payload = {
  type: 'update', repo: 'pvme/pvme-guides', baseBranch: 'master', path,
  content: 'Updated guide', originalContent, notes: 'Update abilities',
  source: 'master', branch: 'master',
};

beforeEach(() => {
  process.env.AUTH_COOKIE_SECRET = cookieSecret;
  process.env.DRY_RUN = 'false';
  process.env.ALLOWED_ORIGIN = 'https://pvme.io';
  process.env.TRUSTED_ORIGIN = 'https://pvme.io';
  process.env.GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_ID = 'test-client';
  process.env.GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET = 'test-client-secret';
  process.env.GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI = 'https://guide-api.pvme.io/auth/github/callback';
});

function request(scopes, overrides = {}) {
  const session = {
    provider: 'github', githubId: '123', githubLogin: 'contributor',
    githubToken: 'test-oauth-token', githubScopes: scopes,
    csrfToken: 'test-csrf', exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(cookieSecret).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
  const cookie = ['v2', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
  const headers = {
    origin: 'https://pvme.io', cookie: `pvme_guide_session=${cookie}`,
    'x-pvme-csrf-token': 'test-csrf',
  };
  return {
    method: 'POST', url: '/', query: {}, body: { ...payload },
    get: name => headers[name.toLowerCase()] || '', ...overrides,
  };
}

function response() {
  return {
    statusCode: 200, body: null,
    set() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    redirect(url) { this.location = url; },
  };
}

test('GitHub login requests repository access without workflow access', async () => {
  const res = response();
  await submitGuideUpdate(request([], { method: 'GET', url: '/auth/github/start' }), res);
  const scopes = new URL(res.location).searchParams.get('scope').split(' ');
  assert.ok(scopes.includes('repo'));
  assert.ok(!scopes.includes('workflow'));
});

test('existing GitHub sessions receive reauthorization instructions before any GitHub writes', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('GitHub must not be called without the required permissions');
  });
  for (const scopes of [[], ['read:user'], ['workflow']]) {
    const res = response();
    await submitGuideUpdate(request(scopes), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'Please log in with GitHub again, then try again.');
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

for (const replaceExistingReview of [false, true]) {
  test(`authorized submission ${replaceExistingReview ? 'resets an existing' : 'creates a new'} review branch from upstream`, async t => {
    const writes = [];
    const pr = { number: 42, html_url: 'https://github.com/pvme/pvme-guides/pull/42', body: '' };
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer test-oauth-token');
      const route = new URL(url).pathname;
      const method = options.method;
      const body = options.body ? JSON.parse(options.body) : null;
      let status = 200;
      let data;
      if (method !== 'GET') writes.push({ route, method, body });
      if (route.endsWith('/git/ref/heads/master')) {
        data = { object: { sha: route.includes('/contributor/') ? 'old-fork-sha' : 'upstream-sha' } };
      } else if (route.includes('/git/ref/heads/guide-editor/')) {
        status = replaceExistingReview ? 200 : 404;
        data = replaceExistingReview ? { object: { sha: 'old-review-sha' } } : { message: 'Not Found' };
      } else if (route.includes('/contents/') && method === 'GET') {
        data = { type: 'file', sha: 'file-sha', content: Buffer.from(originalContent).toString('base64') };
      } else if (route.endsWith('/git/refs') || route.includes('/git/refs/heads/')) {
        assert.equal(body.sha, 'upstream-sha');
        data = { object: { sha: body.sha } };
      } else if (route.includes('/contents/') && method === 'PUT') {
        assert.equal(body.branch, branch);
        assert.equal(Buffer.from(body.content, 'base64').toString(), payload.content);
        data = { commit: { sha: 'new-commit' } };
      } else if (route.endsWith('/pulls') && method === 'GET') {
        data = replaceExistingReview ? [pr] : [];
      } else if (route.includes('/pulls') && ['POST', 'PATCH'].includes(method)) {
        if (method === 'POST') assert.equal(body.head, `contributor:${branch}`);
        data = pr;
      } else {
        throw new Error(`Unexpected GitHub request: ${method} ${route}`);
      }
      return { ok: status < 400, status, json: async () => data };
    });
    const res = response();
    const req = request(['repo', 'read:user']);
    req.body.replaceExistingReview = replaceExistingReview;
    await submitGuideUpdate(req, res);
    assert.equal(res.statusCode, replaceExistingReview ? 200 : 201);
    assert.equal(res.body.prUrl, pr.html_url);
    assert.equal(writes.length, 3);
    assert.equal(writes[0].method, replaceExistingReview ? 'PATCH' : 'POST');
    if (replaceExistingReview) assert.equal(writes[0].body.force, true);
    else assert.equal(writes[0].body.ref, `refs/heads/${branch}`);
  });
}

function mockForkSubmission(t, options = {}) {
  const calls = [];
  const original = options.originalContent ?? originalContent;
  const pr = { number: 42, html_url: 'https://github.com/pvme/pvme-guides/pull/42', body: '' };
  const workflow = sha => [{ type: 'file', name: 'publish-guides.yml', path: '.github/workflows/publish-guides.yml', sha }];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const parsed = new URL(url);
    const route = parsed.pathname;
    const method = init.method;
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ route, method, body });
    assert.equal(init.headers.Authorization, 'Bearer test-oauth-token');
    assert.ok(!route.includes('/app/'), 'No app credentials may be used');
    if (method !== 'GET' && !route.includes('/pulls')) {
      assert.ok(route.startsWith('/repos/contributor/pvme-guides/'), 'All guide writes stay in the user fork');
    }
    let status = 200;
    let data;
    if (route.endsWith('/git/ref/heads/master')) {
      data = { object: { sha: route.includes('/contributor/') ? 'old-fork-sha' : 'upstream-sha' } };
    } else if (route.includes('/git/ref/heads/guide-editor/')) {
      status = options.existingPr ? 200 : 404;
      data = { object: { sha: 'review-sha' }, message: 'Not Found' };
    } else if (route.endsWith('/contents/.github/workflows')) {
      const upstream = route.startsWith('/repos/pvme/');
      assert.equal(parsed.searchParams.get('ref'), upstream ? 'upstream-sha' : 'master');
      status = !upstream && options.missingWorkflowDirectory ? 404 : (options.diagnosticStatus || 200);
      data = workflow(upstream || options.synced ? 'current-workflow' : 'old-workflow');
    } else if (route.includes('/contents/') && method === 'GET') {
      data = { type: 'file', sha: 'file-sha', content: Buffer.from(original).toString('base64') };
    } else if (route.endsWith('/git/refs') || route.includes('/git/refs/heads/')) {
      status = options.refStatus || 201;
      data = { message: 'Not Found', object: { sha: 'upstream-sha' } };
    } else if (route.includes('/contents/') && method === 'PUT') {
      assert.equal(body.author, undefined, 'GitHub attributes the commit to the authenticated user');
      assert.equal(body.committer, undefined);
      data = { commit: { sha: 'new-user-commit' } };
    } else if (route.endsWith('/pulls') && method === 'GET') {
      assert.equal(parsed.searchParams.get('head'), `contributor:${branch}`);
      data = options.existingPr ? [pr] : [];
    } else if (route.includes('/pulls') && ['POST', 'PATCH'].includes(method)) {
      if (method === 'POST') assert.equal(body.head, `contributor:${branch}`);
      data = pr;
    } else {
      throw new Error(`Unexpected request: ${method} ${route}`);
    }
    return { status, ok: status < 400, json: async () => data };
  });
  return calls;
}

test('LF edits to an existing CRLF guide are written back with CRLF and preserve content', async t => {
  const original = 'Guide heading\r\n\r\n\tOriginal advice  \r\n';
  const content = 'Guide heading\n\n\tUpdated advice  \n';
  const calls = mockForkSubmission(t, { originalContent: original });
  const req = request(['repo']);
  req.body.originalContent = original;
  req.body.content = content;
  const res = response();

  await submitGuideUpdate(req, res);

  assert.equal(res.statusCode, 201);
  const writes = calls.filter(c => c.method === 'PUT' && c.route.includes('/contents/'));
  assert.equal(writes.length, 1);
  assert.equal(
    Buffer.from(writes[0].body.content, 'base64').toString('utf8'),
    'Guide heading\r\n\r\n\tUpdated advice  \r\n',
  );
});

for (const exists of [false, true]) {
  test(`workflow mismatch during review branch ${exists ? 'reset' : 'creation'} asks for fork sync, then retry succeeds`, async t => {
    const options = { existingPr: exists, refStatus: 404, missingWorkflowDirectory: !exists };
    const calls = mockForkSubmission(t, options);
    const req = request(['repo', 'read:user']);
    req.body.replaceExistingReview = exists;
    const originalBody = JSON.stringify(req.body);
    const failed = response();
    await submitGuideUpdate(req, failed);
    assert.equal(failed.statusCode, 409);
    assert.equal(failed.body.code, 'FORK_SYNC_REQUIRED');
    assert.match(failed.body.error, /Sync fork then Update branch/);
    assert.equal(calls.filter(c => c.method === 'PUT').length, 0);
    assert.equal(calls.filter(c => c.route.includes('/pulls') && c.method !== 'GET').length, 0);
    assert.equal(JSON.stringify(req.body), originalBody);
    // Simulate the contributor syncing on GitHub, then retry the identical draft.
    options.synced = true;
    options.refStatus = 201;
    const retried = response();
    await submitGuideUpdate(req, retried);
    assert.equal(retried.statusCode, exists ? 200 : 201);
    assert.equal(calls.filter(c => c.method === 'PUT').length, 1);
  });
}

for (const options of [
  { refStatus: 404, synced: true },
  { refStatus: 404, diagnosticStatus: 403 },
  { refStatus: 401 },
  { refStatus: 500 },
]) {
  test(`unrelated GitHub write failure is preserved: ${JSON.stringify(options)}`, async t => {
    mockForkSubmission(t, options);
    const res = response();
    await submitGuideUpdate(request(['repo']), res);
    assert.equal(res.statusCode, options.refStatus);
    assert.equal(res.body.code, undefined);
  });
}

test('editing an existing user PR preserves its branch and user attribution', async t => {
  const calls = mockForkSubmission(t, { existingPr: true });
  const req = request(['public_repo', 'read:user']);
  req.body.source = 'user-pr';
  req.body.branch = branch;
  const res = response();
  await submitGuideUpdate(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.filter(c => c.route.includes('/git/refs')).length, 0);
  assert.equal(calls.filter(c => c.method === 'PUT').length, 1);
});

for (const source of ['master', 'user-pr']) {
  test(`stale ${source} content cannot be submitted`, async t => {
    const calls = mockForkSubmission(t, { existingPr: source === 'user-pr', originalContent: 'Changed since loading' });
    const req = request(['repo']);
    req.body.source = source;
    req.body.branch = source === 'user-pr' ? branch : 'master';
    const res = response();
    await submitGuideUpdate(req, res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.error, /changed since it was loaded/);
    assert.equal(calls.filter(c => c.method !== 'GET').length, 0);
  });
}

test('review loading still finds the contributor fork after a successful submission', async t => {
  mockForkSubmission(t, { existingPr: true });
  const res = response();
  await submitGuideUpdate(request(['repo'], {
    method: 'GET', url: `/guides/load?path=${path}&source=review`, query: { path, source: 'review' },
  }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.source, 'user-pr');
  assert.equal(res.body.branch, branch);
  assert.equal(res.body.originalText, originalContent);
});
