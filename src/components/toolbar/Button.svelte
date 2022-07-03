<script>
    export let corner = '';
    export let title = '';
</script>

<button on:click class='{corner} inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-2 active:bg-indigo-800 text-sm border border-indigo-700' title={title} type="button">
    <slot />
</button>
