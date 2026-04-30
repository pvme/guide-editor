<script>
    import DropdownPanel from "./DropdownPanel.svelte";
    import CaretDownFill from "svelte-bootstrap-icons/lib/CaretDownFill.svelte";
    import { loadStyleGuide, styleGuide } from "../../pvmeSettings";

    let open = false;
    let trigger;
    let activeGuide = "style";
    let styleGuideText = styleGuide;
    let loadingStyleGuide = false;

    const guides = [
        { id: "style", label: "Style Guide" },
        { id: "embed", label: "Embed Guide" }
    ];

    const embedGuide = `Embed Guide

Top-level properties
- "title": Main heading, max 256 characters.
- "description": Body text, supports markdown, max 4096 characters.
- "url": Makes the title a clickable link.
- "color": Sidebar colour as a decimal number.
- "timestamp": ISO 8601 timestamp shown in the footer.

Author
- "author": {"name":"Author Name","url":"","icon_url":""}
- .name: Small text above the title.
- .url: Makes the author name clickable.
- .icon_url: Small circular icon next to author name.

Fields
- "fields": [{"name":"Field Name","value":"Field Value","inline":false}]
- .name: Field heading, max 256 characters, required.
- .value: Field content, supports markdown, max 1024 characters, required.
- .inline: true for side-by-side fields, false for full-width fields.

Images
- "thumbnail": {"url":"https://example.com/image.png"}
- "image": {"url":"https://example.com/image.png"}

Footer
- "footer": {"text":"Footer text","icon_url":""}
- .text: Small text at the bottom, max 2048 characters.
- .icon_url: Small circular icon next to footer text.

Common colours
- Red: 15158332
- Orange: 15105570
- Yellow: 15844367
- Green: 3066993
- Blue: 3447003
- Purple: 10181046
- Pink: 15277667
- White: 16777215
- Dark: 2829105
- Blurple: 5793266
- PVME: 39423

Full example
{
  "embed": {
    "title": "__Section Title__",
    "description": "Section description with **markdown** support",
    "color": 39423,
    "fields": [
      {
        "name": "__Category 1__",
        "value": "Item 1\\nItem 2\\nItem 3",
        "inline": true
      },
      {
        "name": "__Category 2__",
        "value": "Item A\\nItem B\\nItem C",
        "inline": true
      }
    ],
    "thumbnail": {
      "url": "https://img.pvme.io/images/example.png"
    },
    "footer": {
      "text": "Footer text here"
    }
  }
}
.embed:json`;

    $: preview = activeGuide === "style" ? styleGuideText : embedGuide;
    $: if (open && activeGuide === "style" && !styleGuideText && !loadingStyleGuide) {
        refreshStyleGuide();
    }

    async function refreshStyleGuide() {
        loadingStyleGuide = true;
        styleGuideText = styleGuide || "Loading style guide...";
        styleGuideText = await loadStyleGuide();
        loadingStyleGuide = false;
    }
</script>

<div class="relative inline-block mb-2 ml-2">
    <button
        bind:this={trigger}
        class="toolbar-btn rounded"
        on:click={() => open = !open}
    >
        Guides&nbsp;<CaretDownFill class="mt-1" />
    </button>

    <DropdownPanel
        {open}
        close={() => open = false}
        width="60vw"
        centered={false}
        bind:registerTrigger={trigger}
    >
        <div class="grid grid-cols-[20%_80%] w-full">
            <div class="flex max-h-[68vh] flex-col gap-1 overflow-auto p-3 text-sm w-full">
                {#each guides as guide}
                    <button
                        class="toolbar-submenu-option {activeGuide === guide.id ? 'toolbar-submenu-option-active' : ''}"
                        on:click={() => activeGuide = guide.id}
                    >
                        {guide.label}
                    </button>
                {/each}
            </div>

            <div class="flex min-w-0 flex-col p-3 pl-0">
                <pre class="h-[60vh] overflow-auto rounded bg-slate-800 p-3 text-sm whitespace-pre-wrap break-words text-slate-100">{preview}</pre>
            </div>
        </div>
    </DropdownPanel>
</div>
