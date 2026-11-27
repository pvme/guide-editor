// Check the actual production bundle against mocked API responses. Never contacts
// the live API, providers or GitHub. Requires an existing Playwright installation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { preview } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await preview({ configFile: false, envFile: false, base: '/guide-editor/',
  preview: { host: '127.0.0.1', port: 5188, strictPort: true } });
let browser;
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const user = { provider: 'github', githubId: '123', githubLogin: 'mock-contributor', username: 'mock-contributor',
    globalName: '', avatar: '', displayName: 'Mock contributor', csrfToken: 'synthetic-release-csrf', canReviewPrs: false };
  const guide = { name: 'Release verification', repo: 'pvme/pvme-guides', baseBranch: 'master', path: 'mock/release.txt',
    source: 'master', branch: 'master', originalText: 'Original\r\nLone\rCR\n', reviewState: { state: 'none' },
    expectedContributor: 'github:123', prUrl: '', existingReviewBranch: '', existingReviewUrl: '' };
  const content = guide.originalText + 'Edited\n';
  const apiRequests = [];
  let posts = 0;
  await page.addInitScript(({ guide, content }) => {
    localStorage.setItem('guideEditorDrafts', JSON.stringify({ version: 1, activeDraftId: 'production-check',
      drafts: [{ id: 'production-check', name: guide.name, content, loadedGuide: guide, createdAt: 1, updatedAt: 1 }] }));
    window.releaseFetches = [];
    const original = window.fetch.bind(window);
    window.fetch = (url, options = {}) => {
      window.releaseFetches.push({ url: String(url), method: options.method || 'GET', credentials: options.credentials, cache: options.cache });
      return original(url, options);
    };
  }, { guide, content });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === 'https://guide-api.pvme.io') {
      apiRequests.push({ path: url.pathname, method: request.method() });
      const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:5188', 'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type,X-PVME-CSRF-Token', 'Access-Control-Allow-Methods': 'GET,POST' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname === '/auth/me') return route.fulfill({ headers, json: { user } });
      if (url.pathname === '/guides/load') return route.fulfill({ headers, json: guide });
      assert.equal(url.pathname, '/v2/submissions'); assert.equal(request.method(), 'POST');
      posts++;
      const payload = request.postDataJSON();
      assert.equal(payload.contractVersion, 2); assert.equal(payload.expectedContributor, 'github:123');
      assert.deepEqual(payload.expectedReview, { state: 'none' });
      assert.equal(payload.sourcePreservation, 'exact'); assert.equal(payload.replaceExistingReview, false);
      assert.equal(payload.content, content); assert.equal(payload.originalContent, guide.originalText);
      assert.equal(request.headers()['x-pvme-csrf-token'], user.csrfToken);
      return route.fulfill({ status: 201, headers, json: { contractVersion: 2, contributor: 'github:123',
        path: guide.path, branch: 'guide-editor/github-123/mock-release',
        reusedReview: false, prUrl: 'https://github.com/pvme/pvme-guides/pull/42' } });
    }
    if (url.origin === 'http://127.0.0.1:5188') {
      assert.ok(!url.pathname.includes('/api/guide-pr'), 'Production must not use the dev proxy');
      return route.continue();
    }
    if (url.pathname.endsWith('.txt')) return route.fulfill({ body: '' });
    return route.fulfill({ json: /channels|roles|users/.test(url.pathname) ? [] : {} });
  });
  await page.goto('http://127.0.0.1:5188/guide-editor/');
  await page.locator('.cm-content').waitFor();
  await page.locator('.submit-guide-main').click();
  await page.locator('.pr-submit-textarea').fill('Mock release verification');
  const acknowledge = page.getByLabel('I understand this update includes unresolved checker issues.');
  if (await acknowledge.count()) await acknowledge.check();
  await page.locator('.pr-submit-form button[type="submit"]').click();
  await page.getByText('your update has been submitted for review', { exact: false }).waitFor();
  assert.equal(posts, 1); assert.deepEqual(errors, []);
  const fetches = await page.evaluate(() => window.releaseFetches.filter(x => x.url.startsWith('https://guide-api.pvme.io')));
  assert.ok(fetches.every(request => request.credentials === 'include' && request.cache === 'no-store'));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('guideEditorDrafts')).drafts.find(d => d.id === 'production-check'));
  assert.equal(saved.content, content); assert.equal(saved.loadedGuide.originalText, guide.originalText);
  const report = { checkedAt: new Date().toISOString(), passed: true, mode: 'production bundle; all API/external requests intercepted',
    apiOrigin: 'https://guide-api.pvme.io', posts, strictPath: '/v2/submissions', credentialedNoStore: true,
    exactSourceAndDraftRetained: true, runtimeErrors: errors, apiRequests };
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
