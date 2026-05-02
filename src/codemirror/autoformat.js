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
const PRESET_MAKER_URL = /(https:\/\/pvme\.io\/preset-maker\/#\/([^\s)\]>]+))(?:([)\]>\s]))?$/;
const PRESET_MAKER_URL_GLOBAL = /https:\/\/pvme\.io\/preset-maker\/#\/([^\s)\]>]+)/g;

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

function tryPresetMakerUrl(doc, pos, typed) {
  const start = Math.max(0, pos - 180);
  const slice = doc.sliceString(start, pos);
  const match = slice.match(PRESET_MAKER_URL);

  if (!match) return null;

  const typedDelimiter = /^[)\]>\s]$/.test(typed);
  const pastedUrl = typed.length > 1;
  const delimiter = match[3] || "";

  if (!pastedUrl && !typedDelimiter) return null;

  const replacement = `https://presets.pvme.io/?id=${match[2]}${delimiter}`;
  const from = pos - match[0].length;
  const to = pos;

  return { from, to, insert: replacement };
}

function replacePresetMakerUrls(text) {
  return text.replace(
    PRESET_MAKER_URL_GLOBAL,
    (_, id) => `https://presets.pvme.io/?id=${id}`
  );
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
    const { fromA, toA, insert: typed } = changes[0];

    const newDoc = tr.newDoc;
    const cursor = tr.newSelection.main.head;

    log("newDoc:", `"${newDoc.toString()}"`);
    log("cursor:", cursor);

    if (typed.length > 1) {
      const replacement = replacePresetMakerUrls(typed);

      if (replacement !== typed) {
        return tr.startState.update({
          changes: {
            from: fromA,
            to: toA,
            insert: replacement
          },
          selection: EditorSelection.cursor(fromA + replacement.length),
          annotations: tr.annotations
        });
      }
    }

    // try matching on newDoc
    const match =
      tryPresetMakerUrl(newDoc, cursor, typed) ||
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
