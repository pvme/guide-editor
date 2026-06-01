<script>
  import { createEventDispatcher, onDestroy, tick } from "svelte";
  import Pencil from "svelte-bootstrap-icons/lib/Pencil.svelte";
  import Modal from "./Modal.svelte";
  import { authUser } from "../../stores";
  import {
    closeReviewPull,
    getAuthenticatedUser,
    getReviewPull,
    listReviewPulls,
    mergeReviewPull,
    refreshReviewPullChecks,
    saveReviewPullFile
  } from "../../guidePrApi";

  export let open = false;
  export let close = () => {};
  export let currentText = "";

  const dispatch = createEventDispatcher();
  const CHECK_POLL_INTERVAL_MS = 4000;
  const CHECK_POLL_TIMEOUT_MS = 120000;
  const CHECK_SHA_GRACE_MS = 8000;

  let pulls = [];
  let session = null;
  let activePath = "";
  let editorLoadedPath = "";
  let editorLoadedContent = "";
  let editorContentSynced = false;
  let status = "idle";
  let message = "";
  let loading = false;
  let loadingAction = "";
  let loadingPullNumber = null;
  let refreshingPulls = false;
  let authStatus = "idle";
  let authCheckedForOpen = false;
  let pollingChecks = false;
  let checkPollTimer = null;
  let commitMessage = "";
  let showClosePrForm = false;
  let closeReason = "";

  $: activeFile = session?.files?.find((file) => file.path === activePath) || null;
  $: activeFileLoadedInEditor = Boolean(activeFile && editorLoadedPath === activeFile.path);
  $: if (activeFileLoadedInEditor && !editorContentSynced && currentText === editorLoadedContent) {
    editorContentSynced = true;
  }
  $: dirty = Boolean(activeFileLoadedInEditor && editorContentSynced && activeFile && currentText !== activeFile.headContent);
  $: checksState = session?.checks?.state || "unknown";
  $: checksCount = (session?.checks?.checkRuns?.length || 0) + (session?.checks?.statuses?.length || 0);
  $: canMerge = Boolean(session?.pr && !dirty && !session.pr.draft && checksState === "passing" && !pollingChecks);
  $: commitMessageText = commitMessage.trim();
  $: canUpdate = Boolean(activeFile?.editable && dirty && session?.pr && commitMessageText);
  $: loadingPulls = refreshingPulls;
  $: loadingPull = loading && loadingAction === "pull";
  $: loadingUpdate = loading && loadingAction === "update";
  $: loadingMerge = loading && loadingAction === "merge";
  $: loadingClose = loading && loadingAction === "close";
  $: closeReasonText = closeReason.trim();
  $: canClosePr = Boolean(session?.pr && !dirty && !pollingChecks);
  $: busyReason = loadingPulls
    ? "Refreshing PRs"
    : loadingPull
      ? "Loading PR"
      : loadingUpdate
        ? "Committing changes"
        : loadingMerge
          ? "Merging PR"
          : loadingClose
            ? "Closing PR"
            : loading
              ? "Working"
              : "";
  $: refreshDisabledReason = busyReason;
  $: editDisabledReason = busyReason || (!activeFile ? "No file selected" : "File cannot be edited");
  $: commitDisabledReason = busyReason
    || (!activeFile
      ? "No file selected"
      : !activeFile.editable
        ? "File cannot be edited"
        : !dirty
          ? "No changes have been made yet"
          : !commitMessageText
            ? "Add a commit message"
            : "");
  $: mergeDisabledReason = busyReason
    || (dirty
      ? "Commit or discard changes first"
      : session?.pr?.draft
        ? "Draft PR"
        : pollingChecks || checksState === "pending"
          ? "Checks running"
          : checksState === "failing"
            ? "Checks failing"
            : checksState === "unknown"
              ? "Checks unavailable"
              : "");

  $: if (open && status === "idle" && pulls.length === 0 && !loading && !refreshingPulls) {
    loadPulls();
  }

  async function loadPulls() {
    if (refreshingPulls) return;
    refreshingPulls = true;
    loadingPullNumber = null;
    message = "";

    try {
      pulls = await withTimeout(listReviewPulls(), 30000, "Pull request refresh timed out.");
      status = "ready";
    } catch (err) {
      status = "error";
      message = normalizeError(err);
    } finally {
      refreshingPulls = false;
    }
  }

  async function selectPull(number) {
    if (loading || refreshingPulls) return;
    rememberActiveText();
    loading = true;
    loadingAction = "pull";
    loadingPullNumber = number;
    message = "";

    try {
      const detail = await getReviewPull(number);
      showClosePrForm = false;
      closeReason = "";
      session = {
        ...detail,
        files: detail.files.map((file) => ({
          ...file,
          headContent: file.headContent || "",
          draftContent: file.headContent || "",
          draftCommitMessage: ""
        }))
      };
      const singleFile = session.files.length === 1 ? session.files[0] : null;
      activePath = singleFile?.path || "";
      editorLoadedPath = "";
      editorLoadedContent = "";
      editorContentSynced = false;
      commitMessage = singleFile?.draftCommitMessage || "";
      status = "ready";
    } catch (err) {
      status = "error";
      message = normalizeError(err);
    } finally {
      loading = false;
      loadingAction = "";
      loadingPullNumber = null;
    }
  }

  async function selectFile(path) {
    rememberActiveText();
    activePath = path;
    await tick();
    const file = session?.files?.find((item) => item.path === path);
    commitMessage = file?.draftCommitMessage || "";
    if (file) loadFile(file);
  }

  function rememberActiveText() {
    if (!session || !activePath || editorLoadedPath !== activePath) return;
    session = {
      ...session,
      files: session.files.map((file) => file.path === activePath
        ? { ...file, draftContent: currentText, draftCommitMessage: commitMessage }
        : file)
    };
  }

  function loadFile(file) {
    commitMessage = file.draftCommitMessage || "";
    editorLoadedPath = file.path;
    editorLoadedContent = file.draftContent;
    editorContentSynced = false;
    dispatch("loadFile", {
      pr: session.pr,
      file,
      content: file.draftContent
    });
  }

  async function updateActiveFile() {
    if (!session?.pr || !activeFile || !activeFile.editable) return;
    loading = true;
    loadingAction = "update";
    message = "";

    const isAuthenticated = Boolean($authUser?.discordId || $authUser?.githubId);
    if (!isAuthenticated) {
      await refreshAuth();
    }

    if (!Boolean($authUser?.discordId || $authUser?.githubId)) {
      status = "error";
      message = "Your login session has expired. Please log in again and retry";
      loading = false;
      loadingAction = "";
      return;
    }

    try {
      const update = await saveReviewPullFile(session.pr.number, activeFile.path, currentText, commitMessageText);
      session = {
        ...session,
        pr: {
          ...session.pr,
          headSha: update.sha || session.pr.headSha
        },
        files: session.files.map((file) => file.path === activeFile.path
          ? { ...file, headContent: currentText, draftContent: currentText, draftCommitMessage: "" }
          : file)
      };
      commitMessage = "";
      status = "success";
      message = "Committed changes to the PR branch. Waiting for checks";
      loading = false;
      loadingAction = "";
      await pollChecksUntilComplete(update.sha);
    } catch (err) {
      // If the error is auth-related, refresh login state as well.
      const errorText = err?.message?.toLowerCase() || "";
      if (
        errorText.includes("login") ||
        errorText.includes("session") ||
        errorText.includes("unauthorized") ||
        errorText.includes("401")
      ) {
        await refreshAuth();
      }
      status = "error";
      message = normalizeError(err);
    } finally {
      loading = false;
      loadingAction = "";
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

  $: if (open && !authCheckedForOpen) {
    refreshAuth();
  }

  $: if (!open) {
    authCheckedForOpen = false;
  }

  async function refreshChecks() {
    if (!session?.pr) return;
    const checks = await refreshReviewPullChecks(session.pr.number);
    session = {
      ...session,
      pr: {
        ...session.pr,
        headSha: checks?.headSha || session.pr.headSha
      },
      checks
    };
    return checks;
  }

  async function refreshReviewSession() {
    if (!session?.pr) return null;
    const detail = await getReviewPull(session.pr.number);
    const previousFiles = session.files || [];
    const files = detail.files.map((file) => {
      const previous = previousFiles.find((item) => item.path === file.path);

      return {
        ...file,
        headContent: file.headContent || "",
        draftContent: previous?.draftContent ?? file.headContent ?? "",
        draftCommitMessage: previous?.draftCommitMessage || ""
      };
    });

    session = {
      ...detail,
      files
    };

    if (activePath && !files.some((file) => file.path === activePath)) {
      activePath = "";
      editorLoadedPath = "";
      editorLoadedContent = "";
      editorContentSynced = false;
      commitMessage = "";
    }

    return detail.checks;
  }

  async function pollChecksUntilComplete(expectedHeadSha = "") {
    if (!session?.pr) return;
    clearCheckPollTimer();
    pollingChecks = true;
    const startedAt = Date.now();

    try {
      while (session?.pr && Date.now() - startedAt < CHECK_POLL_TIMEOUT_MS) {
        const checks = await refreshReviewSession();
        const hasWaitedForGithubToCatchUp = Date.now() - startedAt >= CHECK_SHA_GRACE_MS;
        const isExpectedCommit = !expectedHeadSha || checks?.headSha === expectedHeadSha;
        const canTrustReturnedChecks = isExpectedCommit || hasWaitedForGithubToCatchUp;

        if (canTrustReturnedChecks && checks?.state === "passing") {
          status = "success";
          message = "Committed changes to the PR branch. Checks passed";
          return;
        }

        if (canTrustReturnedChecks && checks?.state === "failing") {
          status = "error";
          message = "Committed changes to the PR branch, but checks failed";
          return;
        }

        await waitForNextCheckPoll();
      }

      status = "error";
      message = "Committed changes to the PR branch, but checks are still pending";
    } catch (err) {
      status = "error";
      message = normalizeError(err);
    } finally {
      pollingChecks = false;
      clearCheckPollTimer();
    }
  }

  function waitForNextCheckPoll() {
    return new Promise((resolve) => {
      checkPollTimer = setTimeout(() => {
        checkPollTimer = null;
        resolve();
      }, CHECK_POLL_INTERVAL_MS);
    });
  }

  function withTimeout(promise, ms, errorMessage) {
    let timeoutId;

    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
    });

    return Promise.race([promise, timeout]).finally(() => {
      clearTimeout(timeoutId);
    });
  }

  function clearCheckPollTimer() {
    if (!checkPollTimer) return;
    clearTimeout(checkPollTimer);
    checkPollTimer = null;
  }

  function editActiveFile() {
    if (!activeFile || loading) return;
    rememberActiveText();
    if (editorLoadedPath !== activeFile.path) {
      loadFile(activeFile);
    }
    close();
  }

  function openClosePrForm() {
    if (!canClosePr || loading) return;
    showClosePrForm = true;
    closeReason = "";
    message = "";
  }

  function cancelClosePr() {
    showClosePrForm = false;
    closeReason = "";
  }

  async function closePr() {
    if (!session?.pr || !closeReasonText) return;
    const closedPr = session.pr;
    loading = true;
    loadingAction = "close";
    message = "";

    try {
      const result = await closeReviewPull(session.pr.number, closeReasonText);
      const successMessage = result.closed
        ? "Pull request closed and commented."
        : "Close request completed";
      session = null;
      activePath = "";
      editorLoadedPath = "";
      editorLoadedContent = "";
      editorContentSynced = false;
      commitMessage = "";
      showClosePrForm = false;
      closeReason = "";
      dispatch("closed", { pr: closedPr });
      await loadPulls();
      status = "success";
      message = successMessage;
    } catch (err) {
      status = "error";
      message = normalizeError(err);
    } finally {
      loading = false;
      loadingAction = "";
    }
  }

  async function mergePr() {
    if (!session?.pr) return;
    const mergedPr = session.pr;
    loading = true;
    loadingAction = "merge";
    message = "";

    try {
      const result = await mergeReviewPull(session.pr.number);
      const successMessage = result.merged ? "Pull request approved and merged." : result.message || "Merge request completed";
      session = null;
      activePath = "";
      editorLoadedPath = "";
      editorLoadedContent = "";
      editorContentSynced = false;
      commitMessage = "";
      showClosePrForm = false;
      closeReason = "";
      dispatch("merged", { pr: mergedPr });
      await loadPulls();
      status = "success";
      message = successMessage;
    } catch (err) {
      status = "error";
      message = normalizeError(err);
    } finally {
      loading = false;
      loadingAction = "";
    }
  }

  function closeModal() {
    close();
  }

  function normalizeError(err) {
    const text = err?.message || "Review action failed";
    return text.endsWith(".") ? text : `${text}.`;
  }

  function getCheckState(check) {
    const value = String(check?.conclusion || check?.state || check?.status || "").toLowerCase();

    if (["success", "neutral", "skipped", "passing"].includes(value)) return "passing";
    if (["failure", "error", "cancelled", "timed_out", "action_required", "failing"].includes(value)) return "failing";
    if (["pending", "queued", "in_progress", "waiting", "requested"].includes(value)) return "pending";
    if (String(check?.status || "").toLowerCase() !== "completed") return "pending";
    return "unknown";
  }

  function getCheckLabel(check) {
    return check?.conclusion || check?.state || check?.status || "unknown";
  }

  function getGithubUserUrl(login) {
    return `https://github.com/${encodeGithubSegment(login)}`;
  }

  function getGithubBranchUrl() {
    if (!session?.pr?.headOwner || !session?.pr?.headRepo || !session?.pr?.headBranch) {
      return session?.pr?.url || "https://github.com/pvme/pvme-guides";
    }

    return `https://github.com/${encodeGithubSegment(session.pr.headOwner)}/${encodeGithubSegment(session.pr.headRepo)}/tree/${encodeURIComponent(session.pr.headBranch)}`;
  }

  function encodeGithubSegment(value) {
    return encodeURIComponent(String(value || ""));
  }

  onDestroy(() => {
    clearCheckPollTimer();
  });
</script>

<Modal {open} close={closeModal} panelClass="max-w-6xl !p-0">
  <div class="grid max-h-[82vh] grid-cols-[18rem_minmax(0,1fr)] overflow-hidden bg-slate-900 text-slate-100">
    <aside class="border-r border-slate-700 bg-slate-950/60">
      <div class="flex items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
        <h2 class="text-lg font-semibold">Review PRs</h2>
        <button
          class="toolbar-btn toolbar-btn--secondary"
          type="button"
          on:click={loadPulls}
          disabled={loading || refreshingPulls}
          data-disabled-reason={refreshDisabledReason}
          data-tooltip-placement="bottom"
        >
          {#if loadingPulls}
            <span class="loading-spinner" aria-hidden="true"></span>
            Loading
          {:else}
            Refresh
          {/if}
        </button>
      </div>
      <div class="max-h-[72vh] overflow-auto p-2">
        {#if loadingPulls && pulls.length > 0}
          <div class="mb-2 flex items-center gap-2 rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
            <span class="loading-spinner" aria-hidden="true"></span>
            Updating pull request list
          </div>
        {/if}

        {#if pulls.length === 0}
          <div class="p-3 text-sm text-slate-400">
            {#if loadingPulls}
              <span class="inline-flex items-center gap-2">
                <span class="loading-spinner" aria-hidden="true"></span>
                Loading pull requests
              </span>
            {:else}
              No open guide PRs found.
            {/if}
          </div>
        {/if}

        {#each pulls as pull}
          <button
            class="w-full min-w-0 rounded px-3 py-2 text-left text-sm hover:bg-slate-800 disabled:cursor-not-allowed {session?.pr?.number === pull.number ? 'bg-slate-800 text-blue-100' : 'text-slate-200'}"
            type="button"
            disabled={loading || refreshingPulls}
            on:click={() => selectPull(pull.number)}
          >
            <div class="flex items-center gap-2 font-semibold">
              <span class="min-w-0 flex-1 truncate">#{pull.number} {pull.title}</span>
              {#if loadingPull && loadingPullNumber === pull.number}
                <span class="loading-spinner" aria-hidden="true"></span>
              {/if}
            </div>
            <div class="mt-1 text-xs text-slate-400">{pull.author} · {pull.guideFiles.length} guide file{pull.guideFiles.length === 1 ? "" : "s"}</div>
          </button>
        {/each}
      </div>
    </aside>

    <section class="min-w-0 overflow-auto">
      {#if session}
        <div class="relative border-b border-slate-700 px-5 py-4">
          {#if loadingPull}
            <div class="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80 text-sm text-slate-200">
              <span class="loading-spinner mr-2" aria-hidden="true"></span>
              Loading pull request
            </div>
          {/if}
          <div class="pr-10">
            <div class="flex min-w-0 items-center gap-3">
              <a class="quiet-review-link min-w-0 truncate text-lg font-semibold" href={session.pr.url} target="_blank" rel="noreferrer">
                #{session.pr.number} {session.pr.title}
              </a>
            </div>
            <div class="min-w-0">
              <div class="mt-1 text-sm text-slate-400">
                <a class="quiet-review-link" href={getGithubUserUrl(session.pr.author)} target="_blank" rel="noreferrer">{session.pr.author}</a>
                <span> · </span>
                <a class="quiet-review-link" href={getGithubBranchUrl()} target="_blank" rel="noreferrer">{session.pr.headOwner}:{session.pr.headBranch}</a>
                {#if session.otherFiles.length > 0}
                  · {session.otherFiles.length} other file{session.otherFiles.length === 1 ? "" : "s"}
                {/if}
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-[16rem_minmax(0,1fr)] gap-0">
          <div class="border-r border-slate-700 p-3">
            <div class="mb-2 text-xs font-semibold uppercase text-slate-500">Changed files</div>
            {#each session.files as file}
              <button
                class="mb-1 w-full rounded px-2 py-2 text-left text-xs hover:bg-slate-800 {file.path === activePath ? 'bg-blue-950/50 text-blue-100' : 'text-slate-300'}"
                type="button"
                on:click={() => selectFile(file.path)}
              >
                <div class="truncate font-mono">{file.path}</div>
                <div class="mt-1 text-slate-500">{file.status} · +{file.additions} -{file.deletions}</div>
              </button>
            {/each}
          </div>

          <div class="min-w-0 p-4">
            {#if activeFile}
              <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate font-mono text-sm">{activeFile.path}</div>
                  <div class="text-xs text-slate-500">{activeFile.status} · {dirty ? "unsaved reviewer edit" : "loaded from PR head"}</div>
                </div>
              </div>
            {/if}

            {#if dirty}
              <div class="mt-3">
                <label class="mb-1 block text-xs font-semibold uppercase text-slate-500" for="review-commit-message">
                  Commit message
                </label>
                <input
                  id="review-commit-message"
                  class="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  maxlength="160"
                  placeholder="Summarise what you changed"
                  bind:value={commitMessage}
                  disabled={loading || !activeFile?.editable}
                />
              </div>
            {/if}

            <div class="mt-3 flex flex-wrap gap-2">
              <button
                class="toolbar-btn toolbar-btn--secondary review-action-btn"
                type="button"
                on:click={editActiveFile}
                disabled={loading || !activeFile?.editable}
                data-disabled-reason={editDisabledReason}
              >
                <Pencil />
                <span>Edit in editor</span>
              </button>
              <button
                class="toolbar-btn review-action-btn rounded"
                type="button"
                on:click={updateActiveFile}
                disabled={loading || !canUpdate}
                data-disabled-reason={commitDisabledReason}
              >
                {#if loadingUpdate}
                  <span class="loading-spinner" aria-hidden="true"></span>
                  Committing
                {:else}
                  Commit changes
                {/if}
              </button>
              <button
                class="toolbar-btn review-action-btn rounded"
                type="button"
                on:click={mergePr}
                disabled={loading || !canMerge}
                data-disabled-reason={mergeDisabledReason}
              >
                {#if loadingMerge}
                  <span class="loading-spinner" aria-hidden="true"></span>
                  Merging
                {:else}
                  Approve &amp; merge
                {/if}
              </button>
              <button class="review-danger-btn review-action-btn rounded" type="button" on:click={openClosePrForm} disabled={loading || !canClosePr}>
                {#if loadingClose}
                  <span class="loading-spinner" aria-hidden="true"></span>
                  Closing
                {:else}
                  Close PR
                {/if}
              </button>
            </div>

            {#if showClosePrForm}
              <div class="mt-3 rounded border border-red-800/70 bg-red-950/25 p-3">
                <label class="mb-1 block text-xs font-semibold uppercase text-red-200" for="review-close-reason">
                  Close reason
                </label>
                <textarea
                  id="review-close-reason"
                  class="min-h-24 w-full resize-y rounded border border-red-900/80 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-red-500 focus:outline-none"
                  placeholder="Explain why this PR is being closed"
                  bind:value={closeReason}
                  disabled={loadingClose}
                ></textarea>
                <div class="mt-3 flex justify-end gap-2">
                  <button
                    class="toolbar-btn toolbar-btn--secondary review-action-btn"
                    type="button"
                    on:click={cancelClosePr}
                    disabled={loadingClose}
                    data-disabled-reason={loadingClose ? "Closing PR" : ""}
                  >
                    Cancel
                  </button>
                  <button class="review-danger-btn review-action-btn rounded" type="button" on:click={closePr} disabled={loadingClose || !closeReasonText}>
                    {#if loadingClose}
                      <span class="loading-spinner" aria-hidden="true"></span>
                      Closing
                    {:else}
                      Comment &amp; close
                    {/if}
                  </button>
                </div>
              </div>
            {/if}

            {#if pollingChecks}
              <div class="mt-3 rounded border border-blue-700/50 bg-blue-950/30 px-3 py-2 text-sm text-blue-100">
                <span class="inline-flex items-center gap-2">
                  <span class="loading-spinner" aria-hidden="true"></span>
                  Waiting for GitHub checks to finish.
                </span>
              </div>
            {:else if checksState !== "passing" && checksState !== "unknown"}
              <div class="mt-3 rounded border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
                Checks are {checksState}. GitHub may reject merge until required checks pass.
              </div>
            {:else if checksState === "unknown"}
              <div class="mt-3 rounded border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-300">
                GitHub has not reported checks for this PR.
              </div>
            {/if}

            {#if checksCount > 0}
              <div class="mt-3 rounded border border-slate-700 bg-slate-950/40 p-3">
                <div class="mb-2 text-xs font-semibold uppercase text-slate-500">Checks</div>
                <div class="space-y-1">
                  {#each session.checks.checkRuns as check}
                    <a class="flex items-center justify-between gap-3 text-sm text-slate-300 hover:text-blue-200" href={check.url} target="_blank" rel="noreferrer">
                      <span class="inline-flex min-w-0 items-center gap-2">
                        {#if getCheckState(check) === "passing"}
                          <span class="check-icon text-emerald-300" aria-label="Passed">✓</span>
                        {:else if getCheckState(check) === "failing"}
                          <span class="check-icon text-red-300" aria-label="Failed">×</span>
                        {:else if getCheckState(check) === "pending"}
                          <span class="loading-spinner !h-3.5 !w-3.5" aria-label="Pending"></span>
                        {:else}
                          <span class="check-icon text-slate-500" aria-label="Unknown">?</span>
                        {/if}
                        <span class="truncate">{check.name}</span>
                      </span>
                      <span class="shrink-0 text-xs text-slate-500">{getCheckLabel(check)}</span>
                    </a>
                  {/each}
                  {#each session.checks.statuses as check}
                    <a class="flex items-center justify-between gap-3 text-sm text-slate-300 hover:text-blue-200" href={check.url} target="_blank" rel="noreferrer">
                      <span class="inline-flex min-w-0 items-center gap-2">
                        {#if getCheckState(check) === "passing"}
                          <span class="check-icon text-emerald-300" aria-label="Passed">✓</span>
                        {:else if getCheckState(check) === "failing"}
                          <span class="check-icon text-red-300" aria-label="Failed">×</span>
                        {:else if getCheckState(check) === "pending"}
                          <span class="loading-spinner !h-3.5 !w-3.5" aria-label="Pending"></span>
                        {:else}
                          <span class="check-icon text-slate-500" aria-label="Unknown">?</span>
                        {/if}
                        <span class="truncate">{check.context}</span>
                      </span>
                      <span class="shrink-0 text-xs text-slate-500">{getCheckLabel(check)}</span>
                    </a>
                  {/each}
                </div>
              </div>
            {/if}

            {#if message}
              <div class={`mt-3 rounded border px-3 py-2 text-sm ${status === "error" ? "border-red-700 bg-red-950/40 text-red-200" : "border-emerald-700 bg-emerald-950/40 text-emerald-200"}`}>
                {message}
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-slate-400">
          {#if loadingPull}
            <span class="inline-flex items-center gap-2">
              <span class="loading-spinner" aria-hidden="true"></span>
              Loading pull request
            </span>
          {:else}
            {#if message}
              <div class={`rounded border px-3 py-2 text-sm ${status === "error" ? "border-red-700 bg-red-950/40 text-red-200" : "border-emerald-700 bg-emerald-950/40 text-emerald-200"}`}>
                {message}
              </div>
            {/if}
            <div>Select a pull request, then choose a changed file to load it into the editor.</div>
          {/if}
        </div>
      {/if}
    </section>
  </div>
</Modal>

<style>
  .loading-spinner {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    border: 2px solid rgb(148 163 184 / 0.45);
    border-top-color: rgb(226 232 240);
    border-radius: 9999px;
    animation: spin 700ms linear infinite;
  }

  .check-icon {
    display: inline-flex;
    width: 0.875rem;
    height: 0.875rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1;
  }

  .review-action-btn {
    display: inline-flex;
    min-width: max-content;
    height: 2.5rem;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    white-space: nowrap;
  }

  .review-danger-btn {
    display: inline-flex;
    border: 1px solid rgb(153 27 27);
    background: rgb(185 28 28);
    padding: 0.5rem 0.75rem;
    color: white;
    font-size: 0.875rem;
    transition: background-color 150ms ease, border-color 150ms ease, opacity 150ms ease;
  }

  .review-danger-btn:hover:not(:disabled) {
    border-color: rgb(127 29 29);
    background: rgb(153 27 27);
  }

  .review-danger-btn:active:not(:disabled) {
    background: rgb(127 29 29);
  }

  .review-danger-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .quiet-review-link {
    color: inherit;
    text-decoration: none;
    text-underline-offset: 0.2rem;
    transition: color 150ms ease;
  }

  .quiet-review-link:hover,
  .quiet-review-link:focus-visible {
    color: rgb(191 219 254);
    text-decoration: underline;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
