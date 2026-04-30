<script>
    import { createEventDispatcher } from 'svelte';
    import Eye from 'svelte-bootstrap-icons/lib/Eye.svelte';
    import EyeSlash from 'svelte-bootstrap-icons/lib/EyeSlash.svelte';


    export let dispatch = createEventDispatcher();
    let showView = true;

    function toggleView() {
        showView = !showView;
        dispatch('toggleView');
    }
</script>

<button on:click={toggleView} class='toolbar-btn rounded' title="Toggle discord preview. Can help with lag when editing large guides" type="button">
    {#if showView}
        <Eye/>
        Hide preview
    {:else}
        <EyeSlash/>
        Show preview
    {/if}
</button>

