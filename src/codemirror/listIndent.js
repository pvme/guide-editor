// src/codemirror/listIndent.js
import { keymap } from "@codemirror/view";
import { parseGuide } from '@pvme/guide-parser';

/* -------------------------------------------------------------
   Bullet rules for unordered lists
-------------------------------------------------------------- */
export function bulletForIndent(indent) {
    if (indent < 4) return "⬥"; // Level 1
    if (indent < 8) return "•"; // Level 2
    return "⬩";                // Level 3
}

/* -------------------------------------------------------------
   Marker rules for ordered lists
-------------------------------------------------------------- */
export function orderedMarkerForIndent(indent, index = 1) {
    if (indent < 4) {
        // Level 1 → numbers
        return `${index}.`;
    }
    if (indent < 8) {
        // Level 2 → letters
        const letter = String.fromCharCode(96 + index); // a, b, c
        return `${letter}.`;
    }
    // Level 3 → same as unordered level 3
    return "⬩";
}

/* -------------------------------------------------------------
   Parse line (detects BOTH list types)
-------------------------------------------------------------- */
export function parseListLine(text) {
    const list = parseGuide(text, { validateReferences: false }).messages[0]?.blocks[0];
    if (list?.type !== 'list') return null;
    const item = list.items[0];
    // Marker choices and indentation remain editor policy, not parser syntax.
    if (!list.ordered && !['⬥', '•', '⬩'].includes(item.marker)) return null;
    if (list.ordered && !item.marker.endsWith('.')) return null;
    const indexPart = item.marker.slice(0, -1);
    return {
        type: list.ordered ? 'ordered' : 'unordered',
        indent: item.indent,
        marker: item.marker,
        content: text.slice(item.children[0]?.range.start.offset ?? text.length),
        ...(list.ordered ? { index: list.style === 'number' ? Number(indexPart) : indexPart.toLowerCase().charCodeAt(0) - 96 } : {})
    };
}

/* -------------------------------------------------------------
   UPDATE LINE
-------------------------------------------------------------- */
function updateLine(state, dispatch, line, newText) {
    dispatch(
        state.update({
            changes: { from: line.from, to: line.to, insert: newText },
            selection: { anchor: line.from + newText.length }
        })
    );
}

/* -------------------------------------------------------------
   ENTER — Continue list
-------------------------------------------------------------- */
export function continueMarkdownList({ state, dispatch }) {
    const sel = state.selection.main;
    if (!sel.empty) return false;

    const line = state.doc.lineAt(sel.from);
    const parsed = parseListLine(line.text);
    if (!parsed) return false;

    const { type, indent, marker, content, index } = parsed;

    // Empty → remove list
    if (content.trim() === "") {
        const newText = " ".repeat(indent);
        updateLine(state, dispatch, line, newText);
        return true;
    }

    let nextMarker;

    if (type === "unordered") {
        nextMarker = marker;
    } else {
        nextMarker = orderedMarkerForIndent(indent, index + 1);
    }

    const insert =
        "\n" + " ".repeat(indent) + nextMarker + " ";

    dispatch(
        state.update({
            changes: { from: sel.from, to: sel.to, insert },
            selection: { anchor: sel.from + insert.length }
        })
    );

    return true;
}

/* -------------------------------------------------------------
   TAB — Indent list
-------------------------------------------------------------- */
export function indentMarkdownList({ state, dispatch }) {
    const sel = state.selection.main;
    if (!sel.empty) return false;

    const line = state.doc.lineAt(sel.from);
    const parsed = parseListLine(line.text);
    if (!parsed) return false;

    const { type, indent, content, index } = parsed;

    const newIndent = indent + 4;
    let newMarker;

    if (type === "unordered") {
        newMarker = bulletForIndent(newIndent);
    } else {
        newMarker = orderedMarkerForIndent(newIndent, index);
    }

    const newText =
        " ".repeat(newIndent) + newMarker + " " + content;

    updateLine(state, dispatch, line, newText);
    return true;
}

/* -------------------------------------------------------------
   SHIFT+TAB — Unindent list
-------------------------------------------------------------- */
export function unindentMarkdownList({ state, dispatch }) {
    const sel = state.selection.main;
    if (!sel.empty) return false;

    const line = state.doc.lineAt(sel.from);
    const parsed = parseListLine(line.text);
    if (!parsed) return false;

    const { type, indent, content, index } = parsed;

    if (indent < 4) return false;

    const newIndent = indent - 4;
    let newMarker;

    if (type === "unordered") {
        newMarker = bulletForIndent(newIndent);
    } else {
        newMarker = orderedMarkerForIndent(newIndent, index);
    }

    const newText =
        " ".repeat(newIndent) + newMarker + " " + content;

    updateLine(state, dispatch, line, newText);
    return true;
}

/* -------------------------------------------------------------
   KEYMAP
-------------------------------------------------------------- */
export const listKeymap = keymap.of([
    { key: "Enter", run: continueMarkdownList },
    { key: "Tab", run: indentMarkdownList },
    { key: "Shift-Tab", run: unindentMarkdownList }
]);
