// src/codemirror/emojiWidget.js

export function emojiWidget(completion) {
  const value = completion?.applyText ?? completion?.text;
  if (typeof value !== "string") return null;

  const wrap = document.createElement("div");
  wrap.className = "cm-emoji-option";

  const match = value.match(/:(\d+)>$/);
  const id = match ? match[1] : null;

  if (id) {
    const img = document.createElement("img");
    img.src = `https://cdn.discordapp.com/emojis/${id}.webp?size=32&quality=lossless`;
    img.width = 20;
    img.height = 20;
    wrap.appendChild(img);
  }

  return wrap;
}
