<script>
    import { onMount, onDestroy } from "svelte";

    export let open = false;
    export let close;
    export let width = "45vw";
    export let centered = false;

    let panelEl;

    // IMPORTANT: bindable prop, not a function
    export let registerTrigger = null;

    let triggerEl;

    // reactively update triggerEl when parent binds it
    $: triggerEl = registerTrigger;

    function handleClickOutside(e) {
        if (!open) return;

        const path = e.composedPath();

        const inPanel = panelEl && path.includes(panelEl);
        const inTrigger = triggerEl && path.includes(triggerEl);

        if (inTrigger) return;   // allow toggle

        if (!inPanel) close();
    }

    function handleEscape(e) {
        if (e.key === "Escape" && open) close();
    }

    onMount(() => {
        document.addEventListener("click", handleClickOutside, true);
        document.addEventListener("keydown", handleEscape);
    });

    onDestroy(() => {
        document.removeEventListener("click", handleClickOutside, true);
        document.removeEventListener("keydown", handleEscape);
    });
</script>

{#if open}
    <div class="relative">

        <div
            class="absolute z-30 w-0 h-0
                   border-l-8 border-l-transparent
                   border-r-8 border-r-transparent
                   border-b-8 border-b-slate-700"
            style={centered
                ? "top: calc(100% + 4px); left: 50%; transform: translateX(-50%);"
                : "top: calc(100% + 4px); left: 1rem;"
            }
        />

        <div
            bind:this={panelEl}
            class="absolute z-20 rounded border border-slate-800 text-white flex
                   shadow-[0_8px_24px_rgba(0,0,0,0.45)] bg-slate-700"
            style={centered
                ? `width:${width}; left:50%; transform:translateX(-50%); top: calc(100% + 10px);`
                : `width:${width}; left:0; top: calc(100% + 10px);`
            }
        >
            <slot/>
        </div>
    </div>
{/if}
