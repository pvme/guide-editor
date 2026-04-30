<script>
  import Modal from "./Modal.svelte";
  import { authUser, loadedGuide, text } from "../../stores";
  import findStyleErrors from "../../syntax/style";
  import findSyntaxErrors from "../../syntax/syntax";
  import {
    getAuthenticatedUser,
    getDiscordLoginUrl,
    logoutDiscord,
    submitGuideUpdate
  } from "../../guidePrApi";

  export let open = false;
  export let close = () => {};

  let notes = "";
  let status = "idle";
  let message = "";
  let prUrl = "";
  let issueAcknowledged = false;
  let replaceExistingReview = false;
  let authStatus = "idle";
  let authCheckedForOpen = false;

  $: hasChanges = Boolean($loadedGuide?.path) && $text !== ($loadedGuide.originalText || "");
  $: issues = [...findStyleErrors($text), ...findSyntaxErrors($text)];
  $: errorCount = issues.filter((issue) => issue.type === "error").length;
  $: warningCount = issues.length - errorCount;
  $: hasIssues = issues.length > 0;
  $: isAuthenticated = Boolean($authUser?.discordId);
  $: hasNotes = notes.trim().length > 0;
  $: replacesExistingReview = $loadedGuide?.source === "master" && Boolean($loadedGuide?.existingReviewBranch);
  $: canSubmit = hasChanges
    && isAuthenticated
    && hasNotes
    && (!hasIssues || issueAcknowledged)
    && (!replacesExistingReview || replaceExistingReview);
  $: defaultTitle = $loadedGuide?.name
    ? `Update ${$loadedGuide.name}`
    : "Update guide";

  $: displayName = $authUser?.displayName || $authUser?.globalName || $authUser?.username || "";
  $: reviewBranch = $loadedGuide?.source === "user-pr"
    ? $loadedGuide.branch
    : $loadedGuide?.existingReviewBranch || "";
  $: branchLabel = reviewBranch
    ? "Review branch"
    : "Source branch";
  $: branchValue = reviewBranch || $loadedGuide?.branch || "master";

  $: if (!open) {
    status = "idle";
    message = "";
    prUrl = "";
    replaceExistingReview = false;
    authCheckedForOpen = false;
  }

  $: if (!open || !hasIssues) {
    issueAcknowledged = false;
  }

  $: if (open && !authCheckedForOpen) {
    refreshAuth();
  }

  function validateLoadedGuide(guide) {
    if (!guide?.path) return "Load a guide before submitting an update.";
    if (guide.repo !== "pvme/pvme-guides") return "This editor can only submit pvme-guides updates.";
    if ((guide.baseBranch || "master") !== "master") return "This editor can only submit updates against master.";
    if (!["master", "user-pr"].includes(guide.source || "master")) return "The loaded guide source is invalid.";
    if (guide.path.startsWith("/") || guide.path.includes("..")) return "The loaded guide path is invalid.";
    if (!guide.path.endsWith(".txt")) return "Only .txt guide files can be submitted.";
    if ($text.trim().length === 0) return "Add guide text before submitting an update.";
    if (!hasChanges) return "Make changes before submitting an update.";
    if (!isAuthenticated) return "Log in with Discord before submitting an update.";
    if (!hasNotes) return "Add a short summary of what changed before submitting an update.";
    if (hasIssues && !issueAcknowledged) return "Review the guide issues warning before submitting an update.";
    if (replacesExistingReview && !replaceExistingReview) {
      return "Confirm that this will replace your existing open review before submitting.";
    }
    return "";
  }

  async function submitPr() {
    const validationError = validateLoadedGuide($loadedGuide);
    if (validationError) {
      status = "error";
      message = validationError;
      return;
    }

    status = "submitting";
    message = "";
    prUrl = "";

    const payload = {
      type: "update",
      repo: "pvme/pvme-guides",
      baseBranch: "master",
      path: $loadedGuide.path,
      content: $text,
      originalContent: $loadedGuide.originalText || "",
      title: defaultTitle,
      notes: notes.trim(),
      source: $loadedGuide.source || "master",
      branch: $loadedGuide.branch || "master",
      existingReviewBranch: $loadedGuide.existingReviewBranch || "",
      replaceExistingReview: replacesExistingReview && replaceExistingReview
    };

    try {
      const data = await submitGuideUpdate(payload);

      prUrl = data.prUrl || data.url || "";
      status = "success";
      const modeLabel = data.dryRun ? " (DEV MODE)" : "";
      message = `Thank you for contributing to PvME - your update has been submitted for review.${modeLabel}`;
    } catch (err) {
      status = "error";
      message = err.message || "Update submission failed.";
    }
  }

  async function refreshAuth() {
    if (authStatus === "loading") return;
    authStatus = "loading";
    authCheckedForOpen = true;

    try {
      authUser.set(await getAuthenticatedUser());
    } catch {
      authUser.set(null);
    } finally {
      authStatus = "idle";
    }
  }

  function loginWithDiscord() {
    window.location.href = getDiscordLoginUrl();
  }

  async function logout() {
    await logoutDiscord();
    authUser.set(null);
  }
</script>

<Modal {open} {close} panelClass="max-w-lg !p-0">
  {#if status === "success"}
    <div class="px-6 py-8 text-center space-y-4">
      <h2 class="text-xl font-semibold text-emerald-200">
        {message}
      </h2>

      {#if prUrl}
        <a
          class="inline-block text-blue-300 underline"
          href={prUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open review
        </a>
      {/if}

      <div class="pt-4">
        <button class="toolbar-secondary-btn" on:click={close}>
          Close
        </button>
      </div>
    </div>
  {:else}
    <form class="pr-submit-form" on:submit|preventDefault={submitPr}>
      <div class="border-b border-slate-700/70 px-6 pb-5 pt-6 pr-12">
        <h2 class="text-xl font-semibold text-white">Submit Guide Update</h2>
        <p class="mt-2 text-sm leading-6 text-slate-300">
          Send this loaded guide to the PvME team for review.
        </p>
      </div>

      <div class="space-y-8 px-6 py-7">
        <div class="pr-form-group">
          <div class="text-sm font-medium text-slate-200">Guide file</div>
          <div class="guide-path mt-2 truncate font-mono text-sm">
            {$loadedGuide?.path || "No guide loaded"}
          </div>
          {#if $loadedGuide?.path}
            <div class="branch-path mt-2 truncate font-mono text-xs">
              <span class="font-sans font-medium text-slate-400">{branchLabel}:</span>
              {branchValue}
            </div>
          {/if}
          <div class="pr-help-text">
            Only this file will be included in the update.
          </div>
        </div>

        <div class="pr-form-group">
          <div class="text-sm font-medium text-slate-200">Discord identity</div>
          {#if isAuthenticated}
            <div class="mt-2 flex items-center justify-between gap-3 rounded border border-slate-700 bg-slate-950/50 px-3 py-2">
              <div class="min-w-0">
                <div class="truncate text-sm text-slate-100">Submitting as {displayName}</div>
                <div class="truncate text-xs text-slate-500">Verified with Discord</div>
              </div>
              <button class="toolbar-secondary-btn" type="button" on:click={logout}>
                Log out
              </button>
            </div>
          {:else}
            <button class="toolbar-btn mt-2 rounded font-medium" type="button" on:click={loginWithDiscord}>
              Log in with Discord
            </button>
            <span class="pr-help-text block">
              Discord login proves who submitted the update.
            </span>
          {/if}
        </div>

        <label class="pr-form-group block">
          <span class="text-sm font-medium text-slate-200">
            What changed? <span class="text-red-400" aria-hidden="true">*</span>
          </span>
          <textarea
            class="pr-submit-field pr-submit-textarea mt-2"
            bind:value={notes}
            placeholder="Briefly describe the update"
          ></textarea>
        </label>

        {#if replacesExistingReview}
          <label class="flex items-start gap-3 rounded border border-amber-700/50 bg-amber-950/20 p-3">
            <input
              class="mt-1"
              type="checkbox"
              bind:checked={replaceExistingReview}
            />
            <span class="text-sm text-amber-50">
              This will replace your existing open review with this version based on the live guide.
            </span>
          </label>
        {/if}
      </div>

      {#if hasIssues}
        <div class="mx-6 mb-6 rounded border border-amber-700/50 bg-amber-950/20 p-3">
          <div class="text-sm font-semibold text-amber-100">Checker issues need acknowledgement</div>
          <p class="mt-2 text-sm leading-6 text-amber-200/90">
            There are {errorCount} error{errorCount === 1 ? "" : "s"} and {warningCount} warning{warningCount === 1 ? "" : "s"} currently showing in the checker.
          </p>
          <label class="mt-3 flex items-start gap-3">
            <input
              class="mt-1"
              type="checkbox"
              bind:checked={issueAcknowledged}
            />
            <span class="text-sm text-amber-50">
              I understand this update includes unresolved checker issues.
            </span>
          </label>
        </div>
      {/if}

      {#if message}
        <div
          class={`mx-6 mb-6 rounded border px-4 py-3 text-sm ${
            status === "error"
              ? "border-red-700 bg-red-950/40 text-red-200"
              : "border-emerald-700 bg-emerald-950/40 text-emerald-200"
          }`}
        >
          {message}
          {#if prUrl}
            <a class="ml-1 text-blue-300 underline" href={prUrl} target="_blank" rel="noreferrer">Open review</a>
          {/if}
        </div>
      {/if}

      <div class="flex justify-end gap-3 border-t border-slate-700/70 bg-slate-900/45 px-6 py-3">
        <button
          on:click={close}
          class="toolbar-secondary-btn"
          type="button"
        >
          Close
        </button>

        <button
          disabled={status === "submitting" || !canSubmit}
          class="toolbar-btn rounded font-medium"
          type="submit"
        >
          {status === "submitting" ? "Submitting..." : "Submit update"}
        </button>
      </div>
    </form>
  {/if}
</Modal>

<style>
  .pr-submit-form {
    color-scheme: dark;
  }

  .pr-form-group {
    display: block;
  }

  .pr-help-text {
    margin-top: 0.55rem;
    color: rgb(100 116 139);
    font-size: 0.75rem;
    line-height: 1.25rem;
  }

  .guide-path {
    border: 1px solid rgb(71 85 105 / 0.72);
    border-radius: 4px;
    background: linear-gradient(
      180deg,
      rgb(15 23 42 / 0.64),
      rgb(15 23 42 / 0.42)
    );
    color: rgb(203 213 225);
    padding: 0.625rem 0.75rem;
  }

  .branch-path {
    border: 1px solid rgb(51 65 85 / 0.72);
    border-radius: 4px;
    background: rgb(2 6 23 / 0.32);
    color: rgb(148 163 184);
    padding: 0.45rem 0.65rem;
  }

  .pr-submit-field {
    display: block;
    width: 100%;
    border: 1px solid rgb(51 65 85);
    border-radius: 4px;
    background-color: rgb(15 23 42 / 0.92) !important;
    color: rgb(241 245 249) !important;
    padding: 0.625rem 0.75rem;
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease;
  }

  .pr-submit-field::placeholder {
    color: rgb(100 116 139);
  }

  .pr-submit-field:focus {
    border-color: rgb(59 130 246);
    box-shadow: 0 0 0 1px rgb(59 130 246 / 0.6);
    outline: none;
  }

  .pr-submit-textarea {
    min-height: 6.5rem;
    resize: vertical;
  }

  .pr-submit-field:-webkit-autofill,
  .pr-submit-field:-webkit-autofill:hover,
  .pr-submit-field:-webkit-autofill:focus {
    box-shadow: 0 0 0 1000px rgb(15 23 42) inset !important;
    -webkit-text-fill-color: rgb(241 245 249) !important;
    caret-color: rgb(241 245 249);
  }
</style>
