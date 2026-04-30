<script>
    import { onMount, onDestroy } from "svelte";

    export let open = false;
    export let close = () => {};
    export let panelClass = "";

    function handleEscape(e) {
        if (e.key === "Escape") close();
    }

    onMount(() => {
        document.addEventListener("keydown", handleEscape);
    });

    onDestroy(() => {
        document.removeEventListener("keydown", handleEscape);
    });
</script>

{#if open}
    <!-- BACKDROP (NOW THE TOPMOST LAYER) -->
    <div
      class="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
      role="presentation"
      on:click={() => close()}
    >
        <!-- MODAL PANEL -->
        <div
          class={`modal-content relative bg-slate-800 border border-slate-700 rounded shadow-xl text-white
                     max-w-3xl w-full max-h-[80vh] overflow-auto cursor-default p-6 ${panelClass}`}
              role="presentation"
              tabindex="-1"
              on:click|stopPropagation
            >
            <!-- CLOSE BUTTON -->
            <button
                class="absolute top-2 right-2 text-slate-300 hover:text-white rounded-md px-2 py-1"
                on:click={() => close()}
                title="Close"
            >
                ✕
            </button>

            <slot />
        </div>
    </div>
{/if}
