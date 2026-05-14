<script>
    import { createEventDispatcher } from "svelte";
    import Gear from "svelte-bootstrap-icons/lib/Gear.svelte";
    import Eye from "svelte-bootstrap-icons/lib/Eye.svelte";
    import EyeSlash from "svelte-bootstrap-icons/lib/EyeSlash.svelte";
    import Modal from "./Modal.svelte";
    import ToolbarTooltip from "./ToolbarTooltip.svelte";
    import { editorSettings, normalizeEditorSettings } from "../../stores";

    export let showView = true;

    const dispatch = createEventDispatcher();
    let open = false;
    $: settings = normalizeEditorSettings($editorSettings);

    function setEmojiTrailingInsert(value) {
        editorSettings.update(current => ({
            ...normalizeEditorSettings(current),
            emojiTrailingInsert: value
        }));
    }
</script>

<ToolbarTooltip text="Editor settings" align="right">
    <button
        class="toolbar-btn rounded"
        type="button"
        on:click={() => (open = true)}
    >
        <Gear />
        Settings
    </button>
</ToolbarTooltip>

<Modal {open} close={() => (open = false)} panelClass="max-w-xl">
    <h2 class="text-2xl font-semibold mb-5">Editor settings</h2>

    <div class="space-y-4">
        <label class="flex items-start justify-between gap-4 rounded-lg border border-slate-700 bg-slate-900/40 p-4">
            <span>
                <span class="flex items-center gap-2 font-semibold">
                    {#if showView}
                        <Eye />
                    {:else}
                        <EyeSlash />
                    {/if}
                    Discord preview
                </span>
                <span class="mt-1 block text-sm text-slate-300">
                    Hide the live preview when editing large guides or when you want a wider editor.
                </span>
            </span>
            <input
                class="mt-1 h-5 w-5 accent-blue-500"
                type="checkbox"
                checked={showView}
                on:change={() => dispatch("toggleView")}
            />
        </label>

        <label class="flex items-start justify-between gap-4 rounded-lg border border-slate-700 bg-slate-900/40 p-4">
            <span>
                <span class="font-semibold">After emoji insert</span>
                <span class="mt-1 block text-sm text-slate-300">
                    Optionally add text after inserting or completing a Discord emoji.
                </span>
            </span>
            <select
                class="mt-1 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                value={settings.emojiTrailingInsert}
                on:change={(e) => setEmojiTrailingInsert(e.currentTarget.value)}
            >
                <option value="none">none</option>
                <option value="space">space</option>
                <option value="spaceArrowSpace">space → space</option>
            </select>
        </label>
    </div>
</Modal>
