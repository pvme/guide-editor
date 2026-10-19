<script>
    import EmbedField from "./EmbedField.svelte";
    
    export let fields;
</script>

<div class='embed-fields'>
    {#each fields.filter(field => field && typeof field === 'object') as field}
        <EmbedField {...field} />
    {/each}
</div>
