<script>
    import markdownToHTML from "./../../markdown";

    export let title;
    export let url = null;
</script>

{#if url}
    <a target='_blank' rel='noreferrer' href={url} class='embed-title'>{@html markdownToHTML(title).content}</a>
{:else}
    <div class='embed-title'>{@html markdownToHTML(title).content}</div>
{/if}