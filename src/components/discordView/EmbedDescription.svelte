<script>
    import markdownToHTML from "./../../markdown";

    export let content;
</script>

<div class='embed-description markup'>{@html markdownToHTML(content, true).content}</div>