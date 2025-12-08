<script>
    import { onMount, onDestroy, tick } from "svelte";

    export let open = false;
    export let close;
    export let width = "45vw";
    export let centered = false;

    let panelEl;

    // bindable trigger
    export let registerTrigger = null;
    let triggerEl;
    $: triggerEl = registerTrigger;

    function handleClickOutside(e) {
        if (!open) return;

        const path = e.composedPath();
        const inPanel = panelEl && path.includes(panelEl);
        const inTrigger = triggerEl && path.includes(triggerEl);

        if (inTrigger) return;
        if (!inPanel) close();
    }

    function handleEscape(e) {
        if (e.key === "Escape" && open) close();
    }

    // -------------------------------
    //   HORIZONTAL OVERFLOW FIX
    // -------------------------------
    async function adjustHorizontalPosition() {
        if (!panelEl) return;
        await tick();

        const rect = panelEl.getBoundingClientRect();

        let shift = 0;

        const rightOverflow = rect.right - window.innerWidth;
        const leftOverflow = rect.left;

        // push left if overflowing right
        if (rightOverflow > 0) {
            shift = -rightOverflow - 8;
        }

        // push right if overflowing left
        if (leftOverflow < 0) {
            shift = Math.max(shift, Math.abs(leftOverflow) + 8);
        }

        // apply only horizontal correction
        panelEl.style.setProperty("--x-shift", `${shift}px`);
    }

    // Recalculate whenever opened
    $: if (open) adjustHorizontalPosition();

    let resizeObs;
    onMount(() => {
        document.addEventListener("click", handleClickOutside, true);
        document.addEventListener("keydown", handleEscape);

        // If content changes size, re-check overflow
        resizeObs = new ResizeObserver(() => {
            if (open) adjustHorizontalPosition();
        });
        if (panelEl) resizeObs.observe(panelEl);
    });

    onDestroy(() => {
        document.removeEventListener("click", handleClickOutside, true);
        document.removeEventListener("keydown", handleEscape);

        if (resizeObs && panelEl) resizeObs.unobserve(panelEl);
    });
</script>

{#if open}
    <div class="relative">

        <!-- ARROW -->
        <div
            class="absolute z-30 w-0 h-0
                   border-l-8 border-l-transparent
                   border-r-8 border-r-transparent
                   border-b-8 border-b-slate-700"
            style={centered
                ? "top: calc(100% + 4px); left: 50%; transform: translateX(-50%);"
                : "top: calc(100% + 4px); left: 1rem;"
            }
        ></div>

        <!-- PANEL -->
        <div
            bind:this={panelEl}
            class="absolute dropdown-panel z-20 rounded border border-slate-800 text-white flex
                   shadow-[0_8px_24px_rgba(0,0,0,0.45)] bg-slate-700"
            style={centered
                ? `width:${width}; --dropdown-transform:translateX(-50%); left:50%; top: calc(100% + 10px);`
                : `width:${width}; --dropdown-transform:translateX(0); left:0; top: calc(100% + 10px);`
            }
        >
            <slot/>
        </div>
    </div>
{/if}

<style>
    /* Original transform PLUS horizontal correction */
    .dropdown-panel {
        transform: var(--dropdown-transform) translateX(var(--x-shift, 0px));
    }
</style>
