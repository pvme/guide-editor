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
import { channels, users, roles, pvmeSpreadsheet } from "./pvmeSettings";

let messageAttachments = [];

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

// PVME blockquote
rules.blockQuote.html = (node, output, state) => {
    const inner = output(node.content, state);
    const block = htmlTag("blockquote", inner, null, state);
    const divider = `<div class="blockquoteDivider"></div>${block}`;
    return htmlTag("div", divider, { class: "blockquoteContainer" }, state);
};

// Inline code
rules.inlineCode.html = (node, output, state) => {
    return htmlTag(
        "code",
        markdown.sanitizeText(node.content.trim()),
        { class: "inline" },
        state
    );
};

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

// After markdown → convert tokens to HTML
function restoreHeadings(html) {
    return html
        .replace(/%%PVME_H1%%(.*?)(<br>|$)/g, `<h1 class="pvme-h1">$1</h1>$2`)
        .replace(/%%PVME_H2%%(.*?)(<br>|$)/g, `<h2 class="pvme-h2">$1</h2>$2`)
        .replace(/%%PVME_H3%%(.*?)(<br>|$)/g, `<h3 class="pvme-h3">$1</h3>$2`);
}

// -----------------------------------------------------------
// LINE SPLITTING
// -----------------------------------------------------------
function safeSplitLines(html) {
    const raw = html.split("<br>");

    // remove trailing blanks
    while (raw.length > 1 && raw[raw.length - 1].trim() === "") {
        raw.pop();
    }

    // convert leading spaces → &nbsp;
    return raw.map(l =>
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
    working.replace(/\[([^\]]+)\]\((https:\/\/presets\.pvme\.io\/\?id=[^)]+)\)/g,
        (m, label, url) => {
            presetLinks.push(url);
        }
    );

    // 3) Parse markdown
    let rendered = toHTML(working, {
        discordCallback: {
            channel: n => "#" + channels[n.id],
            user: n => "@" + users[n.id],
            role: n => "@" + roles[n.id]
        },
        embed: true
    });

    // Remove trailing <br>
    rendered = rendered.replace(/(<br>)+$/g, "");

    // 4) Restore heading HTML
    rendered = restoreHeadings(rendered);

    // 5) Add preset links from markdown-link prepass
    // (Do NOT scan <a href>; avoids double-embeds)
    for (const url of presetLinks) {
        if (input.includes(`<${url}>`)) continue; // escaped with angle brackets → no embed
        messageAttachments.push(url);
    }

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
