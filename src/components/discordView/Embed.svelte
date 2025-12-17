<script>
    import EmbedColorPill from './EmbedColorPill.svelte';
    import EmbedAuthor from './EmbedAuthor.svelte';
    import EmbedTitle from './EmbedTitle.svelte';
    import EmbedDescription from './EmbedDescription.svelte';
    import EmbedThumbnail from './EmbedThumbnail.svelte';
    import EmbedImage from './EmbedImage.svelte';
    import EmbedFooter from './EmbedFooter.svelte';
    import EmbedFields from './EmbedFields.svelte';
    
    export let color = null; 
    export let author = null; 
    export let title = null;
    export let url = null;
    export let description = null;
    export let fields = null;
    export let thumbnail = null;
    export let image = null;
    export let footer = null;
    export let selected = false;
</script>

<div class='embed-wrapper'>
    <EmbedColorPill {color} />
    <div class='embed embed-rich' class:selected={selected}>
        <div class='embed-content'>
            <div class='embed-content-inner'>
                {#if author}
                    <EmbedAuthor {...author} />
                {/if}
                {#if title}
                    <EmbedTitle title={title} url={url} />
                {/if}
                {#if description}
                    <EmbedDescription content={description} />
                {/if}
                {#if fields}
                    <EmbedFields {fields} />
                {/if}
            </div>
            {#if thumbnail}
                <EmbedThumbnail {thumbnail} />
            {/if}
        </div>
        {#if image}
            <EmbedImage {image} />
        {/if}
        {#if footer}
            <EmbedFooter {...footer} />
        {/if}
    </div>
</div>