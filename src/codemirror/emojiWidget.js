// src/codemirror/emojiWidget.js

export function emojiWidget(completion) {
  const wrap = document.createElement("div");
  wrap.className = "cm-emoji-option";

  const match = completion.applyText.match(/\d+/);
  const id = match ? match[0] : null;

  if (id) {
    const img = document.createElement("img");
    img.src = `https://cdn.discordapp.com/emojis/${id}.webp?size=32&quality=lossless`;
    img.width = 20;
    img.height = 20;
    wrap.appendChild(img);
  }

  return wrap;
}
