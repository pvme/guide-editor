<script>
    import markdownToHTML from "./../../markdown";

    export let name;
    export let value;
    export let inline = false;

    $: cls = 'embed-field' + (inline ? ' embed-field-inline' : '');
</script>

<div class={cls}>
    <div class='embed-field-name'>{@html markdownToHTML(name).content}</div>
    <div class='embed-field-value markup'>{@html markdownToHTML(value, true).content}</div>
</div>