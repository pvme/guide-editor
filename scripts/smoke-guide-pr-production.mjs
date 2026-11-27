// Public, anonymous checks only. No redirects, credentials, valid updates or writes.
import assert from 'node:assert/strict';
const base = 'https://guide-api.pvme.io';
async function request(path, options = {}) {
  return fetch(base + path, { redirect: 'manual', cache: 'no-store',
    signal: AbortSignal.timeout(20000), ...options,
    headers: { Origin: 'https://pvme.io', ...(options.headers || {}) } });
}
try {
  const response = await request('/');
  const health = await response.json();
  assert.equal(response.status, 200);
  assert.equal(health.ok, true);
  assert.equal(health.mode, 'live');
  assert.equal(health.repo, 'pvme/pvme-guides');
  assert.equal(health.baseBranch, 'master');
  const submission = await request('/v2/submissions', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(submission.status, 401);
  assert.match(submission.headers.get('cache-control'), /no-store/i);
  console.log('Production health: 200 live; strict v2: 401 anonymous rejection, no-store.');
} catch {
  console.error('Production smoke failed; raw response details withheld.');
  process.exitCode = 1;
}
