<!-- // components/toolbar/GuideSearch.svelte -->
<script>
  import { createEventDispatcher, onMount } from "svelte";

  const dispatch = createEventDispatcher();

  let query = "";
  let open = false;
  let guides = [];
  let filtered = [];
  let activeIndex = 0;

  async function loadGuideIndex() {
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

  $: filtered =
    query.length === 0
      ? []
      : guides
          .filter(g =>
            g.path.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 10);

  function selectGuide(guide) {
    dispatch("select", guide);
    query = "";
    open = false;
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
      open = false;
    }
  }
</script>

<div class="relative mr-5 w-72">
  <input
    class="h-10 w-full rounded-md
           bg-slate-800 border border-slate-700
           px-3 text-sm text-slate-200
           placeholder:text-slate-400
           focus:outline-none focus:ring-2 focus:ring-indigo-500"
    placeholder="Search and load a guide…"
    bind:value={query}
    on:focus={() => (open = true)}
    on:keydown={onKeydown}
  />

  {#if open && filtered.length > 0}
    <div
      class="absolute z-50 mt-1 w-full
             rounded-md border border-slate-700
             bg-slate-900 shadow-lg"
    >
      {#each filtered as guide, i}
        <button
          class="w-full text-left px-3 py-1.5 text-sm
                 hover:bg-slate-800
                 {i === activeIndex ? 'bg-slate-800' : ''}"
          on:click={() => selectGuide(guide)}
        >
          <div class="text-slate-200">{guide.name}</div>
          <div class="text-xs text-slate-400 truncate">
            {guide.path}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
