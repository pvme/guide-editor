<script>
    export let text;
    export let icon_url = null;
</script>

<div>
    {#if icon_url}
        <img src={icon_url} class='embed-footer-icon' role='presentation' width='20' height='20' alt='embed footer icon'/>
    {/if}
    <span class='embed-footer'>{text}</span>
</div>