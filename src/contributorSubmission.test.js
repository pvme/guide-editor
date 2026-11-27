import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EditorState } from '@codemirror/state';
import { exactDocument, exactLineSeparator } from './codemirror/exactDocument.js';
import { toggleBold } from './codemirror/commands.js';
import { prepareSubmission, sourceBinding, assertSourceUnchanged, validateRecoveredSource,
  validateSource, submissionRecovery, contributorIdentity } from './contributorSubmission.js';
import { parseSubmissionResult, SubmissionUncertainError } from './submission-contract.js';
import { parseReviewState } from './review-state.js';
import { captureGuideLoad } from './contributorSource.js';

const user = { provider: 'github', githubId: '123', githubLogin: 'alice', username: 'alice',
  globalName: '', avatar: '', displayName: 'Alice', csrfToken: 'csrf', canReviewPrs: false };
const review = { state: 'present', repository: 'alice/pvme-guides',
  branch: 'guide-editor/github-123/guides-test', headSha: 'a'.repeat(40),
  prId: 23, prNumber: 42, prUrl: 'https://github.com/pvme/pvme-guides/pull/42' };
const base = { repo: 'pvme/pvme-guides', baseBranch: 'master', path: 'guides/test.txt',
  source: 'master', branch: 'master', originalText: 'Original\r\ntext\rtrailing\n',
  expectedContributor: 'github:123', reviewState: { state: 'none' }, prUrl: '',
  existingReviewBranch: '', existingReviewUrl: '' };
const replacement = { ...base, reviewState: review, existingReviewBranch: review.branch, existingReviewUrl: review.prUrl };
const prepare = (guide = base, extras = {}) => prepareSubmission({ guide, user,
  content: guide.originalText + 'Edited\n', title: 'Update guide', notes: 'Change text', ...extras });

test('strict preparation captures exact source, qualified identity and immutable review', () => {
  const guide = structuredClone(replacement);
  const payload = prepare(guide, { consent: sourceBinding(guide) });
  guide.reviewState.headSha = 'b'.repeat(40);
  assert.equal(payload.expectedReview.headSha, review.headSha);
  assert.ok(Object.isFrozen(payload.expectedReview));
  assert.equal(payload.contractVersion, 2);
  assert.equal(payload.sourcePreservation, 'exact');
  assert.equal(payload.originalContent, base.originalText);
  assert.equal(payload.replaceExistingReview, true);
  assert.equal(contributorIdentity({ provider: 'discord', discordId: '123' }), 'discord:123');
  assert.throws(() => prepare(base, { user: { ...user, githubId: '456' } }), /Restore the account/);
});

test('replacement consent binds contributor, guide, source and every review field', () => {
  assert.throws(() => prepare(replacement), /Confirm replacing/);
  const consent = sourceBinding(replacement);
  const changes = { expectedContributor: 'github:456', path: 'guides/other.txt',
    originalText: 'Different', source: 'user-pr' };
  for (const [key, value] of Object.entries(changes)) {
    assert.notEqual(sourceBinding({ ...replacement, [key]: value }), consent);
  }
  for (const [key, value] of Object.entries(review)) {
    assert.notEqual(sourceBinding({ ...replacement, reviewState: { ...review,
      [key]: typeof value === 'number' ? value + 1 : value + 'x' } }), consent);
  }
  assert.throws(() => prepare({ ...replacement, reviewState: { ...review, headSha: 'b'.repeat(40) } }, { consent }), /Confirm replacing/);
});

test('review-source submission uses its captured version and false replacement', () => {
  const guide = { ...base, source: 'user-pr', branch: review.branch, prUrl: review.prUrl, reviewState: review };
  assert.equal(prepare(guide).replaceExistingReview, false);
  assert.deepEqual(prepare(guide).expectedReview, review);
});

test('same text cannot mask changed, appeared, disappeared, closed or replaced reviews', () => {
  for (const fresh of [base, { ...replacement, reviewState: { ...review, headSha: 'b'.repeat(40) } },
    { ...replacement, reviewState: { ...review, prId: 24 } },
    { ...replacement, reviewState: { ...review, prNumber: 43, prUrl: review.prUrl.replace('42', '43') }, existingReviewUrl: review.prUrl.replace('42', '43') }]) {
    assert.throws(() => assertSourceUnchanged(replacement, fresh, user));
  }
  assert.throws(() => assertSourceUnchanged(base, replacement, user));
  assert.doesNotThrow(() => assertSourceUnchanged(replacement, structuredClone(replacement), user));
});

test('legacy and anonymous drafts require deliberate exact source validation without rebasing', () => {
  const legacy = { ...base }; delete legacy.reviewState; delete legacy.expectedContributor;
  assert.throws(() => prepare(legacy));
  assert.equal(validateRecoveredSource(legacy, replacement, user), replacement);
  assert.throws(() => validateRecoveredSource(legacy, { ...base, originalText: 'changed' }, user), /differs/);
  assert.throws(() => validateRecoveredSource({ ...legacy, expectedContributor: 'github:456' }, base, user), /original contributor/);
  assert.equal(validateRecoveredSource({ ...base, expectedContributor: '' }, base, user), base);
  assert.equal(legacy.originalText, base.originalText);
});

test('unverified requires both explicit local dry-run permission and backend load marker', () => {
  const guide = { ...base, reviewState: { state: 'unverified' }, dryRun: true };
  assert.throws(() => prepare(guide));
  assert.throws(() => validateSource({ ...guide, dryRun: false }, user, true));
  assert.equal(prepare(guide, { allowUnverified: true }).expectedReview.state, 'unverified');
  assert.throws(() => parseReviewState({ state: 'none', headSha: 'fake' }));
});

test('real and dry-run results validate identity, status, branch, path, PR and bytes', () => {
  const payload = prepare();
  const success = { contractVersion: 2, contributor: 'github:123', path: base.path,
    branch: review.branch, prUrl: review.prUrl, reusedReview: false };
  assert.equal(parseSubmissionResult(success, payload, 201).prUrl, review.prUrl);
  for (const patch of [{ contractVersion: 1 }, { contributor: 'discord:123' }, { path: 'other.txt' },
    { branch: 'guide-editor/github-456/test' }, { prUrl: 'https://evil.test/pr' }, { reusedReview: true }, { dryRun: false }]) {
    assert.throws(() => parseSubmissionResult({ ...success, ...patch }, payload, 201), SubmissionUncertainError);
  }
  const dry = { contractVersion: 2, contributor: 'github:123', path: base.path, dryRun: true,
    reviewStateVerified: false, message: 'Validated', title: payload.title, user,
    source: 'master', branch: 'master', reviewBranch: review.branch,
    contentBytes: Buffer.byteLength(payload.content), originalContentBytes: Buffer.byteLength(payload.originalContent) };
  assert.equal(parseSubmissionResult(dry, payload, 200).dryRun, true);
  for (const patch of [{ reviewStateVerified: true }, { contentBytes: 0 }, { originalContentBytes: 0 },
    { user: { ...user, githubId: '456' } }, { reviewBranch: 'master' }, { branch: review.branch }]) {
    assert.throws(() => parseSubmissionResult({ ...dry, ...patch }, payload, 200), SubmissionUncertainError);
  }
  assert.throws(() => parseSubmissionResult(success, payload, 200));
  assert.throws(() => parseSubmissionResult(success, prepare(replacement, { consent: sourceBinding(replacement) }), 201));
});

test('CodeMirror load, switch and edit preserve mixed CRLF, lone CR, Unicode and final newlines', () => {
  const original = 'First\r\nSecond\rThird\n😀 e\u0301  \n\n';
  let state = EditorState.create({ doc: exactDocument(original), extensions: [exactLineSeparator] });
  assert.equal(state.doc.toString(), original);
  state = state.update({ changes: { from: 0, insert: 'X' } }).state;
  assert.equal(state.doc.toString(), 'X' + original);
  state = state.update({ changes: { from: 0, to: state.doc.length, insert: exactDocument(original) } }).state;
  assert.equal(state.doc.toString(), original);
  state = state.update({ changes: { from: 0, to: state.doc.length, insert: original + 'tool edit\r\n' } }).state;
  assert.equal(state.doc.toString(), original + 'tool edit\r\n');
  state = state.update({ selection: { anchor: 0, head: original.length } }).state;
  toggleBold({ state, dispatch: transaction => { state = transaction.state; } });
  assert.equal(state.doc.toString(), '**' + original + '**tool edit\r\n');
});

test('account changes across source loading reject the load', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ user: { ...user, githubId: ++calls === 1 ? '123' : '456' } }) }));
  await assert.rejects(captureGuideLoad(async () => base), /Account changed/);
});

test('every structured error gives draft-preserving recovery, including uncertain publication', () => {
  for (const code of ['INVALID_CONTRACT', 'STRICT_ROUTE_REQUIRED', 'INVALID_CONTRIBUTOR', 'CONTRIBUTOR_MISMATCH',
    'CSRF_INVALID', 'INVALID_REVIEW_STATE', 'REPLACEMENT_CONSENT_REQUIRED', 'REVIEW_STATE_CONFLICT', 'SOURCE_CONFLICT', 'FORK_SYNC_REQUIRED']) {
    assert.match(submissionRecovery({ code }), /draft is retained/);
  }
  for (const status of [400, 401, 403, 404, 413, 429, 500, undefined]) {
    assert.match(submissionRecovery({ status }), /draft is retained/);
  }
  assert.match(submissionRecovery(new Error('Network lost')), /Publication is uncertain/);
});
