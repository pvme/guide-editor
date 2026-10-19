<script>
    import { renderFragment } from "../../renderer/guideRenderer.js";

    export let content;
</script>

<div class='embed-description markup'>{@html renderFragment(content)}</div>