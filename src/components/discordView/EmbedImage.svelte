<script>
    import { safeUrl } from '../../renderer/guideRenderer.js';
    export let image;
    export let onClick; // ensure this is passed in by the parent
</script>

<button
    type="button"
    class="embed-thumbnail embed-thumbnail-rich"
    on:click={onClick}
>
    <img
        class="image"
        role="presentation"
        src={safeUrl(image.url)}
        alt=""
    />
</button>
