// Strict contract validators adapted from the adjacent website implementation.
const validContributor = (value) => typeof value === "string" && /^(github|discord):[1-9]\d*$/.test(value);
const validBranch = (value) => typeof value === "string" && !!value && !/[\s\\~^:?*\[\u0000-\u001f\u007f]/.test(value) && !value.includes("..") && !value.includes("@{") && value.split("/").every(
  (part) => !!part && !part.startsWith(".") && !part.endsWith(".") && !part.endsWith(".lock")
);
function contributorBranch(branch, identity) {
  return validBranch(branch) && branch.startsWith(`guide-editor/${identity.replace(":", "-")}/`);
}
function parseReviewState(value, allowUnverified = false) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(
      "Strict review metadata is missing. Reload with a v2 backend; retain or export your draft."
    );
  const state = value;
  if (Object.keys(state).length === 1 && (state.state === "none" || state.state === "unverified" && allowUnverified))
    return Object.freeze({ state: state.state });
  const keys = [
    "state",
    "repository",
    "branch",
    "headSha",
    "prId",
    "prNumber",
    "prUrl"
  ];
  if (state.state !== "present" || Object.keys(state).length !== keys.length || !keys.every((key) => Object.hasOwn(state, key)) || typeof state.repository !== "string" || !/^[A-Za-z0-9_.-]+\/pvme-guides$/.test(state.repository) || !validBranch(state.branch) || typeof state.headSha !== "string" || !/^[a-f0-9]{40}$/.test(state.headSha) || !Number.isSafeInteger(state.prId) || state.prId <= 0 || !Number.isSafeInteger(state.prNumber) || state.prNumber <= 0 || state.prUrl !== `https://github.com/pvme/pvme-guides/pull/${state.prNumber}`)
    throw new Error(
      "Invalid immutable review version. Retain/export your draft and reload the source."
    );
  return Object.freeze({
    state: "present",
    repository: state.repository,
    branch: state.branch,
    headSha: state.headSha,
    prId: state.prId,
    prNumber: state.prNumber,
    prUrl: state.prUrl
  });
}
function reviewKey(value) {
  if (!value) return "missing";
  return value.state === "present" ? JSON.stringify([
    value.state,
    value.repository,
    value.branch,
    value.headSha,
    value.prId,
    value.prNumber,
    value.prUrl
  ]) : value.state;
}
function validateReviewOwner(state, identity, user) {
  if (state.state !== "present") return;
  if (!contributorBranch(state.branch, identity))
    throw new Error(
      "Review branch does not belong to the captured contributor."
    );
  const repository = user ? user.provider === "github" ? `${user.githubLogin}/pvme-guides` : "pvme/pvme-guides" : void 0;
  if (repository && state.repository !== repository)
    throw new Error(
      "Review repository does not belong to the captured contributor."
    );
}
function validateLoadedReview(loaded, identity, user, allowUnverified = false) {
  const state = parseReviewState(loaded.reviewState, allowUnverified);
  validateReviewOwner(state, identity, user);
  if (loaded.source === "master" && loaded.branch === "master") {
    if (loaded.prUrl || (state.state === "present" ? loaded.existingReviewBranch !== state.branch || loaded.existingReviewUrl !== state.prUrl : !!loaded.existingReviewBranch || !!loaded.existingReviewUrl))
      throw new Error("Loaded master/review metadata is inconsistent.");
  } else if (loaded.source === "user-pr" && state.state === "present") {
    if (loaded.branch !== state.branch || loaded.prUrl !== state.prUrl || loaded.existingReviewBranch && loaded.existingReviewBranch !== state.branch || loaded.existingReviewUrl && loaded.existingReviewUrl !== state.prUrl)
      throw new Error("Loaded review metadata is inconsistent.");
  } else
    throw new Error("Loaded source does not match the immutable review state.");
  if (state.state === "unverified" && (loaded.dryRun !== true || !allowUnverified))
    throw new Error(
      "Unverified review state requires a verified local dry-run backend."
    );
  return state;
}
export {
  contributorBranch,
  parseReviewState,
  reviewKey,
  validContributor,
  validateLoadedReview,
  validateReviewOwner
};
