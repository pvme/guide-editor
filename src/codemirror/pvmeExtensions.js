// src/codemirror/pvmeExtensions.js

import { Facet, EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from "@codemirror/view";
import {
  highlightSelectionMatches,
  selectSelectionMatches,
  selectNextOccurrence,
} from "@codemirror/search";
import { markdown } from "@codemirror/lang-markdown";
import {
  history,
  defaultKeymap,
  historyKeymap,
  redo,
} from "@codemirror/commands";
import { closeBrackets, autocompletion } from "@codemirror/autocomplete";
import { bracketMatching } from "@codemirror/language";

import {
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrikethrough,
  toggleH1,
  toggleH2,
  toggleH3,
  insertUnorderedList,
  insertOrderedList,
  formatInlineCode,
  formatCodeBlock,
  formatBlockquote,
} from "./commands.js";

import { autocompletionSource } from "./autocomplete.js";
import { emojiWidget } from "./emojiWidget.js";
import { draculaTheme } from "./draculaTheme";
import { listKeymap } from "./listIndent.js";
import { autoformatOnUpdate } from "./autoformat.js";

import { messageSyncExtension } from "./messageSync.js";

function selectNextOccurrenceSafe(view) {
  const handled = selectNextOccurrence(view);
  return true; // always swallow ctrl+D
}

// Create a facet that stores the sync engine instance
export const SyncEngineFacet = Facet.define();

export const commandDispatch = Facet.define();

export function pvmeExtensions(textStore, syncApi) {
  const sync = messageSyncExtension(syncApi);

  return [
    SyncEngineFacet.of(sync),

    EditorState.allowMultipleSelections.of(true),
    drawSelection(),

    listKeymap,

    keymap.of([
      { key: "Ctrl-d", run: selectNextOccurrenceSafe },
      { key: "Ctrl-Shift-d", run: selectSelectionMatches },
      { key: "Ctrl-y", run: redo },

      { key: "Ctrl-b", run: toggleBold },
      { key: "Ctrl-i", run: toggleItalic },
      { key: "Ctrl-u", run: toggleUnderline },
      { key: "Ctrl-Alt-s", run: toggleStrikethrough },
      { key: "Ctrl-Alt-1", run: toggleH1 },
      { key: "Ctrl-Alt-2", run: toggleH2 },
      { key: "Ctrl-Alt-3", run: toggleH3 },

      ...defaultKeymap,
      ...historyKeymap,
    ]),

    history(),
    lineNumbers(),
    markdown(),
    EditorView.lineWrapping,
    highlightActiveLine(),
    highlightSelectionMatches({ minSelectionLength: 3 }),

    // cursor → preview sync
    EditorView.updateListener.of((update) => {
      if (update.selectionSet) sync.handleEditorCursor(update.view);
    }),

    closeBrackets(),
    bracketMatching(),

    autocompletion({
      override: [autocompletionSource],
      icons: false,
      defaultKeymap: true,
      optionClass: () => "cm-completionItem",
      useCustomRender: true,
      addToOptions: [
        {
          position: 20,
          render(comp) {
            if (comp.type !== "emoji") return null;
            return emojiWidget(comp);
          },
        },
      ],
    }),

    autoformatOnUpdate(),

    draculaTheme,

    // Toolbar commands
    commandDispatch.of({
      bold: toggleBold,
      italic: toggleItalic,
      underline: toggleUnderline,
      strikethrough: toggleStrikethrough,
      h1: toggleH1,
      h2: toggleH2,
      h3: toggleH3,
      unorderedList: insertUnorderedList,
      orderedList: insertOrderedList,
      blockquote: formatBlockquote,
      inlineCode: formatInlineCode,
      codeBlock: formatCodeBlock,

      wikiLink: (view) => {
        const { state } = view;
        const sel = state.selection.main;

        const selected = state.doc.sliceString(sel.from, sel.to);
        const text = selected || "item_name";

        const formatted = encodeURIComponent(text.trim().replace(/\s+/g, "_"));

        const url = `https://runescape.wiki/w/${formatted}`;
        const markdown = `[${text}](<${url}>)`;

        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: markdown },
          selection: selected
            ? { anchor: sel.from + markdown.length }
            : {
                anchor: sel.from + 1,
                head: sel.from + text.length + 1,
              },
        });

        return true;
      },
    }),

    // Sync doc → Svelte store
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const newDoc = update.state.doc.toString();
      textStore.update((t) => (t === newDoc ? t : newDoc));
    }),
  ];
}
