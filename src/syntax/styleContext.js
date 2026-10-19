// Source indexing and traversal only; Markdown/PVME grammar belongs to the parser.
export function walkBlocks(blocks, visit, context = {}) {
  for (const block of blocks) {
    visit(block, context);
    if (block.type === 'blockquote') walkBlocks(block.children, visit, { ...context, quoted: true });
    if (block.type === 'list') for (const item of block.items) walkBlocks(item.children, visit, { ...context, item });
  }
}

export function visitInline(nodes, visit, insideLink = false) {
  for (const node of nodes || []) {
    visit(node, insideLink);
    if (node.children) visitInline(node.children, visit, insideLink || node.type === 'link');
  }
}

export function inlineText(nodes = []) {
  return nodes.map(node => node.children ? inlineText(node.children) : node.value ?? node.raw).join('');
}

export function createStyleContext(document, source) {
  const lines = [];
  let start = 0;
  for (const raw of source.split('\n')) {
    lines.push({ start, text: raw.endsWith('\r') ? raw.slice(0, -1) : raw });
    start += raw.length + 1;
  }
  function position(offset) {
    let low = 0, high = lines.length;
    while (low + 1 < high) {
      const middle = (low + high) >>> 1;
      if (lines[middle].start <= offset) low = middle;
      else high = middle;
    }
    return { line: low + 1, column: offset - lines[low].start + 1, offset };
  }
  const range = (from, to) => ({ start: position(from), end: position(to) });
  const results = [], seen = new Set();
  function add(code, location, text, type = 'warn') {
    const key = `${code}:${location.start.offset}:${location.end.offset}:${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ source: 'style', code, type, text, range: location,
      line: [location.start.line, location.end.line - (location.end.column === 1 && location.end.line > location.start.line ? 1 : 0)],
      column: [location.start.column, location.end.column] });
  }
  // A non-whitespace sentinel prevents masked code from becoming a whitespace
  // warning. Preserve UTF-16 offsets (including astral emojis) and line endings.
  const masked = source.split('');
  const mask = location => {
    for (let i = location.start.offset; i < location.end.offset; i++) {
      if (!['\r', '\n'].includes(masked[i])) masked[i] = '\uFFFC';
    }
  };
  const proseLines = new Set(), excludedLines = new Set(), quoteStarts = new Map();
  const quoteStart = location => quoteStarts.set(location.start.line,
    Math.min(quoteStarts.get(location.start.line) ?? Infinity, location.start.offset));
  for (const message of document.messages) walkBlocks(message.blocks, (block, context) => {
    if (['paragraph', 'heading', 'subtext', 'blank'].includes(block.type)) {
      for (let line = block.range.start.line; line <= block.range.end.line; line++) proseLines.add(line);
    }
    if (['codeblock', 'embed', 'command', 'unknown-command', 'attachment'].includes(block.type)) {
      mask(block.range);
      for (let line = block.range.start.line; line <= block.range.end.line; line++) excludedLines.add(line);
    }
    if (['paragraph', 'heading', 'subtext'].includes(block.type)) visitInline(block.children, node => {
      if (context.quoted) quoteStart(node.range);
      if (['inline-code', 'link', 'image', 'mention', 'timestamp', 'reference'].includes(node.type)) mask(node.range);
    });
    if (context.quoted && ['paragraph', 'heading', 'subtext'].includes(block.type)) quoteStart(block.range);
  });
  // Quote/list prefixes are layout, not doubled spaces in prose. Inline/block
  // AST positions identify them without scanning another Markdown grammar.
  for (const [line, offset] of quoteStarts) {
    for (let i = lines[line - 1].start; i < offset; i++) masked[i] = ' ';
  }
  for (const line of excludedLines) proseLines.delete(line);
  return { lines, range, add, results, proseLines, masked: masked.join('') };
}
