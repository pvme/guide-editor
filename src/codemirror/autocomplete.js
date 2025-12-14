// src/codemirror/pvmeAutocomplete.js

import { usersFormat, channelsFormat, emojisFormat, channels } from "../pvmeSettings";

const DEBUG = false;
const log = (...args) => DEBUG && console.log("[AUTOFORMAT]", ...args);

export function autocompletionSource(context) {
  const pos = context.pos;
  const doc = context.state.doc;
  const line = doc.lineAt(pos);

  const text = line.text.slice(0, pos - line.from);

  // MATCHES:
  // @user, ;@user
  // #chan, ;#chan
  // :emoji, ;:emoji
  //
  // Group 1 = optional semicolon
  // Group 2 = trigger char (@,#,:)
  // Group 3 = query (letters / numbers / underscores / hyphens)
  const m = text.match(/(;)?([@#:])([a-zA-Z0-9_-]*)$/);

  if (!m) return null;

  const semicolon = m[1];     // may be undefined
  const prefix     = m[2];    // "@", "#", or ":"
  const query      = m[3].toLowerCase();

  if (query.length < 2) return null;  // prevent autocomplete until 2+ chars typed

  let raw = [];

  // USERS -------------------------------------------------------
  if (prefix === "@") {
    raw = Object.entries(usersFormat)
      .filter(([name]) => name.toLowerCase().includes(query))
      .map(([name, id]) => ({
        label: name,
        insertText: `<@${id}>`
      }));
  }

  // CHANNELS ----------------------------------------------------
  else if (prefix === "#") {
    raw = Object.entries(channelsFormat)
      .filter(([name]) => name.toLowerCase().includes(query))
      .map(([name, id]) => ({
        label: `#${channels[id]}`,
        insertText: `<#${id}>`
      }));
  }

  // EMOJIS ------------------------------------------------------
  else if (prefix === ":") {
    raw = Object.keys(emojisFormat)
      .filter(name => name.toLowerCase().includes(query))
      .map(name => ({
        label: name,
        insertText: emojisFormat[name],
        type: "emoji"
      }));
  }

  if (raw.length === 0) return null;

  // Calculate positions -----------------------------------------
  // triggerFrom = start of query
  const triggerFrom = pos - query.length;

  return {
    from: triggerFrom,
    to: pos,
    options: raw.map(item => ({
      label: item.label,
      type: item.type || undefined,
      detail: "",
      info: "",
      applyText: item.insertText,

      apply(view, completion, from, toPos) {
        // Remove everything from the optional semicolon + prefix up to the cursor
        //
        // If semicolon exists, remove 2 chars: ";@"
        // If semicolon doesn't exist, remove 1 char: "@"
        const prefixLen = semicolon ? 2 : 1;
        const replaceFrom = triggerFrom - prefixLen;
        const replaceTo   = toPos;

        view.dispatch({
          changes: {
            from: replaceFrom,
            to: replaceTo,
            insert: item.insertText
          }
        });
      }
    })),
    filter: false
  };
}
