<script>
    import { createEventDispatcher } from 'svelte';
    import Eye from 'svelte-bootstrap-icons/lib/Eye.svelte';
    import EyeSlash from 'svelte-bootstrap-icons/lib/EyeSlash.svelte';
    import ToolbarTooltip from "./ToolbarTooltip.svelte";


    export let dispatch = createEventDispatcher();
    let showView = true;

    function toggleView() {
        showView = !showView;
        dispatch('toggleView');
    }
</script>

<ToolbarTooltip text="Toggle Discord preview. Can help with lag when editing large guides" align="right">
    <button on:click={toggleView} class='toolbar-btn rounded' type="button">
        {#if showView}
            <Eye/>
            Hide preview
        {:else}
            <EyeSlash/>
            Show preview
        {/if}
    </button>
</ToolbarTooltip>
