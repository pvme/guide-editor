<script>
  import { createEventDispatcher, onMount, onDestroy } from "svelte";

  export let open = false;
  export let guide = null;
  export let loadingAction = "idle";

  let modalEl;

  const dispatch = createEventDispatcher();

  const confirm = () => dispatch("confirm");
  const loadReview = () => dispatch("loadReview");
  const loadLive = () => dispatch("loadLive");
  const cancel = () => dispatch("cancel");
  $: isLoading = loadingAction !== "idle";

  function onKeydown(e) {
    if (!open) return;

    if (e.key === "Escape") {
      e.preventDefault();
      if (!isLoading) cancel();
    }

    if (e.key === "Enter" && !guide?.hasExistingReview && !isLoading) {
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
      {#if guide?.hasExistingReview}
        <h2 class="text-xl font-semibold text-white mb-4">
          You already have a submitted update for this guide
        </h2>

        <p class="text-slate-300 mb-6 leading-relaxed">
          You can continue editing your existing submitted version, or start again from the current live guide.
        </p>

        <div class="flex flex-col gap-3">
          <button
            on:click={loadReview}
            disabled={isLoading}
            class="toolbar-btn rounded-md font-medium"
          >
            {#if loadingAction === "review"}
              <span class="loading-spinner" aria-hidden="true"></span>
              Loading
            {:else}
              Continue from my last submitted update
            {/if}
          </button>

          <button
            on:click={loadLive}
            disabled={isLoading}
            class="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
          >
            {#if loadingAction === "live"}
              <span class="loading-spinner" aria-hidden="true"></span>
              Loading
            {:else}
              Start fresh from the live guide
            {/if}
          </button>

          <button
            on:click={cancel}
            disabled={isLoading}
            class="px-4 py-2 rounded-md text-slate-300 hover:text-white transition"
          >
            Cancel
          </button>
        </div>
      {:else}
        <h2 class="text-xl font-semibold text-white mb-4">
          Load Guide
        </h2>

        <p class="text-slate-300 mb-6 leading-relaxed">
          Load the
          <span class="text-blue-400 font-medium">{guide?.name}</span>
          guide?<br />
          This will overwrite your current editor content.
        </p>

        <div class="flex justify-end gap-3">
          <button
            on:click={cancel}
            disabled={isLoading}
            class="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
          >
            Cancel
          </button>

          <button
            on:click={confirm}
            disabled={isLoading}
            class="toolbar-btn rounded-md font-medium"
          >
            {#if loadingAction === "confirm"}
              <span class="loading-spinner" aria-hidden="true"></span>
              Loading
            {:else}
              Load Guide
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.72;
  }

  .loading-spinner {
    width: 0.9rem;
    height: 0.9rem;
    border: 2px solid rgb(191 219 254 / 0.45);
    border-top-color: rgb(255 255 255);
    border-radius: 999px;
    animation: spin 700ms linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
