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
  let loading = false;
  let loadError = "";

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

  function tokenMatch(text, query) {
    const terms = query.split(" ").filter(Boolean);

    return terms.length > 0 && terms.every(term => text.includes(term));
  }

  async function loadGuideIndex() {
    if (loaded || loading) return;
    loading = true;
    loadError = "";

    try {
      guides = await loadGuidesFromChannels();

      if (guides.length === 0) {
        guides = await loadGuidesFromGithubTree();
      }

      loaded = true;
    } catch (err) {
      loadError = err?.message || "Guide list could not be loaded.";
    } finally {
      loading = false;
    }
  }

  async function loadGuidesFromChannels() {
    const res = await fetch(
      "https://raw.githubusercontent.com/pvme/pvme-settings/pvme-discord/channels.json"
    );

    if (!res.ok) {
      throw new Error("Guide list could not be loaded.");
    }

    const channels = await res.json();
    const seen = new Set();

    return (Array.isArray(channels) ? channels : [])
      .filter(channel => channel?.path?.endsWith(".txt"))
      .filter(channel => {
        if (seen.has(channel.path)) return false;
        seen.add(channel.path);
        return true;
      })
      .map(channel => ({
        name: channel.name || channel.path.split("/").pop(),
        path: channel.path,
        url: `https://raw.githubusercontent.com/pvme/pvme-guides/master/${channel.path}`
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async function loadGuidesFromGithubTree() {
    const res = await fetch(
      "https://api.github.com/repos/pvme/pvme-guides/git/trees/master?recursive=1"
    );

    if (!res.ok) {
      throw new Error("Guide list could not be loaded.");
    }

    const data = await res.json();
    const tree = Array.isArray(data.tree) ? data.tree : [];

    return tree
      .filter(f => f.type === "blob" && f.path.endsWith(".txt"))
      .map(f => ({
        name: f.path.split("/").pop(),
        path: f.path,
        url: `https://raw.githubusercontent.com/pvme/pvme-guides/master/${f.path}`
      }));
  }

  onMount(loadGuideIndex);

  $: if (open) {
    loadGuideIndex();
    focusInput();
  }

  $: filtered =
    query.length === 0
      ? guides.slice(0, 10)
      : guides
          .map(g => {
            const text = normalise(`${g.name} ${g.path}`);
            const q = normalise(query);

            const includes = text.includes(q);
            const tokens = tokenMatch(text, q);
            const fuzzy = fuzzyMatch(text, q);

            return {
              guide: g,
              score: includes ? 3 : tokens ? 2 : fuzzy ? 1 : 0
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
      if (filtered.length === 0) return;
      activeIndex = (activeIndex + 1) % filtered.length;
      e.preventDefault();
    }

    if (e.key === "ArrowUp") {
      if (filtered.length === 0) return;
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
        {#if loading}
          <div class="px-4 py-8 text-center text-sm text-slate-400">
            Loading guides...
          </div>
        {:else if loadError}
          <div class="px-4 py-8 text-center text-sm text-slate-400">
            {loadError}
            <button
              class="mt-3 block w-full text-blue-300 hover:text-blue-200"
              type="button"
              on:click={loadGuideIndex}
            >
              Try again
            </button>
          </div>
        {:else if filtered.length > 0}
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
            {query.trim() ? "No guides found" : "No guides loaded"}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
