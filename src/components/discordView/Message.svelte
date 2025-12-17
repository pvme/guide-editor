<script>
  import Embed from "./Embed.svelte";
  import Attachment from "./Attachment.svelte";

  export let lineMap = [];
  export let globalOffset = 0;
</script>

{#each lineMap as item}
  {#if item.type === "text"}
    <div class="pvme-line" data-src-line={item.line + globalOffset}>
      {@html item.html}
    </div>

  {:else if item.type === "attachment"}
    <div
      class="pvme-line attachment attachment--{item.kind}"
      data-src-line={item.line + globalOffset}
    >
      <Attachment url={item.url} />
    </div>

  {:else if item.type === "embed"}
    <div class="pvme-line embed"
      data-src-line={item.line + globalOffset}>
      <Embed {...item.embed} />
    </div>
  {/if}
{/each}