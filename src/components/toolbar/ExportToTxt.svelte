<script>
  import { text } from './../../stores'; 

  function exportText() {
    let hiddenElement = document.createElement('a');
    hiddenElement.href = 'data:attachment/text,' + encodeURI($text);
    hiddenElement.target = '_blank';
    hiddenElement.download = 'GuideEditorExport.txt';
    hiddenElement.click();
  }
</script>

<button on:click={exportText} class='inline-flex items-center rounded bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-2 active:bg-indigo-800 text-sm border border-indigo-700' title="Export to text file" type="button">
  Export to .txt file
</button>

