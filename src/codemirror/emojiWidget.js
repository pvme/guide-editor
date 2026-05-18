// src/codemirror/emojiWidget.js

export function emojiWidget(completion) {
  const value = (completion?.applyText ?? completion?.text)?.trim();
  if (typeof value !== "string" && !completion?.emojiId) return null;

  const wrap = document.createElement("div");
  wrap.className = "cm-emoji-option";

  const id = completion?.emojiId || getEmojiId(value);

  if (id) {
    const img = document.createElement("img");
    img.src = `https://cdn.discordapp.com/emojis/${id}.webp?size=32&quality=lossless`;
    img.width = 20;
    img.height = 20;
    wrap.appendChild(img);
  }

  return wrap;
}

function getEmojiId(value) {
  const matches = [...String(value || "").matchAll(/:(\d+)>/g)];
  return matches.length ? matches[matches.length - 1][1] : null;
}
