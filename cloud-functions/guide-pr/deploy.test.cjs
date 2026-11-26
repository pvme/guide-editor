const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TARGET, PRODUCTION, loadProductionEnv, buildDeploymentPlan, deploy } = require('./deploy.js');

function production() {
  return {
    name: `projects/${TARGET.project}/locations/${TARGET.region}/functions/${TARGET.name}`,
    environment: 'GEN_2', state: 'ACTIVE', updateTime: '2026-10-28T15:20:48Z',
    buildConfig: { runtime: 'nodejs22', entryPoint: TARGET.name },
    serviceConfig: {
      revision: 'submitguideupdate-00062-res', serviceAccountEmail: 'runtime@example.iam.gserviceaccount.com',
      environmentVariables: {
        PVME_SUBMIT_SECRET: 'production-submit-value', DISCORD_CLIENT_ID: '123', GITHUB_APP_ID: '456',
        GUIDE_EDITOR_REVIEWER_GITHUB_LOGINS: 'existing-reviewer', UNRELATED_FEATURE: 'retained',
      },
      secretEnvironmentVariables: ['AUTH_COOKIE_SECRET', 'DISCORD_CLIENT_SECRET', 'GITHUB_APP_PRIVATE_KEY',
        'GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_ID', 'GUIDE_EDITOR_GITHUB_OAUTH_CLIENT_SECRET',
        'GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI'].map(key => ({ key, projectId: '123', secret: key, version: 'latest' })),
      secretVolumes: [{ mountPath: '/existing-volume', projectId: '123', secret: 'existing', versions: [{ version: '1', path: 'value' }] }],
    },
  };
}

function temporaryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-pr-deploy-test-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('guide-pr-deploy-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}

test('only production env files load; exported settings win', t => {
  const root = temporaryRoot(t);
  for (const name of ['.env', '.env.local', '.env.development', '.env.development.local']) {
    fs.writeFileSync(path.join(root, name), 'DRY_RUN=true\nDEVELOPMENT_ONLY=must-not-load');
  }
  fs.writeFileSync(path.join(root, '.env.production'), 'DRY_RUN=false\nORDER=production\nQUOTED="quoted value"');
  fs.writeFileSync(path.join(root, '.env.production.local'), 'ORDER=production-local');
  const env = loadProductionEnv(root, { ORDER: 'exported' });
  assert.equal(env.DRY_RUN, 'false');
  assert.equal(env.DEVELOPMENT_ONLY, undefined);
  assert.equal(env.ORDER, 'exported');
  assert.equal(env.QUOTED, 'quoted value');
});

for (const key of Object.keys(PRODUCTION)) {
  test(`production setting ${key} must be explicit`, () => {
    const env = { ...PRODUCTION }; delete env[key];
    assert.throws(() => buildDeploymentPlan(env, production()), new RegExp(key));
  });
}

for (const [key, value] of [
  ['DRY_RUN', 'true'], ['AUTH_COOKIE_SECURE', 'false'], ['AUTH_COOKIE_SAMESITE', 'Lax'],
  ['ALLOWED_ORIGIN', '*'], ['TRUSTED_ORIGIN', 'https://pvme.io,http://localhost:5173'],
  ['DISCORD_REDIRECT_URI', 'http://localhost:5173/api/guide-pr/auth/discord/callback'],
  ['GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI', 'http://localhost:8080/auth/github/callback'],
  ['GITHUB_OAUTH_REDIRECT_URI', 'http://127.0.0.1:8080/auth/github/callback'],
  ['FRONTEND_ORIGIN', 'http://localhost:4321/'],
]) {
  test(`rejects unsafe production setting ${key}`, () => {
    assert.throws(() => buildDeploymentPlan({ ...PRODUCTION, [key]: value }, production()), new RegExp(key));
  });
}

for (const value of ['...', 'local-dev-cookie-secret', 'same-as-root-env', 'test-secret', 'change-me', 'your-secret', 'framework-only-nonsecret']) {
  test(`rejects known development placeholder (${value}) without echoing it`, () => {
    assert.throws(() => buildDeploymentPlan({ ...PRODUCTION, PVME_SUBMIT_SECRET: value }, production()), error => {
      assert.match(error.message, /placeholder/);
      assert.ok(!error.message.includes(value)); return true;
    });
  });
}

test('preserves every deployed environment entry, binding and runtime identity', () => {
  const current = production(); const snapshot = JSON.stringify(current);
  const plan = buildDeploymentPlan(PRODUCTION, current);
  assert.equal(JSON.stringify(current), snapshot);
  for (const [key, value] of Object.entries(current.serviceConfig.environmentVariables)) {
    assert.equal(plan.environment[key], value);
  }
  assert.equal(plan.environment.GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI, undefined);
  assert.deepEqual(plan.verifyCallbacks, [{ provider: 'github', expected: PRODUCTION.GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI }]);
  assert.equal(plan.serviceAccount, current.serviceConfig.serviceAccountEmail);
});

test('rejects credential, reviewer, cookie-domain and Secret Manager binding changes', () => {
  for (const [key, value] of [
    ['PVME_SUBMIT_SECRET', 'different-production-value'], ['GUIDE_EDITOR_REVIEWER_GITHUB_LOGINS', 'another-reviewer'],
    ['AUTH_COOKIE_DOMAIN', 'pvme.io'], ['AUTH_COOKIE_SECRET_SECRET', 'another-secret'],
    ['GITHUB_APP_PRIVATE_KEY_SECRET', 'another-key'],
  ]) assert.throws(() => buildDeploymentPlan({ ...PRODUCTION, [key]: value }, production()), /preserve/);
});

test('rejects wrong project, runtime, entry point, generation, missing configuration and new function creation', () => {
  for (const modify of [c => { c.name = 'other'; }, c => { c.buildConfig.runtime = 'nodejs20'; },
    c => { c.buildConfig.entryPoint = 'other'; }, c => { c.environment = 'GEN_1'; },
    c => { c.serviceConfig.serviceAccountEmail = ''; }, c => { delete c.serviceConfig.environmentVariables.DISCORD_CLIENT_ID; }]) {
    const current = production(); modify(current);
    assert.throws(() => buildDeploymentPlan(PRODUCTION, current));
  }
  assert.throws(() => buildDeploymentPlan({ ...PRODUCTION, GCLOUD_PROJECT_ID: 'other-project' }, production()));
});

function mockExecution(t, { status = 0, throwOnDeploy = false, drift = false } = {}) {
  const calls = []; let file;
  const execute = args => {
    calls.push(args);
    if (args[1] === 'describe') {
      const current = production();
      if (drift && calls.length > 1) current.serviceConfig.revision = 'newer-revision';
      return { status: 0, stdout: JSON.stringify(current) };
    }
    assert.equal(args[1], 'deploy');
    assert.ok(!args.some(arg => /secrets|unauthenticated|clear-/.test(arg)));
    assert.ok(args.includes('--service-account=runtime@example.iam.gserviceaccount.com'));
    file = args.find(arg => arg.startsWith('--env-vars-file=')).slice('--env-vars-file='.length);
    const values = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(values.PVME_SUBMIT_SECRET, 'production-submit-value');
    assert.equal(values.UNRELATED_FEATURE, 'retained');
    assert.ok(!args.join(' ').includes('production-submit-value'));
    if (throwOnDeploy) throw new Error('Mock deployment exception');
    return { status, stdout: '', stderr: 'Untrusted CLI output must never be printed' };
  };
  return { execute, calls, file: () => file };
}

function safeFetch() {
  return Promise.resolve({ status: 302, headers: new Headers({ location:
    `https://github.com/login/oauth/authorize?redirect_uri=${encodeURIComponent(PRODUCTION.GUIDE_EDITOR_GITHUB_OAUTH_REDIRECT_URI)}` }) });
}

for (const options of [{}, { status: 1 }, { throwOnDeploy: true }]) {
  test(`temporary sensitive configuration is removed after deployment result ${JSON.stringify(options)}`, async t => {
    const root = temporaryRoot(t); const mock = mockExecution(t, options);
    const action = deploy({ env: PRODUCTION, root, tempRoot: root, execute: mock.execute, fetchFn: safeFetch });
    if (options.status || options.throwOnDeploy) await assert.rejects(action);
    else assert.equal((await action).previousRevision, 'submitguideupdate-00062-res');
    assert.ok(mock.file()); assert.ok(!fs.existsSync(mock.file()));
    assert.deepEqual(fs.readdirSync(root), []);
  });
}

test('configuration drift aborts before deployment and removes temporary configuration', async t => {
  const root = temporaryRoot(t); const mock = mockExecution(t, { drift: true });
  await assert.rejects(deploy({ env: PRODUCTION, root, tempRoot: root, execute: mock.execute, fetchFn: safeFetch }), /changed during preflight/);
  assert.equal(mock.calls.filter(args => args[1] === 'deploy').length, 0);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('unverified secret-bound callback aborts before deployment', async t => {
  const root = temporaryRoot(t); const mock = mockExecution(t);
  await assert.rejects(deploy({ env: PRODUCTION, root, tempRoot: root, execute: mock.execute,
    fetchFn: async () => ({ status: 302, headers: new Headers({ location: 'https://github.com/login/oauth/authorize?redirect_uri=http://localhost:5173/' }) }) }), /callback/);
  assert.equal(mock.calls.length, 1); assert.deepEqual(fs.readdirSync(root), []);
});

test('invalid explicit configuration cannot run any gcloud command', async t => {
  const root = temporaryRoot(t);
  await assert.rejects(deploy({ env: { ...PRODUCTION, DRY_RUN: 'true' }, root,
    execute: () => { assert.fail('gcloud must not run'); } }), /DRY_RUN/);
});
