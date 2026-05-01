<script>
    import ToolbarTooltip from "./ToolbarTooltip.svelte";

    export let corner = '';
    export let title = '';
</script>

<ToolbarTooltip text={title}>
    <button on:click class='{corner} toolbar-btn px-2' type="button">
        <slot />
    </button>
</ToolbarTooltip>
