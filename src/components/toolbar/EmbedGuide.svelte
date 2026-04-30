<script>
    import DropdownPanel from "./DropdownPanel.svelte";
    import CaretDownFill from "svelte-bootstrap-icons/lib/CaretDownFill.svelte";
    import Clipboard from "svelte-bootstrap-icons/lib/Clipboard.svelte";
    import { text } from "../../stores";

    export let insertAtCursor;
    export let getEditorCursorPosition = () => null;
    export let replaceEditorText = null;
    export let compact = false;

    let open = false;
    let trigger;
    let showCopied = false;
    let activeSection = "properties";

    const sections = [
        { id: "properties", label: "Properties" },
        { id: "author",     label: "Author" },
        { id: "fields",     label: "Fields" },
        { id: "images",     label: "Images" },
        { id: "footer",     label: "Footer" },
        { id: "colours",    label: "Colours" },
        { id: "example",    label: "Example" },
        { id: "layout",     label: "Layout" },
    ];

    const properties = [
        { key: "title",       val: '"Your title here"',       desc: "Main heading (max 256 chars)" },
        { key: "description", val: '"Your description here"', desc: "Body text — supports markdown (max 4096 chars)" },
        { key: "url",         val: '"https://example.com"',   desc: "Makes the title a clickable link" },
        { key: "color",       val: "39423",                   desc: "Sidebar colour as decimal number" },
        { key: "timestamp",   val: '"2025-01-01T00:00:00Z"',  desc: "ISO 8601 date shown in footer" },
    ];

    const authorProps = [
        { key: "author", val: '{"name":"Author Name","url":"","icon_url":""}', desc: "Small text and icon above the title" },
    ];
    const authorSub = [
        { key: ".name",     desc: "Small text above the title" },
        { key: ".url",      desc: "Makes the author name clickable" },
        { key: ".icon_url", desc: "Small circular icon next to author name" },
    ];

    const fieldProps = [
        { key: "fields", val: '[{"name":"Field Name","value":"Field Value","inline":false}]', desc: "Array of field objects" },
    ];
    const fieldSub = [
        { key: ".name",   desc: "Field heading — bold (max 256 chars, required)" },
        { key: ".value",  desc: "Field content — supports markdown (max 1024 chars, required)" },
        { key: ".inline", desc: "true = side by side (up to 3/row), false = full width" },
    ];

    const imageProps = [
        { key: "thumbnail", val: '{"url":"https://example.com/image.png"}', desc: "Small image in the top-right corner" },
        { key: "image",     val: '{"url":"https://example.com/image.png"}', desc: "Large image at the bottom of the embed" },
    ];

    const footerProps = [
        { key: "footer", val: '{"text":"Footer text","icon_url":""}', desc: "Small text and icon at the bottom" },
    ];
    const footerSub = [
        { key: ".text",     desc: "Small text at the bottom (max 2048 chars)" },
        { key: ".icon_url", desc: "Small circular icon next to footer text" },
    ];

    const colours = [
        { name: "Red",     decimal: "15158332", hex: "#e74c3c" },
        { name: "Orange",  decimal: "15105570", hex: "#e67e22" },
        { name: "Yellow",  decimal: "15844367", hex: "#f1c40f" },
        { name: "Green",   decimal: "3066993",  hex: "#2ecc71" },
        { name: "Blue",    decimal: "3447003",  hex: "#3498db" },
        { name: "Purple",  decimal: "10181046", hex: "#9b59b6" },
        { name: "Pink",    decimal: "15277667", hex: "#e91e63" },
        { name: "White",   decimal: "16777215", hex: "#ffffff" },
        { name: "Dark",    decimal: "2829105",  hex: "#2b2d31" },
        { name: "Blurple", decimal: "5793266",  hex: "#5865f2" },
        { name: "PVME",    decimal: "39423",    hex: "#0099ff" },
    ];

    const fullExample = `{
  "embed": {
    "title": "__Section Title__",
    "description": "Section description with **markdown** support",
    "color": 39423,
    "fields": [
      {
        "name": "__Category 1__",
        "value": "Item 1\\nItem 2\\nItem 3",
        "inline": true
      },
      {
        "name": "__Category 2__",
        "value": "Item A\\nItem B\\nItem C",
        "inline": true
      }
    ],
    "thumbnail": {
      "url": "https://img.pvme.io/images/example.png"
    },
    "footer": {
      "text": "Footer text here"
    }
  }
}
.embed:json`;

    const layoutDiagram = `\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 \u2503  [author icon] Author Name             \u2502
\u2502 \u2503  Title (clickable if url set)  [thumb] \u2502
\u2502 \u2503  Description text here...      [nail]  \u2502
\u2502 \u2503                                        \u2502
\u2502 \u2503  Field 1 (inline)  Field 2   Field 3   \u2502
\u2502 \u2503  value             value     value     \u2502
\u2502 \u2503                                        \u2502
\u2502 \u2503  Field 4 (full width)                  \u2502
\u2502 \u2503  value                                 \u2502
\u2502 \u2503                                        \u2502
\u2502 \u2503  [        large image        ]         \u2502
\u2502 \u2503                                        \u2502
\u2502 \u2503  [footer icon] Footer text \u2022 timestamp \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
  \u2503 = colour sidebar`;

    function insertProperty(key, val) {
        const current = $text;
        const embedBlocks = findEmbedBlocks(current);
        const cursor = getEditorCursorPosition();

        if (embedBlocks.length === 0) {
            const template = buildNewEmbedTemplate(key, val);
            insertAtCursor(template);
            open = false;
            return;
        }

        const block = embedBlocks.find(b => cursor !== null && cursor >= b.blockStart && cursor <= b.blockEnd);

        if (!block) {
            const template = buildNewEmbedTemplate(key, val);
            insertAtCursor(template);
            open = false;
            return;
        }

        try {
            const obj = JSON.parse(block.json);
            const embed = obj.embed || obj;
            let parsed;
            try { parsed = JSON.parse(val); } catch { parsed = val; }
            embed[key] = parsed;
            if (obj.embed) obj.embed = embed;

            const newJson = JSON.stringify(obj, null, 2);
            const updated = current.substring(0, block.jsonStart) + newJson + current.substring(block.jsonEnd);
            const propertyIndex = newJson.indexOf(`${JSON.stringify(key)}:`);
            const nextCursor = propertyIndex === -1
                ? block.jsonStart
                : block.jsonStart + propertyIndex;

            if (replaceEditorText) {
                replaceEditorText(updated, nextCursor);
            } else {
                text.set(updated);
            }
        } catch {
            const snippet = `${JSON.stringify(key)}: ${val},\n    |`;
            insertAtCursor(snippet);
        }

        open = false;
    }

    function buildNewEmbedTemplate(key, val) {
        return `\n.\n{\n  "embed": {\n    ${JSON.stringify(key)}: ${val}\n  }\n}\n.embed:json\n|`;
    }

    function insertColour(decimal) {
        insertProperty("color", decimal);
    }

    function findEmbedBlocks(src) {
        const lines = src.split('\n');
        const blocks = [];
        let inEmbed = false;
        let embedLines = [];
        let embedStartChar = 0;
        let charPos = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (inEmbed) {
                embedLines.push(line);
                const joined = embedLines.join('\n');
                try {
                    JSON.parse(joined);
                    blocks.push({
                        json: joined,
                        jsonStart: embedStartChar,
                        jsonEnd: charPos + line.length,
                        blockStart: embedStartChar,
                        blockEnd: charPos + line.length
                    });
                    inEmbed = false;
                    embedLines = [];
                } catch { /* keep collecting */ }
                charPos += line.length + 1;
                continue;
            }

            if (trimmed === '.embed:json') {
                const lastBlock = blocks[blocks.length - 1];
                if (lastBlock) {
                    lastBlock.blockEnd = charPos + line.length;
                }
                charPos += line.length + 1;
                continue;
            }

            if (trimmed.startsWith('{') && !inEmbed) {
                embedStartChar = charPos;
                try {
                    JSON.parse(trimmed);
                    blocks.push({
                        json: trimmed,
                        jsonStart: charPos,
                        jsonEnd: charPos + line.length,
                        blockStart: charPos,
                        blockEnd: charPos + line.length
                    });
                } catch {
                    inEmbed = true;
                    embedLines = [line];
                    embedStartChar = charPos;
                }
                charPos += line.length + 1;
                continue;
            }

            charPos += line.length + 1;
        }

        return blocks;
    }

    async function copyExample() {
        await navigator.clipboard.writeText(fullExample);
        showCopied = true;
        setTimeout(() => { showCopied = false; }, 1500);
    }
</script>

<div class="relative inline-block">
    <button
        bind:this={trigger}
        class="{compact ? 'w-full justify-between' : ''} toolbar-btn rounded"
        on:click={() => open = !open}
    >
        JSON Assistant&nbsp;<CaretDownFill class="mt-1" />
    </button>

    <DropdownPanel
        {open}
        close={() => open = false}
        width="45vw"
        bind:registerTrigger={trigger}
    >
        <div class="grid grid-cols-[12rem_1fr] w-full">

            <div class="flex flex-col text-sm p-3 w-full gap-1">
                {#each sections as s}
                    <button
                        class="toolbar-submenu-option {activeSection === s.id ? 'toolbar-submenu-option-active' : ''}"
                        on:click={() => activeSection = s.id}
                    >
                        {s.label}
                    </button>
                {/each}
            </div>

            <div class="p-3 pl-0 overflow-auto" style="max-height: 60vh;">

                {#if activeSection === "properties"}
                    <div class="text-sm text-slate-300 mb-3">
                        Top-level embed properties. Place your cursor inside an embed JSON block, then click <strong class="text-blue-300">Insert</strong> to update that embed.
                    </div>
                    {#each properties as p}
                        <div class="flex items-center gap-3 p-2 rounded mb-1 bg-slate-800">
                            <code class="text-blue-300 font-mono text-xs min-w-[7rem]">"{p.key}"</code>
                            <span class="text-slate-400 text-xs flex-1">{p.desc}</span>
                            <button
                                class="toolbar-menu-option whitespace-nowrap text-xs"
                                on:click={() => insertProperty(p.key, p.val)}
                            >Insert</button>
                        </div>
                    {/each}
                {/if}

                {#if activeSection === "author"}
                    <div class="text-sm text-slate-300 mb-3">Author block — small text and icon above the title.</div>
                    {#each authorProps as p}
                        <div class="flex items-center gap-3 p-2 rounded mb-1 bg-slate-800">
                            <code class="text-blue-300 font-mono text-xs min-w-[7rem]">"{p.key}"</code>
                            <span class="text-slate-400 text-xs flex-1">{p.desc}</span>
                            <button
                                class="toolbar-menu-option whitespace-nowrap text-xs"
                                on:click={() => insertProperty(p.key, p.val)}
                            >Insert</button>
                        </div>
                    {/each}
                    {#each authorSub as s}
                        <div class="flex items-center gap-3 p-2 rounded mb-1 ml-4">
                            <code class="text-slate-400 font-mono text-xs min-w-[7rem]">{s.key}</code>
                            <span class="text-slate-500 text-xs flex-1">{s.desc}</span>
                        </div>
                    {/each}
                {/if}

                {#if activeSection === "fields"}
                    <div class="text-sm text-slate-300 mb-3">Fields — a grid of labelled sections inside the embed.</div>
                    {#each fieldProps as p}
                        <div class="flex items-center gap-3 p-2 rounded mb-1 bg-slate-800">
                            <code class="text-blue-300 font-mono text-xs min-w-[7rem]">"{p.key}"</code>
                            <span class="text-slate-400 text-xs flex-1">{p.desc}</span>
                            <button
                                class="toolbar-menu-option whitespace-nowrap text-xs"
                                on:click={() => insertProperty(p.key, p.val)}
                            >Insert</button>
                        </div>
                    {/each}
                    {#each fieldSub as s}
                        <div class="flex items-center gap-3 p-2 rounded mb-1 ml-4">
                            <code class="text-slate-400 font-mono text-xs min-w-[7rem]">{s.key}</code>
                            <span class="text-slate-500 text-xs flex-1">{s.desc}</span>
                        </div>
                    {/each}
                {/if}

                {#if activeSection === "images"}
                    <div class="text-sm text-slate-300 mb-3">Image properties for embeds.</div>
                    {#each imageProps as p}
                        <div class="flex items-center gap-3 p-2 rounded mb-1 bg-slate-800">
                            <code class="text-blue-300 font-mono text-xs min-w-[7rem]">"{p.key}"</code>
                            <span class="text-slate-400 text-xs flex-1">{p.desc}</span>
                            <button
                                class="toolbar-menu-option whitespace-nowrap text-xs"
                                on:click={() => insertProperty(p.key, p.val)}
                            >Insert</button>
                        </div>
                    {/each}
                {/if}

                {#if activeSection === "footer"}
                    <div class="text-sm text-slate-300 mb-3">Footer — small text and icon at the bottom of the embed.</div>
                    {#each footerProps as p}
                        <div class="flex items-center gap-3 p-2 rounded mb-1 bg-slate-800">
                            <code class="text-blue-300 font-mono text-xs min-w-[7rem]">"{p.key}"</code>
                            <span class="text-slate-400 text-xs flex-1">{p.desc}</span>
                            <button
                                class="toolbar-menu-option whitespace-nowrap text-xs"
                                on:click={() => insertProperty(p.key, p.val)}
                            >Insert</button>
                        </div>
                    {/each}
                    {#each footerSub as s}
                        <div class="flex items-center gap-3 p-2 rounded mb-1 ml-4">
                            <code class="text-slate-400 font-mono text-xs min-w-[7rem]">{s.key}</code>
                            <span class="text-slate-500 text-xs flex-1">{s.desc}</span>
                        </div>
                    {/each}
                {/if}

                {#if activeSection === "colours"}
                    <div class="text-sm text-slate-300 mb-3">
                        Place your cursor inside an embed JSON block, then click a colour to set it on that embed. Convert hex at
                        <a href="https://www.binaryhexconverter.com/hex-to-decimal-converter"
                           target="_blank" class="text-blue-400 hover:underline">binaryhexconverter.com</a>.
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        {#each colours as c}
                            <button
                                class="flex items-center gap-2 p-2 rounded bg-slate-800 hover:bg-slate-600 transition-colors"
                                on:click={() => insertColour(c.decimal)}
                            >
                                <span class="w-4 h-4 rounded flex-shrink-0" style="background:{c.hex}{c.name === 'Dark' ? ';border:1px solid #555' : ''}"></span>
                                <span class="text-slate-300 text-sm">{c.name}</span>
                                <code class="text-slate-500 text-xs ml-auto font-mono">{c.decimal}</code>
                            </button>
                        {/each}
                    </div>
                {/if}

                {#if activeSection === "example"}
                    <div class="text-sm text-slate-300 mb-3">A full embed example you can copy into your guide.</div>
                    <pre class="overflow-auto bg-slate-800 p-3 rounded text-sm whitespace-pre-wrap break-words text-slate-300"
                         style="max-height: 45vh;">{fullExample}</pre>
                    <div class="flex items-center mt-2">
                        <button
                            class="toolbar-btn rounded"
                            on:click={copyExample}
                        >
                            <Clipboard />&nbsp;Copy
                        </button>
                        {#if showCopied}
                            <span class="ml-2 text-sm">Copied</span>
                        {/if}
                    </div>
                {/if}

                {#if activeSection === "layout"}
                    <div class="text-sm text-slate-300 mb-3">Visual layout of an embed in Discord.</div>
                    <pre class="overflow-auto bg-slate-800 p-3 rounded text-xs font-mono text-slate-400 whitespace-pre">{layoutDiagram}</pre>
                {/if}

            </div>
        </div>
    </DropdownPanel>
</div>
