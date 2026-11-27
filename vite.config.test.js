import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { guideSubmitProxy } from './vite.config.js';

const localEnv = { VITE_GUIDE_PR_ENDPOINT_LOCAL: 'http://localhost:8080',
  VITE_GUIDE_PR_ENDPOINT_LIVE: 'https://guide-api.pvme.io', PVME_SUBMIT_SECRET: 'local-only-secret' };

function handler(env = localEnv, options) {
  let middleware;
  guideSubmitProxy(env, options).configureServer({ middlewares: { use(prefix, fn) {
    assert.equal(prefix, '/api/guide-pr'); middleware = fn;
  } } });
  return middleware;
}
function response() {
  return { headers: {}, setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; } };
}
function request(url = '/', method = 'GET', body = '') {
  const req = Readable.from([Buffer.from(body)]);
  Object.assign(req, { url, method, headers: { cookie: 'pvme_guide_session=encrypted', 'x-pvme-csrf-token': 'csrf' } });
  return req;
}

for (const port of [5173, 4321]) {
  test(`proxy forwards credentials, body and CSRF for localhost:${port} and preserves redirect paths`, async t => {
    const mock = t.mock.method(globalThis, 'fetch', async (url, init) => {
      assert.equal(url, 'http://localhost:8080/auth/dev-session');
      assert.equal(init.headers['X-PVME-Submit-Secret'], 'local-only-secret');
      assert.equal(init.headers['X-PVME-Proxy-Origin'], `http://localhost:${port}`);
      assert.equal(init.headers.Cookie, 'pvme_guide_session=encrypted');
      assert.equal(init.headers['X-PVME-CSRF-Token'], 'csrf');
      assert.equal(init.body.toString(), '{"token":"encrypted"}');
      assert.equal(init.redirect, 'manual');
      return { status: 302, text: async () => '', headers: {
        getSetCookie: () => ['a=one; Path=/; HttpOnly; Secure; SameSite=None', 'b=two; Secure; SameSite=Lax'],
        get: name => name === 'location' ? `http://localhost:${port}/pvme-website/?edit=1` : 'application/json',
      } };
    });
    const res = response();
    await handler(localEnv, { frontendOrigin: `http://localhost:${port}` })(request('/auth/dev-session', 'POST', '{"token":"encrypted"}'), res);
    assert.equal(mock.mock.callCount(), 1); assert.equal(res.statusCode, 302);
    assert.equal(res.headers.location, `http://localhost:${port}/pvme-website/?edit=1`);
    assert.deepEqual(res.headers['set-cookie'], ['a=one; Path=/; HttpOnly; SameSite=Lax', 'b=two; SameSite=Lax']);
  });
}

test('unavailable local backend never falls back to production', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async url => {
    assert.ok(url.startsWith('http://localhost:8080/')); throw new Error('Local backend unavailable');
  });
  const res = response(); await handler()(request('/guides/load?path=guide.txt'), res);
  assert.equal(res.statusCode, 502); assert.equal(mock.mock.callCount(), 1);
});

for (const status of [201, 403, 404, 409, 500]) {
  test(`strict proxy preserves v2 route, assertions and CSRF without retry after ${status}`, async t => {
    const body = JSON.stringify({ contractVersion: 2, expectedContributor: 'github:123',
      expectedReview: { state: 'none' }, sourcePreservation: 'exact', replaceExistingReview: false });
    const mock = t.mock.method(globalThis, 'fetch', async (url, init) => {
      assert.equal(url, 'http://localhost:8080/v2/submissions');
      assert.equal(init.method, 'POST');
      assert.equal(init.headers['X-PVME-CSRF-Token'], 'csrf');
      assert.equal(init.body.toString(), body);
      return { status, text: async () => '{"contractVersion":2}', headers: { get: () => null, getSetCookie: () => [] } };
    });
    const res = response(); await handler()(request('/v2/submissions', 'POST', body), res);
    assert.equal(res.statusCode, status); assert.equal(mock.mock.callCount(), 1);
  });
}

test('proxy delegates OAuth cancellation state validation to backend', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, 'http://localhost:8080/auth/github/callback?error=access_denied&state=untrusted');
    return { status: 302, text: async () => '', headers: { get: () => null, getSetCookie: () => [] } };
  });
  const res = response(); await handler()(request('/auth/github/callback?error=access_denied&state=untrusted'), res);
  assert.equal(res.statusCode, 302);
});

test('missing server secret or endpoint fails before any network call', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('No network allowed'); });
  for (const env of [{}, { VITE_GUIDE_PR_ENDPOINT_LOCAL: 'http://localhost:8080' }]) {
    const res = response(); await handler(env)(request(), res); assert.equal(res.statusCode, 503);
  }
  assert.throws(() => guideSubmitProxy(localEnv, { frontendOrigin: 'https://evil.example' }));
});
