import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

// Exercise the real API module with build-time development settings, isolated
// from any repository env files. Dependencies remain the real strict validators.
let moduleNumber = 0;
async function localApi(t, overrides = {}, hostname = 'localhost') {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { hostname } });
  t.after(() => descriptor ? Object.defineProperty(globalThis, 'location', descriptor) : delete globalThis.location);
  const environment = { DEV: true, VITE_GUIDE_PR_ENDPOINT_LOCAL: 'http://localhost:8080', ...overrides };
  const source = readFileSync(new URL('./guidePrApi.js', import.meta.url), 'utf8')
    .replace("'./submission-contract.js'", JSON.stringify(new URL('./submission-contract.js', import.meta.url).href))
    .replace('import.meta.env || {}', JSON.stringify(environment));
  return import('data:text/javascript;base64,' + Buffer.from(source + `\n// instance ${++moduleNumber}`).toString('base64'));
}
const health = { ok: true, mode: 'dry-run', repo: 'pvme/pvme-guides', baseBranch: 'master' };
const guide = { dryRun: true, reviewState: { state: 'unverified' } };

test('unverified load requires a fresh successful backend health check', async t => {
  const api = await localApi(t);
  const urls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    urls.push(url); assert.equal(options.cache, 'no-store');
    return { ok: true, status: 200, json: async () => url.endsWith('/') ? health : guide };
  });
  assert.equal(api.isLocalDryRun(), false);
  assert.deepEqual(await api.loadGuideForReview('guides/test.txt'), guide);
  assert.equal(api.isLocalDryRun(), true);
  assert.equal(urls.length, 2);
});

for (const patch of [{ ok: false }, { mode: 'live' }, { repo: 'other/repo' }, { baseBranch: 'other' }]) {
  test(`unverified load rejects invalid health ${JSON.stringify(patch)}`, async t => {
    const api = await localApi(t);
    t.mock.method(globalThis, 'fetch', async url => ({ ok: true, json: async () => url.endsWith('/') ? { ...health, ...patch } : guide }));
    await assert.rejects(api.loadGuideForReview('guides/test.txt'), /dry-run mode could not be verified/);
    assert.equal(api.isLocalDryRun(), false);
  });
}

test('failed recheck revokes prior local verification and never posts unverified data', async t => {
  const api = await localApi(t);
  let live = false;
  const methods = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    methods.push(options.method); return { ok: true, json: async () => ({ ...health, mode: live ? 'live' : 'dry-run' }) };
  });
  await api.verifyLocalDryRun(); live = true;
  await assert.rejects(api.submitGuideUpdateStrict({ expectedReview: { state: 'unverified' } },
    { csrf: 'synthetic', allowUnverified: true }), /dry-run mode could not be verified/);
  assert.equal(api.isLocalDryRun(), false);
  assert.deepEqual(methods, ['GET', 'GET']);
});

test('network failure and missing load marker cannot authorize unverified review state', async t => {
  const api = await localApi(t);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Offline'); });
  await assert.rejects(api.verifyLocalDryRun(), /Offline/);
  assert.equal(api.isLocalDryRun(), false);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ ...guide, dryRun: false }) }));
  await assert.rejects(api.loadGuideForReview('guides/test.txt'), /local dry-run source/);
});

for (const [environment, hostname] of [[{ DEV: false }, 'localhost'], [{}, 'pvme.io'],
  [{ VITE_GUIDE_PR_ENDPOINT_LOCAL: 'https://guide-api.pvme.io' }, 'localhost']]) {
  test(`health alone cannot enable unverified state outside local development ${hostname} ${JSON.stringify(environment)}`, async t => {
    const api = await localApi(t, environment, hostname);
    t.mock.method(globalThis, 'fetch', () => assert.fail('Nonlocal configuration must not request health'));
    await assert.rejects(api.verifyLocalDryRun(), /disabled outside/);
    assert.equal(api.isLocalDryRun(), false);
  });
}
