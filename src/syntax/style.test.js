import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { parseGuide } from '@pvme/guide-parser';
import findStyleErrors, { validateGuideStyle } from './style.js';
import { parserIssues } from '../parser/guideParser.js';
import { walkBlocks, visitInline } from './styleContext.js';

const emoji = '<:ability:123>';
const style = (source, options) => validateGuideStyle(parseGuide(source), source, options);
const codes = source => style(source).map(issue => issue.code);
const embed = value => `${JSON.stringify(value)}\n.embed:json`;
const toc = embed({ embed: { title: '__Table of Contents__', description: '[Start]($linkmsg_start$)' } });

// Each row asserts both a positive warning and a representative legitimate case.
for (const [code, bad, good] of [
  ['TRAILING_WHITESPACE', 'Text \t', 'Text'],
  ['DOUBLE_SPACE', 'Text  here', 'Text here'],
  ['SPACER_PLACEHOLDER', '_ _', '`_ _`'],
  ['ARROW_SPACING', 'A→B', '(→ B) → C'],
  ['EMOJI_SPACING', `Text${emoji}`, `Text ${emoji}`],
  ['EMOJI_IN_LINK', `[Text ${emoji}](<https://runescape.wiki/>)`, `[Text](<https://runescape.wiki/>) ${emoji}`],
  ['HEADING_UNDERLINE', '## Section', '## __Section__'],
  ['TITLE_UNDERLINE', '# __Title__', '# Title'],
  ['HEADING_SEPARATOR', 'Text\n## __Section__', 'Text\n.\n## __Section__'],
  ['HEADING_LEVEL', '#### Section', '### Sub-sub-section'],
  ['HEADING_BOLD', '# __**Title**__', '# __Title__'],
  ['BULLET_INDENT', '  • Item', '    • Item'],
  ['LIST_HIERARCHY', '    1) Item', '1) Item\n    a) Nested\n        ⬩ Third'],
  ['BULLET_HIERARCHY', '- Item', '⬥ Item\n    • Nested\n        ⬩ Third'],
  ['EMOJI_FULL_STOP', `Finished ${emoji}.`, `Finished ${emoji}`],
  ['DATE_FORMAT', 'Released 22 July 2013', 'Released 22nd July 2013'],
  ['NOTE_ITALICS', 'Note: This matters.', '*Note: This matters.*'],
  ['LINK_SUPPRESSION', '[Wiki](https://runescape.wiki/)', '[Wiki](<https://runescape.wiki/>)'],
  ['CONTENT_DOMAIN', '[Clip](<https://example.com/clip>)', '[Clip](<https://youtu.be/clip>)'],
  ['BLOCKED_HOST', '[Clip](<https://streamable.com/abcdef>)', '[Clip](<https://www.youtube.com/watch?v=abc>)'],
  ['DISCORD_CDN', '.img:https://cdn.discordapp.com/a.png', '.img:https://img.pvme.io/a.png'],
  ['COMMAND_SPACING', '.img: https://img.pvme.io/a.png', '.img:https://img.pvme.io/a.png'],
  ['LEADING_BLANK', '.\n\nText', '.\nText'],
  ['UNREFERENCED_TAG', '# __Start__\n.tag:start', '# __Start__\n.tag:start\n[Start]($linkmsg_start$)'],
  ['MISSING_TOC', '# __Start__\n.tag:start\n.\n## __Next__\n.tag:next', '# __Start__\n.tag:start\n.\n## __Next__\n.tag:next\n.\n' + embed({ embed: { title: 'Table of Contents', description: '$linkmsg_start$ $linkmsg_next$' } }) + '\n.pin:delete'],
  ['TOC_EMBED', '## __Table of Contents__', toc],
  ['TOC_PIN', toc, toc + '\n.pin:delete'],
  ['TOC_POSITION', toc + '\n.pin:delete\n.\nAfter', toc + '\n.pin:delete'],
  ['TOC_TARGET', '# __Other__\n.tag:other\n$linkmsg_other$\n.\n' + toc, '# __Start__\n.tag:start\n.\n' + toc],
  ['PRESET_PREVIEW', '[Magic - Basic](https://presets.pvme.io/?id=abc)\n[Magic - Advanced](https://presets.pvme.io/?id=def)', '[Magic - Basic](<https://presets.pvme.io/?id=abc>)\n[Magic - Advanced](https://presets.pvme.io/?id=def)'],
  ['MESSAGE_LENGTH', 'x'.repeat(2001), 'x'.repeat(2000)],
  ['EMBED_SCHEMA', embed({ embed: { title: 'x'.repeat(257) } }), embed({ embed: { title: 'Valid' } })],
  ['EMBED_SHAPE', embed([]), embed({ content: 'Valid Discord content without embeds' })],
  ['EMBED_TITLE_MENTION', embed({ embed: { title: '<@123>' } }), embed({ embed: { title: 'Title' } })],
  ['EMBED_FIELD_NAME', embed({ embed: { fields: [{ name: ' ', value: 'Valid' }] } }), embed({ embed: { fields: [{ name: 'Valid', value: 'Valid' }] } })],
  ['EMBED_FIELD_VALUE', embed({ embed: { fields: [{ name: 'Valid', value: ' ' }] } }), embed({ embed: { fields: [{ name: 'Valid', value: 'Valid' }] } })],
  ['EMBED_FIELD_MENTION', embed({ embed: { fields: [{ name: '<#123>', value: 'Valid' }] } }), embed({ embed: { fields: [{ name: 'Valid', value: 'Valid' }] } })]
]) test(`${code}: invalid and valid cases`, () => {
  assert.ok(codes(bad).includes(code), JSON.stringify(style(bad)));
  assert.ok(!codes(good).includes(code), JSON.stringify(style(good)));
});

test('preset previews allow one visible link anywhere among suppressed links', () => {
  const first = '⬥ [Melee (0 Mech)](https://presets.pvme.io/?id=e54f8126-5a67-4af2-b282-a975cb12b9b5) <:melee:1096130867279171706>';
  const second = '⬥ [Melee (2 Mech)](<https://presets.pvme.io/?id=7a639b95-b6d7-4e7e-999c-0ed474704733>) <:melee:1096130867279171706>';
  assert.deepEqual(style(`${first}\n${second}`), []);
  assert.deepEqual(style(`${second}\n${first}`), []);
  assert.deepEqual(style(`${second}\n${second}`), []);
  const issues = style(`${first}\n${second}\n${first}`);
  assert.deepEqual(issues.map(issue => issue.code), ['PRESET_PREVIEW']);
  assert.equal(issues[0].range.start.line, 1);
});

test('heading hierarchy accepts plain titles and preset labels are unrestricted', () => {
  assert.deepEqual(style('# Title\n.\n## __Section 1__\n.\n### __Sub-section 1.1__\n.\n### Sub-sub-section 1.1.1\n\n.\n## __Section 2__\n\n.\n## __Section 3__\n.\n### __Sub-section 3.1__'), []);
  assert.deepEqual(codes('# __Title__\n.\n## __Section__'), ['TITLE_UNDERLINE']);
  assert.deepEqual(style('[AFK setup](https://presets.pvme.io/?id=abc)'), []);
});

test('headings require a literal dot immediately above, except opening titles and quotes', () => {
  for (const heading of ['# Title', '## __Section__', '### __Sub-section__', '### Sub-sub-section']) {
    for (const prefix of ['Text\n', 'Text\n\n', 'Text\n.\n\n', 'Text\n\\.\n', 'Text\n.dot:\n']) {
      const source = prefix + heading;
      const issue = style(source).find(issue => issue.code === 'HEADING_SEPARATOR');
      assert.ok(issue, source);
      assert.equal(issue.range.start.offset, prefix.length);
      assert.equal(source.slice(issue.range.start.offset, issue.range.end.offset).trimEnd(), heading);
    }
    for (const newline of ['\n', '\r\n']) {
      assert.ok(!codes(`Text${newline}.${newline}${heading}`).includes('HEADING_SEPARATOR'));
    }
  }
  assert.deepEqual(style('# Title'), []);
  assert.ok(codes('## __Section__').includes('HEADING_SEPARATOR'));
  assert.deepEqual(style('> ## __Quoted section__'), []);
  assert.deepEqual(style('```\n## Example heading\n```'), []);
});

test('title underline warnings include partial and nested formatting and preserve exemptions', () => {
  for (const source of ['# A __Title__', '# __**Title**__', '# **__Title__**']) {
    const issue = style(source).find(issue => issue.code === 'TITLE_UNDERLINE');
    assert.ok(issue, source);
    assert.equal(issue.type, 'warn');
    assert.equal(issue.range.start.offset, 0);
  }
  for (const source of ['# Title', '# `__Title__`', '> # __Quoted title__', '```\n# __Example title__\n```', '.\n## __Section__', '.\n### __Sub-section__']) {
    assert.deepEqual(style(source), [], source);
  }
});

test('bullet and numbered list items may end in full stops', () => {
  assert.deepEqual(style('⬥ Item.\n    • Nested.\n        ⬩ Third.'), []);
  assert.deepEqual(style('1) Item.\n    a) Nested.'), []);
  assert.deepEqual(style('> ⬥ Quoted item.'), []);
});

test('emoji exceptions apply to static/animated emojis without exempting arbitrary word suffixes', () => {
  for (const before of ['', ' ', 'r', 's', '_', '(', '"', '\\', '\u200B', '\u00A0', '\\u200B', '\\u00A0']) {
    for (const after of ['', ' ', '.', '!', '_', ')', '\u200B']) assert.ok(!codes(`${before}<a:ability:123>${after}`).includes('EMOJI_SPACING'), `${before}/${after}`);
  }
  assert.ok(codes(`spellr${emoji}`).includes('EMOJI_SPACING'));
  assert.ok(codes(`${emoji}word`).includes('EMOJI_SPACING'));
  assert.ok(!codes(`r${emoji} → s${emoji} + ${emoji}`).includes('EMOJI_SPACING'));
});

test('code examples, including nested code and URL destinations, do not trigger prose rules', () => {
  const bad = `Text${emoji}  A→B _ _ 22 July 2013`;
  for (const source of [
    `\`${bad}\``, `\`\`${bad}\`\``, `\`\`\`\n${bad}\n#### Bad\n- Bad.\n..tag:missing\n\`\`\``,
    `> \`\`\`\n> ${bad}\n> \`\`\``, `⬥ \`${bad}\``,
    `⬥ Example\n    \`\`\`\n    ${bad}\n    \`\`\``,
    '[Clip](<https://img.pvme.io/A→B>)', '`Note: literal.`', embed({ embed: { description: bad } })
  ]) assert.deepEqual(style(source), [], source);
  assert.deepEqual(style(`\`${bad}\`  `).map(i => i.code), ['TRAILING_WHITESPACE']);
});

test('exact ranges, CRLF, astral characters and typing suppression remain stable', () => {
  const source = `🚀 Text\r\nOops${emoji}\r\nText  here\t `;
  const issues = style(source);
  const spacing = issues.find(i => i.code === 'EMOJI_SPACING');
  assert.equal(source.slice(spacing.range.start.offset, spacing.range.end.offset), emoji);
  assert.deepEqual(spacing.line, [2, 2]);
  assert.equal(spacing.range.start.column, 5);
  assert.equal(issues.find(i => i.code === 'TRAILING_WHITESPACE').range.end.offset, source.length);
  assert.ok(!style(source, { ignoredTrailingWhitespaceLine: 3 }).some(i => i.code === 'TRAILING_WHITESPACE'));
  assert.equal(issues.filter(i => i.code === 'DOUBLE_SPACE').length, 1);
  assert.equal(new Set(issues.map(i => `${i.code}:${i.range.start.offset}:${i.text}`)).size, issues.length);
});

test('quote nesting preserves list indentation without treating its prefix as double spaces', () => {
  assert.deepEqual(style('> ⬥ Item\n>     • Nested\n>         ⬩ Third'), []);
  assert.equal(codes('> ⬥  Item').filter(code => code === 'DOUBLE_SPACE').length, 1);
  assert.equal(codes('⬥  Item').filter(code => code === 'DOUBLE_SPACE').length, 1);
  assert.deepEqual(style('\u200B    • Nested'), []);
  assert.ok(codes('\u200B • Nested').includes('BULLET_INDENT'));
});

test('quoted headings do not require guide-section underlines but retain Discord heading checks', () => {
  assert.deepEqual(style('> ## ⚠️ Disclaimer'), []);
  assert.deepEqual(style('> # Quoted title\n> ## Quoted section'), []);
  assert.deepEqual(style('>>> ## ⚠️ Disclaimer'), []);
  assert.ok(codes('## Section').includes('HEADING_UNDERLINE'));
  assert.ok(codes('> #### Heading').includes('HEADING_LEVEL'));
  assert.ok(codes('> ## **Heading**').includes('HEADING_BOLD'));
});

test('publication length uses attachment splits and still budgets expanded tag URLs', () => {
  const source = `${'x'.repeat(1200)}\n.img:https://img.pvme.io/a.png\n${'y'.repeat(1200)}`;
  assert.ok(!codes(source).includes('MESSAGE_LENGTH'));
  assert.ok(codes(`${'x'.repeat(1950)}\n$linkmsg_target$`).includes('MESSAGE_LENGTH'));
  assert.ok(codes(embed({ content: 'x'.repeat(2001) })).includes('MESSAGE_LENGTH'));
  assert.ok(codes(embed({ content: `${'x'.repeat(1950)} $linkmsg_target$` })).includes('MESSAGE_LENGTH'));
});

test('leading blank warnings follow preview payloads rather than unsupported blank commands', () => {
  assert.ok(codes('.blank:\n\nText').includes('LEADING_BLANK'));
  assert.ok(!codes('.img:https://img.pvme.io/a.png\n\nText').includes('LEADING_BLANK'));
});

test('date ordinals, emoji punctuation, heading depth and ToC failures have no redundant warnings', () => {
  assert.ok(codes('On July 22, 2013').includes('DATE_FORMAT'));
  assert.ok(codes('On 11st July 2013').includes('DATE_FORMAT'));
  assert.ok(!codes('On 11th July 2013').includes('DATE_FORMAT'));
  assert.deepEqual(codes(`⬥ Finished ${emoji}.`), ['EMOJI_FULL_STOP']);
  assert.deepEqual(codes('Finished 🚀.'), ['EMOJI_FULL_STOP']);
  assert.ok(!codes('.\n### __Sub-section__').includes('HEADING_UNDERLINE'));
  assert.ok(!codes('.\n### Sub-sub-section').includes('HEADING_UNDERLINE'));
  const issues = codes('# __Guide__\n.tag:guide\n.\n## __Part__\n.tag:part\n.\n## __Table of Contents__');
  assert.ok(issues.includes('TOC_EMBED'));
  assert.ok(!issues.includes('MISSING_TOC'));
  assert.ok(codes('## __Table of Contents__\n.\n').includes('TOC_EMBED'));
});

test('style diagnostics stay separate from parser diagnostics and do not duplicate invalid pin warnings', () => {
  const source = '# __Start__\n.tag:start\n.tag:start\n.img:not-a-url\n.unknown:foo\n$linkmsg_missing$\n<:broken>\n.\n{"embed":bad}\n.embed:json\n.\n```\nunclosed';
  const document = parseGuide(source);
  const structural = parserIssues(document), editorial = validateGuideStyle(document);
  assert.ok(structural.every(i => i.source === 'parser'));
  assert.ok(editorial.every(i => i.source === 'style'));
  assert.ok(!editorial.some(i => structural.some(p => p.code === i.code || p.text === i.text)));
  assert.deepEqual(findStyleErrors(source), editorial);
  const malformedPin = parseGuide(toc + '\n.pin:invalid');
  assert.ok(!validateGuideStyle(malformedPin).some(issue => issue.code === 'TOC_PIN'));
});

test('internal URLs are exempt and command boundaries do not exempt headings from style rules', () => {
  for (const url of ['https://pvme.io/guide-editor/', 'https://presets.pvme.io/?id=abc', 'https://pvme.github.io/rotation-builder/', 'https://github.com/pvme/pvme-guides', 'https://raw.githubusercontent.com/pvme/pvme-settings/master/emojis/emojis.json', 'https://discord.com/channels/1/2']) assert.ok(!codes(`[Link](<${url}>)`).includes('CONTENT_DOMAIN'), url);
  const document = parseGuide('# Start\n.tag:start\n## __Next__');
  assert.deepEqual(validateGuideStyle(document).map(issue => issue.code), ['UNREFERENCED_TAG', 'HEADING_SEPARATOR']);
});

test('canonical Style Guide has no editorial warnings, including inside code examples', () => {
  const source = readFileSync(new URL('./fixtures/style-guide.txt', import.meta.url), 'utf8');
  const document = parseGuide(source);
  const issues = validateGuideStyle(document);
  const literals = [];
  for (const message of document.messages) walkBlocks(message.blocks, block => {
    if (block.type === 'codeblock') literals.push(block.range);
    else if (block.children) visitInline(block.children, node => { if (node.type === 'inline-code') literals.push(node.range); });
  });
  assert.ok(issues.every(issue => !literals.some(r => issue.range.start.offset >= r.start.offset && issue.range.end.offset <= r.end.offset)));
  assert.deepEqual(issues, []);
});
