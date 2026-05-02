<script>
  import { createEventDispatcher } from "svelte";
  import Github from "svelte-bootstrap-icons/lib/Github.svelte";
  import Search from "svelte-bootstrap-icons/lib/Search.svelte";
  import { loadedGuide, text } from "../../stores";
  import ToolbarTooltip from "./ToolbarTooltip.svelte";

  export let corner = "";

  const dispatch = createEventDispatcher();

  $: hasLoadedGuide = Boolean($loadedGuide?.path);
  $: hasText = $text.trim().length > 0;
  $: hasChanges = hasLoadedGuide && $text !== ($loadedGuide.originalText || "");
  $: canSubmit = hasLoadedGuide && hasText && hasChanges;
  $: canInteract = canSubmit || !hasLoadedGuide;
  $: title = !hasLoadedGuide
    ? "Search and load a guide"
    : !hasText
      ? "You must add guide text to submit a guide update"
      : !hasChanges
        ? "You must make a guide change to submit a guide update"
        : "Submit this guide update for review";
  $: label = !hasLoadedGuide
    ? "Load a guide"
    : !hasText
      ? "Editor empty"
      : !hasChanges
        ? "No changes yet"
        : "Submit update";
  $: detail = $loadedGuide?.path;
</script>

<div class="submit-guide-group inline-flex items-center">
  <button
    on:click={() => canSubmit ? dispatch("open") : dispatch("loadGuide")}
    disabled={!canInteract}
    class="{hasLoadedGuide ? 'rounded-l' : corner} toolbar-btn px-2 submit-guide-main"
    aria-describedby="submit-guide-help"
    type="button"
  >
    {#if hasLoadedGuide}
      <Github />
    {:else}
      <Search />
    {/if}
    <span class="font-medium">{label}</span>
    {#if hasLoadedGuide}
      <ToolbarTooltip text={detail}>
        <span class="submit-guide-file hidden 2xl:inline max-w-40 rounded bg-black/20 px-1.5 py-0.5 text-xs text-blue-100">
          <span class="submit-guide-file-name truncate">
            {detail}
          </span>
        </span>
      </ToolbarTooltip>
    {/if}
  </button>
  <span id="submit-guide-help" class="submit-guide-tooltip" role="tooltip">
    {title}
  </span>

  {#if hasLoadedGuide}
    <button
      class="toolbar-icon-btn rounded-r border-l-0 submit-guide-search"
      aria-describedby="submit-guide-search-help"
      type="button"
      on:click={() => dispatch("loadGuide")}
    >
      <Search />
    </button>
    <span id="submit-guide-search-help" class="submit-guide-tooltip submit-guide-search-tooltip" role="tooltip">
      Load a different guide
    </span>
  {/if}
</div>

<style>
  .submit-guide-group {
    position: relative;
  }

  .submit-guide-main:disabled {
    background: rgb(30 41 59);
    border-color: rgb(51 65 85);
    color: rgb(148 163 184);
    opacity: 1;
  }

  .submit-guide-main:disabled:hover,
  .submit-guide-main:disabled:focus {
    background: rgb(30 41 59);
    border-color: rgb(51 65 85);
    color: rgb(148 163 184);
    box-shadow: none;
  }

  .submit-guide-main:disabled :global(svg) {
    color: rgb(148 163 184);
  }

  .submit-guide-main:disabled .submit-guide-file {
    background: rgb(15 23 42 / 0.55);
    color: rgb(148 163 184);
  }

  .submit-guide-file {
    position: relative;
    max-width: 10rem;
  }

  .submit-guide-file-name {
    display: block;
    min-width: 0;
  }

  .submit-guide-tooltip {
    position: absolute;
    left: 50%;
    top: calc(100% + 0.5rem);
    z-index: 50;
    width: max-content;
    max-width: 18rem;
    border: 1px solid rgb(51 65 85);
    border-radius: 4px;
    background: rgb(15 23 42);
    color: rgb(226 232 240);
    font-size: 0.75rem;
    line-height: 1rem;
    padding: 0.4rem 0.55rem;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, -0.25rem);
    transition:
      opacity 120ms ease,
      transform 120ms ease;
    white-space: normal;
  }

  .submit-guide-tooltip::before {
    content: "";
    position: absolute;
    left: 50%;
    top: -0.33rem;
    width: 0.6rem;
    height: 0.6rem;
    border-left: 1px solid rgb(51 65 85);
    border-top: 1px solid rgb(51 65 85);
    background: rgb(15 23 42);
    transform: translateX(-50%) rotate(45deg);
  }

  .submit-guide-search-tooltip {
    left: auto;
    right: 0;
    transform: translate(0, -0.25rem);
  }

  .submit-guide-search-tooltip::before {
    left: auto;
    right: 0.9rem;
    transform: rotate(45deg);
  }

  .submit-guide-main:hover + .submit-guide-tooltip,
  .submit-guide-main:focus + .submit-guide-tooltip {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  .submit-guide-main:hover:has(.submit-guide-file:hover) + .submit-guide-tooltip {
    opacity: 0;
    transform: translate(-50%, -0.25rem);
  }

  .submit-guide-search:hover + .submit-guide-search-tooltip,
  .submit-guide-search:focus + .submit-guide-search-tooltip {
    opacity: 1;
    transform: translate(0, 0);
  }

</style>
