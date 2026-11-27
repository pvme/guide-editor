// Optional local browser regression: PLAYWRIGHT_MODULE may point to an existing
// Playwright installation. No credentials or remote API/GitHub writes are used.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import svelteConfig from '../svelte.config.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
// Do not load repository env files or install the development proxy.
const server = await createServer({ configFile: false, envFile: false,
  base: '/guide-editor/', plugins: [tailwindcss(), svelte(svelteConfig)],
  define: { 'import.meta.env.VITE_GUIDE_PR_ENDPOINT_LOCAL': JSON.stringify('http://localhost:8080') },
  server: { host: '127.0.0.1', port: 5187, strictPort: true } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const user = { provider: 'github', githubId: '123', githubLogin: 'alice', username: 'alice',
    globalName: '', avatar: '', displayName: 'Alice', csrfToken: 'explicit-csrf', canReviewPrs: false };
  const review = { state: 'present', repository: 'alice/pvme-guides', branch: 'guide-editor/github-123/guides-test',
    headSha: 'a'.repeat(40), prId: 23, prNumber: 42, prUrl: 'https://github.com/pvme/pvme-guides/pull/42' };
  const base = { name: 'Test', path: 'guides/test.txt', repo: 'pvme/pvme-guides', baseBranch: 'master',
    source: 'master', branch: 'master', originalText: 'First\r\nSecond\rThird\n😀  \n',
    expectedContributor: 'github:123', reviewState: { state: 'none' }, prUrl: '', existingReviewBranch: '', existingReviewUrl: '' };
  const scenarios = ['success-inflight', 'dry-run', 'dry-run-live-health', 'dry-run-bad-health', 'dry-run-unavailable-health',
    'dry-run-changed-health', 'uncertain', 'stale-head', 'new-review', 'account-change', 'recovery', 'replacement', 'csrf', 'old-backend'];
  for (const scenario of scenarios) {
    console.log(`Checking ${scenario}`);
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    let session = user;
    let guide = structuredClone(base);
    if (['stale-head', 'replacement'].includes(scenario)) Object.assign(guide, {
      reviewState: review, existingReviewBranch: review.branch, existingReviewUrl: review.prUrl });
    if (scenario.startsWith('dry-run')) Object.assign(guide, { reviewState: { state: 'unverified' }, dryRun: true });
    let healthReads = 0;
    let fresh = structuredClone(guide);
    if (scenario === 'stale-head') fresh.reviewState.headSha = 'b'.repeat(40);
    if (scenario === 'new-review') Object.assign(fresh, { reviewState: review, existingReviewBranch: review.branch, existingReviewUrl: review.prUrl });
    if (scenario === 'recovery') { delete guide.reviewState; delete guide.expectedContributor; }
    let posts = [];
    let release;
    let posted;
    const postSeen = new Promise(resolve => { posted = resolve; });
    const responseGate = new Promise(resolve => { release = resolve; });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.includes('/api/guide-pr/')) {
        if (url.pathname.endsWith('/api/guide-pr/')) {
          healthReads++;
          if (scenario === 'dry-run-unavailable-health') return route.fulfill({ status: 503, json: { error: 'Offline' } });
          return route.fulfill({ json: { ok: true,
            mode: scenario === 'dry-run-live-health' || (scenario === 'dry-run-changed-health' && healthReads > 1) ? 'live' : 'dry-run',
            repo: scenario === 'dry-run-bad-health' ? 'other/repository' : 'pvme/pvme-guides', baseBranch: 'master' } });
        }
        if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: { user: session } });
        if (url.pathname.endsWith('/guides/load')) return route.fulfill({ json: fresh });
        assert.ok(url.pathname.endsWith('/v2/submissions'), `Unexpected mutation ${url.pathname}`);
        const payload = route.request().postDataJSON(); posts.push(payload); posted();
        assert.equal(route.request().headers()['x-pvme-csrf-token'], user.csrfToken);
        if (scenario === 'success-inflight') await responseGate;
        if (scenario === 'csrf') return route.fulfill({ status: 403, json: { code: 'CSRF_INVALID', error: 'Rejected' } });
        if (scenario === 'old-backend') return route.fulfill({ status: 404, json: { error: 'Unknown route' } });
        if (scenario === 'uncertain') return route.fulfill({ json: { prUrl: review.prUrl } });
        if (scenario === 'dry-run') return route.fulfill({ json: { contractVersion: 2, contributor: 'github:123', dryRun: true,
          reviewStateVerified: false, message: 'Validated', path: payload.path, title: payload.title, user,
          source: payload.source, branch: payload.branch, reviewBranch: review.branch,
          contentBytes: Buffer.byteLength(payload.content), originalContentBytes: Buffer.byteLength(payload.originalContent) } });
        return route.fulfill({ status: scenario === 'replacement' ? 200 : 201, json: { contractVersion: 2,
          contributor: 'github:123', branch: review.branch, path: payload.path,
          prUrl: review.prUrl, reusedReview: scenario === 'replacement' } });
      }
      if (url.hostname === '127.0.0.1') return route.continue();
      // Mock every external read. Nothing reaches real OAuth, GitHub or API hosts.
      if (url.pathname.endsWith('.txt')) return route.fulfill({ body: '' });
      return route.fulfill({ json: /channels|roles|users/.test(url.pathname) ? [] : {} });
    });
    await page.goto('http://127.0.0.1:5187/guide-editor/');
    await page.locator('.cm-content').waitFor().catch(async error => {
      console.error((await page.locator('body').innerText()).slice(0, 3000));
      throw error;
    });
    const content = guide.originalText + 'Edited\n';
    await page.evaluate(async ({ guide, content }) => {
      const stores = await import('/guide-editor/src/stores.js');
      stores.drafts.create({ id: 'captured-draft', content, loadedGuide: guide });
    }, { guide, content });
    await page.locator('.submit-guide-main').click();
    await page.locator('.pr-submit-textarea').fill('Change text');
    if (scenario === 'recovery') {
      await page.getByRole('button', { name: 'Validate recovered draft source' }).click();
      await page.getByText('Exact source validated.', { exact: false }).waitFor();
    }
    const acknowledge = page.getByLabel('I understand this update includes unresolved checker issues.');
    if (await acknowledge.count()) await acknowledge.check();
    if (['stale-head', 'replacement'].includes(scenario)) {
      await page.locator('.pr-submit-form input[type="checkbox"]').first().check();
    }
    if (scenario === 'account-change') session = { ...user, githubId: '456', githubLogin: 'bob' };
    if (!scenario.startsWith('dry-run-') || scenario === 'dry-run-changed-health') {
      await page.locator('.pr-submit-form button[type="submit"]').click();
    }
    if (scenario === 'success-inflight') {
      let timer;
      try {
        await Promise.race([postSeen, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('No strict POST observed')), 10000);
        })]);
      } finally { clearTimeout(timer); }
      session = { ...user, githubId: '456', githubLogin: 'bob' };
      await page.evaluate(async () => {
        const stores = await import('/guide-editor/src/stores.js');
        stores.text.update(value => value + 'Newer edits\n');
        stores.authUser.set({ provider: 'github', githubId: '456', githubLogin: 'bob' });
      });
      release();
    }
    const blockedHealth = scenario.startsWith('dry-run-');
    const expectedMessage = blockedHealth ? (scenario === 'dry-run-unavailable-health' ? 'Offline' : 'Local backend dry-run mode could not be verified')
      : ['stale-head', 'new-review'].includes(scenario) ? 'The review changed'
      : scenario === 'account-change' ? 'Restore the contributor account'
        : scenario === 'uncertain' ? 'Publication is uncertain'
          : scenario === 'csrf' ? 'Refresh your login deliberately'
            : scenario === 'old-backend' ? 'strict backend route is unavailable'
              : scenario === 'dry-run' ? 'Local dry-run validation passed'
                : 'your update has been submitted for review';
    await page.getByText(expectedMessage, { exact: false }).first().waitFor();
    assert.equal(posts.length, blockedHealth || ['stale-head', 'new-review', 'account-change'].includes(scenario) ? 0 : 1);
    if (scenario.startsWith('dry-run')) assert.ok(healthReads >= 1);
    if (posts.length) {
      assert.equal(posts[0].content, content);
      assert.equal(posts[0].originalContent, guide.originalText);
      assert.equal(posts[0].sourcePreservation, 'exact');
      assert.equal(posts[0].contractVersion, 2);
      assert.equal(posts[0].expectedContributor, 'github:123');
    }
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('guideEditorDrafts')).drafts.find(d => d.id === 'captured-draft'));
    assert.equal(saved.content, content + (scenario === 'success-inflight' ? 'Newer edits\n' : ''));
    assert.equal(saved.loadedGuide.originalText, guide.originalText);
    assert.equal(saved.loadedGuide.expectedContributor, scenario === 'recovery' ? 'github:123' : guide.expectedContributor);
    assert.deepEqual(errors, []);
    console.log(`PASS ${scenario}: ${posts.length} strict POST; exact draft retained`);
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
