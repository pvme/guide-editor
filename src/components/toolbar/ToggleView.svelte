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

<button on:click={toggleView} class='rounded-r inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-2 active:bg-indigo-800 text-sm border border-indigo-700 mr-4' title="Toggle discord preview. Can help with lag when editing large guides" type="button">
    {#if showView}
        <Eye/>
    {:else}
        <EyeSlash/>
    {/if}
</button>

