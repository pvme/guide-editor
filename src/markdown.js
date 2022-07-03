import { toHTML, rules, htmlTag } from 'discord-markdown';
import { channels, users, roles, pvmeSpreadsheet } from './constants/discord';
import markdown from 'simple-markdown';


/* Overide blockquote formatting to use discord format. 
FROM:
<blockquote>text<br>more text</blockquote>

TO:
<div class="blockquoteContainer">
    <div class="blockquoteDivider"></div><blockquote>text<br>more text</blockquote>
</div> */
rules.blockQuote.html = (node, output, state) => {
    // todo: make sure output(node.content, state) is correct
    const blockQuote = htmlTag('blockquote', output(node.content, state), null, state);
    const divider = '<div class="blockquoteDivider"></div>' + blockQuote;
    return htmlTag('div', divider, {class: 'blockquoteContainer'}, state);
}

/* Overide inline code formatting to use discord format.
FROM:
<code>text</code>

TO:
<code class="inline">text</code> */
rules.inlineCode.html  = (node, output, state) => {
    return htmlTag('code', markdown.sanitizeText(node.content.trim()), { class: 'inline' }, state);
}

// add attachmentUrls for links not contained in <url>
let messageAttachments = [];

rules.url.parse = capture => {
    messageAttachments.push(capture[1]);
    return {
        content: [{
            type: 'text',
            content: capture[1]
        }],
        target: capture[1]
    };
}


String.prototype.replaceAt = function(startIndex, replacement, endIndex) {
    return this.substring(0, startIndex) + replacement + this.substring(endIndex);
}

function formatPVMESpreadsheet(originalContent) {
    // known bug: currently formats prices in code blocks
    let content = originalContent;
    const regexp = /\$data_pvme:([^!]+)!([a-zA-Z]{1})([^$]+)\$/g;
    const results = [...content.matchAll(regexp)];
    for (const result of results.reverse()) {
        const [pvmeFormat, worksheet, col, row] = result;
        const startIndex = result.index;
        const endIndex = startIndex + pvmeFormat.length;
        const cellValue = pvmeSpreadsheet?.[worksheet]?.[col]?.[row];
        if (cellValue)
            content = content.replaceAt(startIndex, cellValue, endIndex);
    }
    return content;
}

export default function markdownToHTML(messageContent, embed=false) {
    // todo: linkmsg formatting
    messageAttachments = [];

    // convert discord markdown to HTML
    let content = toHTML(messageContent, {
        discordCallback: {
            channel: node => '#' + channels[node.id],
            user: node => '@' + users[node.id],
            role: node => '@' + roles[node.id]
        },
        embed: embed    // allow for named links: [name](url)
    });
       
    content = formatPVMESpreadsheet(content);
    return { content, messageAttachments };
}