// src/codemirror/pvmeAutocomplete.js

import { usersFormat, channelsFormat, emojisFormat, emojiSearch, channels } from "../pvmeSettings";
import { editorSettingsFacet } from "./editorSettings.js";

const DEBUG = false;
const log = (...args) => DEBUG && console.log("[AUTOFORMAT]", ...args);
const ROTATION_EMOJI_MODIFIER = /[rs_]/;

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
          emojiId: getEmojiId(emojisFormat[emojiName]),
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

  const settings = context.state.facet(editorSettingsFacet);
  const rotationMatch = settings.rotationBuilderMode
    ? getRotationBuilderCompletionMatch(line, pos)
    : null;
  if (rotationMatch) {
    const exactKey = rotationMatch.word.toLowerCase();
    const activeMatch = emojisFormat[exactKey]
      ? {
          ...rotationMatch,
          query: exactKey,
          queryFrom: rotationMatch.wordFrom,
          before: "",
          after: ""
        }
      : rotationMatch;
    const { query, queryFrom, wordFrom, before, after } = activeMatch;
    const raw = getEmojiCompletions(context.state, doc, pos, query);

    if (raw.length === 0) return null;

    return {
      from: queryFrom,
      to: pos,
      options: raw.map(item => ({
        label: item.label,
        type: "emoji",
        emojiId: item.emojiId,
        text: `${before}${item.insertText}${after}`,
        detail: "",
        info: "",
        applyText: item.insertText,

        apply(view, completion, from, toPos) {
          const insert = `${before}${withEmojiTrailingInsert(view.state, item.format, view.state.doc, toPos)}${after}`;

          view.dispatch({
            changes: {
              from: wordFrom,
              to: toPos,
              insert
            }
          });
        }
      })),
      filter: false
    };
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
    raw = getEmojiCompletions(context.state, doc, pos, query);
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
      emojiId: item.emojiId,
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

function getEmojiCompletions(state, doc, pos, query) {
  return emojiSearch
    .filter(e =>
      e.id.includes(query) ||
      e.search.some(term => term.includes(query))
    )
    .sort((a, b) => {
      const aExactId = Number(a.id === query);
      const bExactId = Number(b.id === query);
      if (aExactId !== bExactId) return bExactId - aExactId;

      const aStartsWith = Number(a.id.startsWith(query));
      const bStartsWith = Number(b.id.startsWith(query));
      return bStartsWith - aStartsWith;
    })
    .slice(0, 25)
    .map(e => ({
      label: e.id,
      insertText: withEmojiTrailingInsert(state, e.format, doc, pos),
      format: e.format,
      emojiId: e.emojiId,
      type: "emoji"
    }));
}

function isInsideSquareBrackets(lineText, index) {
  const before = lineText.slice(0, index);
  return before.lastIndexOf("[") > before.lastIndexOf("]");
}

function getRotationBuilderCompletionMatch(line, pos) {
  const cursorInLine = pos - line.from;
  const text = line.text.slice(0, cursorInLine);
  const match = text.match(/([a-zA-Z0-9_-]+)$/);
  if (!match) return null;

  const word = match[1];
  const wordFrom = pos - word.length;
  const wordStartInLine = wordFrom - line.from;
  if (isInsideSquareBrackets(line.text, wordStartInLine)) return null;

  const modifierMatch = getRotationBuilderModifierMatch(word);
  const query = modifierMatch?.query || word.toLowerCase();
  if (query.length < 2) return null;

  const usingModifiers = Boolean(modifierMatch);
  const start = modifierMatch?.start || 0;
  const end = modifierMatch?.end || word.length;

  return {
    word,
    query,
    wordFrom,
    queryFrom: usingModifiers ? wordFrom + start : wordFrom,
    before: usingModifiers ? word.slice(0, start) : "",
    after: usingModifiers ? word.slice(end) : ""
  };
}

function getRotationBuilderModifierMatch(word) {
  let leadingModifiers = 0;
  let trailingModifiers = 0;

  while (
    leadingModifiers < word.length &&
    ROTATION_EMOJI_MODIFIER.test(word[leadingModifiers])
  ) {
    leadingModifiers += 1;
  }

  while (
    trailingModifiers < word.length - leadingModifiers &&
    ROTATION_EMOJI_MODIFIER.test(word[word.length - trailingModifiers - 1])
  ) {
    trailingModifiers += 1;
  }

  for (let prefixLength = 1; prefixLength <= leadingModifiers; prefixLength += 1) {
    for (let suffixLength = 0; suffixLength <= trailingModifiers; suffixLength += 1) {
      const end = word.length - suffixLength;
      const query = word.slice(prefixLength, end).toLowerCase();
      if (query.length >= 2) {
        return { start: prefixLength, end, query };
      }
    }
  }

  for (let suffixLength = 1; suffixLength <= trailingModifiers; suffixLength += 1) {
    const end = word.length - suffixLength;
    const query = word.slice(0, end).toLowerCase();
    if (query.length >= 2) {
      return { start: 0, end, query };
    }
  }

  return null;
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

function getEmojiId(value) {
  const matches = [...String(value || "").matchAll(/:(\d+)>/g)];
  return matches.length ? matches[matches.length - 1][1] : null;
}
