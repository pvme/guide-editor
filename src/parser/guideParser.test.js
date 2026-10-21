import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseEditorGuide, parserIssues, getTocEntries, getEmojiId } from './guideParser.js';
import { parseListLine } from '../codemirror/listIndent.js';
import { renderGuide, renderFragment } from '../renderer/guideRenderer.js';
import findStyleErrors from '../syntax/style.js';

test('parser integration smoke: preview line mapping and ToC links use the shared document', () => {
  const source = '# Intro\n.tag:intro\n## Next\nText **bold** <:test:123>\n.img:https://example.com/a.png\nAfter image\n.\n[Intro]($linkmsg_intro$)';
  const document = parseEditorGuide(source);
  const messages = renderGuide(document);
  assert.equal(getTocEntries(document)[0].tag, 'intro');
  assert.equal(getTocEntries(document)[0].section.heading, 'Intro');
  const parts = messages.flatMap(message => message.lineMap);
  assert.deepEqual(parts.filter(part => part.type === 'attachment').map(part => part.line), [5]);
  assert.ok(parts.some(part => part.html?.includes('<strong>bold</strong>')));
  const linkMessage = messages.find(message => message.lineMap.some(part => part.html?.includes('data-guide-tag="intro"')));
  assert.equal(linkMessage.firstEditorLine, 8);
});

test('parser integration smoke: embeds render and parser diagnostics map to editor locations', () => {
  const payload = { content: 'Hello', embeds: [{ title: '**First**' }, { description: 'Second' }], allowed_mentions: { parse: [] } };
  const source = `${JSON.stringify(payload)}\n.embed:json`;
  const document = parseEditorGuide(source);
  assert.deepEqual(renderGuide(document)[0].lineMap.filter(part => part.type === 'embed').map(part => part.embed), payload.embeds);
  const invalid = parseEditorGuide('# Header\r\n.tag:a\r\n$linkmsg_missing$\r\n.\r\n{"embed": bad}\r\n.embed:json');
  const missing = parserIssues(invalid).find(issue => issue.code === 'MISSING_TAG');
  assert.equal(invalid.source.slice(missing.range.start.offset, missing.range.end.offset), '$linkmsg_missing$');
  assert.deepEqual(missing.line, [3, 3]);
  assert.match(renderGuide(invalid).at(-1).lineMap[0].html, /&quot;embed&quot;/);
  assert.equal(findStyleErrors(invalid.source).filter(issue => issue.source === 'parser').length, 0);
});

test('AST rendering escapes source and URL attributes, preserves code, and has future-node fallbacks', () => {
  const html = renderFragment('<script>alert(1)</script> [bad](javascript:alert(1)) **bold** `literal`\n\n```js\n<img src=x onerror=alert(1)>\n```');
  assert.doesNotMatch(html, /<script>|href="javascript:|<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /pvme-codeblock/);
  const document = parseEditorGuide('Text');
  const future = { ...document, messages: [{ ...document.messages[0], blocks: [{ type: 'future', raw: '<unsafe>', range: document.range }] }] };
  assert.equal(renderGuide(future)[0].lineMap[0].html, '&lt;unsafe&gt;');
  assert.deepEqual(findStyleErrors('```\n{"x": "a  b"}\n```'), []);
  assert.deepEqual(findStyleErrors('`a→b`'), []);
});

test('editor list and emoji helpers use shared nodes while preserving editing choices', () => {
  assert.equal(getEmojiId('<:first:123> <a:second:456>'), '456');
  assert.deepEqual(parseListLine('    b. Example'), { type: 'ordered', indent: 4, marker: 'b.', content: 'Example', index: 2 });
  assert.equal(parseListLine('⬥ ').content, '');
  assert.equal(parseListLine('Ordinary prose'), null);
});
