<script>
  import DiscordView from "./components/discordView/DiscordView.svelte";
  import ErrorView from "./components/errorView/ErrorView.svelte";
  import Toolbar from "./components/toolbar/Toolbar.svelte";

  import { EditorState } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import { onMount, onDestroy } from "svelte";
  import { get } from "svelte/store";

  import { activeDraft, authUser, drafts, getDraftTitle, loadedGuide, text, editorSettings, normalizeEditorSettings } from "./stores";
  import { populateConstants } from "./pvmeSettings";
  import { findGuideFromParam, loadGuideText } from "./components/GuideLoadModal.js";
  import { getAuthenticatedUser } from "./guidePrApi";
  import findStyleErrors from "./syntax/style";
  import findSyntaxErrors from "./syntax/syntax";
  import GuideLoadModal from "./components/GuideLoadModal.svelte";
  import GuideSearch from "./components/toolbar/GuideSearch.svelte";
  import SubmitPrModal from "./components/toolbar/SubmitPrModal.svelte";
  import { setEditorIssuesEffect } from "./codemirror/errorGutter.js";
  import {
    pvmeExtensions,
    commandDispatch,
    SyncEngineFacet
  } from "./codemirror/pvmeExtensions.js";
  import { reconfigureEditorSettings } from "./codemirror/editorSettings.js";

  import {
    getMessageAtEditorLine,
    scrollPreviewToMessage,
    highlightPreviewMessage,
    scrollEditorToMessage,
    highlightEditorMessage
  } from "./codemirror/messageSync.js";

  let editor;
  let inputEl;

  let currentMessages = [];
  let currentOffsets = [];

  let validText = "";
  let showView = true;
  let scrollBottom = false;

  let syncEngine = null;

  let showGuideModal = false;
  let pendingGuide = null;
  let showGuideSearch = false;
  let showSubmitPrModal = false;
  let submitAuthError = "";
  let errorViewFlashKey = 0;
  let guideLoadStatus = "idle";
  let guideNotice = "";
  let showNewDraftConfirm = false;
  let draftToRename = null;
  let renameDraftValue = "";
  let draftToDelete = null;
  let removeGlobalKeydown = null;
  let activeEditorLine = 1;
  let confirmedTrailingWhitespaceLines = new Set();
  let removeEditorSettingsSubscription = null;
  let removeActiveDraftSubscription = null;
  let removeTextSubscription = null;
  let removeLoadedGuideSubscription = null;
  let currentEditorSettings = normalizeEditorSettings();
  let activeDraftId = null;
  let syncingDraftToStores = false;

  $: ignoredTrailingWhitespaceLine = confirmedTrailingWhitespaceLines.has(activeEditorLine)
    ? null
    : activeEditorLine;
  $: checkerIssues = [
    ...findStyleErrors(validText, { ignoredTrailingWhitespaceLine }),
    ...findSyntaxErrors(validText)
  ];
  $: if (editor) {
    editor.dispatch({
      effects: setEditorIssuesEffect.of(checkerIssues)
    });
  }

  // -----------------------------
  // Wrappers for sync helpers
  // -----------------------------
  function _getMessageAtEditorLine(line) {
    return getMessageAtEditorLine(currentMessages, line);
  }

  function _scrollEditorToMessage(msgIndex, view) {
    scrollEditorToMessage(currentMessages, msgIndex, view);
  }

  // -----------------------------
  // Preview click handler
  // -----------------------------
  function handleMessageClick(e) {
    currentMessages = e.detail.messages;
    currentOffsets = e.detail.offsets;

    const msgIndex = e.detail.index;
    syncEngine.syncEditorToMessage(editor, msgIndex);
  }


  // ------------------------------------------------
  // Load guide from ?id=xxxx
  // ------------------------------------------------
  async function loadGuide(paramID) {
    pendingGuide = withExistingLocalDraft(await findGuideFromParam(paramID));
    showGuideModal = !!pendingGuide;
  }

  // -----------------------------
  // Modal button actions
  // -----------------------------
  async function confirmLoadGuide() {
    if (!pendingGuide) return;

    guideLoadStatus = "confirm";
    const loaded = await loadGuideText(pendingGuide, "auto");

    if (loaded.hasExistingReview) {
      pendingGuide = {
        ...pendingGuide,
        ...loaded
      };
      guideLoadStatus = "idle";
      return;
    }

    applyLoadedGuide(loaded, "");

    // Remove ?id from URL
    window.history.replaceState({}, document.title, "/guide-editor/");
    
    pendingGuide = null;
    showGuideModal = false;
    guideLoadStatus = "idle";
  }

  async function openAnotherLocalGuideDraft() {
    if (!pendingGuide) return;

    pendingGuide = {
      ...pendingGuide,
      localDraft: null
    };

    await confirmLoadGuide();
  }

  function continueLocalGuideDraft() {
    const draftId = pendingGuide?.localDraft?.id;
    if (!draftId) return;

    drafts.switchTo(draftId);
    pendingGuide = null;
    showGuideModal = false;
    guideLoadStatus = "idle";
  }

  async function loadExistingReviewGuide() {
    if (!pendingGuide) return;
    guideLoadStatus = "review";
    const loaded = await loadGuideText(pendingGuide, "review");
    applyLoadedGuide(loaded, "Loaded your submitted update.");
    pendingGuide = null;
    showGuideModal = false;
    guideLoadStatus = "idle";
  }

  async function loadLiveGuideReplacingReview() {
    if (!pendingGuide) return;
    guideLoadStatus = "live";
    const loaded = await loadGuideText(pendingGuide, "master");
    applyLoadedGuide(loaded, "Started a new draft from the PvME guide. Submitting will replace your existing submitted update.");
    pendingGuide = null;
    showGuideModal = false;
    guideLoadStatus = "idle";
  }

  function applyLoadedGuide(loaded, notice) {
    const guideText = loaded.originalText || "";
    const guide = {
      name: loaded.name || pendingGuide?.name,
      path: loaded.path || pendingGuide?.path,
      url: pendingGuide?.url,
      repo: loaded.repo || "pvme/pvme-guides",
      source: loaded.source || "master",
      branch: loaded.branch || "master",
      baseBranch: loaded.baseBranch || "master",
      prUrl: loaded.prUrl || "",
      existingReviewBranch: loaded.existingReviewBranch || "",
      existingReviewUrl: loaded.existingReviewUrl || "",
      originalText: guideText
    };

    const draftName = getNextLoadedGuideDraftName(guide);

    drafts.create({
      name: draftName,
      content: guideText,
      loadedGuide: guide
    });

    guideNotice = notice;
  }

  function cancelLoadGuide() {
    if (guideLoadStatus !== "idle") return;
    pendingGuide = null;
    showGuideModal = false;
  }

  function withExistingLocalDraft(guide) {
    if (!guide?.path) return guide;

    const state = get(drafts);
    const localDraft = [...state.drafts]
      .filter(draft => draft.loadedGuide?.path === guide.path)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];

    return localDraft
      ? { ...guide, localDraft }
      : guide;
  }

  function getNextLoadedGuideDraftName(guide) {
    const baseName = guide.name || guide.path?.split("/").pop() || "Loaded guide";
    if (!guide.path) return baseName;

    const sameOriginDrafts = get(drafts).drafts
      .filter(draft => draft.loadedGuide?.path === guide.path);

    if (sameOriginDrafts.length === 0) {
      return baseName;
    }

    const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const numberedName = new RegExp(`^${escapedBaseName} \\((\\d+)\\)$`);
    const usedNumbers = new Set();

    for (const draft of sameOriginDrafts) {
      const match = draft.name?.match(numberedName);
      if (match) {
        usedNumbers.add(Number(match[1]));
      } else if (draft.name === baseName) {
        usedNumbers.add(1);
      }
    }

    let nextNumber = 1;
    while (usedNumbers.has(nextNumber)) {
      nextNumber += 1;
    }

    return `${baseName} (${nextNumber})`;
  }

  function lineHasTrailingWhitespace(doc, lineNumber) {
    if (!doc || lineNumber < 1 || lineNumber > doc.lines) return false;
    return /[ \t]$/.test(doc.line(lineNumber).text);
  }

  function getTrailingWhitespaceLines(doc) {
    const lines = new Set();

    for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
      if (lineHasTrailingWhitespace(doc, lineNumber)) {
        lines.add(lineNumber);
      }
    }

    return lines;
  }

  function confirmTrailingWhitespaceLine(doc, lineNumber) {
    const next = new Set(confirmedTrailingWhitespaceLines);

    if (lineHasTrailingWhitespace(doc, lineNumber)) {
      next.add(lineNumber);
    } else {
      next.delete(lineNumber);
    }

    confirmedTrailingWhitespaceLines = next;
  }

  function pruneConfirmedTrailingWhitespaceLines(doc) {
    const next = new Set(
      [...confirmedTrailingWhitespaceLines].filter(lineNumber =>
        lineHasTrailingWhitespace(doc, lineNumber)
      )
    );

    if (
      next.size !== confirmedTrailingWhitespaceLines.size
      || [...next].some(lineNumber => !confirmedTrailingWhitespaceLines.has(lineNumber))
    ) {
      confirmedTrailingWhitespaceLines = next;
    }
  }


  // ------------------------------------------------
  // Setup editor
  // ------------------------------------------------
  let initialDoc = "";
  let initialLoadedGuide = null;
  text.subscribe(v => (initialDoc = v))();
  loadedGuide.subscribe(v => (initialLoadedGuide = v))();

  const initialDraftState = get(drafts);
  const initialDraft = initialDraftState.drafts.find(draft => draft.id === initialDraftState.activeDraftId);
  const hasLegacyContent = initialDoc.trim().length > 0 || Boolean(initialLoadedGuide);
  const hasOnlyBlankInitialDraft = initialDraftState.drafts.length === 1
    && (initialDraft?.content || "").trim().length === 0
    && !initialDraft?.loadedGuide;

  if (hasLegacyContent && hasOnlyBlankInitialDraft) {
    drafts.updateActive({
      name: initialLoadedGuide?.name || initialLoadedGuide?.path?.split("/").pop() || "Current draft",
      content: initialDoc,
      loadedGuide: initialLoadedGuide
    });
  }

  initialDoc = get(activeDraft)?.content || initialDoc;

  onMount(() => {
    removeEditorSettingsSubscription = editorSettings.subscribe(settings => {
      currentEditorSettings = normalizeEditorSettings(settings);
      showView = currentEditorSettings.showPreview;

      if (editor) {
        editor.dispatch({
          effects: reconfigureEditorSettings(currentEditorSettings)
        });
      }
    });

    getAuthenticatedUser()
      .then((user) => authUser.set(user))
      .catch(() => authUser.set(null));

    if (initialDoc.trim().length === 0) {
      loadedGuide.set(null);
    }

    function handleGlobalKeydown(e) {
      if (e.code !== "Space") return;
      if (!e.ctrlKey && !e.metaKey) return;

      e.preventDefault();
      showGuideSearch = true;
    }

    document.addEventListener("keydown", handleGlobalKeydown);
    removeGlobalKeydown = () => document.removeEventListener("keydown", handleGlobalKeydown);

    const state = EditorState.create({
      doc: initialDoc,
      extensions: [
        pvmeExtensions(text, {
          getMessageAtEditorLine: _getMessageAtEditorLine,
          scrollPreviewToMessage,
          highlightPreviewMessage,
          scrollEditorToMessage: _scrollEditorToMessage,
          highlightEditorMessage
        }, currentEditorSettings),
        EditorView.updateListener.of((update) => {
          if (!update.selectionSet && !update.docChanged) return;

          const nextActiveLine = update.state.doc.lineAt(update.state.selection.main.head).number;

          if (nextActiveLine !== activeEditorLine) {
            confirmTrailingWhitespaceLine(update.state.doc, activeEditorLine);
          } else if (update.docChanged) {
            pruneConfirmedTrailingWhitespaceLines(update.state.doc);
          }

          activeEditorLine = nextActiveLine;
        })
      ]
    });

    editor = new EditorView({ state, parent: inputEl });
    syncEngine = editor.state.facet(SyncEngineFacet)[0];
    confirmedTrailingWhitespaceLines = getTrailingWhitespaceLines(editor.state.doc);

    removeActiveDraftSubscription = activeDraft.subscribe(draft => {
      if (!draft || !editor || draft.id === activeDraftId) return;

      activeDraftId = draft.id;
      syncingDraftToStores = true;
      guideNotice = "";

      loadedGuide.set(draft.loadedGuide || null);
      text.set(draft.content || "");

      const cur = editor.state.doc.toString();
      const next = draft.content || "";
      if (cur !== next) {
        editor.dispatch({
          changes: { from: 0, to: cur.length, insert: next }
        });
      }

      confirmedTrailingWhitespaceLines = getTrailingWhitespaceLines(editor.state.doc);
      syncingDraftToStores = false;
    });

    // --- Load guide from URL ---
    const params = new URLSearchParams(window.location.search);
    if (params.get("authError")) {
      submitAuthError = params.get("authError");
    }

    if (params.get("submit") === "1" || submitAuthError) {
      showSubmitPrModal = true;
      params.delete("submit");
      params.delete("authError");
      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
      window.history.replaceState({}, document.title, nextUrl);
    }

    if (params.has("id")) {
      loadGuide(params.get("id"));
    }

    editor.focus();

    // Sync store → editor
    removeTextSubscription = text.subscribe(v => {
      validText = v;

      if (!syncingDraftToStores && activeDraftId) {
        drafts.updateActive({ content: v });
      }

      if (!syncingDraftToStores && v.trim().length === 0) {
        loadedGuide.set(null);
      }

      const cur = editor.state.doc.toString();
      if (cur !== v) {
        editor.dispatch({
          changes: { from: 0, to: cur.length, insert: v }
        });
        confirmedTrailingWhitespaceLines = getTrailingWhitespaceLines(editor.state.doc);
      }
    });

    removeLoadedGuideSubscription = loadedGuide.subscribe(v => {
      if (syncingDraftToStores || !activeDraftId) return;
      drafts.updateActive({ loadedGuide: v });
    });
  });

  onDestroy(() => {
    removeGlobalKeydown?.();
    removeEditorSettingsSubscription?.();
    removeActiveDraftSubscription?.();
    removeTextSubscription?.();
    removeLoadedGuideSubscription?.();
    editor?.destroy();
  });

  // -----------------------------
  // Toolbar actions
  // -----------------------------
  function runCommand(name) {
    const commands = Object.assign({}, ...editor.state.facet(commandDispatch));
    const fn = commands[name];
    if (fn) fn(editor);
    editor.focus();
  }

  function insertAtCursor(text) {
    if (!editor) return;

    const view = editor;
    const sel = view.state.selection.main;

    const raw = text;
    const clean = raw.replace("|", "");

    const pipeIndex = raw.indexOf("|");
    const cursor =
      pipeIndex === -1 ? sel.from + clean.length : sel.from + pipeIndex;

    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: clean },
      selection: { anchor: cursor }
    });

    view.focus();
  }

  function getEditorCursorPosition() {
    return editor?.state.selection.main.head ?? null;
  }

  function replaceEditorText(nextText, cursorPosition = null) {
    if (!editor) return;

    const nextCursor = cursorPosition === null
      ? editor.state.selection.main.head
      : Math.min(Math.max(cursorPosition, 0), nextText.length);

    editor.dispatch({
      changes: {
        from: 0,
        to: editor.state.doc.length,
        insert: nextText
      },
      selection: { anchor: nextCursor },
      effects: EditorView.scrollIntoView(nextCursor, {
        y: "center",
        x: "nearest"
      })
    });

    text.set(nextText);
    editor.focus();
  }

  function handleGuideSearchSelect(guide) {
    pendingGuide = withExistingLocalDraft(guide);
    showGuideSearch = false;
    showGuideModal = true;
  }

  function handleErrorJump(e) {
    if (!editor) return;

    const requestedLine = e.detail?.line || 1;
    const lineNumber = Math.min(
      Math.max(requestedLine, 1),
      editor.state.doc.lines
    );
    const line = editor.state.doc.line(lineNumber);

    editor.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, {
        y: "center",
        x: "nearest"
      })
    });

    editor.focus();
  }

  function handleReviewCheckerIssues() {
    showSubmitPrModal = false;
    errorViewFlashKey += 1;
  }

  function togglePreviewVisibility() {
    editorSettings.update(settings => {
      const current = normalizeEditorSettings(settings);

      return {
        ...current,
        showPreview: !current.showPreview
      };
    });
  }

  function openRenameDraftModal(draft) {
    draftToRename = draft;
    renameDraftValue = getDraftTitle(draft);
  }

  function requestNewDraft() {
    if (editor?.state.doc.toString().trim().length > 0) {
      showNewDraftConfirm = true;
      return;
    }

    createNewDraft();
  }

  function createNewDraft() {
    drafts.create();
    showNewDraftConfirm = false;
    guideNotice = "";
  }

  function confirmRenameDraft() {
    if (!draftToRename) return;
    drafts.rename(draftToRename.id, renameDraftValue);
    draftToRename = null;
    renameDraftValue = "";
  }

  function openDeleteDraftModal(draft) {
    draftToDelete = draft;
  }

  function confirmDeleteDraft() {
    if (!draftToDelete) return;
    drafts.delete(draftToDelete.id);
    draftToDelete = null;
  }

  function handleDraftModalKeydown(e) {
    const isButtonTarget = e.target instanceof Element && e.target.closest("button");

    if (showNewDraftConfirm) {
      if (e.key === "Escape") {
        e.preventDefault();
        showNewDraftConfirm = false;
      }

      if (e.key === "Enter" && !isButtonTarget) {
        e.preventDefault();
        createNewDraft();
      }
      return;
    }

    if (draftToRename) {
      if (e.key === "Escape") {
        e.preventDefault();
        draftToRename = null;
      }

      if (e.key === "Enter" && !isButtonTarget) {
        e.preventDefault();
        confirmRenameDraft();
      }
      return;
    }

    if (draftToDelete) {
      if (e.key === "Escape") {
        e.preventDefault();
        draftToDelete = null;
      }

      if (e.key === "Enter" && !isButtonTarget) {
        e.preventDefault();
        confirmDeleteDraft();
      }
    }
  }
</script>

<svelte:window on:keydown={handleDraftModalKeydown} />

<main>
  <div class="flex flex-col h-screen bg-slate-900">

    <Toolbar
      {insertAtCursor}
      {getEditorCursorPosition}
      {replaceEditorText}
      {showView}
      on:command={(e) => runCommand(e.detail)}
      on:toggleView={togglePreviewVisibility}
      on:loadGuide={(e) => handleGuideSearchSelect(e.detail)}
      on:openGuideSearch={() => (showGuideSearch = true)}
      on:openSubmitPr={() => (showSubmitPrModal = true)}
      on:newDraft={requestNewDraft}
      on:renameDraft={(e) => openRenameDraftModal(e.detail)}
      on:deleteDraft={(e) => openDeleteDraftModal(e.detail)}
    />


    <div class="flex-1 flex flex-row overflow-hidden">

      <!-- EDITOR -->
      <div
        class="w-1/2 ml-4 mr-2 mb-4 flex flex-col"
        class:w-full={!showView}
        class:mr-4={!showView}
      >
      <div
        bind:this={inputEl}
        class="editor cm6-container flex-1 flex flex-col overflow-hidden"
      ></div>

        {#if guideNotice}
          <div class="mt-2 rounded border border-blue-800/50 bg-blue-950/30 px-3 py-2 text-sm text-blue-100">
            {guideNotice}
          </div>
        {/if}

        <ErrorView
          text={validText}
          flashKey={errorViewFlashKey}
          {ignoredTrailingWhitespaceLine}
          on:jump={handleErrorJump}
        />
      </div>

      <!-- PREVIEW -->
      {#await populateConstants()}
        <p class="ml-2">Loading constants…</p>
      {:then}
        {#if showView}
          <div class="w-1/2 mr-4 ml-2 mb-4 overflow-auto discord-view">
            <DiscordView
              text={validText}
              scrollBottom={scrollBottom}
              bind:messages={currentMessages}
              bind:offsets={currentOffsets}
              on:messageClick={handleMessageClick}
            />
          </div>
        {/if}
      {/await}
    </div>
  </div>

  <GuideLoadModal
    open={showGuideModal}
    guide={pendingGuide}
    loadingAction={guideLoadStatus}
    on:confirm={confirmLoadGuide}
    on:continueLocalDraft={continueLocalGuideDraft}
    on:openAnotherDraft={openAnotherLocalGuideDraft}
    on:loadReview={loadExistingReviewGuide}
    on:loadLive={loadLiveGuideReplacingReview}
    on:cancel={cancelLoadGuide}
  />

  <GuideSearch
    open={showGuideSearch}
    on:select={(e) => handleGuideSearchSelect(e.detail)}
    on:cancel={() => (showGuideSearch = false)}
  />

  <SubmitPrModal
    open={showSubmitPrModal}
    authError={submitAuthError}
    on:reviewIssues={handleReviewCheckerIssues}
    close={() => {
      showSubmitPrModal = false;
      submitAuthError = "";
    }}
  />

  {#if showNewDraftConfirm}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        class="w-full max-w-md rounded border border-slate-700 bg-slate-800 p-5 text-white shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
        role="dialog"
        aria-modal="true"
      >
        <h2 class="text-lg font-semibold">Create New Draft</h2>
        <p class="mt-3 text-sm text-slate-300">
          This draft is saved in Local drafts. Creating a new draft will only clear the editor window.
        </p>
        <div class="mt-5 flex justify-end gap-2">
          <button
            class="rounded border border-slate-600 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
            type="button"
            on:click={() => (showNewDraftConfirm = false)}
          >
            Cancel
          </button>
          <button class="toolbar-btn rounded font-medium" type="button" on:click={createNewDraft}>
            New draft
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if draftToRename}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        class="w-full max-w-md rounded border border-slate-700 bg-slate-800 p-5 text-white shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
        role="dialog"
        aria-modal="true"
      >
        <form on:submit|preventDefault={confirmRenameDraft}>
          <h2 class="text-lg font-semibold">Rename Draft</h2>
          <label class="mt-4 block text-sm text-slate-300" for="draft-name">Draft name</label>
          <input
            id="draft-name"
            class="mt-2 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
            bind:value={renameDraftValue}
          />
          <div class="mt-5 flex justify-end gap-2">
            <button
              class="rounded border border-slate-600 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
              type="button"
              on:click={() => (draftToRename = null)}
            >
              Cancel
            </button>
            <button class="toolbar-btn rounded font-medium" type="submit">
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if draftToDelete}
    {@const isOnlyDraft = $drafts.drafts.length <= 1}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        class="w-full max-w-md rounded border border-slate-700 bg-slate-800 p-5 text-white shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
        role="dialog"
        aria-modal="true"
      >
        <h2 class="text-lg font-semibold">Discard Draft</h2>
        <p class="mt-3 text-sm text-slate-300">
          {#if isOnlyDraft}
            Discard "{getDraftTitle(draftToDelete)}" and start a blank draft?
          {:else}
            Discard "{getDraftTitle(draftToDelete)}"?
          {/if}
        </p>
        <div class="mt-5 flex justify-end gap-2">
          <button
            class="rounded border border-slate-600 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
            type="button"
            on:click={() => (draftToDelete = null)}
          >
            Cancel
          </button>
          <button
            class="rounded border border-red-700 bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            type="button"
            on:click={confirmDeleteDraft}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  {/if}

</main>
