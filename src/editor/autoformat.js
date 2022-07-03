import { channelsFormat, rolesFormat, emojisFormat } from './../pvmeSettings';


function formatEmojis(cm) {
    /* Format named emojis (or aliases) to emoji ID's. 
    INPUT: "text ;gbarge; more text ;greaterbarge;" 
    OUTPUT: "text <:gbarge:1234> more text <:gbarge:1234>" */
    const formattedText = cm.getValue();
    const regexp = /;([^;]+);/g;
    const results = [...formattedText.matchAll(regexp)];
    for (const result of results.reverse()) {
        const [match, name] = result;
        const emoji = emojisFormat[name.toLowerCase()];
        if (emoji) {
            const cursor = getCursorFromIndex(formattedText, result.index);
            cm.replaceRange(emoji, cursor, {line: cursor.line, ch: cursor.ch + match.length});
        }
    }
}

function formatChannels(cm) {
    /* Format named channels to channel ID's. 
    INPUT: "text ;#eD2-hydrix-drAgOns; more text" 
    OUTPUT: "text <#1234> more text" */
    const formattedText = cm.getValue();
    const regexp = /;#([^;]+);/g;
    const results = [...formattedText.matchAll(regexp)];
    for (const result of results.reverse()) {
        const [match, name] = result;
        const channelID = channelsFormat[name.toLowerCase()];
        if (channelID) {
            const cursor = getCursorFromIndex(formattedText, result.index);
            cm.replaceRange(`<#${channelID}>`, cursor, {line: cursor.line, ch: cursor.ch + match.length});
        }
    }
}

function formatRoles(cm) {
    /* Format named roles to role ID's. 
    INPUT: "text ;@&helPer; more text" 
    OUTPUT: "text <@&1234> more text" */
    const formattedText = cm.getValue();
    const regexp = /;@&([^;]+);/g;
    const results = [...formattedText.matchAll(regexp)];
    for (const result of results.reverse()) {
        const [match, name] = result;
        const roleID = rolesFormat[name.toLowerCase()];
        if (roleID) {
            const cursor = getCursorFromIndex(formattedText, result.index);
            cm.replaceRange(`<@&${roleID}>`, cursor, {line: cursor.line, ch: cursor.ch + match.length});
        }
    }
    return formattedText;
}

function formatArrows(cm) {
    let formattedText = cm.getValue();
    const regexp = /->/g;
    const results = [...formattedText.matchAll(regexp)];
    for (const result of results.reverse()) {
        const cursor = getCursorFromIndex(formattedText, result.index);
        cm.replaceRange('→', cursor, {line: cursor.line, ch: cursor.ch + result.length + 1});
    }
}

function getCursorFromIndex(text, index) {
    /* Get codemirror cursor object { line, ch } from a string index.
    INPUT: text = "hello\nworld", index = 7
    OUTPUT: {line: 1, ch: 1} */
    var perLine = text.split('\n');
    var totalLength = 0;
    for (let i = 0; i < perLine.length; i++) {
        totalLength += perLine[i].length;
        if (totalLength >= index)
            return {line: i, ch: index - (totalLength - perLine[i].length)};
        totalLength += 1;  // include '\n' 
    }
}

export default function autoformatText(cm) {
    // ordered so that there are no false results (not mandatory but faster)
    formatArrows(cm);
    formatRoles(cm);
    formatChannels(cm);
    formatEmojis(cm);
}