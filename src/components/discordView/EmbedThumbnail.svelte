<script>
    import { safeUrl } from '../../renderer/guideRenderer.js';
    export let thumbnail;
</script>

<img src={safeUrl(thumbnail.url)} role='presentation' class='embed-rich-thumb' style='max-width: 80px; max-height: 80px;' alt='embed thumbnail'/>
