import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EditorState } from '@codemirror/state';
import { parseGuide } from '@pvme/guide-parser';
import { getGuideHighlightTokens, guideHighlightField } from './guideSyntaxHighlighting.js';
import { editorSettingsExtension, reconfigureEditorSettings } from './editorSettings.js';

const tokens = source => getGuideHighlightTokens(parseGuide(source));
const textOf = (source, kind) => tokens(source).filter(token => token.kind === kind).map(token => source.slice(token.from, token.to));

test('highlighting toggles live without changing source or selection and reflects edits made while disabled', () => {
  let state = EditorState.create({
    doc: '.tag:before',
    selection: { anchor: 2 },
    extensions: [editorSettingsExtension({}), guideHighlightField]
  });
  assert.equal(state.field(guideHighlightField).size, 1);
  state = state.update({ effects: reconfigureEditorSettings({ syntaxHighlighting: false }) }).state;
  assert.equal(state.field(guideHighlightField).size, 0);
  assert.equal(state.doc.toString(), '.tag:before');
  assert.equal(state.selection.main.head, 2);
  state = state.update({ changes: { from: 5, to: state.doc.length, insert: 'after\n.' } }).state;
  assert.equal(state.field(guideHighlightField).size, 0);
  state = state.update({ effects: reconfigureEditorSettings({ syntaxHighlighting: true }) }).state;
  assert.equal(state.field(guideHighlightField).size, 2);
  assert.equal(state.doc.toString(), '.tag:after\n.');
  assert.equal(state.selection.main.head, 2);
  const decorations = state.field(guideHighlightField);
  state = state.update({ effects: reconfigureEditorSettings({ syntaxHighlighting: true, rotationBuilderMode: true }) }).state;
  assert.strictEqual(state.field(guideHighlightField), decorations);
});

test('highlighting can be disabled at editor creation', () => {
  const state = EditorState.create({
    doc: '.tag:example',
    extensions: [editorSettingsExtension({ syntaxHighlighting: false }), guideHighlightField]
  });
  assert.equal(state.field(guideHighlightField).size, 0);
});

test('PvME command lines, explicit boundaries and references are distinct from ordinary prose', () => {
  const source = 'Normal text.\n.\n.tag:headings\n.img:https://img.pvme.io/a.png\n.file:https://img.pvme.io/b.png\n.pin:delete\n.react:test\n.blank:\n$linkmsg_headings$';
  assert.deepEqual(textOf(source, 'command'), ['.', '.tag:', '.img:', '.file:', '.pin:', '.react:', '.blank:']);
  assert.deepEqual(textOf(source, 'reference'), ['$linkmsg_headings$']);
  assert.deepEqual(tokens('Normal text with a full stop.'), []);
  assert.equal(parseGuide('# Heading\n.tag:a\n## Next').messages.length, 1);
});

test('attachment URLs and other command arguments stay outside highlight ranges', () => {
  const source = '.img:https://img.pvme.io/a.png?value=a+b\n.file:https://img.pvme.io/b.png\n.tag:headings\n.embed:json';
  assert.deepEqual(textOf(source, 'command'), ['.img:', '.file:', '.tag:', '.embed:']);
  for (const token of tokens(source)) {
    const lineStart = source.lastIndexOf('\n', token.from - 1) + 1;
    const valueStart = source.indexOf(':', lineStart) + 1;
    assert.ok(token.to <= valueStart);
  }
});

test('literal examples and escaped dot commands do not become live command/reference colours', () => {
  const source = '..tag:escaped\n\\.tag:escaped\n`.tag:literal $linkmsg_literal$`\n```\n.\n.tag:literal\n$linkmsg_literal$\n```';
  assert.deepEqual(textOf(source, 'command'), []);
  assert.deepEqual(textOf(source, 'reference'), []);
  assert.equal(textOf(source, 'markup').length, 4);
});

test('Markdown accents only delimiters; heading text, styled text, emoji and mention codes stay plain', () => {
  const source = '# __Heading__\n⬥ **Bold** *Italic* __Underline__ ~~Strike~~ ||Spoiler|| `code`\n    • Nested\n[Wiki](<https://runescape.wiki/>)\n> Quote\n<:ability:123> → s<:ability:123> + <@123>';
  assert.ok(textOf(source, 'markup').includes('#'));
  assert.ok(textOf(source, 'markup').includes('**'));
  assert.ok(textOf(source, 'markup').includes('__'));
  for (const word of ['Heading', 'Bold', 'Italic', 'Underline', 'Spoiler', 'Quote', 'code', '<:ability:123>', '<@123>']) {
    assert.ok(tokens(source).every(token => !source.slice(token.from, token.to).includes(word)), word);
  }
  assert.deepEqual(textOf(source, 'bullet'), ['⬥', '•']);
  assert.deepEqual(textOf(source, 'operator'), ['→', '+']);
});

test('JSON accents field names only; strings, numbers, literals and punctuation stay plain', () => {
  const payload = { embed: { title: 'literal .pin:delete {true}', description: '$linkmsg_start$', color: 39423, fields: [{ inline: true, name: 'Quote " inside', value: 'value' }] }, allowed_mentions: null };
  const source = `${JSON.stringify(payload, null, 2)}\n.embed:json`;
  assert.ok(textOf(source, 'json-key').includes('"title"'));
  assert.ok(tokens(source).every(token => !['json-string', 'json-number', 'json-literal', 'json-punctuation'].includes(token.kind)));
  assert.deepEqual(textOf(source, 'reference'), ['$linkmsg_start$']);
  assert.deepEqual(textOf(source, 'command'), ['.embed:']);
  const marker = source.indexOf('.embed:json');
  assert.ok(tokens(source).filter(token => token.kind.startsWith('json-')).every(token => token.to <= marker));
});

test('incomplete commands and invalid JSON remain highlightable while typing', () => {
  assert.deepEqual(textOf('.ta', 'command'), ['.ta']);
  const source = '{"embed": {"color": 123, "title": }}\n.embed:json';
  assert.ok(parseGuide(source).diagnostics.some(issue => issue.code === 'INVALID_EMBED_JSON'));
  assert.ok(textOf(source, 'json-key').includes('"title"'));
  assert.deepEqual(textOf(source, 'json-key'), ['"embed"', '"color"', '"title"']);
  assert.deepEqual(textOf(source, 'command'), ['.embed:']);
});

test('JSON fences accent field names without turning quoted commands/references into bot commands', () => {
  for (const close of ['\n```', '']) {
    const source = '```json\n{"literal":"$linkmsg_literal$", "number": 42}' + close;
    assert.deepEqual(textOf(source, 'json-key'), ['"literal"', '"number"']);
    assert.deepEqual(textOf(source, 'command'), []);
    assert.deepEqual(textOf(source, 'reference'), []);
  }
  assert.deepEqual(textOf('> ```json\n> {"number":42}\n> ```', 'json-key'), []);
});

test('ranges preserve UTF-16/CRLF positions, nested lists/quotes and the original AST', () => {
  const source = '🚀 Text\r\n.\r\n.tag:section\r\n> ⬥ **Bold**\r\n>     • Nested\r\n$linkmsg_section$';
  const document = parseGuide(source), before = JSON.stringify(document);
  const highlights = getGuideHighlightTokens(document);
  assert.equal(JSON.stringify(document), before);
  assert.deepEqual(textOf(source, 'command'), ['.', '.tag:']);
  assert.deepEqual(textOf(source, 'bullet'), ['⬥', '•']);
  assert.ok(highlights.every(token => token.from >= 0 && token.from < token.to && token.to <= source.length));
});

test('CodeMirror decorations initialise and update on edits without changing source or selection', () => {
  const initial = '.\n.tag:before\n$linkmsg_before$';
  let state = EditorState.create({ doc: initial, extensions: [guideHighlightField] });
  const original = state.field(guideHighlightField);
  const selected = state.update({ selection: { anchor: 2 } }).state;
  assert.strictEqual(selected.field(guideHighlightField), original);
  assert.equal(selected.doc.toString(), initial);
  state = selected.update({ changes: { from: 2, to: selected.doc.length, insert: '.tag:after' } }).state;
  assert.notStrictEqual(state.field(guideHighlightField), original);
  const classes = [];
  state.field(guideHighlightField).between(0, state.doc.length, (from, to, decoration) => classes.push(decoration.spec.class));
  assert.deepEqual(classes, ['cm-pvme-command', 'cm-pvme-command']);
  assert.equal(state.doc.toString(), '.\n.tag:after');
  assert.equal(state.selection.main.head, 2);
  const restored = state.update({ changes: { from: 0, to: state.doc.length, insert: initial } }).state;
  assert.deepEqual(getGuideHighlightTokens(parseGuide(restored.doc.toString())), getGuideHighlightTokens(parseGuide(initial)));
});
