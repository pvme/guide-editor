<script>
  import FileEarmarkArrowDown from "svelte-bootstrap-icons/lib/FileEarmarkArrowDown.svelte";
  import { text } from './../../stores'; 

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

<button on:click={exportText} class='{corner} {iconOnly ? "toolbar-icon-btn" : "toolbar-btn px-2"}' title="Export to text file" type="button">
  {#if iconOnly}
    <FileEarmarkArrowDown />
  {:else}
    Export to .txt file
  {/if}
</button>

