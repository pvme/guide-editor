import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAuthenticatedUser, submitGuideUpdate } from './guidePrApi.js';

test('fork sync errors reach the submit UI without losing their recovery code', async t => {
  const payload = { content: 'Draft stays here', notes: 'Update abilities' };
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'include');
    assert.deepEqual(JSON.parse(options.body), payload);
    return {
      ok: false, status: 409,
      json: async () => ({ code: 'FORK_SYNC_REQUIRED', error: 'Sync your fork and retry this draft.' }),
    };
  });
  await assert.rejects(submitGuideUpdate(payload), error => {
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
    return { ok: true, json: async () => ({ prUrl: 'https://github.com/pvme/pvme-guides/pull/42' }) };
  });
  await getAuthenticatedUser();
  assert.equal((await submitGuideUpdate({ content: 'Updated guide' })).prUrl, 'https://github.com/pvme/pvme-guides/pull/42');
});
