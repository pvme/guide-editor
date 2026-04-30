<script>
    export let corner = '';
    export let title = '';
</script>

<button on:click class='{corner} toolbar-btn px-2' title={title} type="button">
    <slot />
</button>
