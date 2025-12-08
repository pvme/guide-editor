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

  ".cm-content .cm-line .cm-selectionBackground": {
    background: "linear-gradient(90deg, #00cafe 0%, #b44dff 40%, #ff49e1 100%)",
    opacity: "0.45"
  },

  ".cm-content .cm-line ::selection": {
    background: "linear-gradient(90deg, #00cafe 0%, #b44dff 40%, #ff49e1 100%)",
    color: "#ffffff"
  },

  ".cm-content .cm-line .cm-selectionMatch": {
    background: "rgba(99, 102, 241, 0.1)",
    borderRadius: "4px",
    boxShadow: "0 0 0 1px rgba(99, 102, 241, 0.35)"
  },

  ".cm-content .cm-activeLine": {
    backgroundColor: "rgba(255,255,255,0.05)"
  },

  ".cm-gutters": {
    backgroundColor: "#282a36",
    color: "#6272a4",
    border: "none"
  }
}, { dark: true });
