const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test, beforeEach } = require('node:test');
const { submitGuideUpdate } = require('./index.js');

let testIp = 0;
const cookieSecret = 'submission-test-secret';
const branch = 'guide-editor/github-123/dpm-advice-dpm-advice-melee';
const path = 'dpm-advice/dpm-advice-melee.txt';
const originalContent = 'Original guide';
const reviewSha = 'a'.repeat(40);
const expectedReview = { state: 'present', repository: 'contributor/pvme-guides', branch,
  headSha: reviewSha, prId: 4242, prNumber: 42, prUrl: 'https://github.com/pvme/pvme-guides/pull/42' };
const payload = {
  type: 'update', repo: 'pvme/pvme-guides', baseBranch: 'master', path,
  content: 'Updated guide', originalContent, notes: 'Update abilities',
  source: 'master', branch: 'master',
};

beforeEach(t => {
  testIp++;
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unmocked network prohibited'); });
  for (const name of ['PVME_SUBMIT_SECRET', 'FRONTEND_ORIGIN', 'AUTH_COOKIE_DOMAIN', 'AUTH_COOKIE_SECURE',
    'AUTH_COOKIE_SAMESITE', 'DISCORD_REDIRECT_URI', 'GUIDE_EDITOR_REVIEWER_GITHUB_LOGINS']) delete process.env[name];
  process.env.AUTH_COOKIE_SECRET = cookieSecret;
  process.env.DRY_RUN = 'false';
  process.env.ALLOWED_ORIGIN = 'https://pvme.io';
  process.env.TRUSTED_ORIGIN = 'https://pvme.io';
  process.env.GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_ID = 'test-client';
  process.env.GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET = 'test-client-secret';
  process.env.GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI = 'https://guide-api.pvme.io/auth/github/callback';
});

function request(scopes, overrides = {}, sessionOverrides = {}, headerOverrides = {}) {
  const session = {
    provider: 'github', githubId: '123', githubLogin: 'contributor',
    githubToken: 'test-oauth-token', githubScopes: scopes,
    csrfToken: 'test-csrf', exp: Math.floor(Date.now() / 1000) + 3600, ...sessionOverrides,
  };
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(cookieSecret).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
  const cookie = ['v2', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
  const headers = {
    origin: 'https://pvme.io', cookie: `pvme_guide_session=${cookie}`,
    'x-pvme-csrf-token': 'test-csrf', ...headerOverrides,
  };
  return {
    ip: `test-${testIp}`, method: 'POST', url: '/', query: {}, body: { ...payload },
    get: name => headers[name.toLowerCase()] || '', ...overrides,
  };
}

function response() {
  return {
    statusCode: 200, body: null, headers: {},
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    append(name, value) {
      const key = name.toLowerCase();
      this.headers[key] = [...(this.headers[key] ? [this.headers[key]].flat() : []), value];
      return this;
    },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    redirect(url) { this.location = url; },
  };
}

function strictRequest(body = {}, session = {}, headers = {}) {
  return request(['repo'], { url: '/v2/submissions', body: { ...payload, contractVersion: 2,
    expectedContributor: 'github:123', expectedReview: { state: 'none' },
    sourcePreservation: 'exact', replaceExistingReview: false, ...body } }, session, headers);
}

// Full synthetic live lifecycle. All network is intercepted; stages can change
// independently to exercise GitHub's separate ref and PR resources.
function mockStrictSubmission(t, options = {}) {
  const calls = []; let prReads = 0; let published = false;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const parsed = new URL(url), route = parsed.pathname, method = init.method;
    assert.equal(init.headers.Authorization, 'Bearer test-oauth-token');
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ route, method, body, ref: parsed.searchParams.get('ref') });
    options.onCall?.({ route, method, body });
    let status = 200, data;
    const current = options.state ? options.state(prReads + 1) : (options.present === false ? null : expectedReview);
    if (route.endsWith('/git/ref/heads/master')) data = { object: { sha: 'b'.repeat(40) } };
    else if (route.includes('/git/ref/heads/guide-editor/')) {
      if (!current || options.missingBranch) { status = 404; data = {}; }
      else data = { object: { sha: published ? 'c'.repeat(40) : current.headSha } };
    } else if (route.endsWith('/pulls') && method === 'GET') {
      prReads++;
      data = current ? [{ id: current.prId, number: current.prNumber, html_url: current.prUrl,
        state: options.closed ? 'closed' : 'open', body: '',
        head: { sha: published ? 'c'.repeat(40) : current.headSha, ref: current.branch,
          repo: { full_name: current.repository } },
        base: { ref: 'master', repo: { full_name: 'pvme/pvme-guides' } } }] : [];
    } else if (route.includes('/contents/')) data = { type: 'file', sha: 'file-sha', content: Buffer.from(originalContent).toString('base64') };
    else if (route.includes('/git/commits/') && method === 'GET') data = { tree: { sha: 'tree' } };
    else if (route.endsWith('/git/trees')) data = { sha: 'edited-tree' };
    else if (route.endsWith('/git/commits')) data = { sha: 'c'.repeat(40) };
    else if (route.includes('/git/refs')) {
      status = options.refStatus || 200; published = status < 400; data = {};
    } else if (route.includes('/pulls') && method !== 'GET') data = { html_url: expectedReview.prUrl };
    else throw new Error(`Unexpected strict mock ${method} ${route}`);
    return { ok: status < 400, status, json: async () => data };
  });
  return calls;
}

for (const expected of [undefined, '', '123', 'GitHub:123', 'github:0', {}, 'github:123:456']) {
  test(`strict contributor rejects malformed assertion ${JSON.stringify(expected)} before any access`, async () => {
    const res = response(); await submitGuideUpdate(strictRequest({ expectedContributor: expected }), res);
    assert.equal(res.statusCode, 400); assert.equal(res.body.code, 'INVALID_CONTRIBUTOR');
  });
}

for (const [before, after] of [
  ['github:123', { githubId: '456' }],
  ['github:123', { provider: 'discord', discordId: '123', pvmeMember: true, pvmeGuildId: '534508796639182860' }],
  ['discord:123', { provider: 'discord', discordId: '456', pvmeMember: true, pvmeGuildId: '534508796639182860' }],
  ['discord:123', { githubId: '123' }],
]) {
  test(`account switch after auth/me rejects ${before} -> ${JSON.stringify(after)}`, async () => {
    const me = response();
    const [provider, id] = before.split(':');
    await submitGuideUpdate(request(['repo'], { method: 'GET', url: '/auth/me' },
      { provider, githubId: id, discordId: id }), me);
    assert.equal(me.body.user.provider, provider);
    const res = response(); await submitGuideUpdate(strictRequest({ expectedContributor: before }, after), res);
    assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'CONTRIBUTOR_MISMATCH');
  });
}

for (const token of ['', 'wrong']) test(`strict CSRF rejects ${JSON.stringify(token)} despite trusted origin`, async () => {
  const res = response(); await submitGuideUpdate(strictRequest({}, {}, { 'x-pvme-csrf-token': token }), res);
  assert.equal(res.statusCode, 403); assert.equal(res.body.code, 'CSRF_INVALID');
});

for (const expected of [undefined, null, {}, { state: 'none', headSha: reviewSha },
  { ...expectedReview, headSha: 'master' }, { ...expectedReview, prId: '4242' },
  { ...expectedReview, branch: 'other' }, { state: 'unverified' }]) {
  test(`strict rejects malformed review assertion ${JSON.stringify(expected)}`, async () => {
    const res = response(); await submitGuideUpdate(strictRequest({ expectedReview: expected }), res);
    assert.equal(res.statusCode, 400); assert.equal(res.body.code, 'INVALID_REVIEW_STATE');
  });
}

for (const [app, label] of [[undefined, 'PvME Website'], ['website', 'PvME Website'], ['guide-editor', 'PvME Guide Editor']]) {
  for (const present of [false, true]) {
    test(`${label} attribution ${present ? 'updates an existing' : 'creates a new'} PR (${app})`, async t => {
      const calls = mockStrictSubmission(t, { present });
      const req = strictRequest(present ? { expectedReview, replaceExistingReview: true } : {}, {},
        app ? { 'x-pvme-app': app } : {});
      const res = response();
      await submitGuideUpdate(req, res);
      assert.equal(res.statusCode, present ? 200 : 201);
      const pr = calls.find(c => c.route.includes('/pulls') && c.method !== 'GET');
      assert.ok(pr.body.body.startsWith(`Submitted from the ${label}.\n`));
      assert.ok(res.headers['access-control-allow-headers'].includes('X-PVME-App'));
    });
  }
}

for (const source of ['master', 'user-pr']) {
  test(`strict ${source} accepts matching version and returns captured contributor`, async t => {
    const calls = mockStrictSubmission(t);
    const req = strictRequest({ source, branch: source === 'master' ? 'master' : branch,
      expectedReview, replaceExistingReview: source === 'master' });
    const captured = JSON.stringify(req.body);
    const res = response(); await submitGuideUpdate(req, res);
    assert.equal(res.statusCode, 200); assert.equal(res.body.contributor, 'github:123');
    assert.equal(res.body.contractVersion, 2); assert.equal(res.body.reusedReview, true);
    assert.equal(JSON.stringify(req.body), captured);
    assert.equal(calls.find(c => c.route.includes('/git/refs')).body.force, false);
    assert.equal(calls.filter(c => c.route.endsWith('/pulls') && c.method === 'GET').length, 4);
    assert.ok(!JSON.stringify(res.body).includes('test-oauth-token'));
  });

  for (const change of ['head', 'id', 'number', 'url', 'closed', 'missing', 'missing-branch']) {
    test(`strict ${source} rejects stale ${change} with zero mutations`, async t => {
      const altered = { ...expectedReview };
      if (change === 'head') altered.headSha = 'd'.repeat(40);
      if (change === 'id') altered.prId++;
      if (change === 'number') { altered.prNumber++; altered.prUrl = altered.prUrl.replace('42', '43'); }
      if (change === 'url') altered.prUrl = 'https://github.com/other/repo/pull/42';
      const calls = mockStrictSubmission(t, { present: change !== 'missing', state: () => change === 'missing' ? null : altered,
        closed: change === 'closed', missingBranch: change === 'missing-branch' });
      const res = response(); await submitGuideUpdate(strictRequest({ source,
        branch: source === 'master' ? 'master' : branch, expectedReview, replaceExistingReview: source === 'master' }), res);
      assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'REVIEW_STATE_CONFLICT');
      assert.equal(calls.filter(c => c.method !== 'GET').length, 0);
    });
  }
}

test('strict absent-review assertion rejects a newly appeared review before writes', async t => {
  const calls = mockStrictSubmission(t); const res = response();
  await submitGuideUpdate(strictRequest(), res);
  assert.equal(res.body.code, 'REVIEW_STATE_CONFLICT');
  assert.equal(calls.filter(c => c.method !== 'GET').length, 0);
});

test('strict replacement requires explicit consent before any GitHub access', async () => {
  const res = response(); await submitGuideUpdate(strictRequest({ expectedReview }), res);
  assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'REPLACEMENT_CONSENT_REQUIRED');
});

test('strict no-review submission creates a new PR', async t => {
  const calls = mockStrictSubmission(t, { present: false }); const res = response();
  await submitGuideUpdate(strictRequest(), res);
  assert.equal(res.statusCode, 201); assert.equal(res.body.contributor, 'github:123');
  assert.equal(res.body.reusedReview, false);
  assert.equal(calls.find(c => c.route.endsWith('/git/refs')).body.ref, `refs/heads/${branch}`);
});

for (const stage of [2, 3, 4]) test(`strict detects PR replacement at recheck ${stage}`, async t => {
  const calls = mockStrictSubmission(t, { state: n => n >= stage ? { ...expectedReview, prId: 9999 } : expectedReview });
  const res = response(); await submitGuideUpdate(strictRequest({ expectedReview, replaceExistingReview: true }), res);
  assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'REVIEW_STATE_CONFLICT');
  if (stage === 2) assert.equal(calls.filter(c => c.method !== 'GET').length, 0);
  if (stage === 3) assert.equal(calls.filter(c => c.route.includes('/git/refs')).length, 0);
  assert.equal(calls.filter(c => c.route.includes('/pulls') && c.method !== 'GET').length, 0);
});

test('strict review advance before publication leaves ref untouched', async t => {
  const calls = mockStrictSubmission(t, { state: n => n >= 3 ? { ...expectedReview, headSha: 'd'.repeat(40) } : expectedReview });
  const res = response(); await submitGuideUpdate(strictRequest({ expectedReview, replaceExistingReview: true }), res);
  assert.equal(res.body.code, 'REVIEW_STATE_CONFLICT');
  assert.equal(calls.filter(c => c.route.includes('/git/refs')).length, 0);
});

test('strict non-fast-forward publication never forces, retries or updates PR', async t => {
  const calls = mockStrictSubmission(t, { refStatus: 409 }); const res = response();
  await submitGuideUpdate(strictRequest({ expectedReview, replaceExistingReview: true }), res);
  assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'SOURCE_CONFLICT');
  const refs = calls.filter(c => c.route.includes('/git/refs'));
  assert.equal(refs.length, 1); assert.equal(refs[0].body.force, false);
  assert.equal(calls.filter(c => c.route.includes('/pulls') && c.method !== 'GET').length, 0);
});

test('review source and version use one captured immutable SHA', async t => {
  const calls = mockStrictSubmission(t); const res = response();
  await submitGuideUpdate(request(['repo'], { method: 'GET', url: '/guides/load', query: { path, source: 'review' } }), res);
  assert.equal(res.statusCode, 200); assert.deepEqual(res.body.reviewState, expectedReview);
  assert.equal(calls.find(c => c.route.includes('/contents/')).ref, res.body.reviewState.headSha);
  assert.equal(res.body.originalText, originalContent);
});

for (const provider of ['github', 'discord']) test(`strict dry-run returns ${provider} identity with zero external calls`, async () => {
  process.env.DRY_RUN = 'true'; const contributor = `${provider}:123`;
  const res = response(); await submitGuideUpdate(strictRequest({ expectedContributor: contributor,
    expectedReview: { state: 'unverified' } }, { provider, discordId: '123', pvmeMember: true,
    pvmeGuildId: '534508796639182860' }), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.contributor, contributor);
  assert.equal(res.body.reviewStateVerified, false); assert.equal(res.body.dryRun, true);
  assert.equal(res.body.user.githubToken, undefined);
});

test('strict contract never falls back through legacy routes or an unknown version', async () => {
  for (const url of ['/', '/submit-guide-update', '/submitGuideUpdate/']) {
    const req = strictRequest(); req.url = url; const res = response();
    await submitGuideUpdate(req, res);
    assert.equal(res.statusCode, 400); assert.equal(res.body.code, 'STRICT_ROUTE_REQUIRED');
  }
  const wrong = strictRequest({ contractVersion: 1 }); const res = response();
  await submitGuideUpdate(wrong, res); assert.equal(res.body.code, 'INVALID_CONTRACT');
  const unknown = strictRequest(); unknown.url = '/v3/submissions'; const missing = response();
  await submitGuideUpdate(unknown, missing); assert.equal(missing.statusCode, 404);
});

test('an accepted strict request keeps its captured session after browser account switching', async t => {
  const req = strictRequest({ expectedReview, replaceExistingReview: true });
  let switched = false;
  const calls = mockStrictSubmission(t, { onCall() {
    if (!switched) {
      switched = true;
      // Replace all request cookie/header reads as if another tab changed login.
      const other = request(['repo'], {}, { githubId: '999', githubLogin: 'other', githubToken: 'other-token' });
      req.get = other.get;
    }
  } });
  const res = response(); await submitGuideUpdate(req, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.contributor, 'github:123');
  assert.ok(calls.filter(c => c.method !== 'GET' && !c.route.includes('/pulls'))
    .every(c => c.route.startsWith('/repos/contributor/')));
  assert.match(calls.find(c => c.route.endsWith('/git/commits')).body.message, /contributor \(123\)/);
});

for (const present of [true, false]) {
  test(`load metadata is explicit for ${present ? 'existing' : 'absent'} review`, async t => {
    mockStrictSubmission(t, { present });
    for (const source of ['auto', 'master']) {
      const res = response(); await submitGuideUpdate(request(['repo'], { method: 'GET', url: '/guides/load', query: { path, source } }), res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body.reviewState, present ? expectedReview : { state: 'none' });
    }
  });
}

for (const stage of [2, 3]) {
  test(`new review appearing at recheck ${stage} never publishes over it`, async t => {
    const calls = mockStrictSubmission(t, { state: n => n >= stage ? expectedReview : null });
    const res = response(); await submitGuideUpdate(strictRequest(), res);
    assert.equal(res.body.code, 'REVIEW_STATE_CONFLICT');
    if (stage === 2) assert.equal(calls.filter(c => c.method !== 'GET').length, 0);
    assert.equal(calls.filter(c => c.route.includes('/git/refs')).length, 0);
  });
}

for (const stage of [2, 3, 4]) {
  test(`review disappearing at recheck ${stage} requires fresh consent`, async t => {
    const calls = mockStrictSubmission(t, { state: n => n >= stage ? null : expectedReview });
    const res = response(); await submitGuideUpdate(strictRequest({ expectedReview, replaceExistingReview: true }), res);
    assert.equal(res.body.code, 'REVIEW_STATE_CONFLICT');
    assert.equal(calls.filter(c => c.route.includes('/pulls') && c.method !== 'GET').length, 0);
  });
}

for (const field of ['sourcePreservation', 'replaceExistingReview']) test(`strict requires explicit ${field}`, async () => {
  const req = strictRequest(); delete req.body[field]; const res = response();
  await submitGuideUpdate(req, res); assert.equal(res.body.code, 'INVALID_CONTRACT');
});

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

function mockForkSubmission(t, options = {}) {
  const calls = [];
  const original = options.originalContent ?? originalContent;
  const pr = { id: 4242, number: 42, state: 'open', html_url: 'https://github.com/pvme/pvme-guides/pull/42', body: '',
    head: { sha: 'a'.repeat(40), ref: branch, repo: { full_name: 'contributor/pvme-guides' } },
    base: { ref: 'master', repo: { full_name: 'pvme/pvme-guides' } } };
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
      data = { object: { sha: 'a'.repeat(40) }, message: 'Not Found' };
    } else if (route.endsWith('/contents/.github/workflows')) {
      const upstream = route.startsWith('/repos/pvme/');
      assert.equal(parsed.searchParams.get('ref'), upstream ? 'upstream-sha' : 'master');
      status = !upstream && options.missingWorkflowDirectory ? 404 : (options.diagnosticStatus || 200);
      data = workflow(upstream || options.synced ? 'current-workflow' : 'old-workflow');
    } else if (route.includes('/contents/') && method === 'GET') {
      const n = calls.filter(c => c.route.includes('/contents/') && c.method === 'GET').length;
      data = { type: 'file', sha: 'file-sha', content: Buffer.from(options.changeOnRead === n ? 'Concurrent edit' : original).toString('base64') };
    } else if (route.includes('/git/commits/') && method === 'GET') {
      data = { tree: { sha: 'base-tree' } };
    } else if (route.endsWith('/git/trees') && method === 'POST') {
      data = { sha: 'edited-tree' };
    } else if (route.endsWith('/git/commits') && method === 'POST') {
      assert.equal(body.author, undefined);
      data = { sha: 'new-user-commit' };
    } else if (route.endsWith('/git/refs') || route.includes('/git/refs/heads/')) {
      status = options.refStatus || 201;
      data = { message: 'Not Found', object: { sha: 'upstream-sha' } };
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
  const writes = calls.filter(c => c.method === 'POST' && c.route.endsWith('/git/trees'));
  assert.equal(writes.length, 1);
  assert.equal(
    writes[0].body.tree[0].content,
    'Guide heading\r\n\r\n\tUpdated advice  \r\n',
  );
});

for (const exists of [false, true]) {
  test(`workflow mismatch during review branch ${exists ? 'replacement' : 'creation'} asks for fork sync, then retry succeeds`, async t => {
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
    assert.equal(calls.filter(c => c.route.includes('/git/refs') && c.method !== 'GET').length, 1);
    assert.equal(calls.filter(c => c.route.includes('/pulls') && c.method !== 'GET').length, 0);
    assert.equal(JSON.stringify(req.body), originalBody);
    // Simulate the contributor syncing on GitHub, then retry the identical draft.
    options.synced = true;
    options.refStatus = 201;
    const retried = response();
    await submitGuideUpdate(req, retried);
    assert.equal(retried.statusCode, exists ? 200 : 201);
    assert.equal(calls.filter(c => c.route.endsWith('/git/trees')).length, 2);
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
  assert.equal(calls.filter(c => c.route.includes('/git/refs')).length, 1);
  assert.equal(calls.filter(c => c.route.endsWith('/git/trees')).length, 1);
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


for (const provider of ['github', 'discord']) {
  test(`${provider} public user is allowlisted, retains CSRF and excludes credentials`, async () => {
    const res = response();
    await submitGuideUpdate(request(['repo'], { method: 'GET', url: '/auth/me' }, {
      provider, discordId: '456', pvmeMember: true, pvmeRoles: ['private-role'],
      discordToken: 'discord-secret', appPrivateKey: 'private-key', clientSecret: 'oauth-secret',
    }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.csrfToken, 'test-csrf');
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.deepEqual(Object.keys(res.body.user).sort(), (provider === 'github'
      ? ['provider','githubId','githubLogin','username','globalName','avatar','csrfToken','canReviewPrs','displayName']
      : ['provider','discordId','username','globalName','avatar','pvmeMember','csrfToken','canReviewPrs','displayName']).sort());
    for (const secret of ['test-oauth-token','discord-secret','private-key','oauth-secret','private-role'])
      assert.ok(!JSON.stringify(res.body).includes(secret));
  });
}

for (const origin of ['https://evil.example', 'https://pvme.io.evil.example', 'null', '*']) {
  test(`untrusted origin ${origin} is rejected before external calls`, async () => {
    if (origin === '*') { process.env.ALLOWED_ORIGIN = '*'; process.env.DRY_RUN = 'true'; }
    const res = response(); await submitGuideUpdate(request(['repo'], {}, {}, { origin }), res);
    assert.equal(res.statusCode, 403); assert.equal(res.headers['access-control-allow-origin'], undefined);
  });
}

for (const cookie of ['', 'pvme_guide_session=invalid', 'pvme_guide_session=%XX']) {
  test(`missing or malformed session rejects submission (${cookie})`, async () => {
    const res = response(); await submitGuideUpdate(request(['repo'], {}, {}, { cookie }), res);
    assert.equal(res.statusCode, 401);
  });
}

for (const exp of [0, undefined, '9999999999']) {
  test(`invalid session expiry ${exp} cannot authenticate`, async () => {
    const res = response(); await submitGuideUpdate(request(['repo'], {}, { exp }), res);
    assert.equal(res.statusCode, 401);
  });
}

test('invalid CSRF rejects submit and logout; valid logout clears secure cookies', async () => {
  for (const url of ['/', '/auth/logout']) {
    const res = response(); await submitGuideUpdate(request(['repo'], { url }, {}, { 'x-pvme-csrf-token': 'wrong' }), res);
    assert.equal(res.statusCode, 403);
  }
  const res = response(); await submitGuideUpdate(request(['repo'], { url: '/auth/logout' }), res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.headers['set-cookie'].every(c => c.includes('Max-Age=0') && c.includes('HttpOnly') && c.includes('Secure')));
});

function signed(value) {
  const p = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${p}.${crypto.createHmac('sha256', cookieSecret).update(p).digest('base64url')}`;
}
function decodedState(res) {
  return JSON.parse(Buffer.from(new URL(res.location).searchParams.get('state').split('.')[0], 'base64url'));
}

for (const returnTo of ['https://pvme.io/pvme-website/guides/melee/?edit=1#section', 'https://pvme.io/guide-editor/?id=guide', 'https://pvme.io/']) {
  test(`OAuth preserves approved return path ${returnTo}`, async () => {
    process.env.FRONTEND_ORIGIN = 'https://pvme.io/guide-editor/';
    const res = response(); await submitGuideUpdate(request([], { method: 'GET', url: '/auth/github/start', query: { returnTo } }), res);
    assert.equal(decodedState(res).returnTo, returnTo);
    assert.ok(res.headers['set-cookie'].includes('HttpOnly'));
    assert.ok(res.headers['set-cookie'].includes('SameSite=Lax'));
  });
}

for (const returnTo of ['https://evil.example/', '//evil.example/', 'javascript:alert(1)', 'https://user:password@pvme.io/', 'http://localhost:9999/', 'http://localhost:4321/']) {
  test(`production rejects OAuth return destination ${returnTo}`, async () => {
    process.env.FRONTEND_ORIGIN = 'https://pvme.io/guide-editor/';
    const res = response(); await submitGuideUpdate(request([], { method: 'GET', url: '/auth/github/start', query: { returnTo } }), res);
    assert.equal(decodedState(res).returnTo, 'https://pvme.io/guide-editor/');
  });
}

for (const port of [5173, 4321]) for (const provider of ['github', 'discord']) {
  test(`${provider} mocked OAuth roundtrip on localhost:${port} restores a public session`, async t => {
    process.env.DRY_RUN = 'true'; process.env.PVME_SUBMIT_SECRET = 'local-proxy';
    process.env.ALLOWED_ORIGIN = 'http://localhost:5173,http://localhost:4321,https://pvme.io';
    process.env.AUTH_COOKIE_SECURE = 'false'; process.env.AUTH_COOKIE_SAMESITE = 'Lax';
    process.env.DISCORD_CLIENT_ID = 'test-discord'; process.env.DISCORD_CLIENT_SECRET = 'test-discord-secret';
    process.env.GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI = port === 4321
      ? 'http://localhost:8080/auth/github/callback' : 'http://localhost:5173/api/guide-pr/auth/github/callback';
    const origin = `http://localhost:${port}`;
    const headers = { origin: '', 'x-pvme-submit-secret': 'local-proxy', 'x-pvme-proxy-origin': origin };
    const returnTo = `${origin}/${port === 4321 ? 'pvme-website' : 'guide-editor'}/?edit=1`;
    const start = response();
    await submitGuideUpdate(request([], { method: 'GET', url: `/auth/${provider}/start`, query: { returnTo } }, {}, headers), start);
    const authorization = new URL(start.location);
    assert.equal(authorization.searchParams.get('redirect_uri'), provider === 'github'
      ? process.env.GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI : `${origin}/api/guide-pr/auth/discord/callback`);
    const state = authorization.searchParams.get('state'); const cookie = start.headers['set-cookie'].split(';')[0];
    t.mock.method(globalThis, 'fetch', async url => ({ ok: true, status: 200, json: async () =>
      String(url).includes('token') ? { access_token: 'mock-provider-token', scope: 'repo read:user' }
        : String(url).includes('/member') ? { roles: [] }
        : provider === 'github' ? { id: 123, login: 'contributor' } : { id: '456', username: 'discord-user' } }));
    const callback = response();
    await submitGuideUpdate(request([], { method: 'GET', url: `/auth/${provider}/callback`, query: { code: 'mock-code', state } }, {}, { ...headers, cookie }), callback);
    if (provider === 'github') {
      const url = new URL(callback.location); assert.equal(url.origin, origin);
      const token = url.searchParams.get('githubSession'); assert.ok(token);
      const completed = response();
      await submitGuideUpdate(request([], { url: '/auth/dev-session', body: { token } }, {}, headers), completed);
      assert.equal(completed.statusCode, 200); assert.equal(completed.body.user.githubLogin, 'contributor');
      assert.ok(!JSON.stringify(completed.body).includes('mock-provider-token'));
      const wrongOrigin = response();
      await submitGuideUpdate(request([], { url: '/auth/dev-session', body: { token } }, {}, {
        ...headers, 'x-pvme-proxy-origin': port === 5173 ? 'http://localhost:4321' : 'http://localhost:5173',
      }), wrongOrigin);
      assert.equal(wrongOrigin.statusCode, 400);
    } else {
      assert.equal(callback.location, returnTo);
      assert.ok(callback.headers['set-cookie'].some(c => /^pvme_guide_session=v2\./.test(c)));
      assert.ok(callback.headers['set-cookie'].every(c => !c.includes('; Secure')));
      assert.ok(callback.headers['set-cookie'].some(c => c.startsWith('pvme_oauth_discord=;') && c.includes('Max-Age=0')));
    }
    const cancelled = response();
    await submitGuideUpdate(request([], { method: 'GET', url: `/auth/${provider}/callback`, query: { error: 'access_denied', state } }, {}, { ...headers, cookie }), cancelled);
    assert.equal(new URL(cancelled.location).pathname, new URL(returnTo).pathname);
    assert.ok(new URL(cancelled.location).searchParams.has('authError'));
  });
}

for (const provider of ['github', 'discord']) {
  test(`${provider} rejects tampered, expired, cross-provider and unbound state without OAuth exchange`, async () => {
    process.env.DISCORD_CLIENT_ID = 'test-discord'; process.env.DISCORD_CLIENT_SECRET = 'test-secret';
    const start = response(); await submitGuideUpdate(request([], { method: 'GET', url: `/auth/${provider}/start` }), start);
    const state = new URL(start.location).searchParams.get('state');
    const cookie = start.headers['set-cookie'].split(';')[0]; const decoded = decodedState(start);
    for (const [value, boundCookie] of [[state + 'tampered', cookie], [state, ''],
      [signed({ ...decoded, exp: 0 }), cookie], [signed({ ...decoded, provider: 'other' }), cookie]]) {
      const res = response();
      await submitGuideUpdate(request([], { method: 'GET', url: `/auth/${provider}/callback`, query: { code: 'mock', state: value } }, {}, { cookie: boundCookie }), res);
      assert.ok(new URL(res.location).searchParams.has('authError'));
      assert.ok(!String(res.headers['set-cookie']).includes('pvme_guide_session='));
    }
  });
}

test('spoofed proxy origin is ignored without a secret and in production', async () => {
  process.env.DISCORD_CLIENT_ID = 'test-discord'; process.env.DISCORD_CLIENT_SECRET = 'test-secret';
  for (const dry of ['true', 'false']) {
    process.env.DRY_RUN = dry; process.env.PVME_SUBMIT_SECRET = 'proxy-secret';
    const res = response();
    await submitGuideUpdate(request([], { method: 'GET', url: '/auth/discord/start' }, {}, {
      'x-pvme-proxy-origin': 'http://localhost:4321', 'x-pvme-submit-secret': dry === 'true' ? 'wrong' : 'proxy-secret', host: 'guide-api.pvme.io',
    }), res);
    assert.equal(new URL(res.location).searchParams.get('redirect_uri'), 'https://guide-api.pvme.io/auth/discord/callback');
  }
});

test('production excludes dev-session authentication bypass', async () => {
  const res = response(); await submitGuideUpdate(request([], { url: '/auth/dev-session', body: { token: 'forged' } }), res);
  assert.equal(res.statusCode, 403); assert.equal(res.headers['set-cookie'], undefined);
});

const exactSource = '  Unicode \u{1f409} \u00e9\r\n JSON { "key" : "value" }  \n\t.preset = x\r\n---\n';
for (const source of ['auto', 'master', 'review']) {
  test(`loading ${source} preserves exact mixed EOL, Unicode, whitespace and PvME syntax`, async t => {
    mockForkSubmission(t, { originalContent: exactSource, existingPr: source === 'review' });
    const res = response(); await submitGuideUpdate(request(['repo'], { method: 'GET', url: '/guides/load', query: { path, source } }), res);
    assert.equal(res.statusCode, 200); assert.equal(res.body.originalText, exactSource);
    assert.equal(res.body.source, source === 'review' ? 'user-pr' : 'master');
    assert.equal(crypto.createHash('sha256').update(res.body.originalText).digest('hex'), crypto.createHash('sha256').update(exactSource).digest('hex'));
  });
}

test('auto detects existing PR; master retains replacement metadata', async t => {
  mockForkSubmission(t, { existingPr: true });
  for (const source of ['auto', 'master']) {
    const res = response(); await submitGuideUpdate(request(['repo'], { method: 'GET', url: '/guides/load', query: { path, source } }), res);
    if (source === 'auto') { assert.equal(res.body.hasExistingReview, true); assert.equal(res.body.reviewBranch, branch); assert.equal(res.body.originalText, undefined); }
    else { assert.equal(res.body.existingReviewBranch, branch); assert.ok(res.body.existingReviewUrl); }
  }
});

test('existing review replacement requires explicit consent', async t => {
  const calls = mockForkSubmission(t, { existingPr: true }); const res = response();
  await submitGuideUpdate(request(['repo']), res); assert.equal(res.statusCode, 409);
  assert.equal(calls.filter(c => c.method !== 'GET').length, 0);
});

for (const exact of [false, true]) {
  test(`mixed source patch remains exact with exact mode=${exact}`, async t => {
    const calls = mockForkSubmission(t, { originalContent: exactSource }); const req = request(['repo']);
    Object.assign(req.body, { originalContent: exactSource, content: exactSource.replace('value', 'new value') });
    if (exact) req.body.sourcePreservation = 'exact';
    const res = response(); await submitGuideUpdate(req, res); assert.equal(res.statusCode, 201);
    assert.equal(calls.find(c => c.route.endsWith('/git/trees')).body.tree[0].content, req.body.content);
  });
}

test('exact mode permits deliberate conversion of uniform CRLF to LF', async t => {
  const calls = mockForkSubmission(t, { originalContent: 'Old\r\n' }); const req = request(['repo']);
  Object.assign(req.body, { originalContent: 'Old\r\n', content: 'New\n', sourcePreservation: 'exact' });
  const res = response(); await submitGuideUpdate(req, res); assert.equal(res.statusCode, 201);
  assert.equal(calls.find(c => c.route.endsWith('/git/trees')).body.tree[0].content, 'New\n');
});

for (const source of ['master', 'user-pr']) {
  test(`${source} concurrent snapshot change is rejected before object creation`, async t => {
    const calls = mockForkSubmission(t, { existingPr: source === 'user-pr', changeOnRead: 2 }); const req = request(['repo']);
    Object.assign(req.body, { source, branch: source === 'master' ? 'master' : branch });
    const res = response(); await submitGuideUpdate(req, res); assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'SOURCE_CONFLICT');
    assert.equal(calls.filter(c => c.method !== 'GET').length, 0);
  });
  test(`concurrent ${source} branch advance rejects non-fast-forward publish without retry or PR update`, async t => {
    const calls = mockForkSubmission(t, { existingPr: true, refStatus: 422, synced: true }); const req = request(['repo']);
    Object.assign(req.body, { source, branch: source === 'master' ? 'master' : branch, replaceExistingReview: true });
    const res = response(); await submitGuideUpdate(req, res); assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'SOURCE_CONFLICT');
    const refs = calls.filter(c => c.route.includes('/git/refs') && c.method !== 'GET');
    assert.equal(refs.length, 1); assert.equal(refs[0].body.force, false);
    assert.equal(calls.filter(c => c.route.includes('/pulls') && c.method !== 'GET').length, 0);
  });
}

test('master changing before publish leaves review ref and PR untouched', async t => {
  const calls = mockForkSubmission(t, { changeOnRead: 3 }); const res = response();
  await submitGuideUpdate(request(['repo']), res); assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'SOURCE_CONFLICT');
  assert.equal(calls.filter(c => c.route.includes('/git/refs') && c.method !== 'GET').length, 0);
});

for (const source of ['master', 'user-pr']) {
  test(`dry-run ${source} submission validates identity and payload with zero external calls`, async () => {
    process.env.DRY_RUN = 'true'; const req = request(['repo']);
    Object.assign(req.body, { source, branch: source === 'master' ? 'master' : branch });
    const res = response(); await submitGuideUpdate(req, res); assert.equal(res.statusCode, 200); assert.equal(res.body.dryRun, true);
    assert.equal(res.body.reviewBranch, branch); assert.equal(res.body.user.githubToken, undefined);
  });
}

test('dry-run enforces Discord membership and source branch ownership', async () => {
  process.env.DRY_RUN = 'true'; const res = response();
  await submitGuideUpdate(request([], {}, { provider: 'discord', discordId: '456', pvmeMember: false }), res); assert.equal(res.statusCode, 403);
  const req = request(['repo']); Object.assign(req.body, { source: 'user-pr', branch: 'somebody-else' });
  const rejected = response(); await submitGuideUpdate(req, rejected); assert.equal(rejected.statusCode, 403);
});

for (const pathValue of ['../secret.txt', '/absolute.txt', 'folder/../../secret.txt', 'guide.json', 'a\\b.txt', 'a/./b.txt']) {
  test(`invalid guide path ${pathValue} is rejected`, async () => {
    const req = request(['repo']); req.body.path = pathValue; const res = response();
    await submitGuideUpdate(req, res); assert.equal(res.statusCode, 400);
  });
}

test('missing review branch rejects load and update without writes', async t => {
  const calls = mockForkSubmission(t); const req = request(['repo']); Object.assign(req.body, { source: 'user-pr', branch });
  const submitted = response(); await submitGuideUpdate(req, submitted); assert.equal(submitted.statusCode, 409);
  const loaded = response(); await submitGuideUpdate(request(['repo'], { method: 'GET', url: '/guides/load', query: { path, source: 'review' } }), loaded);
  assert.equal(loaded.statusCode, 404); assert.equal(calls.filter(c => c.method !== 'GET').length, 0);
});


for (const replace of [false, true]) {
  test(`${replace ? 'replacement' : 'new'} submission publishes immutable tree and contributor metadata`, async t => {
    const calls = mockForkSubmission(t, { existingPr: replace });
    const req = request(['repo']); Object.assign(req.body, { replaceExistingReview: replace, title: 'Visual JSON edit', notes: 'Keep JSON spacing' });
    const res = response(); await submitGuideUpdate(req, res);
    assert.equal(res.statusCode, replace ? 200 : 201);
    const commit = calls.find(c => c.route.endsWith('/git/commits') && c.method === 'POST');
    assert.deepEqual(commit.body.parents, replace ? ['a'.repeat(40), 'upstream-sha'] : ['upstream-sha']);
    assert.equal(commit.body.author, undefined);
    assert.match(commit.body.message, /Submitted by GitHub user: contributor \(123\)/);
    const tree = calls.find(c => c.route.endsWith('/git/trees'));
    assert.equal(tree.body.base_tree, 'base-tree'); assert.equal(tree.body.tree[0].path, path);
    const ref = calls.find(c => c.route.includes('/git/refs') && c.method !== 'GET');
    assert.equal(ref.body.sha, 'new-user-commit');
    if (replace) assert.equal(ref.body.force, false); else assert.equal(ref.body.ref, `refs/heads/${branch}`);
    const pr = calls.find(c => c.route.includes('/pulls') && c.method !== 'GET');
    assert.equal(pr.body.title, 'Visual JSON edit'); assert.match(pr.body.body, /Keep JSON spacing/);
    assert.match(pr.body.body, /contributor/);
  });
}

for (const strict of [false, true]) test(`two concurrent editors cannot publish sibling commits over each other (strict=${strict})`, async t => {
  let reviewHead = reviewSha; let commitCount = 0; let publications = 0;
  const parents = new Map(); let release;
  const bothReady = new Promise(resolve => { release = resolve; });
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const route = new URL(url).pathname; const method = init.method;
    const body = init.body ? JSON.parse(init.body) : null;
    let data; let status = 200;
    if (route.endsWith('/git/ref/heads/master')) data = { object: { sha: 'upstream-sha' } };
    else if (route.includes('/git/ref/heads/guide-editor/')) data = { object: { sha: reviewHead } };
    else if (route.includes('/contents/')) {
      assert.equal(new URL(url).searchParams.get('ref'), reviewSha);
      data = { type: 'file', sha: 'old-file-sha', content: Buffer.from(originalContent).toString('base64') };
    } else if (route.includes('/git/commits/')) data = { tree: { sha: 'review-tree' } };
    else if (route.endsWith('/git/trees')) data = { sha: 'new-tree' };
    else if (route.endsWith('/git/commits')) {
      const sha = `commit-${++commitCount}`; parents.set(sha, body.parents[0]);
      if (commitCount === 2) release(); await bothReady; data = { sha };
    } else if (route.includes('/git/refs/heads/')) {
      assert.equal(body.force, false);
      if (parents.get(body.sha) !== reviewHead) { status = 422; data = { message: 'Update is not a fast forward' }; }
      else { reviewHead = body.sha; publications++; data = { object: { sha: reviewHead } }; }
    } else if (route.includes('/pulls')) data = method === 'GET' ? [{ id: 4242, number: 42, state: 'open',
      html_url: expectedReview.prUrl, body: '', head: { sha: reviewHead, ref: branch, repo: { full_name: expectedReview.repository } },
      base: { ref: 'master', repo: { full_name: 'pvme/pvme-guides' } } }] : { html_url: expectedReview.prUrl };
    else throw new Error(`Unexpected request ${route}`);
    return { ok: status < 400, status, json: async () => data };
  });
  const responses = [response(), response()];
  await Promise.all(responses.map((res, i) => {
    const req = strict ? strictRequest({ expectedReview }) : request(['repo']);
    Object.assign(req.body, { source: 'user-pr', branch, content: `Editor ${i}` });
    return submitGuideUpdate(req, res);
  }));
  assert.deepEqual(responses.map(r => r.statusCode).sort(), [200, 409]);
  assert.equal(publications, 1); assert.equal(responses.find(r => r.statusCode === 409).body.code, 'SOURCE_CONFLICT');
});

for (const strict of [false, true]) test(`Discord contributors use the App identity, shared branch naming and Discord attribution (strict=${strict})`, async t => {
  process.env.GITHUB_APP_ID = '123'; process.env.GITHUB_INSTALLATION_ID = '456';
  process.env.GITHUB_APP_PRIVATE_KEY = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  const discordBranch = 'guide-editor/discord-456/dpm-advice-dpm-advice-melee'; const writes = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const route = new URL(url).pathname; const method = init.method; const body = init.body ? JSON.parse(init.body) : null;
    let data; let status = 200;
    if (route.includes('/app/installations/')) data = { token: 'mock-app-token' };
    else {
      assert.equal(init.headers.Authorization, 'Bearer mock-app-token');
      assert.ok(route.startsWith('/repos/pvme/pvme-guides/'));
      if (method !== 'GET') writes.push({ route, method, body });
      if (route.endsWith('/git/ref/heads/master')) data = { object: { sha: 'master-sha' } };
      else if (route.includes('/git/ref/heads/guide-editor/')) { status = 404; data = { message: 'Not Found' }; }
      else if (route.includes('/contents/')) data = { type: 'file', sha: 'file-sha', content: Buffer.from(originalContent).toString('base64') };
      else if (route.includes('/git/commits/')) data = { tree: { sha: 'base-tree' } };
      else if (route.endsWith('/git/trees')) data = { sha: 'edited-tree' };
      else if (route.endsWith('/git/commits')) data = { sha: 'commit-sha' };
      else if (route.endsWith('/git/refs')) data = { object: { sha: 'commit-sha' } };
      else if (route.endsWith('/pulls')) data = method === 'GET' ? [] : { html_url: 'https://github.com/pvme/pvme-guides/pull/43' };
      else throw new Error(`Unexpected request ${route}`);
    }
    return { ok: status < 400, status, json: async () => data };
  });
  const res = response();
  const session = { provider: 'discord', discordId: '456', username: 'discord-contributor', pvmeMember: true, pvmeGuildId: '534508796639182860' };
  const req = strict ? strictRequest({ expectedContributor: 'discord:456' }, session) : request([], {}, session);
  await submitGuideUpdate(req, res);
  assert.equal(res.statusCode, 201); assert.equal(res.body.branch, discordBranch);
  if (strict) assert.equal(res.body.contributor, 'discord:456');
  const commit = writes.find(c => c.route.endsWith('/git/commits'));
  assert.deepEqual(commit.body.author, { name: 'discord-contributor', email: '456@discord.pvme.io' });
  assert.match(commit.body.message, /Submitted by Discord user/);
  assert.equal(writes.find(c => c.route.endsWith('/pulls')).body.head, discordBranch);
  assert.ok(!JSON.stringify(res.body).includes('mock-app-token'));
});

test('dry-run blocks every reviewer mutation before any GitHub call', async () => {
  process.env.DRY_RUN = 'true'; process.env.GUIDE_EDITOR_REVIEWER_GITHUB_LOGINS = 'contributor';
  for (const action of ['file', 'comment', 'review', 'merge', 'close']) {
    const res = response(); await submitGuideUpdate(request(['repo'], { url: `/reviews/pulls/42/${action}`, method: action === 'file' ? 'PUT' : 'POST' }), res);
    assert.equal(res.statusCode, 403); assert.match(res.body.error, /disabled in dry-run/);
  }
});

test('inaccessible fork stops before branch or PR writes', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.equal(init.method, 'GET');
    return { ok: false, status: 403, json: async () => ({ message: 'Repository is inaccessible' }) };
  });
  const res = response(); await submitGuideUpdate(request(['repo']), res);
  assert.equal(res.statusCode, 403);
});

test('dry-run source reads only public master and refuses review snapshots', async t => {
  process.env.DRY_RUN = 'true';
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(init, undefined); assert.ok(String(url).startsWith('https://raw.githubusercontent.com/pvme/pvme-guides/master/'));
    return { ok: true, text: async () => exactSource };
  });
  for (const source of ['auto', 'master', 'review']) {
    const res = response(); await submitGuideUpdate(request(['repo'], { method: 'GET', url: '/guides/load', query: { path, source } }), res);
    assert.equal(res.statusCode, source === 'review' ? 404 : 200);
    if (source !== 'review') { assert.equal(res.body.originalText, exactSource); assert.equal(res.body.dryRun, true); }
  }
});


test('legacy readable GitHub cookies and dev handoffs cannot be used as authenticated session cookies', async () => {
  const legacy = signed({ provider: 'github', githubId: '123', githubLogin: 'contributor', githubToken: 'legacy-token', exp: Math.floor(Date.now() / 1000) + 3600 });
  const legacyResponse = response();
  await submitGuideUpdate(request([], { method: 'GET', url: '/auth/me' }, {}, { cookie: `pvme_guide_session=${legacy}` }), legacyResponse);
  assert.equal(legacyResponse.body.user, null);
  const handoff = response();
  await submitGuideUpdate(request([], { method: 'GET', url: '/auth/me' }, { devSession: true, devOrigin: 'http://localhost:4321' }), handoff);
  assert.equal(handoff.body.user, null);
});

test('trusted origin fallback preserves legacy submit/logout; proxy requires explicit CSRF', async () => {
  process.env.DRY_RUN = 'true';
  const res = response();
  await submitGuideUpdate(request(['repo'], {}, {}, { 'x-pvme-csrf-token': '' }), res);
  assert.equal(res.statusCode, 200);
  process.env.PVME_SUBMIT_SECRET = 'local-proxy';
  const rejected = response();
  await submitGuideUpdate(request(['repo'], {}, {}, { origin: '', 'x-pvme-submit-secret': 'local-proxy', 'x-pvme-csrf-token': '' }), rejected);
  assert.equal(rejected.statusCode, 403);
});

for (const text of [' Leading\nJSON { "x": 1 }  \n\n', ' Leading\r\nJSON { "x": 1 }  \r\n', 'Guide with no final newline', 'Lone\rCR\r']) {
  test(`exact source write retains source formatting ${JSON.stringify(text)}`, async t => {
    const calls = mockForkSubmission(t, { originalContent: text }); const req = request(['repo']);
    Object.assign(req.body, { originalContent: text, content: text.replace(/Leading|Guide|Lone/, 'Changed'), sourcePreservation: 'exact' });
    const res = response(); await submitGuideUpdate(req, res); assert.equal(res.statusCode, 201);
    assert.equal(calls.find(c => c.route.endsWith('/git/trees')).body.tree[0].content, req.body.content);
  });
}


test('missing GitHub fork is created through contributor identity before normal submission', async t => {
  let forkCreated = false; let forkRequests = 0;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const route = new URL(url).pathname; const method = init.method;
    assert.equal(init.headers.Authorization, 'Bearer test-oauth-token');
    let data; let status = 200;
    if (route === '/repos/pvme/pvme-guides/forks') {
      assert.equal(method, 'POST'); forkCreated = true; forkRequests++; data = {};
    } else if (route.endsWith('/git/ref/heads/master')) {
      if (route.startsWith('/repos/contributor/') && !forkCreated) { status = 404; data = { message: 'Not Found' }; }
      else data = { object: { sha: 'master-sha' } };
    } else if (route.includes('/git/ref/heads/guide-editor/')) { status = 404; data = { message: 'Not Found' }; }
    else if (route.includes('/contents/')) data = { type: 'file', sha: 'file-sha', content: Buffer.from(originalContent).toString('base64') };
    else if (route.includes('/git/commits/')) data = { tree: { sha: 'tree' } };
    else if (route.endsWith('/git/trees')) data = { sha: 'new-tree' };
    else if (route.endsWith('/git/commits')) data = { sha: 'commit' };
    else if (route.endsWith('/git/refs')) data = { object: { sha: 'commit' } };
    else if (route.endsWith('/pulls')) data = method === 'GET' ? [] : { html_url: 'https://github.com/pvme/pvme-guides/pull/44' };
    else throw new Error(`Unexpected ${method} ${route}`);
    return { ok: status < 400, status, json: async () => data };
  });
  const res = response(); await submitGuideUpdate(request(['repo']), res);
  assert.equal(res.statusCode, 201); assert.equal(forkRequests, 1);
});
