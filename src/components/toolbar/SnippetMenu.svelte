<script>
    import DropdownPanel from "./DropdownPanel.svelte";
    import CaretDownFill from "svelte-bootstrap-icons/lib/CaretDownFill.svelte";
    import { disclaimer } from "./templateData.js";

    export let insertAtCursor;

    let open = false;
    let trigger;

    // Each snippet now contains "|"
    // Cursor will land at that spot.
    const snippets = [
        { label: "Disclaimer", snippet: disclaimer },
        { label: ".", snippet: ".|" },
        { label: ".img:", snippet: ".img:|" },
        { label: ".tag:", snippet: ".tag:|" },
        { label: ".embed:json", snippet: ".embed:json|" },
        { label: "linkmsg", snippet: "$linkmsg_tagword$|" },
        { label: "PvME Spreadsheet Reference", snippet: "$data_pvme:sheet!A1$|" },
    ];


    function pick(snippet) {
        insertAtCursor("\n" + snippet);
        open = false;
    }
</script>

<div class="relative inline-block">
    <button
        bind:this={trigger}
        class="inline-flex items-center rounded bg-indigo-600 hover:bg-indigo-700
               text-white px-4 py-2 text-sm border border-indigo-700"
        on:click={() => open = !open}
    >
        Snippets&nbsp;<CaretDownFill class="mt-1" />
    </button>

    <DropdownPanel
        {open}
        close={() => open = false}
        width="220px"
        centered={false}
        bind:registerTrigger={trigger}
    >
        <div class="flex flex-col p-3 text-sm w-full">
            {#each snippets as item}
                <button
                    class="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
                           border border-indigo-700 p-2 text-left rounded mb-1"
                    on:click={() => pick(item.snippet)}
                >
                    {item.label}
                </button>
            {/each}
        </div>
    </DropdownPanel>
</div>