import { validateLoadedReview, reviewKey, validContributor } from './review-state.js';
import { validateStrictUpdate } from './submission-contract.js';

export function contributorIdentity(user) {
  const identity = user?.provider === 'github' ? `github:${user.githubId}`
    : user?.provider === 'discord' ? `discord:${user.discordId}` : '';
  return validContributor(identity) ? identity : '';
}

// Includes exact original bytes and every immutable review field, never just text/head.
export function sourceBinding(guide) {
  return JSON.stringify([guide?.expectedContributor, guide?.path, guide?.repo,
    guide?.baseBranch, guide?.source, guide?.branch, guide?.originalText,
    reviewKey(guide?.reviewState)]);
}

export function validateSource(guide, user, allowUnverified = false) {
  if (!guide?.expectedContributor || guide.expectedContributor !== contributorIdentity(user)) {
    throw Object.assign(new Error('Restore the account that loaded this draft, or explicitly validate a recovered source. Your draft is retained.'), { code: 'CONTRIBUTOR_MISMATCH' });
  }
  if (guide.repo !== 'pvme/pvme-guides' || guide.baseBranch !== 'master' || typeof guide.originalText !== 'string') {
    throw new Error('Reload this guide from the source. Keep or export your draft first.');
  }
  return validateLoadedReview(guide, guide.expectedContributor, user, allowUnverified);
}

export function prepareSubmission({ guide, user, content, title, notes, consent, allowUnverified = false }) {
  const review = validateSource(guide, user, allowUnverified);
  const replacement = guide.source === 'master' && review.state === 'present';
  if (replacement && consent !== sourceBinding(guide)) {
    throw Object.assign(new Error('Confirm replacing the captured review version after inspecting its PR.'), { code: 'REPLACEMENT_CONSENT_REQUIRED' });
  }
  const payload = {
    contractVersion: 2, expectedContributor: guide.expectedContributor,
    expectedReview: Object.freeze({ ...review }), type: 'update', repo: guide.repo,
    baseBranch: guide.baseBranch, path: guide.path, originalContent: guide.originalText,
    content, title, notes: notes.trim(), source: guide.source, branch: guide.branch,
    existingReviewBranch: guide.existingReviewBranch || '',
    replaceExistingReview: replacement, sourcePreservation: 'exact'
  };
  validateStrictUpdate(payload, user, allowUnverified);
  return Object.freeze(payload);
}

export function assertSourceUnchanged(captured, fresh, user, allowUnverified = false) {
  validateSource(fresh, user, allowUnverified);
  if (sourceBinding(captured) !== sourceBinding(fresh)) {
    throw Object.assign(new Error('Source or review version changed. Keep/export this draft, inspect the review, then load a fresh source and give fresh consent. No merge or rebase was performed.'), {
      code: reviewKey(captured.reviewState) !== reviewKey(fresh.reviewState) ? 'REVIEW_STATE_CONFLICT' : 'SOURCE_CONFLICT'
    });
  }
}

// Deliberate legacy recovery may attach metadata only when exact source still matches.
export function validateRecoveredSource(captured, fresh, user, allowUnverified = false) {
  if (captured?.expectedContributor && captured.expectedContributor !== contributorIdentity(user)) {
    throw Object.assign(new Error('Restore the original contributor account to validate this draft.'), { code: 'CONTRIBUTOR_MISMATCH' });
  }
  if (captured.reviewState) {
    assertSourceUnchanged({ ...captured, expectedContributor: captured.expectedContributor || fresh.expectedContributor }, fresh, user, allowUnverified);
  } else if (['path', 'repo', 'source', 'branch', 'originalText'].some(key => captured[key] !== fresh[key])) {
    throw new Error('The recovered source differs from the fresh source. Keep/export the draft and load a new source; apply your edits manually.');
  }
  validateSource(fresh, user, allowUnverified);
  return fresh;
}

export function submissionRecovery(error) {
  const guidance = {
    INVALID_CONTRACT: 'The strict request was rejected. Update the client/backend integration.',
    STRICT_ROUTE_REQUIRED: 'The backend route is incompatible. Update the integration; never use the legacy submission route.',
    INVALID_CONTRIBUTOR: 'Reload the source with the intended contributor account.',
    CONTRIBUTOR_MISMATCH: 'Restore the contributor account that loaded this draft and validate the source again.',
    CSRF_INVALID: 'Refresh your login deliberately, confirm the original contributor and validate the source before manually submitting.',
    INVALID_REVIEW_STATE: 'Load a fresh source with a v2 backend and give fresh replacement consent.',
    REPLACEMENT_CONSENT_REQUIRED: 'Inspect the captured PR and explicitly confirm replacement.',
    REVIEW_STATE_CONFLICT: 'The review changed, appeared, disappeared, closed or was replaced. Inspect the PR, load a fresh source and give fresh consent. Publication may already have occurred.',
    SOURCE_CONFLICT: 'Source or branch changed. Inspect the contribution and load fresh source; apply edits manually.',
    FORK_SYNC_REQUIRED: 'Sync your fork manually on GitHub, then load fresh source and give fresh consent. No workflow scope is requested.'
  };
  return `${guidance[error?.code] || (error?.status === 404
    ? 'The source or strict backend route is unavailable. Use a v2 backend and reload the source.'
    : error?.status === 401 || error?.status === 403
      ? 'Re-authenticate as the original contributor and check access, membership and permissions.'
      : error?.status === 429 ? 'Wait before manually trying again.'
        : [400, 413].includes(error?.status) ? 'Correct the input or export the draft.'
          : 'Publication is uncertain. Inspect your contribution before any manual retry.')} Your draft is retained. ${error?.message || ''}`;
}
