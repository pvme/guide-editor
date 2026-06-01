<script>
  import { createEventDispatcher } from "svelte";
  import { getDraftTitle } from "../stores";

  export let open = false;
  export let guide = null;
  export let loadingAction = "idle";

  let modalEl;

  const dispatch = createEventDispatcher();

  const confirm = () => dispatch("confirm");
  const continueLocalDraft = () => dispatch("continueLocalDraft");
  const openAnotherDraft = () => dispatch("openAnotherDraft");
  const loadReview = () => dispatch("loadReview");
  const loadLive = () => dispatch("loadLive");
  const cancel = () => dispatch("cancel");
  $: isLoading = loadingAction !== "idle";

  function onKeydown(e) {
    if (!open) return;
    const isButtonTarget = e.target instanceof Element && e.target.closest("button");

    if (e.key === "Escape") {
      e.preventDefault();
      if (!isLoading) cancel();
    }

    if (e.key === "Enter" && guide?.localDraft && !isLoading && !isButtonTarget) {
      e.preventDefault();
      continueLocalDraft();
    }

    if (e.key === "Enter" && !guide?.localDraft && !guide?.hasExistingReview && !isLoading && !isButtonTarget) {
      e.preventDefault();
      confirm();
    }
  }

  $: if (open && modalEl) {
    modalEl.focus();
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
    <div
      class="bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-6 w-[440px] max-w-[calc(100vw-2rem)]"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      bind:this={modalEl}
    >
      {#if guide?.localDraft}
        <h2 class="text-xl font-semibold text-white mb-4 leading-snug">
          Continue working on
          <span class="text-blue-400">{guide?.name}</span>?
        </h2>

        <p class="text-slate-300 mb-6 leading-relaxed">
          This file is already saved in Drafts as "{getDraftTitle(guide.localDraft)}".
        </p>

        <div class="flex flex-col gap-3">
          <button
            on:click={continueLocalDraft}
            disabled={isLoading}
            data-disabled-reason={isLoading ? "Loading" : ""}
            class="toolbar-btn rounded-md font-medium"
          >
            Continue draft
          </button>

          <button
            on:click={openAnotherDraft}
            disabled={isLoading}
            class="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-sm text-slate-200 transition"
          >
            {#if loadingAction === "confirm"}
              <span class="loading-spinner" aria-hidden="true"></span>
              Opening
            {:else}
              Open another copy
            {/if}
          </button>

          <button
            on:click={cancel}
            disabled={isLoading}
            class="px-4 py-2 rounded-md text-sm text-slate-300 hover:text-white transition"
          >
            Cancel
          </button>
        </div>
      {:else if guide?.hasExistingReview}
        <h2 class="text-xl font-semibold text-white mb-4">
          You already have a submitted update for this guide
        </h2>

        <p class="text-slate-300 mb-6 leading-relaxed">
          You can keep working from your submitted update, or start a separate draft from the PvME guide.
        </p>

        <div class="flex flex-col gap-3">
          <button
            on:click={loadReview}
            disabled={isLoading}
            data-disabled-reason={isLoading ? "Loading" : ""}
            class="toolbar-btn rounded-md font-medium"
          >
            {#if loadingAction === "review"}
              <span class="loading-spinner" aria-hidden="true"></span>
              Loading
            {:else}
              Continue from submitted update
            {/if}
          </button>

          <button
            on:click={loadLive}
            disabled={isLoading}
            class="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-sm text-slate-200 transition"
          >
            {#if loadingAction === "live"}
              <span class="loading-spinner" aria-hidden="true"></span>
              Loading
            {:else}
              Start from PvME guide
            {/if}
          </button>

          <button
            on:click={cancel}
            disabled={isLoading}
            class="px-4 py-2 rounded-md text-sm text-slate-300 hover:text-white transition"
          >
            Cancel
          </button>
        </div>
      {:else}
        <h2 class="text-xl font-semibold text-white mb-4 leading-snug">
          Start working on
          <span class="text-blue-400">{guide?.name}</span>?
        </h2>

        <p class="text-slate-300 mb-6 leading-relaxed">
          Your current working draft can be found in the Drafts menu.
        </p>

        <div class="flex justify-end gap-3">
          <button
            on:click={cancel}
            disabled={isLoading}
            class="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-sm text-slate-200 transition"
          >
            Cancel
          </button>

          <button
            on:click={confirm}
            disabled={isLoading}
            data-disabled-reason={isLoading ? "Opening file" : ""}
            class="toolbar-btn rounded-md font-medium"
          >
            {#if loadingAction === "confirm"}
              <span class="loading-spinner" aria-hidden="true"></span>
              Opening
            {:else}
              Open file
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
