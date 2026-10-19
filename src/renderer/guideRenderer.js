import { parseGuide } from '@pvme/guide-parser';
import * as settings from '../pvmeSettings.js';
import { getPresetEmbedUrl } from '../presetEmbeds.js';
import { projectDiscordMessages } from '../discord/projectDiscordMessages.js';

export function escapeHTML(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function safeUrl(value, allowMail = false) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return ['https:', 'http:', ...(allowMail ? ['mailto:'] : [])].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function spreadsheetValue(target) {
  const [sheet, cell] = target.split('!');
  if (!cell) return settings.pvmeSpreadsheet?.cell_aliases?.[target];
  const address = /^([A-Za-z]+)(\d+)$/.exec(cell);
  return address ? settings.pvmeSpreadsheet?.cells?.[sheet]?.[address[1]]?.[address[2]] : undefined;
}

function referenceLink(node, label) {
  return `<a class="d-channel-link" href="#guide-tag-${encodeURIComponent(node.target)}" data-guide-tag="${escapeHTML(node.target)}">${label}</a>`;
}

export function renderInline(nodes = [], document) {
  return nodes.map(node => {
    const children = () => renderInline(node.children, document);
    switch (node.type) {
      case 'text': return escapeHTML(node.value);
      case 'bold': return `<strong>${children()}</strong>`;
      case 'italic': return `<em>${children()}</em>`;
      case 'underline': return `<u>${children()}</u>`;
      case 'strikethrough': return `<s>${children()}</s>`;
      case 'spoiler': return `<span class="spoiler-text" tabindex="0">${children()}</span>`;
      case 'inline-code': return `<code class="inline">${escapeHTML(node.value)}</code>`;
      case 'line-break': return '<br>';
      case 'spacer': return '&nbsp;';
      case 'emoji':
        return node.id ? `<img class="d-emoji${node.animated ? ' d-emoji-animated' : ''}" src="https://cdn.discordapp.com/emojis/${encodeURIComponent(node.id)}.${node.animated ? 'gif' : 'png'}" alt=":${escapeHTML(node.name)}:" title="${escapeHTML(node.name)}">` : escapeHTML(node.raw);
      case 'mention': {
        let label = node.target;
        if (node.kind === 'channel') {
          label = `#${settings.channels[node.target] || node.target}`;
          return `<span class="d-mention d-channel"><a class="d-channel-link" href="https://discord.com/channels/534508796639182860/${encodeURIComponent(node.target)}">${escapeHTML(label)}</a></span>`;
        }
        if (node.kind === 'user') label = `@${settings.users[node.target] || node.target}`;
        if (node.kind === 'role') label = `@${settings.roles[node.target] || node.target}`;
        if (node.kind === 'special') label = ({ customize: '#Channels & Roles', guide: '#Server Guide' })[node.target] || node.raw;
        if (['everyone', 'here'].includes(node.kind)) label = `@${node.kind}`;
        return `<span class="d-mention">${escapeHTML(label)}</span>`;
      }
      case 'reference': {
        if (node.kind === 'tag') {
          const anchor = document?.tags[node.target];
          return referenceLink(node, escapeHTML(`#${anchor?.heading || node.target}`));
        }
        if (node.kind === 'data' || node.kind === 'data-link') return escapeHTML(spreadsheetValue(node.target) ?? node.raw);
        return escapeHTML(node.raw);
      }
      case 'timestamp': {
        const date = new Date(Number(node.timestamp) * 1000);
        if (!Number.isFinite(date.getTime())) return escapeHTML(node.raw);
        const style = node.style || 'f';
        const options = { t: { timeStyle: 'short' }, T: { timeStyle: 'medium' }, d: { dateStyle: 'short' }, D: { dateStyle: 'long' }, f: { dateStyle: 'long', timeStyle: 'short' }, F: { dateStyle: 'full', timeStyle: 'short' } };
        let label;
        if (style === 'R') {
          const seconds = (date.getTime() - Date.now()) / 1000;
          const [unit, size] = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]].find(([, size]) => Math.abs(seconds) >= size) || ['second', 1];
          label = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(seconds / size), unit);
        } else label = date.toLocaleString(undefined, options[style]);
        return `<time class="d-mention" datetime="${date.toISOString()}" title="${escapeHTML(node.raw)}">${escapeHTML(label)}</time>`;
      }
      case 'link': {
        const tag = node.destination?.find(reference => reference.kind === 'tag');
        if (tag) return referenceLink(tag, children());
        let url = node.url;
        for (const reference of node.destination || []) {
          if (reference.kind === 'data' || reference.kind === 'data-link') url = url.replace(reference.raw, String(spreadsheetValue(reference.target) ?? reference.raw));
        }
        const safe = safeUrl(url, true);
        return safe ? `<a href="${escapeHTML(safe)}" target="_blank" rel="noopener noreferrer">${children()}</a>` : children();
      }
      case 'image': {
        const url = safeUrl(node.url);
        return url ? `<img class="media" src="${escapeHTML(url)}" alt="${escapeHTML(node.children?.map(child => child.value ?? child.raw).join(''))}">` : escapeHTML(node.raw);
      }
      default: return escapeHTML(node.raw);
    }
  }).join('');
}

export function renderBlock(node, document, parentIndent = 0) {
  const children = () => renderInline(node.children, document);
  switch (node.type) {
    case 'paragraph': return children();
    case 'heading': return `<h${Math.min(node.level, 6)} class="pvme-h${node.level}"${document ? ` data-section-id="${escapeHTML(node.id)}"` : ''}>${children()}</h${Math.min(node.level, 6)}>`;
    case 'blank': return '<br>';
    case 'subtext': return `<small>${children()}</small>`;
    case 'codeblock': return `<pre class="pvme-codeblock"><code>${escapeHTML(node.value)}</code></pre>`;
    case 'embed': return `<pre class="pvme-codeblock"><code>${escapeHTML(node.raw)}</code></pre>`;
    case 'blockquote': return `<div class="blockquoteContainer"><div class="blockquoteDivider"></div><blockquote>${node.children.map(block => renderBlock(block, document)).join('<br>')}</blockquote></div>`;
    case 'list': return node.items.map(item => `<div class="pvme-list-item"${document ? ` data-src-line="${item.range.start.line}"` : ''} style="padding-left:${Math.max(0, item.indent - parentIndent) / 2}ch">${escapeHTML(item.marker)} ${item.children.map(block => renderBlock(block, document, item.indent)).join('<br>')}</div>`).join('');
    case 'command': return node.valid ? '' : escapeHTML(node.raw);
    case 'unknown-command': return escapeHTML(node.raw);
    default: return escapeHTML(node.raw);
  }
}

// Embed JSON strings have no inline AST of their own. Delegate their Markdown
// to the same shared parser; only presentation and host lookups happen here.
export function renderFragment(value) {
  if (typeof value !== 'string') return '';
  const document = parseGuide(value, { validateReferences: false });
  return document.messages.flatMap(message => message.blocks).map(node => renderBlock(node)).join('<br>');
}

export function embedValues(node) {
  if (!node.valid || !node.value || typeof node.value !== 'object' || Array.isArray(node.value)) return [];
  const value = node.value;
  const embeds = Object.hasOwn(value, 'embeds') ? (Array.isArray(value.embeds) ? value.embeds : [])
    : Object.hasOwn(value, 'embed') ? [value.embed]
    : Object.hasOwn(value, 'content') ? [] : [value];
  return embeds.filter(embed => embed && typeof embed === 'object' && !Array.isArray(embed));
}

function linkPreviews(node, result = []) {
  if (node.type === 'link' && !node.suppressEmbed && safeUrl(node.url)) {
    const host = new URL(node.url).hostname.replace(/^www\.|^m\./, '');
    if (node.raw === node.url || getPresetEmbedUrl(node.url) || ['youtube.com', 'youtu.be'].includes(host)) result.push(node.url);
  }
  if (node.children) node.children.forEach(child => linkPreviews(child, result));
  if (node.items) node.items.forEach(item => item.children.forEach(child => linkPreviews(child, result)));
  return result;
}

export function renderGuide(document) {
  return projectDiscordMessages(document).map(message => ({
    ...message,
    firstEditorLine: message.range.start.line,
    lastEditorLine: message.range.end.line,
    tag: message.anchors[0]?.tag,
    lineMap: message.blocks.flatMap(block => {
      const location = { line: block.range.start.line, range: block.range };
      if (block.type === 'attachment') return [{ ...location, type: 'attachment', kind: 'direct', url: safeUrl(block.url) }];
      if (block.type === 'embed' && block.valid) {
        const content = typeof block.value?.content === 'string' ? [{ ...location, type: 'text', html: renderFragment(block.value.content) }] : [];
        const embeds = embedValues(block).map(embed => ({ ...location, type: 'embed', embed, value: block.value }));
        return content.length || embeds.length ? [...content, ...embeds] : [{ ...location, type: 'text', html: renderBlock(block, document) }];
      }
      const html = renderBlock(block, document);
      const previews = linkPreviews(block).map(url => ({ ...location, type: 'attachment', kind: 'embed', url }));
      return [...(html ? [{ ...location, type: 'text', html }] : []), ...previews];
    })
  }));
}
