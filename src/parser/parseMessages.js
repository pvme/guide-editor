// src/parser/parseMessages.js
//
// PVME Message Parser (with fenced code block support)
// -----------------------------------------------------------
// Produces fully structured messages with correct ordering:
//
// [
//   {
//     rawParts: [
//       { type:"text", raw, editorLine },
//       { type:"attachment", url, editorLine },
//       { type:"embed", embedObj, editorLine },
//       { type:"codeblock", raw, editorLine }   ← NEW
//     ],
//     lineMap: [
//       { type:"text"/"attachment"/"embed", html/url/embed, line }
//     ]
//   }
// ]
//
// -----------------------------------------------------------

import markdownToHTML from "../markdown.js";

export function parseMessages(rawText) {
    const lines = rawText.split("\n");
    const messages = [];

    let current = createMessage(1);
    let insideEmbed = false;
    let embedBuffer = [];

    // NEW: fenced code block state
    let insideFence = false;
    let fenceBuffer = [];

    // -----------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------
    function escapeHTML(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function createMessage(startLine) {
        return {
            rawParts: [],
            embed: null,
            tag: null,
            pin: null,
            react: [],
            isBlank: false,
            firstEditorLine: startLine,
            lastEditorLine: startLine,
            lineMap: []
        };
    }

    function extractEmbed(obj) {
        if (!obj) return null;
        if (obj.embed) return obj.embed;
        if (obj.embeds && obj.embeds[0]) return obj.embeds[0];
        return obj;
    }

    // -----------------------------------------------------------
    // FINALIZE message → convert rawParts → lineMap
    // -----------------------------------------------------------
    function finalize() {
        if (current.rawParts.length === 0 && !current.embed) return;

        const lineMap = [];
        let ln = 1;

        for (const part of current.rawParts) {

            // ---------------- TEXT ----------------
            if (part.type === "text") {
                const rendered = markdownToHTML(part.raw);

                for (const entry of rendered.lineMap) {
                    lineMap.push({
                        type: "text",
                        html: entry.html,
                        line: ln++
                    });
                }

                // naked URL attachments
                for (const url of rendered.messageAttachments) {
                    lineMap.push({
                        type: "attachment",
                        url,
                        line: ln++
                    });
                }
            }

            // ---------------- CODE BLOCK (NEW) ----------------
            else if (part.type === "codeblock") {
                lineMap.push({
                    type: "text",
                    html: `<pre class="pvme-codeblock"><code>${escapeHTML(
                        part.raw
                    )}</code></pre>`,
                    line: ln++
                });
            }

            // ---------------- INLINE ATTACHMENT ----------------
            else if (part.type === "attachment") {
                lineMap.push({
                    type: "attachment",
                    url: part.url,
                    line: ln++
                });
            }

            // ---------------- EMBED ----------------
            else if (part.type === "embed") {
                lineMap.push({
                    type: "embed",
                    embed: part.embed,
                    line: ln++
                });
            }
        }

        // Embed that belongs to whole message
        if (current.embed && !current.rawParts.some(p => p.type === "embed")) {
            lineMap.push({
                type: "embed",
                embed: current.embed,
                line: ln++
            });
        }

        current.lineMap = lineMap;
        messages.push(current);
    }

    // -----------------------------------------------------------
    // MAIN PARSE LOOP
    // -----------------------------------------------------------
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const trimmed = raw.trim();
        const lineNum = i + 1;

        current.lastEditorLine = lineNum;

        // -------------------------------------------------------
        // FENCED CODE BLOCKS (``` ... ```)
        // -------------------------------------------------------
        if (trimmed.startsWith("```")) {
            if (!insideFence) {
                // Opening fence → enter fence mode
                insideFence = true;
                fenceBuffer = [];
            } else {
                // Closing fence → push block to rawParts
                insideFence = false;

                current.rawParts.push({
                    type: "codeblock",
                    raw: fenceBuffer.join("\n"),
                    editorLine: lineNum
                });

                fenceBuffer = [];
            }
            continue;
        }

        // Inside fenced block → collect raw lines
        if (insideFence) {
            fenceBuffer.push(raw);
            continue;
        }

        // -------------------------------------------------------
        // EMBED JSON MODE
        // -------------------------------------------------------
        if (insideEmbed) {
            if (trimmed === ".embed:json") {
                insideEmbed = false;

                let json = embedBuffer.join("\n");

                // Normalize control chars
                json = json.replace(
                    /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\uFEFF]/g,
                    ""
                );
                json = json.replace(
                    /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g,
                    " "
                );
                json = json.replace(
                    /"((?:[^"\\]|\\.)*)\n((?:[^"\\]|\\.)*)"/g,
                    (m, a, b) => `"${a}\\n${b}"`
                );

                try {
                    const parsed = JSON.parse(json);
                    const embedObj = extractEmbed(parsed);

                    current.rawParts.push({
                        type: "embed",
                        embed: embedObj,
                        editorLine: lineNum
                    });
                } catch (e) {
                    console.warn("[parseMessages] JSON embed parse failed:", e, json);
                }

                embedBuffer = [];
                continue;
            }

            embedBuffer.push(raw);
            continue;
        }

        // START EMBED JSON CAPTURE
        if (trimmed.startsWith("{")) {
            insideEmbed = true;
            embedBuffer = [raw];
            continue;
        }

        // ESCAPED DOT
        if (raw.startsWith("..")) {
            current.rawParts.push({
                type: "text",
                raw: raw.slice(1),
                editorLine: lineNum
            });
            continue;
        }

        // -------------------------------------------------------
        // DOT COMMANDS (.img, .file, .tag, .react, etc.)
        // -------------------------------------------------------
        if (raw.startsWith(".")) {
            const cmd = trimmed.match(/^\.([a-zA-Z]+):(.*)$/);

            if (trimmed === ".") {
                finalize();
                current = createMessage(lineNum + 1);
                continue;
            }

            if (cmd) {
                const base = cmd[1];
                const param = cmd[2].trim();

                switch (base) {
                    case "blank":
                        finalize();
                        current = createMessage(lineNum + 1);
                        current.isBlank = true;
                        continue;

                    case "img":
                    case "file":
                        if (param) {
                            current.rawParts.push({
                                type: "attachment",
                                url: param,
                                editorLine: lineNum
                            });
                        }
                        continue;

                    case "tag":
                        current.tag = param;
                        continue;

                    case "pin":
                        current.pin = param;
                        continue;

                    case "react":
                        current.react.push(param);
                        continue;

                    case "embed":
                        continue;
                }

                continue;
            }

            continue;
        }

        // BLANK LINE
        if (!trimmed) {
            current.rawParts.push({
                type: "text",
                raw: "",
                editorLine: lineNum
            });
            continue;
        }

        // NORMAL TEXT
        if (!current.rawParts.some(p => p.editorLine === lineNum)) {
            current.firstEditorLine = Math.min(current.firstEditorLine, lineNum);
        }

        current.rawParts.push({
            type: "text",
            raw,
            editorLine: lineNum
        });
    }

    finalize();
    return messages;
}
