<script>
    import DropdownPanel from "./DropdownPanel.svelte";
    import CaretDownFill from "svelte-bootstrap-icons/lib/CaretDownFill.svelte";
    import Clipboard from "svelte-bootstrap-icons/lib/Clipboard.svelte";
    import { text } from "../../stores";
    import {
        afkGuide,
        bossGuide,
        commandTemplate,
        disclaimer,
        embedTextFormatting,
        slayerGuide
    } from "./templateData";

    export let insertAtCursor;

    let open = false;
    let trigger;
    let showCopied = false;

    const snippets = [
        { label: "Disclaimer", value: disclaimer, insertPrefix: "\n" },
        { label: ".img:", value: ".img:|", insertPrefix: "\n" },
        { label: ".tag:", value: ".tag:|", insertPrefix: "\n" },
        { label: "linkmsg", value: "$linkmsg_tagword$|", insertPrefix: "\n" },
        { label: "PvME Spreadsheet Reference", value: "$data_pvme:sheet!A1$|", insertPrefix: "\n" }
    ];

    const guideTemplates = [
        { label: "Boss Guide", value: bossGuide },
        { label: "AFK Guide", value: afkGuide },
        { label: "Slayer Guide", value: slayerGuide }
    ];

    const embedTemplates = [
        { label: "Command", value: commandTemplate },
        { label: "Embed", value: embedTextFormatting },
        { label: "Compact ToC", build: () => buildToC("compact") },
        { label: "Categorised ToC", build: () => buildToC("categorised") }
    ];

    let activeItem = guideTemplates[0];

    $: preview = getItemValue(activeItem);

    function getItemValue(item) {
        if (!item) return "";
        return item.build ? item.build() : item.value;
    }

    function selectTemplate(item) {
        activeItem = item;
        showCopied = false;
    }

    function insertTemplate() {
        insertAtCursor((activeItem.insertPrefix ?? "\n") + preview);
        open = false;
    }

    async function copyPreview() {
        await navigator.clipboard.writeText(preview.replace("|", ""));
        showCopied = true;
    }

    function buildToC(mode) {
        const chapters = [...$text.matchAll(/\n.tag:([^\n]+)/g)];
        const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

        const formatted = chapters
            .map(c => `⬥ [${cap(c[1])}]($linkmsg_${c[1]}$)`)
            .join("\\n");

        if (mode === "compact") {
            return `{
  "embed": {
    "title": "__Table of Contents__",
    "description": "*To edit this guide in our web editor [click here](<https://pvme.io/guide-editor/?id={{channel:id}}>), or visit <id:customize> and select Entry Editor*\\n${formatted}",
    "color": 39423
  }
}
.embed:json
.pin:delete`;
        }

        return `{
  "embed": {
    "title": "__Table of Contents__",
    "description": "*To edit this guide in our web editor [click here](<https://pvme.io/guide-editor/?id={{channel:id}}>), or visit <id:customize> and select Entry Editor*",
    "color": 39423,
    "fields": [
      {
        "name": "__Category__",
        "value": "${formatted}",
        "inline": true
      }
    ]
  }
}
.embed:json
.pin:delete`;
    }
</script>

<div class="relative inline-block">
    <button
        bind:this={trigger}
        class="toolbar-btn rounded"
        on:click={() => open = !open}
    >
        Templates&nbsp;<CaretDownFill class="mt-1" />
    </button>

    <DropdownPanel
        {open}
        close={() => open = false}
        width="60vw"
        centered={false}
        bind:registerTrigger={trigger}
    >
        <div class="grid grid-cols-[20%_80%] w-full">
            <div class="flex max-h-[68vh] flex-col gap-3 overflow-auto p-3 text-sm w-full">
                <div>
                    <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                        Guide Templates
                    </div>
                    <div class="grid grid-cols-1 gap-1">
                        {#each guideTemplates as item}
                            <button
                                class="toolbar-submenu-option {activeItem === item ? 'toolbar-submenu-option-active' : ''}"
                                on:click={() => selectTemplate(item)}
                            >
                                {item.label}
                            </button>
                        {/each}
                    </div>
                </div>

                <div>
                    <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                        Snippets
                    </div>
                    <div class="grid grid-cols-1 gap-1">
                        {#each snippets as item}
                            <button
                                class="toolbar-submenu-option {activeItem === item ? 'toolbar-submenu-option-active' : ''}"
                                on:click={() => selectTemplate(item)}
                            >
                                {item.label}
                            </button>
                        {/each}
                    </div>
                </div>

                <div>
                    <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                        Embeds
                    </div>
                    <div class="grid grid-cols-1 gap-1">
                        {#each embedTemplates as item}
                            <button
                                class="toolbar-submenu-option {activeItem === item ? 'toolbar-submenu-option-active' : ''}"
                                on:click={() => selectTemplate(item)}
                            >
                                {item.label}
                            </button>
                        {/each}
                    </div>
                </div>
            </div>

            <div class="flex min-w-0 flex-col p-3 pl-0">
                <pre class="h-[60vh] overflow-auto rounded bg-slate-800 p-3 text-sm whitespace-pre-wrap break-words text-slate-100">{preview}</pre>

                <div class="mt-2 flex items-center gap-2">
                    <button
                        class="toolbar-btn rounded"
                        on:click={insertTemplate}
                    >
                        Insert
                    </button>

                    <button
                        class="toolbar-btn rounded"
                        on:click={copyPreview}
                    >
                        <Clipboard />&nbsp;Copy
                    </button>

                    {#if showCopied}
                        <span class="text-sm text-slate-300">Copied</span>
                    {/if}
                </div>
            </div>
        </div>
    </DropdownPanel>
</div>
