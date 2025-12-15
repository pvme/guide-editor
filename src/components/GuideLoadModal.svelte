<script>
  import { createEventDispatcher, onMount, onDestroy } from "svelte";

  export let open = false;
  export let guide = null;
  let modalEl;

  const dispatch = createEventDispatcher();

  const confirm = () => dispatch("confirm");
  const cancel = () => dispatch("cancel");

  function onKeydown(e) {
    if (!open) return;

    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }

    if (e.key === "Enter") {
      e.preventDefault();
      confirm();
    }
  }
  
  $: if (open && modalEl) {
    modalEl.focus();
  }
</script>

{#if open}
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
    <div
      class="bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-6 w-[380px]"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      on:keydown={onKeydown}
      bind:this={modalEl}
    >
      <h2 class="text-xl font-semibold text-white mb-4">
        Load Guide
      </h2>

      <p class="text-slate-300 mb-6 leading-relaxed">
        Load the
        <span class="text-indigo-400 font-medium">{guide?.name}</span>
        guide?<br />
        This will overwrite your current editor content.
      </p>

      <div class="flex justify-end gap-3">
        <button
          on:click={cancel}
          class="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
        >
          Cancel
        </button>

        <button
          on:click={confirm}
          class="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition"
        >
          Load Guide
        </button>
      </div>
    </div>
  </div>
{/if}
