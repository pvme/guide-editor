<script>
    import EmbedField from "./EmbedField.svelte";
    
    export let fields;
</script>

<div class='embed-fields'>
    {#each fields as field}
        <EmbedField {...field} />
    {/each}
</div>