// src/codemirror/autoformat.js

import {
  EditorState,
  EditorSelection
} from "@codemirror/state";

import {
  channelsFormat,
  usersFormat,
  rolesFormat,
  emojisFormat
} from "../pvmeSettings";

const DEBUG = false;
const log = (...args) => DEBUG && console.log("[AUTOFORMAT]", ...args);

const ARROW   = /->$/;
const USER    = /;@([^;]+);/;
const ROLE    = /;@&([^;]+);/;
const CHANNEL = /;#([^;]+);/;
const TOKEN   = /;([a-zA-Z0-9_-]+);$/;

const special = {
  b1: "⬥ ",
  b2: "    • ",
  b3: "        ⬩ ",
  u1: "⬥ ",
  u2: "    • ",
  u3: "        ⬩ ",
  nl: "\n",
  newline: "\n",
  empty: "\u200B",
  space: "\u00A0"
};

function trySuffix(doc, pos, regex, make) {
  // Look backwards up to 50 chars (safe & fast)
  const start = Math.max(0, pos - 50);
  const slice = doc.sliceString(start, pos);

  // Force regex to match at the END of the slice
  const m = slice.match(regex);
  if (!m) return null;

  const replacement = make(m);
  if (!replacement) return null;

  const from = pos - m[0].length;
  const to = pos;

  return { from, to, insert: replacement };
}

export function autoformatOnUpdate() {
  return EditorState.transactionFilter.of(tr => {
    log("──── TRANSACTION START ────");

    if (!tr.docChanged) return tr;

    // collect the insertion
    const changes = [];
    tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      changes.push({
        fromA, toA, fromB, toB,
        insert: inserted.toString()
      });
    });
    log("changeIter:", changes);

    if (changes.length !== 1) return tr;
    const typed = changes[0].insert;

    const newDoc = tr.newDoc;
    const cursor = tr.newSelection.main.head;

    log("newDoc:", `"${newDoc.toString()}"`);
    log("cursor:", cursor);

    // try matching on newDoc
    const match =
      trySuffix(newDoc, cursor, ARROW, () => "→") ||
      trySuffix(newDoc, cursor, USER,  m => `<@${usersFormat[m[1].toLowerCase()]}>`) ||
      trySuffix(newDoc, cursor, ROLE,  m => `<@&${rolesFormat[m[1].toLowerCase()]}>`) ||
      trySuffix(newDoc, cursor, CHANNEL, m => `<#${channelsFormat[m[1].toLowerCase()]}>`) ||
      trySuffix(newDoc, cursor, TOKEN, m => emojisFormat[m[1].toLowerCase()] || special[m[1].toLowerCase()])

    if (!match) {
      log("no match → passthrough");
      return tr;
    }

    log("MATCH:", match);

    const { fromB, insert } = changes[0];
    const insertedLen = insert.length;

    // map newDoc → startState positions
    const mapPos = (pos) => {
      if (pos <= fromB) return pos;
      return pos - insertedLen;
    };

    const startFrom = mapPos(match.from);
    const startTo   = mapPos(match.to);

    log("Mapped to startState:", { startFrom, startTo });

    const replacement = match.insert;

    const updated = tr.startState.update({
      changes: {
        from: startFrom,
        to: startTo,
        insert: replacement
      },
      selection: EditorSelection.cursor(startFrom + replacement.length),
      annotations: tr.annotations
    });

    log("RETURN UPDATED TX:", updated);
    return updated;
  });
}
