<script>
    import { renderFragment, safeUrl } from "../../renderer/guideRenderer.js";

    export let title;
    export let url = null;
</script>

{#if safeUrl(url)}
    <a target='_blank' rel='noreferrer' href={safeUrl(url)} class='embed-title'>{@html renderFragment(title)}</a>
{:else}
    <div class='embed-title'>{@html renderFragment(title)}</div>
{/if}
