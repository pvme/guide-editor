<script>
    import DropdownPanel from "./DropdownPanel.svelte";
    import CaretDownFill from "svelte-bootstrap-icons/lib/CaretDownFill.svelte";
    import { styleGuide } from "../../pvmeSettings";

    export let compact = false;

    let open = false;
    let trigger;
</script>

<div class="relative inline-block">
    <button
        bind:this={trigger}
        class="{compact ? 'w-full justify-between' : ''} toolbar-btn rounded"
        on:click={() => open = !open}
    >
        Style Guide&nbsp;<CaretDownFill class="mt-1" />
    </button>

    <DropdownPanel
        {open}
        close={() => open = false}
        width="55vw"
        bind:registerTrigger={trigger}
    >
        <div class="p-4 w-full">
            <pre class="overflow-auto bg-slate-800 p-4 rounded text-sm whitespace-pre-wrap break-words"
                 style="height: 60vh;">
{styleGuide}
            </pre>
        </div>
    </DropdownPanel>
</div>
