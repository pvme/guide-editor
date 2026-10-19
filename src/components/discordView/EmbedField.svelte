<script>
    import { renderFragment } from "../../renderer/guideRenderer.js";

    export let name;
    export let value;
    export let inline = false;

    $: cls = 'embed-field' + (inline ? ' embed-field-inline' : '');
</script>

<div class={cls}>
    <div class='embed-field-name'>{@html renderFragment(name)}</div>
    <div class='embed-field-value markup'>{@html renderFragment(value)}</div>
</div>