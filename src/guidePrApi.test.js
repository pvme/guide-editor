import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAuthenticatedUser, submitGuideUpdateStrict } from './guidePrApi.js';

const strictPayload = { contractVersion: 2, expectedContributor: 'github:123', expectedReview: { state: 'none' },
  content: 'Draft stays here', originalContent: 'Original', type: 'update', repo: 'pvme/pvme-guides',
  baseBranch: 'master', path: 'guides/test.txt', source: 'master', branch: 'master',
  notes: 'Changes', sourcePreservation: 'exact', replaceExistingReview: false };

test('fork sync errors reach the submit UI without losing their recovery code', async t => {
  const payload = { ...strictPayload };
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'include');
    assert.deepEqual(JSON.parse(options.body), payload);
    return {
      ok: false, status: 409,
      json: async () => ({ code: 'FORK_SYNC_REQUIRED', error: 'Sync your fork and retry this draft.' }),
    };
  });
  await assert.rejects(submitGuideUpdateStrict(payload, { csrf: 'explicit-csrf' }), error => {
    assert.equal(error.code, 'FORK_SYNC_REQUIRED');
    assert.equal(error.message, 'Sync your fork and retry this draft.');
    return true;
  });
  assert.equal(payload.content, 'Draft stays here');
});

test('authenticated submissions keep CSRF protection and return the contributor PR URL', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/auth/me')) {
      return { ok: true, json: async () => ({ user: { githubId: '123', csrfToken: 'csrf-from-session' } }) };
    }
    assert.equal(options.headers['X-PVME-CSRF-Token'], 'csrf-from-session');
    return { ok: true, status: 201, json: async () => ({ contractVersion: 2, contributor: 'github:123',
      path: strictPayload.path, branch: 'guide-editor/github-123/guides-test', reusedReview: false,
      prUrl: 'https://github.com/pvme/pvme-guides/pull/42' }) };
  });
  await getAuthenticatedUser();
  assert.equal((await submitGuideUpdateStrict(strictPayload, { csrf: 'csrf-from-session' })).prUrl, 'https://github.com/pvme/pvme-guides/pull/42');
});

test('strict submission requires explicit CSRF even after session restore', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Missing explicit CSRF must not POST'));
  for (const csrf of [undefined, '', '   ']) {
    await assert.rejects(submitGuideUpdateStrict(strictPayload, { csrf }), error => error.code === 'CSRF_INVALID');
  }
});

test('invalid or unverified-live strict requests fail before any network call', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Invalid strict request must not POST'));
  for (const patch of [{ contractVersion: 1 }, { expectedContributor: '123' }, { expectedReview: undefined },
    { sourcePreservation: undefined }, { replaceExistingReview: 'true' }, { expectedReview: { state: 'unverified' } }]) {
    await assert.rejects(submitGuideUpdateStrict({ ...strictPayload, ...patch }, { csrf: 'explicit', allowUnverified: true }));
  }
});

test('strict result validation uses the submitted snapshot despite caller mutation', async t => {
  const payload = structuredClone(strictPayload);
  t.mock.method(globalThis, 'fetch', async () => {
    payload.path = 'other.txt'; payload.expectedContributor = 'github:456';
    return { ok: true, status: 201, json: async () => ({ contractVersion: 2, contributor: 'github:123',
      path: strictPayload.path, branch: 'guide-editor/github-123/guides-test', reusedReview: false,
      prUrl: 'https://github.com/pvme/pvme-guides/pull/42' }) };
  });
  assert.equal((await submitGuideUpdateStrict(payload, { csrf: 'captured' })).contributor, 'github:123');
});

for (const status of [404, 403, 409, 500]) {
  test(`strict client retains assertions and never retries or falls back after ${status}`, async t => {
    const payload = { contractVersion: 2, expectedContributor: 'github:123',
      expectedReview: { state: 'none' }, content: 'Retained draft',
      originalContent: 'Original', type: 'update', repo: 'pvme/pvme-guides',
      baseBranch: 'master', path: 'guides/test.txt', source: 'master', branch: 'master',
      notes: 'Changes', sourcePreservation: 'exact', replaceExistingReview: false };
    let attempts = 0;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      attempts++;
      assert.ok(url.endsWith('/v2/submissions'));
      assert.deepEqual(JSON.parse(options.body), payload);
      assert.equal(options.credentials, 'include');
      return { ok: false, status, json: async () => ({ code: 'REVIEW_STATE_CONFLICT',
        error: 'Your login session could not be verified. Keep draft.' }) };
    });
    await assert.rejects(submitGuideUpdateStrict(payload, { csrf: 'explicit-csrf' }), error => error.status === status);
    assert.equal(attempts, 1); assert.equal(payload.expectedContributor, 'github:123');
  });
}
