<script>
    import { createEventDispatcher } from 'svelte';
    import ChevronBarDown from 'svelte-bootstrap-icons/lib/ChevronBarDown.svelte';
    import ChevronBarExpand from 'svelte-bootstrap-icons/lib/ChevronBarExpand.svelte';
    import Button from './Button.svelte';

    export let dispatch = createEventDispatcher();
    let scrollBottom = false;

    function toggleScrollBottom() {
        scrollBottom = !scrollBottom;
        dispatch('toggleScrollBottom');
    }
</script>

<Button on:click={toggleScrollBottom} title="Toggle automatically scrolling Discord preview to bottom" corner='rounded-l'>
    {#if scrollBottom}
        <ChevronBarDown/>
    {:else}
        <ChevronBarExpand/>
    {/if}
</Button>
