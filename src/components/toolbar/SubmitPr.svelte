<script>
  import { createEventDispatcher } from "svelte";
  import Github from "svelte-bootstrap-icons/lib/Github.svelte";
  import { loadedGuide, text } from "../../stores";

  export let corner = "";

  const dispatch = createEventDispatcher();

  $: hasLoadedGuide = Boolean($loadedGuide?.path);
  $: hasText = $text.trim().length > 0;
  $: hasChanges = hasLoadedGuide && $text !== ($loadedGuide.originalText || "");
  $: canSubmit = hasLoadedGuide && hasText && hasChanges;
  $: canInteract = canSubmit || !hasLoadedGuide;
  $: title = !hasLoadedGuide
    ? "Load a guide before submitting an update"
    : !hasText
      ? "Add guide text before submitting an update"
      : !hasChanges
        ? "Make changes before submitting an update"
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

<button
  on:click={() => canSubmit ? dispatch("open") : dispatch("loadGuide")}
  disabled={!canInteract}
  class="{corner} toolbar-btn px-2"
  {title}
  type="button"
>
  <Github />
  <span class="font-medium">{label}</span>
  {#if hasLoadedGuide}
    <span class="hidden 2xl:inline max-w-40 truncate rounded bg-black/20 px-1.5 py-0.5 text-xs text-blue-100">
      {detail}
    </span>
  {/if}
</button>
