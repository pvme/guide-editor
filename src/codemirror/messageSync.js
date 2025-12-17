// CLICK-ONLY MESSAGE SYNC ENGINE
// ------------------------------
// No scroll syncing.
// Only responds to:
// • Cursor movement in the editor
// • Message click in preview

import { EditorView } from "@codemirror/view";

export function messageSyncExtension({
  getMessageAtEditorLine,   // (line) → msgIndex
  scrollPreviewToMessage,   // (msgIndex)
  highlightPreviewMessage,  // (msgIndex)
  scrollEditorToMessage,    // (msgIndex, view)
  highlightEditorMessage    // (msgIndex, view)
}) {
  return {
    /** Called by pvmeExtensions when the editor cursor moves */
    handleEditorCursor(view) {
      const pos = view.state.selection.main.head;
      const line = view.state.doc.lineAt(pos).number;
      const msgIndex = getMessageAtEditorLine(line);

      if (msgIndex == null) return;

      scrollPreviewToMessage(msgIndex);
      highlightPreviewMessage(msgIndex);
    },

    /** Called externally when clicking a message in preview */
    syncEditorToMessage(view, msgIndex) {
      scrollEditorToMessage(msgIndex, view);
      highlightEditorMessage(msgIndex, view);

      scrollPreviewToMessage(msgIndex);
      highlightPreviewMessage(msgIndex);
    }
  };
}

// ---------------------------------------------------------------------------
// DEFAULT HANDLER IMPLEMENTATIONS
// ---------------------------------------------------------------------------

export function getMessageAtEditorLine(currentMessages, line) {
  for (let i = 0; i < currentMessages.length; i++) {
    const m = currentMessages[i];
    if (line >= m.firstEditorLine && line <= m.lastEditorLine) {
      return i;
    }
  }
  return 0;
}

export function highlightPreviewMessage(index) {
  document.querySelectorAll(".pvme-message")
    .forEach(el => el.classList.remove("highlight"));

  const target = document.querySelector(
    `.pvme-message[data-msg-index="${index}"]`
  );
  if (target) target.classList.add("highlight");
}

export function highlightEditorMessage() {
  // optional hook
}

export function scrollPreviewToMessage(index) {
  const target = document.querySelector(
    `.pvme-message[data-msg-index="${index}"]`
  );
  const container = document.querySelector(".discord-view");
  if (!target || !container) return;

  const targetCentre =
    target.offsetTop + target.offsetHeight / 2;

  const containerCentre =
    container.clientHeight / 2;

  container.scrollTo({
    top: targetCentre - containerCentre,
    behavior: "smooth"
  });
}

export function scrollEditorToMessage(currentMessages, msgIndex, view) {
  const start = currentMessages[msgIndex]?.firstEditorLine;
  if (!start) return;

  const line = view.state.doc.line(start);

  view.dispatch({
    selection: { anchor: line.from },
    effects: EditorView.scrollIntoView(line.from, {
      y: "center",
      yMargin: 80
    })
  });
}
