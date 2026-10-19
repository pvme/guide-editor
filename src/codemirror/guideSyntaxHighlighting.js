import { StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import { parser as jsonParser } from '@lezer/json';
import { parseEditorGuide } from '../parser/guideParser.js';
import { editorSettingsFacet } from './editorSettings.js';

// Guide syntax comes from the same AST used by preview/validation. JSON gets
// its own error-tolerant lexer only inside AST-identified JSON regions.
export function getGuideHighlightTokens(document) {
  const { source } = document;
  const tokens = [], seen = new Set();
  function add(from, to, kind) {
    if (from >= to) return;
    const key = `${from}:${to}:${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    tokens.push({ from, to, kind });
  }
  const mark = (node, kind) => add(node.range.start.offset, node.range.end.offset, kind);
  function json(from, to) {
    jsonParser.parse(source.slice(from, to)).iterate({ enter(node) {
      if (node.name === 'PropertyName') add(from + node.from, from + node.to, 'json-key');
    } });
  }
  function prefix(node) {
    const first = node.children?.[0];
    if (!first) return;
    const from = node.range.start.offset;
    const text = source.slice(from, first.range.start.offset).trimEnd();
    add(from, from + text.length, 'markup');
  }
  function inline(nodes = []) {
    for (const node of nodes) {
      if (['bold', 'italic', 'underline', 'strikethrough', 'spoiler'].includes(node.type)) {
        add(node.range.start.offset, node.children[0]?.range.start.offset ?? node.range.end.offset, 'markup');
        add(node.children.at(-1)?.range.end.offset ?? node.range.end.offset, node.range.end.offset, 'markup');
      }
      if (node.type === 'inline-code') {
        const width = node.raw.match(/^`+/)?.[0].length ?? 0;
        add(node.range.start.offset, node.range.start.offset + width, 'markup');
        add(node.range.end.offset - width, node.range.end.offset, 'markup');
      }
      if (['link', 'image'].includes(node.type) && /^!?\[/.test(node.raw)) {
        prefix(node);
        const end = node.children.at(-1)?.range.end.offset;
        if (end !== undefined && source.slice(end, end + 2) === '](') add(end, end + 2, 'markup');
        add(node.range.end.offset - 1, node.range.end.offset, 'markup');
      }
      if (node.type === 'text') {
        for (const match of node.raw.matchAll(/[→+]/g)) {
          add(node.range.start.offset + match.index, node.range.start.offset + match.index + 1, 'operator');
        }
      }
      if (node.children) inline(node.children);
    }
  }
  function blocks(nodes) {
    for (const node of nodes) {
      if (['heading', 'blockquote', 'subtext'].includes(node.type)) prefix(node);
      if (node.type === 'codeblock') {
        const opening = node.range.start.offset + node.raw.indexOf(node.fence);
        add(opening, opening + node.fence.length, 'markup');
        if (node.closed) {
          const closing = node.range.start.offset + node.raw.lastIndexOf(node.fence);
          add(closing, closing + node.fence.length, 'markup');
        }
        // Root JSON fences have contiguous source. Nested quote/list fences
        // stay plain because their values strip prefixes.
        if (node.language?.toLowerCase() === 'json' && node.range.start.column === 1) {
          const from = source.indexOf('\n', node.range.start.offset) + 1;
          const to = node.closed ? source.lastIndexOf(node.fence, node.range.end.offset - node.fence.length) : node.range.end.offset;
          if (from > node.range.start.offset && to >= from) json(from, to);
        }
        continue;
      }
      if (node.type === 'embed') {
        json(node.range.start.offset, embedMarkers.get(node.range.end.offset) ?? node.range.end.offset);
        continue;
      }
      if (node.type === 'list') {
        for (const item of node.items) {
          const from = item.range.start.offset + item.raw.indexOf(item.marker);
          add(from, from + item.marker.length, 'bullet');
          blocks(item.children);
        }
      } else if (node.type === 'blockquote') blocks(node.children);
      else inline(node.children);
    }
  }

  const embedMarkers = new Map(document.commands.filter(command => command.name === 'embed')
    .map(command => [command.range.end.offset, command.range.start.offset]));
  for (const message of document.messages) blocks(message.blocks);
  for (const command of document.commands) mark(command, 'command');
  for (const separator of document.separators) add(separator.start.offset, separator.end.offset, 'command');
  for (const reference of document.references) mark(reference, 'reference');
  return tokens.sort((a, b) => a.from - b.from || b.to - a.to);
}

function decorations(doc) {
  return Decoration.set(getGuideHighlightTokens(parseEditorGuide(doc.toString()))
    .map(token => Decoration.mark({ class: `cm-pvme-${token.kind}` }).range(token.from, token.to)), true);
}

export const guideHighlightField = StateField.define({
  create(state) {
    return state.facet(editorSettingsFacet).syntaxHighlighting ? decorations(state.doc) : Decoration.none;
  },
  update(value, transaction) {
    const enabled = transaction.state.facet(editorSettingsFacet).syntaxHighlighting;
    if (!enabled) return Decoration.none;
    const wasEnabled = transaction.startState.facet(editorSettingsFacet).syntaxHighlighting;
    return transaction.docChanged || !wasEnabled ? decorations(transaction.newDoc) : value;
  },
  provide: field => EditorView.decorations.from(field)
});

const guideHighlightTheme = EditorView.theme({
  // One accent only. Body text, emoji codes, JSON values and code examples
  // inherit the editor's ordinary white foreground.
  '.cm-pvme-command, .cm-pvme-reference, .cm-pvme-json-key, .cm-pvme-markup, .cm-pvme-bullet, .cm-pvme-operator': { color: '#82b1ff' }
});

export const guideSyntaxHighlighting = [guideHighlightField, guideHighlightTheme];
