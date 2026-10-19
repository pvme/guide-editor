<script>
  import Embed from "./Embed.svelte";
  import Attachment from "./Attachment.svelte";

  export let lineMap = [];
</script>

{#each lineMap as item, i}
  {#if item.type === "text"}
    <div class="pvme-line" data-src-line={item.line} data-src-end-line={item.range.end.line}>
      {@html item.html}
    </div>

  {:else if item.type === "attachment"}
    <div
      class="pvme-line attachment attachment--{item.kind}"
      class:attachment-after-heading={lineMap[i - 1]?.html?.includes('class="pvme-h')}
      data-src-line={item.line}
    >
      <Attachment url={item.url} />
    </div>

  {:else if item.type === "embed"}
    <div class="pvme-line embed"
      data-src-line={item.line}>
      <Embed {...item.embed} />
    </div>
  {/if}
{/each}
