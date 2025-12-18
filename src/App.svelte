<script>
  import DiscordView from "./components/discordView/DiscordView.svelte";
  import ErrorView from "./components/errorView/ErrorView.svelte";
  import Toolbar from "./components/toolbar/Toolbar.svelte";

  import { EditorState } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import { onMount, onDestroy } from "svelte";

  import { text } from "./stores";
  import { populateConstants } from "./pvmeSettings";
  import { findGuideFromParam, loadGuideText } from "./components/GuideLoadModal.js";
  import GuideLoadModal from "./components/GuideLoadModal.svelte";
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

    const guideText = await loadGuideText(pendingGuide.url);

    // Replace editor text
    editor.dispatch({
      changes: {
        from: 0,
        to: editor.state.doc.length,
        insert: guideText
      }
    });

    text.set(guideText);

    // Remove ?id from URL
    window.history.replaceState({}, document.title, "/guide-editor/");
    
    pendingGuide = null;
    showGuideModal = false;
  }

  function cancelLoadGuide() {
    pendingGuide = null;
    showGuideModal = false;
  }


  // ------------------------------------------------
  // Setup editor
  // ------------------------------------------------
  let initialDoc = "";
  text.subscribe(v => (initialDoc = v))();

  onMount(() => {
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
    if (params.has("id")) {
      loadGuide(params.get("id"));
    }

    editor.focus();

    // Sync store → editor
    text.subscribe(v => {
      validText = v;
      const cur = editor.state.doc.toString();
      if (cur !== v) {
        editor.dispatch({
          changes: { from: 0, to: cur.length, insert: v }
        });
      }
    });
  });

  onDestroy(() => editor?.destroy());

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

  function handleGuideSearchSelect(guide) {
    pendingGuide = guide;
    showGuideModal = true;
  }
</script>

<main>
  <div class="flex flex-col h-screen bg-slate-900">

    <Toolbar
      {insertAtCursor}
      on:command={(e) => runCommand(e.detail)}
      on:toggleView={() => (showView = !showView)}
      on:loadGuide={(e) => handleGuideSearchSelect(e.detail)}
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

        <ErrorView text={validText} />
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
    on:confirm={confirmLoadGuide}
    on:cancel={cancelLoadGuide}
  />

</main>
