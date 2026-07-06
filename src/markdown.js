// src/markdown.js
//
// PVME Markdown Renderer
// -----------------------------------------------------------
// Features:
// - Reliable H1/H2/H3 support using protected tokens
// - PVME spreadsheet refs + channel aliases
// - Naked URL → attachment capture
// - Markdown link preset URLs → attachment capture
// - Clean <br>-based split for Discord-like layout
// -----------------------------------------------------------

import { toHTML, rules, htmlTag } from "@riskymh/discord-markdown";
import markdown from "simple-markdown";
import { channels, channelDetails, users, roles, pvmeSpreadsheet } from "./pvmeSettings";

let messageAttachments = [];
const DISCORD_CHANNEL_TYPE_FORUM = 15;
const PVME_DISCORD_GUILD_ID = "534508796639182860";

// -----------------------------------------------------------
// DISCORD-MARKDOWN PATCHES
// -----------------------------------------------------------

// Disable underline rules (++, +text+, +... parsing)
for (const key of Object.keys(rules)) {
    const rule = rules[key];
    if (!rule || typeof rule.match !== "function") continue;

    // Look for rules that trigger on "+"
    const src = rule.match.toString();
    if (src.includes("++") || src.includes("\\+")) {
        rule.match = () => null;   // disable underline match
    }
}

// Disable lists (PVME formats their own lists)
rules.list.html = () => "";
if (rules.list && typeof rules.list.match === "function") {
    rules.list.match = () => null;
}
if (rules.unorderedList && typeof rules.unorderedList.match === "function") {
    rules.unorderedList.match = () => null;
}

// Inline code
rules.inlineCode.html = (node, output, state) => {
    return htmlTag(
        "code",
        markdown.sanitizeText(node.content.trim()),
        { class: "inline" },
        state
    );
};

// Add title tooltip to rendered emojis
if (rules.discordEmoji) {
    rules.discordEmoji.html = (node, output, state) => {
        return htmlTag(
            "img",
            "",
            {
                class: "d-emoji" + (node.animated ? " d-emoji-animated" : ""),
                src: `https://cdn.discordapp.com/emojis/${node.id}.${node.animated ? "gif" : "png"}`,
                alt: `:${node.name}:`,
                title: `${node.name}`
            },
            state
        );
    };
}

// Capture naked URLs as attachments
rules.url.parse = capture => {
    const url = capture[1];
    messageAttachments.push(url);
    return {
        content: [{ type: "text", content: url }],
        target: url
    };
};

// -----------------------------------------------------------
// PVME CUSTOM TRANSFORMS
// -----------------------------------------------------------

// Spreadsheet lookup
function resolveSpreadsheetRefs(text) {
    const re = /\$data_pvme:([^$]+)\$/g;
    const cellRe = /^([^!]+)!([A-Za-z]+)(\d+)$/;

    return text.replace(re, (full, ref) => {
        const parsed = ref.match(cellRe);
        let value;
        if (parsed) {
            const [, sheet, col, row] = parsed;
            value = pvmeSpreadsheet?.cells?.[sheet]?.[col]?.[row];
        } else {
            value = pvmeSpreadsheet?.cell_aliases?.[ref];
        }
        return value ?? full;
    });
}

// Channel aliases
function applySpecialChannels(text) {
    return text
        .replaceAll("&lt;id:customize&gt;",
            `<span class="d-mention d-channel">#Channels & Roles</span>`
        )
        .replaceAll("&lt;id:guide&gt;",
            `<span class="d-mention d-channel">#Server Guide</span>`
        );
}

function renderChannelMention(node) {
    const id = String(node.id);
    const name = channels[id] || id;
    const channel = channelDetails[id];
    const safeName = markdown.sanitizeText(name);
    const channelText = channel?.type === DISCORD_CHANNEL_TYPE_FORUM
        ? renderChannelIcon("forum") + safeName
        : "#" + safeName;

    return htmlTag(
        "a",
        channelText,
        {
            class: "d-channel-link",
            href: `https://discord.com/channels/${PVME_DISCORD_GUILD_ID}/${id}`
        }
    );
}

function renderChannelIcon(type) {
    if (type !== "forum") return "";

    return `<svg class="d-channel-icon d-channel-icon--forum" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.75 4.25c-3.25 0-5.9 2.16-5.9 4.82 0 1.42.76 2.72 1.98 3.6l-.54 2.36a.55.55 0 0 0 .82.58l2.42-1.42c.4.07.81.11 1.22.11 3.25 0 5.9-2.16 5.9-4.82s-2.65-4.82-5.9-4.82Z" /><path fill="currentColor" d="M16.25 8.72c3.25 0 5.9 2.16 5.9 4.82 0 1.42-.76 2.72-1.98 3.6l.54 2.36a.55.55 0 0 1-.82.58l-2.42-1.42c-.4.07-.81.11-1.22.11-2.8 0-5.15-1.6-5.75-3.73 2.84-.83 4.87-2.95 4.87-5.44 0-.27-.02-.53-.07-.79.31-.06.63-.09.95-.09Z" /></svg>`;
}

function isYouTubeURL(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");
        return host === "youtu.be" || host === "youtube.com";
    } catch {
        return false;
    }
}

// -----------------------------------------------------------
// TOKEN-BASED HEADING SYSTEM
// -----------------------------------------------------------

// Before markdown → replace headings with special tokens
function protectHeadings(text) {
    return text
        .replace(/^###\s+(.*)$/gm, (_, t) => `%%PVME_H3%%${t}`)
        .replace(/^##\s+(.*)$/gm, (_, t) => `%%PVME_H2%%${t}`)
        .replace(/^#\s+(.*)$/gm, (_, t) => `%%PVME_H1%%${t}`);
}

function restoreHeadings(html) {
    return html
        .replace(/%%PVME_H1%%([\s\S]*?)(?=<br>|$)/g, `<h1 class="pvme-h1">$1</h1>`)
        .replace(/%%PVME_H2%%([\s\S]*?)(?=<br>|$)/g, `<h2 class="pvme-h2">$1</h2>`)
        .replace(/%%PVME_H3%%([\s\S]*?)(?=<br>|$)/g, `<h3 class="pvme-h3">$1</h3>`)
}


// -----------------------------------------------------------
// LINE SPLITTING
// -----------------------------------------------------------
function safeSplitLines(html) {
    const lines = [];
    let buffer = "";
    let depth = 0;

    for (let i = 0; i < html.length; i++) {
        const char = html[i];

        // Track tag depth
        if (html.startsWith("<br>", i) && depth === 0) {
            lines.push(buffer);
            buffer = "";
            i += 3;
            continue;
        }

        if (char === "<") {
            const tagEnd = html.indexOf(">", i);
            const tag = html.slice(i, tagEnd + 1);

            if (tag.startsWith("<div class=\"blockquoteContainer\"")) {
                depth++;
            } else if (tag === "</div>" && depth > 0) {
                depth--;
            }

            buffer += tag;
            i = tagEnd;
            continue;
        }

        // Only split on <br> at top level
        if (
            depth === 0 &&
            html.startsWith("<br>", i)
        ) {
            lines.push(buffer);
            buffer = "";
            i += 3;
            continue;
        }

        buffer += char;
    }

    if (buffer) {
        lines.push(buffer);
    }

    // Trim trailing empty lines
    while (lines.length > 1 && lines[lines.length - 1].trim() === "") {
        lines.pop();
    }

    // Preserve leading spaces
    return lines.map(l =>
        l.replace(/^(\s+)/, m => m.replace(/ /g, "&nbsp;"))
    );
}

// -----------------------------------------------------------
// MAIN RENDERER
// -----------------------------------------------------------
export default function markdownToHTML(input) {
    messageAttachments = [];

    if (!input.trim()) {
        return { content: "", lineMap: [], messageAttachments: [] };
    }

    // 1) PVME transforms
    let working = resolveSpreadsheetRefs(input);
    working = applySpecialChannels(working);

    // 2) Heading protection
    working = protectHeadings(working);

    // -----------------------------------------------------------
    // PREPASS: detect markdown links to preset URLs
    // -----------------------------------------------------------
    const presetLinks = [];
    working.replace(/\[([^\]]+)\]\((https:\/\/presets\.pvme\.io\/?\?id=[^)]+)\)/g,
        (m, label, url) => {
            presetLinks.push(url);
        }
    );

    // 3) Parse markdown
    let rendered = toHTML(working, {
        discordCallback: {
            channel: renderChannelMention,
            user: n => "@" + users[n.id],
            role: n => "@" + roles[n.id]
        },
        embed: true
    });

    // Remove trailing <br>
    rendered = rendered.replace(/(<br>)+$/g, "");

    // 4) Restore heading HTML
    rendered = restoreHeadings(rendered);

    // 5) Add preset / video links from markdown-link prepass
    // (Do NOT scan <a href>; avoids double-embeds)
    for (const url of presetLinks) {
        if (input.includes(`<${url}>`)) continue; // escaped with angle brackets → no embed
        messageAttachments.push(url);
    }

    working.replace(/\[([^\]]+)\]\((<?)(https?:\/\/[^)>]+)(>?)\)/g,
        (m, label, openAngle, url, closeAngle) => {
            if (openAngle || closeAngle) return;
            if (!isYouTubeURL(url)) return;
            messageAttachments.push(url);
        }
    );

    // 6) Build lineMap
    const lines = safeSplitLines(rendered);

    const lineMap = lines.map((html, i) => ({
        line: i + 1,
        html
    }));

    return {
        content: rendered,
        lineMap,
        messageAttachments
    };
}
