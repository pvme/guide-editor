import { parseGuide } from '@pvme/guide-parser';

// Share one document between preview, diagnostics and editor tools for each edit.
let previousSource;
let previousDocument;
export function parseEditorGuide(source = '') {
  if (source !== previousSource) {
    previousSource = source;
    previousDocument = parseGuide(source);
  }
  return previousDocument;
}

export function getTocEntries(document) {
  const sections = new Map(document.sections.map(section => [section.id, section]));
  return Object.values(document.tags)
    .sort((a, b) => a.range.start.offset - b.range.start.offset)
    .map(anchor => ({ ...anchor, section: sections.get(anchor.sectionId) ?? null }));
}

export function parserIssues(document) {
  return document.diagnostics.map(diagnostic => ({
    source: 'parser', code: diagnostic.code, type: diagnostic.severity,
    text: diagnostic.message, range: diagnostic.range,
    line: [diagnostic.range.start.line, diagnostic.range.end.line - (diagnostic.range.end.column === 1 && diagnostic.range.end.line > diagnostic.range.start.line ? 1 : 0)],
    column: [diagnostic.range.start.column, diagnostic.range.end.column]
  }));
}

// Completion previews may contain several emojis (for example a rotation
// shorthand). Identify them with the shared inline grammar as well.
export function getEmojiId(value) {
  let id = null;
  function visit(nodes) {
    for (const node of nodes || []) {
      if (node.type === 'emoji' && node.id) id = node.id;
      if (node.children) visit(node.children);
      if (node.items) node.items.forEach(item => visit(item.children));
    }
  }
  parseGuide(String(value || ''), { validateReferences: false }).messages.forEach(message => visit(message.blocks));
  return id;
}
