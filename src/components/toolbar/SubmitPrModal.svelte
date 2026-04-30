<script>
  import Modal from "./Modal.svelte";
  import { createEventDispatcher, tick } from "svelte";
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
  export let authError = "";
  export let close = () => {};

  const dispatch = createEventDispatcher();

  let notes = "";
  let status = "idle";
  let message = "";
  let prUrl = "";
  let issueAcknowledged = false;
  let replaceExistingReview = false;
  let authStatus = "idle";
  let authCheckedForOpen = false;
  let submitAttempted = false;
  let lastAuthError = "";
  let notesEl;
  let focusedNotesForOpen = false;

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
  $: validationItems = getValidationItems($loadedGuide);
  $: blockingItems = validationItems.filter((item) => !item.done);
  $: submitTooltip = canSubmit
    ? "Submit this guide update"
    : blockingItems.length > 0
      ? `Required: ${blockingItems[0].label}`
      : "Submit unavailable";

  $: if (!open) {
    status = "idle";
    message = "";
    prUrl = "";
    replaceExistingReview = false;
    authCheckedForOpen = false;
    submitAttempted = false;
    lastAuthError = "";
    focusedNotesForOpen = false;
  }

  $: if (open && authError && authError !== lastAuthError) {
    lastAuthError = authError;
    status = "error";
    message = authError;
  }

  $: if (!open || !hasIssues) {
    issueAcknowledged = false;
  }

  $: if (open && !authCheckedForOpen) {
    refreshAuth();
  }

  $: if (open && isAuthenticated && !focusedNotesForOpen && status !== "success") {
    focusNotesField();
  }

  function validateLoadedGuide(guide) {
    return getValidationItems(guide).find((item) => !item.done)?.error || "";
  }

  function getValidationItems(guide) {
    const validGuide = Boolean(guide?.path)
      && guide.repo === "pvme/pvme-guides"
      && (guide.baseBranch || "master") === "master"
      && ["master", "user-pr"].includes(guide.source || "master")
      && !guide.path.startsWith("/")
      && !guide.path.includes("..")
      && guide.path.endsWith(".txt");
    const hasGuideText = $text.trim().length > 0;

    return [
      {
        done: validGuide,
        label: "Load a valid guide",
        error: !guide?.path
          ? "You must load a guide to submit a guide update."
          : "You must reload this guide to submit a guide update."
      },
      {
        done: isAuthenticated,
        label: "Log in with Discord",
        error: "You must log in with Discord to submit a guide update."
      },
      {
        done: hasGuideText && hasChanges,
        label: "Make a guide change",
        error: !hasGuideText
          ? "You must add guide text to submit a guide update."
          : "You must make a guide change to submit a guide update."
      },
      {
        done: hasNotes,
        label: "Describe what changed",
        error: "You must describe what changed to submit a guide update."
      },
      {
        done: !hasIssues || issueAcknowledged,
        label: "Acknowledge checker issues",
        error: "You must acknowledge checker issues to submit a guide update.",
        hidden: !hasIssues
      },
      {
        done: !replacesExistingReview || replaceExistingReview,
        label: "Confirm replacing existing review",
        error: "You must confirm replacing your existing review to submit a guide update.",
        hidden: !replacesExistingReview
      }
    ].filter((item) => !item.hidden);
  }

  async function submitPr() {
    submitAttempted = true;

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

      if (data.branch) {
        loadedGuide.update((guide) => guide
          ? {
            ...guide,
            source: "user-pr",
            branch: data.branch,
            prUrl,
            existingReviewBranch: "",
            existingReviewUrl: "",
            originalText: $text
          }
          : guide);
      }
    } catch (err) {
      status = "error";
      message = normalizeSubmitError(err);
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

  function reviewCheckerIssues() {
    dispatch("reviewIssues");
  }

  async function focusNotesField() {
    focusedNotesForOpen = true;
    await tick();
    notesEl?.focus();
  }

  async function logout() {
    await logoutDiscord();
    authUser.set(null);
  }

  function normalizeSubmitError(err) {
    const text = err?.message || "";

    if (!text) return "Submit failed. Try again in a moment.";
    if (text.includes("log in with Discord") || text.includes("Log in with Discord")) return "You must log in with Discord to submit a guide update.";
    if (text.includes("No guide changes") || text.includes("make a guide change")) return "You must make a guide change to submit a guide update.";
    if (text.includes("summary of what changed") || text.includes("describe what changed")) return "You must describe what changed to submit a guide update.";
    if (text.includes("changed since it was loaded")) return text;
    if (text.includes("replace your existing open review")) return text;

    return text.endsWith(".") ? text : `${text}.`;
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
      <div class="border-b border-slate-700/70 px-6 pb-4 pt-5 pr-12">
        <h2 class="text-xl font-semibold text-white">Submit Guide Update</h2>
        <p class="mt-1.5 text-sm leading-5 text-slate-300">
          Send this loaded guide to the PvME team for review.
        </p>
      </div>

      <div class="space-y-5 px-6 py-5">
        {#if !isAuthenticated}
          <div class="pr-auth-gate">
            <div>
              <div class="text-sm font-semibold text-slate-100">Discord login required</div>
              <p class="mt-1 text-sm leading-5 text-slate-400">
                You must log in with Discord to submit a guide update.
              </p>
            </div>
            <button class="toolbar-btn rounded font-medium" type="button" on:click={loginWithDiscord}>
              {authStatus === "loading" ? "Logging in..." : "Log in"}
            </button>
          </div>
        {:else}
          <div class="pr-form-group">
            <div class="text-sm font-medium text-slate-200">Discord identity</div>
            <div class="mt-2 flex items-center justify-between gap-3 rounded border border-slate-700 bg-slate-950/50 px-3 py-2">
              <div class="min-w-0">
                <div class="truncate text-sm text-slate-100">Submitting as {displayName}</div>
                <div class="truncate text-xs text-slate-500">Verified with Discord</div>
              </div>
              <button class="toolbar-secondary-btn" type="button" on:click={logout}>
                Log out
              </button>
            </div>
          </div>

          <div class="pr-form-group">
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm font-medium text-slate-200">File being updated</div>
            </div>
            <div class="guide-file-field mt-2">
              <div class="truncate font-mono text-sm text-slate-200">
                {$loadedGuide?.path || "No guide loaded"}
              </div>
              {#if $loadedGuide?.path}
                <div class="mt-1 truncate font-mono text-xs text-slate-400">
                  <span class="font-sans font-medium">{branchLabel}:</span>
                  {branchValue}
                </div>
              {/if}
            </div>
          </div>

          <label class="pr-form-group block">
            <span class="text-sm font-medium text-slate-200">
              What changed? <span class="text-red-400" aria-hidden="true">*</span>
            </span>
            <textarea
              class="pr-submit-field pr-submit-textarea mt-2"
              class:pr-field-missing={submitAttempted && !hasNotes}
              bind:this={notesEl}
              bind:value={notes}
              placeholder="Briefly describe the update"
            ></textarea>
            {#if submitAttempted && !hasNotes}
              <span class="pr-required-text block">
                Required before you can submit.
              </span>
            {/if}
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
        {/if}
      </div>

      {#if isAuthenticated && hasIssues}
        <div class="mx-6 mb-4 rounded border border-amber-700/50 bg-amber-950/20 p-3">
          <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <div class="text-sm font-semibold text-amber-100">Checker issues</div>
            <div class="text-xs text-amber-200/90">
              {errorCount} error{errorCount === 1 ? "" : "s"}, {warningCount} warning{warningCount === 1 ? "" : "s"}
            </div>
          </div>
          <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label class="flex min-w-0 items-start gap-3">
              <input
                class="mt-1"
                type="checkbox"
                bind:checked={issueAcknowledged}
              />
              <span class="text-sm text-amber-50">
                I understand this update includes unresolved checker issues.
              </span>
            </label>
            <button
              class="toolbar-secondary-btn shrink-0"
              type="button"
              on:click={reviewCheckerIssues}
            >
              Review issues
            </button>
          </div>
        </div>
      {/if}

      {#if message}
        <div
          class={`mx-6 mb-4 rounded border px-4 py-3 text-sm ${
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

        {#if isAuthenticated && canSubmit}
          <button
            disabled={status === "submitting"}
            class="toolbar-btn rounded font-medium"
            type="submit"
          >
            {#if status === "submitting"}
              <span class="loading-spinner" aria-hidden="true"></span>
              Submitting
            {:else}
              Submit update
            {/if}
          </button>
        {:else if isAuthenticated}
          <span class="submit-action">
            <button
              class="toolbar-btn rounded font-medium"
              aria-describedby="submit-update-help"
              type="submit"
            >
              Submit update
            </button>
            <span id="submit-update-help" class="submit-tooltip" role="tooltip">
              {submitTooltip}
            </span>
          </span>
        {/if}
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
    margin-top: 0.4rem;
    color: rgb(100 116 139);
    font-size: 0.75rem;
    line-height: 1.25rem;
  }

  .pr-required-text {
    margin-top: 0.4rem;
    color: rgb(251 191 36);
    font-size: 0.75rem;
    line-height: 1.25rem;
  }

  .guide-file-field {
    border: 1px solid rgb(71 85 105 / 0.72);
    border-radius: 4px;
    background: linear-gradient(
      180deg,
      rgb(15 23 42 / 0.64),
      rgb(15 23 42 / 0.42)
    );
    padding: 0.55rem 0.75rem;
  }

  .pr-auth-gate {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border: 1px solid rgb(51 65 85);
    border-radius: 4px;
    background: rgb(15 23 42 / 0.52);
    padding: 0.875rem;
  }

  .pr-submit-field {
    display: block;
    width: 100%;
    border: 1px solid rgb(51 65 85);
    border-radius: 4px;
    background-color: rgb(15 23 42 / 0.92) !important;
    color: rgb(241 245 249) !important;
    padding: 0.55rem 0.75rem;
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

  .pr-field-missing {
    border-color: rgb(180 83 9 / 0.8);
  }

  .pr-submit-textarea {
    min-height: 5rem;
    resize: vertical;
  }

  .pr-submit-field:-webkit-autofill,
  .pr-submit-field:-webkit-autofill:hover,
  .pr-submit-field:-webkit-autofill:focus {
    box-shadow: 0 0 0 1000px rgb(15 23 42) inset !important;
    -webkit-text-fill-color: rgb(241 245 249) !important;
    caret-color: rgb(241 245 249);
  }

  .submit-action {
    position: relative;
    display: inline-flex;
  }

  .submit-tooltip {
    position: absolute;
    right: 0;
    bottom: calc(100% + 0.5rem);
    z-index: 10;
    width: max-content;
    max-width: 16rem;
    border: 1px solid rgb(51 65 85);
    border-radius: 4px;
    background: rgb(15 23 42);
    color: rgb(226 232 240);
    font-size: 0.75rem;
    line-height: 1rem;
    padding: 0.4rem 0.55rem;
    opacity: 0;
    pointer-events: none;
    transform: translateY(0.25rem);
    transition:
      opacity 120ms ease,
      transform 120ms ease;
    white-space: normal;
  }

  .submit-action:hover .submit-tooltip,
  .submit-action:focus-within .submit-tooltip {
    opacity: 1;
    transform: translateY(0);
  }

  .loading-spinner {
    width: 0.9rem;
    height: 0.9rem;
    border: 2px solid rgb(191 219 254 / 0.45);
    border-top-color: rgb(255 255 255);
    border-radius: 999px;
    animation: spin 700ms linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
