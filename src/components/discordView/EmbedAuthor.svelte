<script>
    import { safeUrl } from '../../renderer/guideRenderer.js';
    export let name;
    export let url = null;
    export let icon_url = null;
</script>


<div class='embed-author'>
    {#if safeUrl(url)}
        <a target='_blank' rel='noreferrer' href={safeUrl(url)} class='embed-author-name'>{name}</a>
    {:else}
        <span class='embed-author-name'>{name}</span>
    {/if}
    {#if icon_url}
        <img src={safeUrl(icon_url)} role='presentation' class='embed-author-icon' alt='athor-icon'/>
    {/if}
</div>
