import { EditorView } from "@codemirror/view";

export const draculaTheme = EditorView.theme({
  "&": {
    color: "#f8f8f2",
    backgroundColor: "#282a36"
  },
  ".cm-content": {
    caretColor: "#f8f8f2"
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#f8f8f2"
  },
  ".cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "#44475a !important"
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(255,255,255,0.05)"
  },
  ".cm-gutters": {
    backgroundColor: "#282a36",
    color: "#6272a4",
    border: "none"
  }
}, { dark: true });
