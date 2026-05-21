<script>
  import { createEventDispatcher } from "svelte";
  import FileEarmarkPlus from "svelte-bootstrap-icons/lib/FileEarmarkPlus.svelte";
  import Pencil from "svelte-bootstrap-icons/lib/Pencil.svelte";
  import Trash from "svelte-bootstrap-icons/lib/Trash.svelte";
  import DropdownPanel from "./DropdownPanel.svelte";
  import ToolbarTooltip from "./ToolbarTooltip.svelte";
  import { drafts, getDraftTitle, getGuideSourceContext } from "../../stores";

  const dispatch = createEventDispatcher();
  let open = false;
  let triggerEl;

  function close() {
    open = false;
  }

  function createNewDraft() {
    close();
    dispatch("newDraft");
  }

  function switchDraft(id) {
    drafts.switchTo(id);
    close();
  }

  function renameDraft(draft) {
    close();
    dispatch("renameDraft", draft);
  }

  function deleteDraft(draft) {
    close();
    dispatch("deleteDraft", draft);
  }

  function formatUpdatedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getDraftMeta(draft) {
    if (!draft?.loadedGuide?.path) return "Local draft";

    const title = getDraftTitle(draft);
    const baseTitle = title.replace(/ \(\d+\)$/, "");
    const path = draft.loadedGuide.path;
    const source = getGuideSourceContext(draft.loadedGuide);
    const shouldShowPath = baseTitle !== path && baseTitle !== path.split("/").pop();

    if (!shouldShowPath) {
      return source;
    }

    return source ? `${path} · ${source}` : path;
  }

  $: sortedDrafts = [...$drafts.drafts].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
</script>

<div class="relative">
  <ToolbarTooltip text="Local drafts">
    <button
      bind:this={triggerEl}
      class="toolbar-btn rounded px-3"
      type="button"
      aria-label="Local drafts"
      aria-expanded={open}
      on:click={() => (open = !open)}
    >
      <span>Open drafts</span>
      <span class="inline-flex min-w-5 items-center justify-center rounded-full bg-blue-900 px-1.5 text-xs font-semibold text-blue-100">
        {$drafts.drafts.length}
      </span>
    </button>
  </ToolbarTooltip>

  <DropdownPanel {open} {close} width="26rem" registerTrigger={triggerEl} centered>
    <div class="flex max-h-[70vh] w-full flex-col overflow-hidden">
      <div class="flex items-center justify-between gap-3 border-b border-slate-600 px-3 py-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-white">Local Drafts</div>
          <div class="text-xs text-slate-300">Switch or create saved editor drafts</div>
        </div>
        <button
          class="toolbar-btn h-9 rounded px-2.5"
          type="button"
          on:click={createNewDraft}
        >
          <FileEarmarkPlus />
          <span>New</span>
        </button>
      </div>

      <div class="max-h-[17rem] min-h-0 overflow-y-auto p-2" role="list">
        {#each sortedDrafts as draft (draft.id)}
          {@const isActive = draft.id === $drafts.activeDraftId}
          {@const canRename = !draft.loadedGuide?.path}
          {@const displayTitle = getDraftTitle(draft)}
          <div
            class="group flex items-center gap-2 rounded border px-3 py-2 {isActive ? 'border-blue-500/40 bg-blue-900/55' : 'border-transparent hover:bg-slate-600/55'}"
            role="listitem"
          >
            <button
              class="min-w-0 flex-1 text-left"
              type="button"
              on:click={() => switchDraft(draft.id)}
            >
              <div class="flex min-w-0 items-center gap-2">
                <span class="group/title-popover relative min-w-0">
                  <span class="block truncate text-sm font-medium {isActive ? 'text-white' : 'text-slate-100'}">
                    {displayTitle}
                  </span>
                  <span class="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden max-w-80 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-200 shadow-lg group-hover/title-popover:block group-focus-within/title-popover:block">
                    {displayTitle}
                    <span class="absolute -top-[5px] left-3 h-2.5 w-2.5 rotate-45 border-l border-t border-slate-600 bg-slate-950"></span>
                  </span>
                </span>
                {#if isActive}
                  <span class="shrink-0 rounded-full bg-blue-500/25 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-blue-100">
                    Current file
                  </span>
                {/if}
              </div>
              <div class="truncate text-xs text-slate-300">
                {getDraftMeta(draft)}
              </div>
              <div class="text-xs text-slate-400">
                {formatUpdatedAt(draft.updatedAt)}
              </div>
            </button>

            <span class="group/rename-action relative inline-flex">
              <button
                class="inline-flex h-8 w-8 items-center justify-center rounded border border-transparent text-slate-300 hover:border-slate-500 hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:border-transparent disabled:hover:bg-transparent disabled:hover:text-slate-500"
                type="button"
                aria-label={canRename ? "Rename draft" : "Rename disabled"}
                disabled={!canRename}
                on:click={() => renameDraft(draft)}
              >
                <Pencil />
              </button>
              <span class="pointer-events-none absolute right-9 top-1/2 z-30 hidden -translate-y-1/2 whitespace-nowrap rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-200 shadow-lg group-hover/rename-action:inline-flex group-focus-within/rename-action:inline-flex">
                {canRename ? "Rename draft" : "You can't rename a PvME guide"}
                <span class="absolute -right-[5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-r border-t border-slate-600 bg-slate-950"></span>
              </span>
            </span>
            <span class="group/discard-action relative inline-flex">
              <button
                class="inline-flex h-8 w-8 items-center justify-center rounded border border-transparent text-slate-300 hover:border-red-700 hover:bg-red-800 hover:text-white"
                type="button"
                aria-label="Discard draft"
                on:click={() => deleteDraft(draft)}
              >
                <Trash />
              </button>
              <span class="pointer-events-none absolute right-9 top-1/2 z-30 hidden -translate-y-1/2 whitespace-nowrap rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-200 shadow-lg group-hover/discard-action:inline-flex group-focus-within/discard-action:inline-flex">
                Discard draft
                <span class="absolute -right-[5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-r border-t border-slate-600 bg-slate-950"></span>
              </span>
            </span>
          </div>
        {/each}
      </div>
    </div>
  </DropdownPanel>
</div>
