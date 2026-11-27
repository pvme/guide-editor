// Strict contract validators adapted from the adjacent website implementation.
import {
  contributorBranch,
  parseReviewState,
  validContributor,
  validateReviewOwner
} from "./review-state.js";
const record = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const string = (value) => typeof value === "string";
function parsePublicUser(value) {
  if (value === null) return null;
  if (!record(value) || !["username", "globalName", "avatar", "displayName", "csrfToken"].every(
    (key) => string(value[key])
  ) || !value.csrfToken.trim() || typeof value.canReviewPrs !== "boolean")
    throw new Error("Invalid public session response.");
  const common = {
    username: value.username,
    globalName: value.globalName,
    avatar: value.avatar,
    displayName: value.displayName,
    csrfToken: value.csrfToken,
    canReviewPrs: value.canReviewPrs
  };
  if (value.provider === "github" && string(value.githubId) && /^[1-9]\d*$/.test(value.githubId) && string(value.githubLogin) && value.githubLogin)
    return {
      ...common,
      provider: "github",
      githubId: value.githubId,
      githubLogin: value.githubLogin
    };
  if (value.provider === "discord" && string(value.discordId) && /^[1-9]\d*$/.test(value.discordId) && typeof value.pvmeMember === "boolean")
    return {
      ...common,
      provider: "discord",
      discordId: value.discordId,
      pvmeMember: value.pvmeMember
    };
  throw new Error("Invalid public session response.");
}
const validPrUrl = (value) => string(value) && /^https:\/\/github\.com\/pvme\/pvme-guides\/pull\/[1-9]\d*$/.test(value);
class SubmissionUncertainError extends Error {
}
function validateUpdate(payload) {
  if (!payload || typeof payload !== "object" || ![
    "type",
    "repo",
    "baseBranch",
    "path",
    "originalContent",
    "content",
    "title",
    "notes",
    "source",
    "branch",
    "existingReviewBranch"
  ].every(
    (key) => typeof payload[key] === "string"
  ) || payload.type !== "update" || payload.repo !== "pvme/pvme-guides" || payload.baseBranch !== "master" || !/\.txt$/i.test(payload.path) || /[\\:\u0000-\u001f]/.test(payload.path) || payload.path.startsWith("/") || payload.path.split("/").some((part) => !part || part === "." || part === "..") || !["master", "user-pr"].includes(payload.source) || !payload.branch || payload.source === "master" && payload.branch !== "master" || payload.sourcePreservation !== "exact" || typeof payload.replaceExistingReview !== "boolean" || typeof payload.originalContent !== "string" || typeof payload.content !== "string" || !payload.content.trim() || payload.content === payload.originalContent || !payload.title.trim() || payload.title.trim().length > 120 || !payload.notes.trim() || payload.notes.trim().length > 2e3)
    throw new Error(
      "Invalid guide update. Check the source, summary and reason; your draft is retained."
    );
  if ([payload.originalContent, payload.content].some(
    (text) => new TextEncoder().encode(text).byteLength > 2 * 1024 * 1024
  ))
    throw new Error(
      "Guide source exceeds the 2 MiB UTF-8 limit. Export your draft for recovery."
    );
}
function validateStrictUpdate(payload, user, allowUnverified = false) {
  const keys = [
    "contractVersion",
    "expectedContributor",
    "expectedReview",
    "type",
    "repo",
    "baseBranch",
    "path",
    "originalContent",
    "content",
    "title",
    "notes",
    "source",
    "branch",
    "existingReviewBranch",
    "replaceExistingReview",
    "sourcePreservation"
  ];
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).some((key) => !keys.includes(key)) || payload.title !== void 0 && typeof payload.title !== "string" || payload.existingReviewBranch !== void 0 && typeof payload.existingReviewBranch !== "string")
    throw new Error("Invalid strict request fields.");
  validateUpdate({
    ...payload,
    title: payload.title?.trim() || "Update",
    existingReviewBranch: payload.existingReviewBranch || ""
  });
  if (payload.contractVersion !== 2 || !validContributor(payload.expectedContributor))
    throw new Error(
      "Strict v2 submission requires contractVersion 2 and the captured contributor."
    );
  const review = parseReviewState(payload.expectedReview, allowUnverified);
  validateReviewOwner(review, payload.expectedContributor, user || void 0);
  if (payload.source === "user-pr" && (review.state !== "present" || payload.branch !== review.branch || payload.replaceExistingReview))
    throw new Error(
      "Review-source submission requires its captured version and replacement false."
    );
  if (payload.existingReviewBranch && (review.state !== "present" || payload.existingReviewBranch !== review.branch))
    throw new Error(
      "Legacy branch metadata conflicts with the strict review assertion."
    );
  if (payload.source === "master" && review.state === "present" !== payload.replaceExistingReview)
    throw new Error(
      "Master replacement requires explicit consent for the captured review version."
    );
  if (review.state === "unverified" && (!allowUnverified || payload.source !== "master" || payload.replaceExistingReview))
    throw new Error("Unverified review state is local dry-run only.");
}
function parseSubmissionResult(value, payload, status) {
  const invalid = () => new SubmissionUncertainError(
    "The server returned an unrecognised submission result. A PR may have changed. Inspect or reload your contribution in Guide Editor before retrying. Your draft is retained."
  );
  if (!record(value) || value.contractVersion !== 2 || value.contributor !== payload.expectedContributor || value.path !== payload.path || !string(value.branch) || !value.branch)
    throw invalid();
  if (value.dryRun === true) {
    let user;
    try {
      user = parsePublicUser(value.user);
    } catch {
      throw invalid();
    }
    if (!user || status !== 200 || value.reviewStateVerified !== false || (user.provider === "github" ? `github:${user.githubId}` : `discord:${user.discordId}`) !== payload.expectedContributor || !string(value.message) || !string(value.title) || value.title !== (payload.title?.trim() || `Update ${payload.path}`) || value.source !== payload.source || value.branch !== payload.branch || !contributorBranch(value.reviewBranch, payload.expectedContributor) || payload.expectedReview.state === "present" && value.reviewBranch !== payload.expectedReview.branch || value.contentBytes !== new TextEncoder().encode(payload.content).byteLength || value.originalContentBytes !== new TextEncoder().encode(payload.originalContent).byteLength)
      throw invalid();
    return {
      contractVersion: 2,
      contributor: payload.expectedContributor,
      reviewStateVerified: false,
      dryRun: true,
      message: value.message,
      title: value.title,
      path: payload.path,
      branch: value.branch,
      reviewBranch: value.reviewBranch,
      source: payload.source,
      contentBytes: value.contentBytes,
      originalContentBytes: value.originalContentBytes,
      user
    };
  }
  if (payload.expectedReview.state === "unverified" || !contributorBranch(value.branch, payload.expectedContributor) || value.dryRun !== void 0 || !validPrUrl(value.prUrl) || typeof value.reusedReview !== "boolean" || status !== (value.reusedReview ? 200 : 201) || value.reusedReview !== (payload.expectedReview.state === "present") || payload.expectedReview.state === "present" && (value.branch !== payload.expectedReview.branch || value.prUrl !== payload.expectedReview.prUrl) || payload.source === "user-pr" && (value.branch !== payload.branch || !value.reusedReview) || payload.existingReviewBranch && value.branch !== payload.existingReviewBranch)
    throw invalid();
  return {
    contractVersion: 2,
    contributor: payload.expectedContributor,
    path: payload.path,
    branch: value.branch,
    prUrl: value.prUrl,
    reusedReview: value.reusedReview
  };
}
export {
  SubmissionUncertainError,
  parseSubmissionResult,
  validateStrictUpdate,
};
