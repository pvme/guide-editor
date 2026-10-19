import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseGuide } from '@pvme/guide-parser';
import { projectDiscordMessages } from './projectDiscordMessages.js';
import { renderGuide } from '../renderer/guideRenderer.js';

const image = '.img:https://img.pvme.io/images/0n5JNcBqXi.png';
const file = '.file:https://example.com/file.png';

test('Action Bars publishes two posts, retaining the heading, labels and correct images', () => {
  const document = parseGuide(`.\n## __Action Bars__\n⬥ 0 Mech\n${image}\n⬥ 2 Mech\n.img:https://img.pvme.io/images/X5CvvlTzW5.png`);
  const before = JSON.stringify(document);
  const messages = projectDiscordMessages(document);
  assert.equal(document.messages.length, 1);
  assert.equal(messages.length, 2);
  assert.deepEqual(messages.map(m => m.blocks.filter(b => b.type !== 'command').map(b => b.type)), [
    ['heading', 'list', 'attachment'], ['list', 'attachment']
  ]);
  assert.deepEqual(messages.map(m => [m.range.start.line, m.range.end.line]), [[2, 4], [5, 6]]);
  assert.deepEqual(messages.map(m => m.sourceMessageIndex), [0, 0]);
  assert.strictEqual(messages[0].blocks[0], document.messages[0].blocks[0]);
  assert.equal(JSON.stringify(document), before);
  const rendered = renderGuide(document);
  assert.match(rendered[0].lineMap.map(p => p.html || '').join(''), /Action Bars.*0 Mech/);
  assert.doesNotMatch(rendered[0].lineMap.map(p => p.html || '').join(''), /2 Mech/);
  assert.equal(rendered[1].lineMap.at(-1).url, 'https://img.pvme.io/images/X5CvvlTzW5.png');
  assert.equal(rendered[1].followsAttachment, true);
});

test('tags never split; pin/reactions stay on the outgoing post at their command position', () => {
  const document = parseGuide(`# Intro\n.tag:intro\n## Child\n${image}\n.tag:child\n.pin:delete\n.react:first\nAfter\n.react:second\n.\nLast`);
  const messages = projectDiscordMessages(document);
  assert.equal(messages.length, 3);
  assert.deepEqual(messages.map(m => m.pin), ['delete', null, null]);
  assert.deepEqual(messages.map(m => m.reactions), [['first'], ['second'], []]);
  assert.deepEqual(messages[0].anchors.map(a => a.tag), ['intro', 'child']);
  assert.equal(messages[1].range.start.line, 8);
  assert.equal(messages[2].sourceMessageIndex, 1);
  assert.equal(messages[0].range.end.line, 7);
});

test('consecutive attachments and embed payloads stay together; embed markers never split', () => {
  const document = parseGuide(`Before\n${image}\n${file}\n{"embed":{"title":"Embed"}}\n.embed:json\nAfter`);
  const [message] = projectDiscordMessages(document);
  assert.equal(projectDiscordMessages(document).length, 1);
  assert.equal(message.blocks.filter(b => b.type === 'attachment').length, 2);
  assert.equal(message.blocks.filter(b => b.type === 'embed').length, 1);
  assert.equal(renderGuide(document)[0].lineMap.filter(p => p.type === 'embed').length, 1);
});

test('.blank: creates a boundary, with no extra metadata-only post or metadata leakage', () => {
  const document = parseGuide('Before\n.pin:delete\n.blank:\n.react:next\nAfter\n.blank:');
  const messages = projectDiscordMessages(document);
  assert.equal(document.messages.length, 1);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].pin, 'delete');
  assert.equal(messages[1].pin, null);
  assert.equal(messages[1].explicitBlank, true);
  assert.deepEqual(messages[1].reactions, ['next']);
  assert.equal(projectDiscordMessages(parseGuide('.tag:only\n.pin:delete\n.react:x')).length, 0);
});

test('all ordinary AST content after attachments splits, including blanks, quotes and fences', () => {
  for (const content of ['Text', '⬥ Item', '> Quote', '```\n.img:literal\n.\n```', '\nText']) {
    const messages = projectDiscordMessages(parseGuide(`${image}\n${content}`));
    assert.equal(messages.length, 2, content);
    assert.equal(messages[0].range.end.line, 1);
    assert.equal(messages[1].range.start.line, 2);
  }
});

test('projection uses AST only and preserves explicit source boundaries and code literals', () => {
  const document = parseGuide('```\n.blank:\n.tag:literal\n.\n```\n.\nNext');
  Object.defineProperty(document, 'source', { get() { throw new Error('Do not read raw source'); } });
  const messages = projectDiscordMessages(document);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].blocks[0].type, 'codeblock');
  assert.equal(messages[1].sourceMessageIndex, 1);
});

test('legacy extra trailing-blank spacing applies at explicit boundaries only', () => {
  const messages = projectDiscordMessages(parseGuide('Before\n\n.\nAfter\n\n'));
  assert.equal(messages[0].hasTrailingBlank, true);
  assert.equal(messages[1].hasTrailingBlank, false);
});
