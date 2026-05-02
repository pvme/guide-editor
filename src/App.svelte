<script>
  import DiscordView from "./components/discordView/DiscordView.svelte";
  import ErrorView from "./components/errorView/ErrorView.svelte";
  import Toolbar from "./components/toolbar/Toolbar.svelte";

  import { EditorState } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import { onMount, onDestroy } from "svelte";

  import { authUser, loadedGuide, text } from "./stores";
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
  let removeGlobalKeydown = null;

  $: checkerIssues = [...findStyleErrors(validText), ...findSyntaxErrors(validText)];
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
    pendingGuide = await findGuideFromParam(paramID);
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
    applyLoadedGuide(loaded, "Loaded the live guide. Submitting will replace your existing submitted update.");
    pendingGuide = null;
    showGuideModal = false;
    guideLoadStatus = "idle";
  }

  function applyLoadedGuide(loaded, notice) {
    const guideText = loaded.originalText || "";
    // Replace editor text
    editor.dispatch({
      changes: {
        from: 0,
        to: editor.state.doc.length,
        insert: guideText
      }
    });

    text.set(guideText);
    loadedGuide.set({
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
    });

    guideNotice = notice;
  }

  function cancelLoadGuide() {
    if (guideLoadStatus !== "idle") return;
    pendingGuide = null;
    showGuideModal = false;
  }


  // ------------------------------------------------
  // Setup editor
  // ------------------------------------------------
  let initialDoc = "";
  text.subscribe(v => (initialDoc = v))();

  onMount(() => {
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
        })
      ]
    });

    editor = new EditorView({ state, parent: inputEl });
    syncEngine = editor.state.facet(SyncEngineFacet)[0];

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
    text.subscribe(v => {
      validText = v;

      if (v.trim().length === 0) {
        loadedGuide.set(null);
      }

      const cur = editor.state.doc.toString();
      if (cur !== v) {
        editor.dispatch({
          changes: { from: 0, to: cur.length, insert: v }
        });
      }
    });
  });

  onDestroy(() => {
    removeGlobalKeydown?.();
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
    pendingGuide = guide;
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
</script>

<main>
  <div class="flex flex-col h-screen bg-slate-900">

    <Toolbar
      {insertAtCursor}
      {getEditorCursorPosition}
      {replaceEditorText}
      on:command={(e) => runCommand(e.detail)}
      on:toggleView={() => (showView = !showView)}
      on:loadGuide={(e) => handleGuideSearchSelect(e.detail)}
      on:openGuideSearch={() => (showGuideSearch = true)}
      on:openSubmitPr={() => (showSubmitPrModal = true)}
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

</main>
