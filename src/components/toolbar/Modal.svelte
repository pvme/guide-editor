<script>
    import { onMount, onDestroy } from "svelte";

    export let open = false;
    export let close = () => {};

    function handleEscape(e) {
        if (e.key === "Escape") close();
    }

    onMount(() => {
        document.addEventListener("keydown", handleEscape);
        document.body.style.overflow = "hidden";
    });

    onDestroy(() => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "";
    });
</script>

{#if open}
    <!-- BACKDROP (NOW THE TOPMOST LAYER) -->
    <div
      class="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4"
      role="button"
      tabindex="0"
      on:click={() => close()}
      on:keydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          close();
        }
      }}
    >
        <!-- MODAL PANEL -->
            <div
              class="modal-content relative bg-slate-800 border border-slate-700 rounded shadow-xl text-white
                     max-w-3xl w-full max-h-[80vh] overflow-auto p-6"
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
