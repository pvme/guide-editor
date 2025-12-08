<script>

    import DropdownPanel from "./DropdownPanel.svelte";
    import Button from "./Button.svelte";
    import CaretDownFill from "svelte-bootstrap-icons/lib/CaretDownFill.svelte";
    import Clipboard from "svelte-bootstrap-icons/lib/Clipboard.svelte";
    import { text } from "../../stores";

    import {
        guide,
        afkGuide,
        slayerGuide,
        embedTextFormatting
    } from "./templateData";

    let open = false;
    let trigger;
    let preview = "";
    let showCopied = false;

    function setTemplate(t) {
        preview = t;
        showCopied = false;
    }

    function generateCompact() {
        preview = buildToC("compact");
        showCopied = false;
    }

    function generateCategorised() {
        preview = buildToC("categorised");
        showCopied = false;
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
    "description": "*To edit this guide…*\\n${formatted}",
    "color": 39423
  }
}
.embed:json
.pin:delete`;
        }

        return `{
  "embed": {
    "title": "__Table of Contents__",
    "description": "*To edit this guide…*",
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

    async function copyPreview() {
        await navigator.clipboard.writeText(preview);
        showCopied = true;
    }

    // Initialise
    setTemplate(guide)

</script>
<div class="relative inline-block">
    <button
        bind:this={trigger}
        class="inline-flex items-center rounded bg-indigo-600 hover:bg-indigo-700
               text-white px-4 py-2 text-sm border border-indigo-700"
        on:click={() => open = !open}
    >
        Template&nbsp;<CaretDownFill class="mt-1" />
    </button>

    <DropdownPanel
        {open}
        close={() => open = false}
        width="55vw"
        centered={true}
        bind:registerTrigger={trigger}
    >
        <div class="grid grid-cols-[12rem_1fr] w-full">

            <!-- LEFT SIDEBAR -->
            <div class="flex flex-col text-sm p-3 w-full">

                <div class="font-semibold mb-1">Guides</div>

                <button class="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
                               border border-indigo-700 p-2 rounded"
                    on:click={() => setTemplate(guide)}>
                    Full Guide
                </button>

                <button class="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
                               border border-indigo-700 p-2 rounded"
                    on:click={() => setTemplate(afkGuide)}>
                    AFK Guide
                </button>

                <button class="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
                               border border-indigo-700 p-2 rounded"
                    on:click={() => setTemplate(slayerGuide)}>
                    Slayer Guide
                </button>

                <div class="border-t border-indigo-800 my-2"></div>

                <div class="font-semibold mb-1">Embeds</div>


                <button class="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
                               border border-indigo-700 p-2 rounded"
                    on:click={() => setTemplate(embedTextFormatting)}>
                    Embed
                </button>

                <button class="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
                               border border-indigo-700 p-2 rounded"
                    on:click={generateCompact}>
                    Compact ToC
                </button>

                <button class="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
                               border border-indigo-700 p-2 rounded"
                    on:click={generateCategorised}>
                    Categorised ToC
                </button>

            </div>

            <!-- PREVIEW PANEL -->
            <div class="flex flex-col flex-grow p-3 pl-0">
                <pre class="overflow-auto bg-slate-800 p-3 rounded text-sm whitespace-pre-wrap break-words"
                     style="height: 60vh;">
{preview}
                </pre>

                <div class="flex items-center mt-2">
                    <Button on:click={copyPreview} corner="rounded" title="Copy to clipboard">
                        <Clipboard /> &nbsp;Copy
                    </Button>

                    {#if showCopied}
                        <span class="ml-2">☑️ Copied</span>
                    {/if}
                </div>
            </div>

        </div>
    </DropdownPanel>
</div>
