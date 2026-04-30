<!-- // components/toolbar/GuideSearch.svelte -->
<script>
  import { createEventDispatcher, onMount, tick } from "svelte";
  import Search from "svelte-bootstrap-icons/lib/Search.svelte";

  const dispatch = createEventDispatcher();

  export let open = false;

  let inputEl;
  let query = "";
  let guides = [];
  let filtered = [];
  let activeIndex = 0;
  let loaded = false;

  function normalise(str) {
    return str
      .toLowerCase()
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function fuzzyMatch(text, query) {
    let t = 0;
    let q = 0;

    while (t < text.length && q < query.length) {
      if (text[t] === query[q]) q++;
      t++;
    }

    return q === query.length;
  }

  async function loadGuideIndex() {
    if (loaded) return;
    loaded = true;

    const res = await fetch(
      "https://api.github.com/repos/pvme/pvme-guides/git/trees/master?recursive=1"
    );

    const data = await res.json();

    guides = data.tree
      .filter(f => f.type === "blob" && f.path.endsWith(".txt"))
      .map(f => ({
        name: f.path.split("/").pop(),
        path: f.path,
        url: `https://raw.githubusercontent.com/pvme/pvme-guides/master/${f.path}`
      }));
  }

  onMount(loadGuideIndex);

  $: if (open) {
    focusInput();
  }

  $: filtered =
    query.length === 0
      ? guides.slice(0, 10)
      : guides
          .map(g => {
            const text = normalise(g.path);
            const q = normalise(query);

            const includes = text.includes(q);
            const fuzzy = fuzzyMatch(text, q);

            return {
              guide: g,
              score: includes ? 2 : fuzzy ? 1 : 0
            };
          })
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(x => x.guide)
          .slice(0, 10);

  // reset index when query changes
  $: if (query.length > 0) {
    activeIndex = 0;
  }

  // ensure index is always valid
  $: if (filtered.length > 0 && activeIndex >= filtered.length) {
    activeIndex = 0;
  }

  function selectGuide(guide) {
    if (!guide) return;
    dispatch("select", { ...guide });
    query = "";
    activeIndex = 0;
    close();
  }

  async function focusInput() {
    await tick();
    inputEl?.focus();
  }

  function close() {
    dispatch("cancel");
  }

  function onKeydown(e) {
    if (!open) return;

    if (e.key === "ArrowDown") {
      activeIndex = (activeIndex + 1) % filtered.length;
      e.preventDefault();
    }

    if (e.key === "ArrowUp") {
      activeIndex =
        (activeIndex - 1 + filtered.length) % filtered.length;
      e.preventDefault();
    }

    if (e.key === "Enter") {
      selectGuide(filtered[activeIndex]);
      e.preventDefault();
    }

    if (e.key === "Escape") {
      close();
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm px-4 pt-[12vh]"
    role="presentation"
    on:click={close}
    on:keydown={(e) => {
      if (e.key === "Escape") close();
    }}
  >
    <div
      class="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Search guides"
      tabindex="-1"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <div class="flex items-center gap-3 border-b border-slate-700 px-4 py-3">
        <Search class="text-slate-400" />
        <input
          class="h-10 w-full bg-transparent text-lg text-slate-100 placeholder:text-slate-500 focus:outline-none"
          placeholder="Search and load a guide..."
          bind:this={inputEl}
          bind:value={query}
          on:keydown={onKeydown}
        />
      </div>

      <div class="max-h-[55vh] overflow-auto py-2">
        {#if filtered.length > 0}
          {#each filtered as guide, i}
            <button
              class="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-slate-800 {i === activeIndex ? 'bg-slate-800' : ''}"
              on:mousedown={() => selectGuide(guide)}
            >
              <div class="text-slate-100">{guide.name}</div>
              <div class="text-xs text-slate-400 truncate">
                {guide.path}
              </div>
            </button>
          {/each}
        {:else}
          <div class="px-4 py-8 text-center text-sm text-slate-400">
            No guides found
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
