import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";

const flashRow = StateEffect.define();
const flashDuration = 1600;

const flashField = StateField.define({
  create: () => ({ decorations: Decoration.none, alternate: false }),
  update(value, transaction) {
    if (transaction.docChanged) {
      value = { ...value, decorations: Decoration.none };
    }
    for (const effect of transaction.effects) {
      if (!effect.is(flashRow)) continue;
      const alternate = !value.alternate;
      const rows = [];
      if (effect.value !== null) {
        const decoration = Decoration.line({
          class: `cm-preview-row-flash cm-preview-row-flash-${alternate ? "a" : "b"}`
        });
        for (let line = effect.value.firstLine; line <= effect.value.lastLine; line++) {
          rows.push(decoration.range(transaction.state.doc.line(line).from));
        }
      }
      value = {
        alternate,
        decorations: Decoration.set(rows)
      };
    }
    return value;
  },
  provide: field => EditorView.decorations.from(field, value => value.decorations)
});

const fade = {
  "0%, 35%": { backgroundColor: "rgba(189, 147, 249, 0.38)", boxShadow: "inset 4px 0 #bd93f9" },
  "100%": { backgroundColor: "transparent", boxShadow: "inset 4px 0 transparent" }
};

export const editorRowFlash = [
  flashField,
  ViewPlugin.fromClass(class {
    update(update) {
      if (update.docChanged || update.transactions.some(transaction =>
        transaction.effects.some(effect => effect.is(flashRow))
      )) {
        clearTimeout(this.timer);
        if (update.state.field(flashField).decorations.size) {
          this.timer = setTimeout(() => {
            update.view.dispatch({ effects: flashRow.of(null) });
          }, flashDuration);
        }
      }
    }
    destroy() {
      clearTimeout(this.timer);
    }
  }),
  EditorView.baseTheme({
    ".cm-line.cm-preview-row-flash": {
      animationDuration: `${flashDuration}ms`,
      animationTimingFunction: "ease-out"
    },
    // Alternate names so a second jump to the same row restarts the animation.
    ".cm-preview-row-flash-a": { animationName: "cm-preview-row-flash-a" },
    ".cm-preview-row-flash-b": { animationName: "cm-preview-row-flash-b" },
    "@keyframes cm-preview-row-flash-a": fade,
    "@keyframes cm-preview-row-flash-b": fade,
    "@media (prefers-reduced-motion: reduce)": {
      ".cm-line.cm-preview-row-flash": {
        animation: "none",
        backgroundColor: "rgba(189, 147, 249, 0.38)",
        boxShadow: "inset 4px 0 #bd93f9"
      }
    }
  })
];

export function flashEditorRows(view, firstLine, lastLine = firstLine) {
  const lineCount = view.state.doc.lines;
  const start = Math.min(lineCount, Math.max(1, firstLine));
  const end = Math.min(lineCount, Math.max(start, lastLine));
  view.dispatch({ effects: flashRow.of({ firstLine: start, lastLine: end }) });
}
