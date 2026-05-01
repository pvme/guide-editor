<script>
  import FileEarmarkArrowDown from "svelte-bootstrap-icons/lib/FileEarmarkArrowDown.svelte";
  import { text } from './../../stores'; 
  import ToolbarTooltip from "./ToolbarTooltip.svelte";

  export let corner = "rounded";
  export let iconOnly = false;

  function exportText() {
    const file = new File([$text], 'GuideEditorExport.txt', {
        type: 'text/plain',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(file);

    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
</script>

<ToolbarTooltip text="Export to text file" align={iconOnly ? "right" : "center"}>
  <button on:click={exportText} class='{corner} {iconOnly ? "toolbar-icon-btn" : "toolbar-btn px-2"}' type="button">
    {#if iconOnly}
      <FileEarmarkArrowDown />
    {:else}
      Export to .txt file
    {/if}
  </button>
</ToolbarTooltip>
