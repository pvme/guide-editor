import { EditorView } from "@codemirror/view";

export const draculaTheme = EditorView.theme(
  {
    "&": {
      color: "#f8f8f2",
      backgroundColor: "#282a36",
    },

    ".cm-content": {
      caretColor: "#f8f8f2",
    },

    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#f8f8f2",
    },

    /* Selection overlay */
    ".cm-selectionLayer": {
      zIndex: 2,
    },

    /* Selected text */
    ".cm-selectionBackground": {
      backgroundColor: "#44475a",
    },

    /* Highlighted matches when selecting text */
    ".cm-selectionMatch": {
      backgroundColor: "rgba(189,147,249,0.18)",
      borderRadius: "3px",
    },

    /* Primary cursor */
    ".cm-cursor": {
      borderLeftColor: "#f8f8f2",
    },

    /* Secondary cursors (multi-select) */
    ".cm-cursor-secondary": {
      borderLeftColor: "#bd93f9",
    },

    /* Native selection fallback */
    ".cm-content ::selection": {
      backgroundColor: "#44475a",
      color: "#f8f8f2",
    },

    /* Active line */
    ".cm-activeLine": {
      backgroundColor: "rgba(255,255,255,0.04)",
    },

    ".cm-gutters": {
      backgroundColor: "#282a36",
      color: "#6272a4",
      border: "none",
    },
  },
  { dark: true },
);
