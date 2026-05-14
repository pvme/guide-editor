// src/codemirror/pvmeAutocomplete.js

import { usersFormat, channelsFormat, emojisFormat, emojiSearch, channels } from "../pvmeSettings";
import { editorSettingsFacet } from "./editorSettings.js";

const DEBUG = false;
const log = (...args) => DEBUG && console.log("[AUTOFORMAT]", ...args);

export function autocompletionSource(context) {
  const pos = context.pos;
  const doc = context.state.doc;
  const line = doc.lineAt(pos);

  const text = line.text.slice(0, pos - line.from);

  // CLOSED EMOJI PREVIEW (:emoji: or ;emoji;)
  const closedEmoji = text.match(/([:;])([a-zA-Z0-9_-]{2,})\1$/);
  if (closedEmoji) {
    const name = closedEmoji[2].toLowerCase();
    const from = pos - (name.length + 2); // ":res:" or ";res;"
    const isDiscordEmojiFragment = closedEmoji[1] === ":" && from > line.from && doc.sliceString(from - 1, from) === "<";
    if (isDiscordEmojiFragment) return null;

    const matches = Object.keys(emojisFormat)
      .filter(e => e.toLowerCase() === name);
    if (matches.length === 1) {
      const emojiName = matches[0];
      const insertText = withEmojiTrailingInsert(context.state, emojisFormat[emojiName], doc, pos);
      const to   = pos;
      return {
        from,
        to,
        options: [{
          label: emojiName,
          type: "emoji",
          text: insertText,
          detail: "Press Enter to insert",
          apply(view) {
            view.dispatch({
              changes: { from, to, insert: insertText }
            });
          }
        }],
        filter: false
      };
    }
  }

  // MATCHES:
  // @user, ;@user
  // #chan, ;#chan
  // :emoji, ;emoji, ;:emoji
  //
  // Group 1 = optional semicolon
  // Group 2 = trigger char (@,#,:)
  // Group 3 = query (letters / numbers / underscores / hyphens)
  const m = text.match(/(;)?([@#:])([a-zA-Z0-9_-]*)$/) ||
    text.match(/(;)()([a-zA-Z0-9_-]*)$/);

  if (!m) return null;

  const semicolon = m[1];     // may be undefined
  const prefix     = m[2] || ";";    // "@", "#", ":", or bare ";"
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
  else if (prefix === ":" || prefix === ";") {
    raw = emojiSearch
      .filter(e =>
        e.id.includes(query) ||
        e.search.some(term => term.includes(query))
      )
      .sort((a, b) => {
        const aExact = a.id.startsWith(query);
        const bExact = b.id.startsWith(query);
        return bExact - aExact;
      })
      .slice(0, 25)
      .map(e => ({
        label: e.id,
        insertText: withEmojiTrailingInsert(context.state, e.format, doc, pos),
        type: "emoji"
      }));
  }

  if (raw.length === 0) return null;

  // Calculate positions -----------------------------------------
  // triggerFrom = start of query
  const triggerFrom = pos - query.length;
  const emojiColonTriggerFrom = prefix === ":" && !semicolon ? triggerFrom - 1 : null;
  if (
    emojiColonTriggerFrom !== null &&
    emojiColonTriggerFrom > line.from &&
    doc.sliceString(emojiColonTriggerFrom - 1, emojiColonTriggerFrom) === "<"
  ) {
    return null;
  }

  return {
    from: triggerFrom,
    to: pos,
    options: raw.map(item => ({
      label: item.label,
      type: item.type || undefined,
      text: item.insertText,
      detail: "",
      info: "",
      applyText: item.insertText,

      apply(view, completion, from, toPos) {
        // Remove everything from the optional semicolon + prefix up to the cursor
        //
        // If semicolon decorates @/#/:, remove 2 chars. Bare ;emoji removes 1 char.
        const prefixLen = semicolon && prefix !== ";" ? 2 : 1;
        const replaceFrom = triggerFrom - prefixLen;
        const replaceTo   = toPos;

        const insert = item.type === "emoji"
          ? withEmojiTrailingInsert(view.state, item.insertText, view.state.doc, replaceTo)
          : item.insertText;

        view.dispatch({
          changes: {
            from: replaceFrom,
            to: replaceTo,
            insert
          }
        });
      }
    })),
    filter: false
  };
}

function withEmojiTrailingInsert(state, value, doc, pos) {
  const settings = state.facet(editorSettingsFacet);
  const mode = settings.emojiTrailingInsert || (settings.autoSpaceAfterEmoji ? "space" : "none");
  if (mode === "none") return value;

  const next = pos < doc.length ? doc.sliceString(pos, pos + 1) : "";
  const hasHorizontalSpace = next && /[ \t]/.test(next);

  if (mode === "space") {
    return value.endsWith(" ") || hasHorizontalSpace ? value : `${value} `;
  }

  if (mode === "spaceArrowSpace") {
    if (value.endsWith(" → ")) return value;
    if (value.endsWith(" →") && hasHorizontalSpace) return value;
    if (value.endsWith(" ")) return `${value}→${hasHorizontalSpace ? "" : " "}`;
    return `${value} →${hasHorizontalSpace ? "" : " "}`;
  }

  return value;
}
