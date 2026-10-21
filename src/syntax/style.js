import Ajv from 'ajv';
import { parseGuide, serializeDiscordMessage } from '@pvme/guide-parser';
import { parseEditorGuide } from '../parser/guideParser.js';
import { projectDiscordMessages } from '../discord/projectDiscordMessages.js';
import { embedSchema } from './embedSchema.js';
import { embedValues } from '../renderer/guideRenderer.js';
import { getPresetEmbedUrl } from '../presetEmbeds.js';
import { createStyleContext, inlineText, visitInline, walkBlocks } from './styleContext.js';

const validateEmbed = new Ajv({ allErrors: true }).compile(embedSchema);
const proseTypes = ['paragraph', 'heading', 'subtext'];
const months = 'January|February|March|April|May|June|July|August|September|October|November|December';
const bulletIndents = new Map([['⬥', 0], ['•', 4], ['⬩', 8]]);
const neighbor = character => character === undefined || /[\s\p{Cf}\\`"'\[\](){}.,!?;:_*\-]/u.test(character);

function permittedHost(url) {
  return ['runescape.wiki', 'www.runescape.wiki', 'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'pvme.io', 'pvme.github.io'].includes(url.hostname)
    || url.hostname.endsWith('.pvme.io')
    || (['discord.com', 'discordapp.com'].includes(url.hostname) && url.pathname.startsWith('/channels/'))
    || (['github.com', 'raw.githubusercontent.com'].includes(url.hostname) && url.pathname.startsWith('/pvme/'));
}

function checkUrl(value, location, add) {
  let url;
  try { url = new URL(value); } catch { return; } // Syntax/references are parser-owned.
  if (!['http:', 'https:'].includes(url.protocol)) return;
  if (['streamable.com', 'www.streamable.com'].includes(url.hostname)) add('BLOCKED_HOST', location, 'Use of streamable.com is forbidden', 'error');
  else if (/^cdn\.discord(?:app)?\.com$/.test(url.hostname)) add('DISCORD_CDN', location, 'Discord CDN should not be used for images', 'error');
  else if (!permittedHost(url)) add('CONTENT_DOMAIN', location, 'Use approved content hosts (RuneScape Wiki, YouTube or PvME); check this external link');
}

function checkEmoji(node, insideLink, source, add) {
  if (!node.id) return;
  if (insideLink) { add('EMOJI_IN_LINK', node.range, 'Discord emoji must not appear inside links', 'error'); return; }
  const start = node.range.start.offset, end = node.range.end.offset;
  const before = source[start - 1], after = source[end];
  const prefix = ['r', 's', '_'].includes(before) && neighbor(source[start - 2]);
  const escapedBefore = /\\u(?:200b|00a0)$/i.test(source.slice(Math.max(0, start - 6), start));
  const escapedAfter = /^\\u(?:200b|00a0)/i.test(source.slice(end, end + 6));
  if ((!neighbor(before) && !prefix && !escapedBefore) || (!neighbor(after) && !escapedAfter)) add('EMOJI_SPACING', node.range, 'Emojis must have valid characters around them');
}

function checkHeading(block, context, message, { add }) {
  const firstContent = message.blocks.find(node => !['blank', 'command', 'unknown-command'].includes(node.type));
  if (!context.quoted && block !== firstContent) add('HEADING_SEPARATOR', block.range, 'Start a new message before this heading');
  if (block.level > 3) add('HEADING_LEVEL', block.range, 'Heading format with 4 or more # are not supported in Discord. ### is the max', 'error');
  let bold = false, underline = false;
  visitInline(block.children, node => {
    if (node.type === 'bold') bold = true;
    if (node.type === 'underline') underline = true;
  });
  if (bold) add('HEADING_BOLD', block.range, 'Bold formatting **text** is redundant in headers (#, ##, ###). Remove the ** on this line', 'error');
  if (!context.quoted && block.level === 1 && underline) add('TITLE_UNDERLINE', block.range, 'Do not underline guide titles (#). Remove the __ formatting');
  const words = block.children.filter(node => node.type !== 'emoji' && !(node.type === 'text' && !node.value.trim()));
  if (!context.quoted && block.level === 2 && !words.every(node => node.type === 'underline')) add('HEADING_UNDERLINE', block.range, 'Underline level 1 section headings (##)');
  // ### can be underlined (sub-section) or plain (sub-sub-section). Logical
  // depth and Oxford capitalisation require author intent/parts of speech.
}

function checkList(block, source, { range, add }) {
  for (const item of block.items) {
    const markerStart = item.range.start.offset + item.raw.indexOf(item.marker);
    const location = range(item.range.start.offset, markerStart + item.marker.length);
    const contentStart = item.children[0]?.range.start;
    if (contentStart?.line === item.range.start.line) {
      const gapStart = markerStart + item.marker.length;
      const gap = source.slice(gapStart, contentStart.offset);
      if (/^ {2,}$/.test(gap)) add('DOUBLE_SPACE', range(gapStart, contentStart.offset), 'Content should not include double spaces');
    }
    const expected = bulletIndents.get(item.marker);
    if (expected !== undefined && (item.indent !== expected || source.slice(item.range.start.offset, markerStart).includes('\t'))) add('BULLET_INDENT', location, `The '${item.marker}' character should ${expected ? `be indented by exactly ${expected} spaces` : 'not be indented'}`, 'error');
    else if (/^\d+[.)]$/.test(item.marker) && item.indent !== 0) add('LIST_HIERARCHY', location, 'Numbered lists belong at level 1; use letters at 4 spaces and ⬩ at 8 spaces');
    else if (/^[A-Za-z][.)]$/.test(item.marker) && item.indent !== 4) add('LIST_HIERARCHY', location, 'Lettered lists should be indented by exactly 4 spaces');
    else if (expected === undefined && !/^\d+[.)]$|^[A-Za-z][.)]$/.test(item.marker)) add('BULLET_HIERARCHY', location, 'Use PvME bullets: ⬥ at level 1, • at level 2, and ⬩ at level 3');
  }
}

function checkPunctuation(block, source, { range, add }) {
  const leaves = [];
  function flatten(nodes) {
    for (const node of nodes || []) {
      if (['bold', 'italic', 'underline', 'strikethrough', 'spoiler'].includes(node.type)) flatten(node.children);
      else leaves.push(node);
    }
  }
  flatten(block.children);
  const last = leaves.at(-1);
  if (last?.type !== 'text' || !last.value.trimEnd().endsWith('.') || last.value.trimEnd().endsWith('..')) return;
  const dot = source.lastIndexOf('.', last.range.end.offset - 1);
  if (dot < last.range.start.offset) return;
  const location = range(dot, dot + 1);
  if ((leaves.at(-2)?.type === 'emoji' && last.value.trim() === '.') || /\p{Extended_Pictographic}\uFE0F?\.$/u.test(last.value.trimEnd())) add('EMOJI_FULL_STOP', location, 'Sentences ending in an emoji should not end in a full stop');
}

function checkText(ctx, options) {
  const { lines, proseLines, masked, range, add } = ctx;
  const ordinal = day => day % 100 >= 11 && day % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th');
  for (const number of proseLines) {
    const { start, text } = lines[number - 1];
    const visible = masked.slice(start, start + text.length);
    const mark = (code, match, message) => add(code, range(start + match.index, start + match.index + match[0].length), message);
    // A leading ZWSP makes this prose rather than a shared list node. Retain
    // the historical spacing check on that exact textual prefix only.
    const invisibleBullet = /^\u200B([ \t]*)([⬥•⬩])(?=\s)/.exec(visible);
    if (invisibleBullet) {
      const expected = bulletIndents.get(invisibleBullet[2]);
      if (invisibleBullet[1] !== ' '.repeat(expected)) add('BULLET_INDENT',
        range(start + 1, start + invisibleBullet[0].length),
        `The '${invisibleBullet[2]}' character should ${expected ? `be indented by exactly ${expected} spaces` : 'not be indented'}`, 'error');
    }
    const trailing = /[ \t]+$/.exec(visible);
    if (trailing && number !== Number(options.ignoredTrailingWhitespaceLine)) mark('TRAILING_WHITESPACE', trailing, 'Content should not include trailing whitespace');
    const indent = /^[\s\u200B]*/.exec(visible)[0].length;
    const body = visible.slice(indent).replace(/[ \t]+$/, '');
    for (const match of body.matchAll(/ {2,}/g)) mark('DOUBLE_SPACE', { ...match, index: indent + match.index }, 'Content should not include double spaces');
    for (const match of visible.matchAll(/__ __|_ _/g)) mark('SPACER_PLACEHOLDER', match, "Do not make use of '_ _'");
    for (const match of visible.matchAll(/→/g)) {
      const before = visible[match.index - 1], after = visible[match.index + 1];
      if ((before !== undefined && !/[\s(]/.test(before)) || (after !== undefined && !/\s/.test(after))) mark('ARROW_SPACING', match, '→ should have spaces around it');
    }
    // Unambiguous written dates only, not shorthand numbers or timestamps.
    for (const match of visible.matchAll(new RegExp(`\\b(\\d{1,2})(st|nd|rd|th)? (${months}) (\\d{4})\\b`, 'g'))) {
      const day = Number(match[1]);
      if (day >= 1 && day <= 31 && match[2] !== ordinal(day)) mark('DATE_FORMAT', match, 'Use dates such as 22nd July 2013 (day with ordinal, month, year)');
    }
    for (const match of visible.matchAll(new RegExp(`\\b(?:${months}) \\d{1,2}(?:st|nd|rd|th)?,? \\d{4}\\b`, 'g'))) mark('DATE_FORMAT', match, 'Use dates such as 22nd July 2013 (day with ordinal, month, year)');
  }
}

function hasMention(value) {
  if (typeof value !== 'string') return false;
  let found = false;
  for (const message of parseGuide(value, { validateReferences: false }).messages) walkBlocks(message.blocks, block => {
    if (proseTypes.includes(block.type)) visitInline(block.children, node => { if (node.type === 'mention') found = true; });
  });
  return found;
}

function checkPublication(document, posts, { add }) {
  const url = 'https://discordapp.com/channels/00000000000000000000/00000000000000000000/00000000000000000000';
  for (const post of posts) {
    const payload = post.blocks.filter(block => !['command', 'unknown-command', 'attachment'].includes(block.type));
    // The parser owns normalization, reference substitution (including code),
    // padding and Discord's text limit. Keep only the editor diagnostic here.
    try {
      serializeDiscordMessage(document.messages[post.sourceMessageIndex], { resolveTag: () => url });
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      add('MESSAGE_LENGTH', post.range, 'Message text exceeds 2000 characters', 'error');
    }
    if (!post.explicitBlank && payload[0]?.type === 'blank' && payload.some(block => block.type !== 'blank')) add('LEADING_BLANK', payload[0].range, 'Message should not start with an empty line', 'error');
  }
  for (const node of document.embeds.filter(embed => embed.valid)) {
    const embeds = embedValues(node);
    if (!embeds.length && typeof node.value?.content !== 'string') add('EMBED_SHAPE', node.range, 'Discord embed must be an object', 'error');
    for (const embed of embeds) {
      if (!validateEmbed(embed)) for (const error of validateEmbed.errors) add('EMBED_SCHEMA', node.range, `Discord embed ${error.instancePath || '/'} ${error.message}`, 'error');
      if (hasMention(embed.title)) add('EMBED_TITLE_MENTION', node.range, 'Discord mentions are not allowed in embed titles', 'error');
      for (const field of Array.isArray(embed.fields) ? embed.fields : []) {
        if (!field || typeof field !== 'object') continue;
        if (typeof field.name === 'string' && !field.name.trim()) add('EMBED_FIELD_NAME', node.range, 'Embed field name is empty', 'error');
        if (typeof field.value === 'string' && !field.value.trim()) add('EMBED_FIELD_VALUE', node.range, 'Embed field value is empty', 'error');
        if (hasMention(field.name)) add('EMBED_FIELD_MENTION', node.range, 'Discord mentions are not allowed in embed field names', 'error');
      }
    }
  }
}

function isTocTitle(value) {
  if (typeof value !== 'string') return false;
  const document = parseGuide(value, { validateReferences: false });
  return /^table of contents(?:\s*\(toc\))?$/i.test(document.messages.flatMap(message => message.blocks).map(block => inlineText(block.children)).join('').trim());
}

function checkToc(document, posts, { add, range, lines }) {
  const toc = document.embeds.find(node => node.valid && embedValues(node).some(embed => isTocTitle(embed.title)));
  const tags = Object.values(document.tags);
  const referenced = new Set(document.references.filter(ref => ref.kind === 'tag').map(ref => ref.target));
  for (const anchor of tags) if (!referenced.has(anchor.tag)) add('UNREFERENCED_TAG', anchor.range, `.tag:${anchor.tag} does not have a matching $linkmsg_${anchor.tag}$ reference`);
  const title = document.sections.find(section => section.level === 1);
  // A fragment or a single section need not have a whole-guide ToC yet.
  if (!toc) {
    const last = posts.filter(post => post.blocks.some(block => !['blank', 'command'].includes(block.type))).at(-1);
    const plainToc = last?.blocks.find(block => block.type === 'heading' && /^table of contents(?:\s*\(toc\))?$/i.test(block.text));
    if (!plainToc && title && tags.filter(tag => tag.sectionId).length >= 2) {
      const line = lines[title.range.start.line - 1];
      add('MISSING_TOC', range(line.start, line.start + line.text.length), 'Guides should end with a pinned Table of Contents embed');
    }
    if (plainToc) add('TOC_EMBED', plainToc.range, 'The Table of Contents should be inside a Discord embed');
    return;
  }
  const post = posts.find(message => message.blocks.includes(toc));
  const pin = post.blocks.find(block => block.type === 'command' && block.valid && block.name === 'pin' && block.parameter === 'delete' && block.range.start.offset >= toc.range.end.offset);
  const malformedPin = post.blocks.some(block => block.type === 'command' && block.name === 'pin' && !block.valid);
  if ((!pin || post.pin !== 'delete') && !malformedPin) add('TOC_PIN', toc.range, 'Add .pin:delete under the Table of Contents embed');
  const laterPayload = posts.flatMap(message => message.blocks).some(block => block.range.start.offset >= toc.range.end.offset && !['blank', 'command'].includes(block.type));
  if (laterPayload) add('TOC_POSITION', toc.range, 'The Table of Contents should be the final guide content');
  const targets = new Set(toc.references.filter(ref => ref.kind === 'tag').map(ref => ref.target));
  for (const anchor of tags) if (referenced.has(anchor.tag) && !targets.has(anchor.tag)) add('TOC_TARGET', anchor.range, `Include tagged section ${anchor.tag} in the Table of Contents`);
}

/** Reusable editorial validation, independent of editor components and stores. */
export function validateGuideStyle(document, source = document.source, options = {}) {
  const ctx = createStyleContext(document, source);
  const { add } = ctx;
  const posts = projectDiscordMessages(document);
  checkText(ctx, options);
  for (const message of document.messages) {
    const presets = [];
    walkBlocks(message.blocks, (block, context) => {
      if (block.type === 'attachment') checkUrl(block.url, block.range, add);
      if (block.type === 'heading') checkHeading(block, context, message, ctx);
      if (block.type === 'list') checkList(block, source, ctx);
      if (block.type === 'command' && block.valid) {
        const space = /:[ \t]+/.exec(block.raw);
        if (space) add('COMMAND_SPACING', ctx.range(block.range.start.offset + space.index + 1, block.range.start.offset + space.index + space[0].length), 'Command must not have whitespace after the colon and before the content', 'error');
      }
      if (!proseTypes.includes(block.type)) return;
      if (block.type !== 'heading') checkPunctuation(block, source, ctx);
      const first = block.children.find(node => node.type !== 'text' || node.value.trim());
      if (first?.type !== 'inline-code' && /^Notes?:/.test(inlineText(block.children)) && !block.children.every(node => node.type === 'italic' || (node.type === 'text' && !node.value.trim()))) add('NOTE_ITALICS', block.range, 'Write explicit Note:/Notes: text in italics');
      visitInline(block.children, (node, insideLink) => {
        if (node.type === 'emoji') checkEmoji(node, insideLink, source, add);
        if (!['link', 'image'].includes(node.type)) return;
        checkUrl(node.url, node.range, add);
        if (getPresetEmbedUrl(node.url)) {
          if (!node.suppressEmbed) presets.push(node);
        } else if (!node.suppressEmbed && /^https?:/.test(node.url) && !node.destination?.some(ref => ref.kind === 'tag')) add('LINK_SUPPRESSION', node.range, node.url.startsWith('https://img.pvme.io/') ? 'Image links are normally preceded by an .img: tag or wrapped in < > to not display' : 'Wrap link destinations in < > to suppress inline embeds');
      });
    });
    for (const preset of presets.slice(0, -1)) add('PRESET_PREVIEW', preset.range, 'Only one preset link in a section should show a preview; wrap other links in < >');
  }
  checkPublication(document, posts, ctx);
  checkToc(document, posts, ctx);
  return ctx.results.sort((a, b) => a.range.start.offset - b.range.start.offset || a.code.localeCompare(b.code));
}

export default function findStyleErrors(source, options = {}) {
  return validateGuideStyle(parseEditorGuide(source), source, options);
}
