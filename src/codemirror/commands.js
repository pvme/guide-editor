// src/codemirror/commands.js

import { EditorSelection } from "@codemirror/state";

/* ------------------------------------------------------------------
   UTILITIES
------------------------------------------------------------------- */

function getSelection(state) {
  const sel = state.selection.main;
  return {
    from: sel.from,
    to: sel.to,
    empty: sel.empty
  };
}

function getText(state, from, to) {
  return state.sliceDoc(from, to);
}

function replaceRange(state, dispatch, from, to, insert) {
  dispatch(state.update({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length }
  }));
}

function wrapFormat({ state, dispatch }, before, after) {
  const sel = state.selection.main;
  const from = sel.from;
  const to = sel.to;
  const text = state.sliceDoc(from, to);

  const hasBefore =
    from >= before.length &&
    state.sliceDoc(from - before.length, from) === before;

  const hasAfter =
    state.sliceDoc(to, to + after.length) === after;

  // ----------------------------
  // REMOVE formatting (toggle off)
  // ----------------------------
  if (hasBefore && hasAfter) {
    dispatch(
      state.update({
        changes: [
          // remove BEFORE marker
          { from: from - before.length, to: from, insert: "" },
          // remove AFTER marker
          { from: to, to: to + after.length, insert: "" }
        ],
        selection: {
          anchor: from - before.length,
          head: to - before.length
        }
      })
    );
    return true;
  }

  // ----------------------------
  // ADD formatting (toggle on)
  // ----------------------------
  dispatch(
    state.update({
      changes: {
        from,
        to,
        insert: before + text + after
      },
      selection: {
        anchor: from + before.length,
        head: to + before.length
      }
    })
  );
  return true;
}


/* ------------------------------------------------------------------
   FORMAT COMMANDS
------------------------------------------------------------------- */

export const toggleBold = (view) =>
  wrapFormat(view, "**", "**");

export const toggleItalic = (view) =>
  wrapFormat(view, "*", "*");

export const toggleUnderline = (view) =>
  wrapFormat(view, "__", "__");

export const toggleStrikethrough = (view) =>
  wrapFormat(view, "~~", "~~");

export const toggleH1 = ({ state, dispatch }) => {
  const sel = state.selection.main;
  const line = state.doc.lineAt(sel.from);
  const txt = line.text;

  const newText = txt.startsWith("# ")
    ? txt.slice(2)
    : "# " + txt;

  replaceRange(state, dispatch, line.from, line.to, newText);
  return true;
};

export const toggleH2 = ({ state, dispatch }) => {
  const sel = state.selection.main;
  const line = state.doc.lineAt(sel.from);
  const txt = line.text;

  const newText = txt.startsWith("## ")
    ? txt.slice(3)
    : "## " + txt;

  replaceRange(state, dispatch, line.from, line.to, newText);
  return true;
};

export const toggleH3 = ({ state, dispatch }) => {
  const sel = state.selection.main;
  const line = state.doc.lineAt(sel.from);
  const txt = line.text;

  const newText = txt.startsWith("### ")
    ? txt.slice(4)
    : "### " + txt;

  replaceRange(state, dispatch, line.from, line.to, newText);
  return true;
};

/* ------------------------------------------------------------------
   INLINE CODE
------------------------------------------------------------------- */

export const formatInlineCode = (view) =>
  wrapFormat(view, "`", "`");


/* ------------------------------------------------------------------
   CODE BLOCK
------------------------------------------------------------------- */

export const formatCodeBlock = ({ state, dispatch }) => {
  const sel = state.selection.main;
  const from = sel.from;
  const to = sel.to;
  const text = state.sliceDoc(from, to);

  const before = "```\n";
  const after = "\n```";

  const hasBefore =
    from >= before.length &&
    state.sliceDoc(from - before.length, from) === before;

  const hasAfter =
    state.sliceDoc(to, to + after.length) === after;

  // ----------------------------
  // REMOVE fenced block (toggle off)
  // ----------------------------
  if (hasBefore && hasAfter) {
    dispatch(
      state.update({
        changes: [
          { from: from - before.length, to: from, insert: "" },
          { from: to, to: to + after.length, insert: "" }
        ],
        selection: {
          anchor: from - before.length,
          head: to - before.length
        }
      })
    );
    return true;
  }

  // ----------------------------
  // ADD fenced block (toggle on)
  // ----------------------------
  dispatch(
    state.update({
      changes: {
        from,
        to,
        insert: before + text + after
      },
      selection: {
        anchor: from + before.length,
        head: to + before.length
      }
    })
  );

  return true;
};


/* ------------------------------------------------------------------
   INSERT LIST ITEM COMMANDS (Toolbar only)
------------------------------------------------------------------- */

import { bulletForIndent, parseListLine, orderedMarkerForIndent } from "./listIndent.js";

export function insertUnorderedList(view) {
  const { state, dispatch } = view;
  const sel = state.selection.main;

  const line = state.doc.lineAt(sel.from);
  const parsed = parseListLine(line.text);
  const indent = line.text.match(/^\s*/)[0].length;

  // TOGGLE OFF if already unordered
  if (parsed && parsed.type === "unordered") {
    const newText = " ".repeat(parsed.indent) + parsed.content;
    dispatch(state.update({
      changes: { from: line.from, to: line.to, insert: newText },
      selection: EditorSelection.cursor(line.from + newText.length)
    }));
    return true;
  }

  // SWITCH ordered → unordered
  if (parsed && parsed.type === "ordered") {
    const bullet = bulletForIndent(parsed.indent);
    const newText = " ".repeat(parsed.indent) + bullet + " " + parsed.content;
    dispatch(state.update({
      changes: { from: line.from, to: line.to, insert: newText },
      selection: EditorSelection.cursor(line.from + newText.length)
    }));
    return true;
  }

  // ADD new unordered list
  const bullet = bulletForIndent(indent);
  const newText = " ".repeat(indent) + bullet + " " + line.text.trim();

  dispatch(state.update({
    changes: { from: line.from, to: line.to, insert: newText },
    selection: EditorSelection.cursor(line.from + newText.length)
  }));

  return true;
}

export function insertOrderedList(view) {
  const { state, dispatch } = view;
  const sel = state.selection.main;

  const line = state.doc.lineAt(sel.from);
  const parsed = parseListLine(line.text);
  const indent = line.text.match(/^\s*/)[0].length;

  // TOGGLE OFF
  if (parsed && parsed.type === "ordered") {
    const newText = " ".repeat(parsed.indent) + parsed.content;
    dispatch(state.update({
      changes: { from: line.from, to: line.to, insert: newText },
      selection: EditorSelection.cursor(line.from + newText.length)
    }));
    return true;
  }

  // SWITCH unordered → ordered
  if (parsed && parsed.type === "unordered") {
    const marker = orderedMarkerForIndent(parsed.indent, 1);
    const newText = " ".repeat(parsed.indent) + marker + " " + parsed.content;
    dispatch(state.update({
      changes: { from: line.from, to: line.to, insert: newText },
      selection: EditorSelection.cursor(line.from + newText.length)
    }));
    return true;
  }

  // ADD new ordered list
  const marker = orderedMarkerForIndent(indent, 1);
  const newText = " ".repeat(indent) + marker + " " + line.text.trim();

  dispatch(state.update({
    changes: { from: line.from, to: line.to, insert: newText },
    selection: EditorSelection.cursor(line.from + newText.length)
  }));

  return true;
}
