const displayedKeys = new Set(['content', 'title', 'description', 'name', 'value', 'text']);

export function* embedTextFields(embed, source) {
  const raw = source.slice(embed.range.start.offset, embed.range.end.offset);
  const pairs = /("(?:\\.|[^"\\])*")\s*:\s*("(?:\\.|[^"\\])*")/gd;
  for (const match of raw.matchAll(pairs)) {
    if (!displayedKeys.has(JSON.parse(match[1]))) continue;
    const token = match[2];
    const value = JSON.parse(token);
    const start = embed.range.start.offset + match.indices[2][0] + 1;
    const offsets = [];
    for (let index = 1; index < token.length - 1;) {
      offsets.push(start + index - 1);
      index += token[index] === '\\' ? (token[index + 1] === 'u' ? 6 : 2) : 1;
    }
    offsets.push(start + token.length - 2);
    yield { value, offsets };
  }
}
