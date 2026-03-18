<script>

    import DropdownPanel from "./DropdownPanel.svelte";
    import Button from "./Button.svelte";
    import CaretDownFill from "svelte-bootstrap-icons/lib/CaretDownFill.svelte";
    import Clipboard from "svelte-bootstrap-icons/lib/Clipboard.svelte";
    import { text } from "../../stores";

    import {
        bossGuide,
        afkGuide,
        slayerGuide,
        embedTextFormatting,
        commandTemplate
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

    async function copyPreview() {
        await navigator.clipboard.writeText(preview);
        showCopied = true;
    }

    // Initialise
    setTemplate(bossGuide)

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
        bind:registerTrigger={trigger}
    >
        <div class="grid grid-cols-[12rem_1fr] w-full">

            <!-- LEFT SIDEBAR -->
            <div class="flex flex-col text-sm p-3 w-full gap-4">

                <!-- Guides -->
                <div>
                    <div class="font-semibold mb-2 text-indigo-200">Guides</div>

                    <div class="flex flex-col">
                        <button
                            class="group-btn rounded-t-md"
                            on:click={() => setTemplate(bossGuide)}>
                            Boss Guide
                        </button>

                        <button
                            class="group-btn border-t-0"
                            on:click={() => setTemplate(afkGuide)}>
                            AFK Guide
                        </button>

                        <button
                            class="group-btn border-t-0 rounded-b-md"
                            on:click={() => setTemplate(slayerGuide)}>
                            Slayer Guide
                        </button>
                    </div>
                </div>

                <!-- Embeds -->
                <div>
                    <div class="font-semibold mb-2 text-indigo-200">Embeds</div>

                    <div class="flex flex-col">
                        <button
                            class="group-btn rounded-t-md"
                            on:click={() => setTemplate(commandTemplate)}>
                            Command
                        </button>

                        <button
                            class="group-btn rounded-t-md"
                            on:click={() => setTemplate(embedTextFormatting)}>
                            Embed
                        </button>

                        <button
                            class="group-btn border-t-0"
                            on:click={generateCompact}>
                            Compact ToC
                        </button>

                        <button
                            class="group-btn border-t-0 rounded-b-md"
                            on:click={generateCategorised}>
                            Categorised ToC
                        </button>
                    </div>
                </div>

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
