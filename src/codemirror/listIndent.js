// src/codemirror/listIndent.js
import { keymap } from "@codemirror/view";

/* -------------------------------------------------------------
   LIST PATTERNS
-------------------------------------------------------------- */

// Unordered: ⬥ • ⬩
export const unorderedRE = /^(\s*)(⬥|•|⬩)\s+(.*)$/;

// Ordered:   1.  2.  a.  b.
export const orderedRE = /^(\s*)((\d+|[a-zA-Z])\.)\s+(.*)$/;

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
    let m;

    // Unordered
    m = unorderedRE.exec(text);
    if (m) {
        return {
            type: "unordered",
            indent: m[1].length,
            marker: m[2],
            content: m[3]
        };
    }

    // Ordered
    m = orderedRE.exec(text);
    if (m) {
        const raw = m[2];
        const indexPart = m[3];

        let index = 1;
        if (/^\d+$/.test(indexPart)) index = parseInt(indexPart, 10);
        else index = indexPart.toLowerCase().charCodeAt(0) - 96;

        return {
            type: "ordered",
            indent: m[1].length,
            marker: raw,
            index,
            content: m[4]
        };
    }

    return null;
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
