import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseGuide } from '@pvme/guide-parser';
import { projectDiscordMessages } from './projectDiscordMessages.js';
import { renderGuide } from '../renderer/guideRenderer.js';

const image = '.img:https://img.pvme.io/images/0n5JNcBqXi.png';
const file = '.file:https://example.com/file.png';

test('Action Bars preview retains headings, labels, images and attachment spacing without mutating the AST', () => {
  const document = parseGuide(`.\n## __Action Bars__\n⬥ 0 Mech\n${image}\n⬥ 2 Mech\n.img:https://img.pvme.io/images/X5CvvlTzW5.png`);
  const before = JSON.stringify(document);
  const messages = projectDiscordMessages(document);
  assert.equal(messages.length, 2);
  assert.deepEqual(messages.map(m => m.blocks.filter(b => b.type !== 'command').map(b => b.type)), [
    ['heading', 'list', 'attachment'], ['list', 'attachment']
  ]);
  assert.deepEqual(messages.map(m => [m.range.start.line, m.range.end.line]), [[2, 4], [5, 6]]);
  for (const message of messages) {
    assert.ok(message.blocks.every(block => document.messages[message.sourceMessageIndex].blocks.includes(block)));
  }
  assert.equal(JSON.stringify(document), before);
  const rendered = renderGuide(document);
  assert.match(rendered[0].lineMap.map(p => p.html || '').join(''), /Action Bars.*0 Mech/);
  assert.doesNotMatch(rendered[0].lineMap.map(p => p.html || '').join(''), /2 Mech/);
  assert.equal(rendered[1].lineMap.at(-1).url, 'https://img.pvme.io/images/X5CvvlTzW5.png');
  assert.equal(rendered[1].followsAttachment, true);
});

test('preview anchors, pin and reactions stay with their parser-assigned posts', () => {
  const document = parseGuide(`# Intro\n.tag:intro\n## Child\n${image}\n.tag:child\n.pin:delete\n.react:first\nAfter\n.react:second\n.\nLast`);
  const messages = projectDiscordMessages(document);
  const child = messages.find(message => message.anchors.some(anchor => anchor.tag === 'child'));
  assert.equal(child.pin, 'delete');
  assert.deepEqual(child.reactions, ['first']);
  assert.equal(child.range.end.line, 7);
  const after = messages.find(message => message.blocks.some(block => block.raw === 'After'));
  assert.equal(after.pin, null);
  assert.deepEqual(after.reactions, ['second']);
  assert.deepEqual(after.anchors, []);
  const last = messages.at(-1);
  assert.equal(last.pin, null);
  assert.deepEqual(last.reactions, []);
  assert.deepEqual(last.anchors, []);
});

test('preview renders image, file and embed payloads once without exposing valid command markers', () => {
  const document = parseGuide(`Before\n${image}\n.\nFile\n${file}\n.\n{"embed":{"title":"Embed"}}\n.embed:json\n.\nAfter`);
  const parts = renderGuide(document).flatMap(message => message.lineMap);
  assert.deepEqual(parts.filter(part => part.type === 'attachment').map(part => part.url), [
    'https://img.pvme.io/images/0n5JNcBqXi.png', 'https://example.com/file.png'
  ]);
  assert.deepEqual(parts.filter(part => part.type === 'embed').map(part => part.embed), [{ title: 'Embed' }]);
  assert.doesNotMatch(parts.map(part => part.html || '').join(''), /\.img:|\.file:|\.embed:/);
});

test('metadata-only segments do not create preview posts or leak metadata into later content', () => {
  const document = parseGuide('.tag:only\n.pin:delete\n.react:x\n.\nBefore\n.pin:delete\n.\nAfter');
  const messages = projectDiscordMessages(document);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].pin, 'delete');
  assert.equal(messages[1].pin, null);
  assert.ok(messages.every(message => message.anchors.length === 0 && message.reactions.length === 0));
});

test('attachment spacing handles prose, lists, quotes, escaped code examples and intentional blanks', () => {
  for (const content of ['Text', '⬥ Item', '> Quote', '```\n..img:literal\n..\n```', '\nText']) {
    const messages = projectDiscordMessages(parseGuide(`${image}\n${content}`));
    assert.equal(messages.length, 2, content);
    assert.equal(messages[0].range.end.line, 1);
    assert.equal(messages[1].range.start.line, 2);
    assert.equal(messages[1].followsAttachment, !content.startsWith('\n'), content);
    assert.equal(messages[1].explicitBlank, content.startsWith('\n'), content);
  }
  const explicit = projectDiscordMessages(parseGuide(`${image}\n.\nText`));
  assert.equal(explicit[1].followsAttachment, false);
  const later = projectDiscordMessages(parseGuide(`${image}\nText\n.react:x\nMore`));
  assert.equal(later.at(-1).followsAttachment, false);
});

test('projection uses AST only and retains escaped code examples for rendering', () => {
  const document = parseGuide('```\n..blank:\n..tag:literal\n..\n```\n.\nNext');
  Object.defineProperty(document, 'source', { get() { throw new Error('Do not read raw source'); } });
  const messages = projectDiscordMessages(document);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].blocks[0].type, 'codeblock');
  assert.match(renderGuide(document)[0].lineMap[0].html, /\.blank:.*\n\.tag:literal/);
});

test('invalid commands remain visible in preview rather than being applied as metadata', () => {
  const messages = renderGuide(parseGuide('Before\n.blank:\n.pin:invalid\n.\nAfter'));
  assert.match(messages[0].lineMap.map(part => part.html || '').join(''), /\.blank:.*\.pin:invalid/);
  assert.ok(messages.every(message => message.pin === null && !message.explicitBlank));
});

test('preview preserves trailing blank rows before separators, metadata and end of file', () => {
  for (const ending of ['.\nAfter', '.pin:delete\n.\nAfter', '']) {
    const [message] = renderGuide(parseGuide(`Before\n\n\n${ending}`));
    assert.deepEqual(message.lineMap.map(part => [part.line, part.html]), [
      [1, 'Before'], [2, '<br>'], [3, '<br>']
    ]);
  }
});
