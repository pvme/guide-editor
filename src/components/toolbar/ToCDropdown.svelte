<script>

    import Button from './Button.svelte';
    import CaretDownFill from 'svelte-bootstrap-icons/lib/CaretDownFill.svelte';
    import { text } from './../../stores'; 
    import Clipboard from 'svelte-bootstrap-icons/lib/Clipboard.svelte';

    let toc = '';
    let copy = copyToClipboard;

    async function copyToClipboard() {
        await new Promise(r => setTimeout(r, 400));
        const dropdown = new Dropdown(document.getElementById('ToCInformation'), document.getElementById('ToCButton'));
        dropdown.hide();
        navigator.clipboard.writeText(toc);
    }
  
  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  function getToCChapters() {
    /*
    Parse .tag:name from text
    */
    // .tag:introduction
		const regexp = /\n.tag:([^\n]+)/g;
		const chapters = [...$text.matchAll(regexp)];

    return chapters;
  }

  function formatChapters(chapters) {
    /*
    Format chapters to be used in ToC:
    ⬥ [<tag_name>]($linkmsg_<tag_name>)\\n⬥ [<tag_name>]($linkmsg_<tag_name>)\\n
    */
    let chaptersFormatted = [];
    for (const chapter of chapters){
      chaptersFormatted.push(`⬥ [${capitalizeFirstLetter(chapter[1])}]($linkmsg_${chapter[1]}$)`);
		}

    return chaptersFormatted.join('\\n');
  }

  function generateCompactToC() {
    const chapters = getToCChapters();

    toc = `
{
  "embed": {
    "title": "__Table of Contents__",
    "description": "*To edit this guide in our web editor [click here](<https://pvme.io/guide-editor/?id={{channel:id}}>), or visit <id:customize> and select Entry Editor*\\n${formatChapters(chapters)}",
    "color": 39423
  }
}
.embed:json
.pin:delete`;
  };

  function generateCategorizedToC() {
    const chapters = getToCChapters();

    // let chaptersFormatted = '';
    // for (const result of chapters){
    //   chaptersFormatted += `\\n⬥ [${result[1]}]($linkmsg_${result[1]}$)`;
		// }
    let fields = [];
		for (const chapter of chapters){
			fields.push(`      {
        "name": "__${chapter[1]}__",
        "value": "[Link]($linkmsg_${chapter[1]}$)",
        "inline": true
      }`);
		}

    toc = `
{
  "embed": {
    "title": "__Table of Contents__",
    "description": "*To edit this guide in our web editor [click here](<https://pvme.io/guide-editor/?id={{channel:id}}>), or visit <id:customize> and select Entry Editor*",
    "color": 39423,
    "fields": [
      {
        "name": "__Category__",
        "value": "${formatChapters(chapters)}",
        "inline": true
      }
    ]
  }
}
.embed:json
.pin:delete`;
  };
</script>


<button id="ToCButton" data-dropdown-toggle="ToCInformation" on:click={generateCompactToC} type="button" class='inline-flex items-center rounded bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-2 active:bg-indigo-800 text-sm border border-indigo-700' title="Create table of contents">
  Table of contents&nbsp;<CaretDownFill class="mt-1"></CaretDownFill>
</button>

<div id="ToCInformation" class="z-10 hidden rounded shadow bg-slate-700 border border-slate-800">
  <div class="flex-grow flex flex-row ">
    <div class="ml-4 my-4 mr-2 inline-flex flex-col text-white text-left text-sm">
      <button title="Compact" on:click={() => generateCompactToC()} class='rounded-t flex-wrap text-left bg-indigo-600 hover:bg-indigo-700 p-2 active:bg-indigo-800 border border-indigo-700' type="button">
        Compact
      </button>
      <button title="Style guide" on:click={() => generateCategorizedToC()} class='rounded-b flex-wrap text-left bg-indigo-600 hover:bg-indigo-700 p-2 active:bg-indigo-800 border border-indigo-700' type="button">
        Categorized
      </button>
    </div>
    <div class="flex-col">
      <div class="pl-2 pr-4 py-4 text-sm text-white flex-grow">
        <pre class="overflow-auto bg-slate-800 px-2" style="height: 40vh; width: 45vw;">
{toc}
        </pre>
    </div>
    <div class="flex items-center ml-2 mr-4 mb-4 text-white">
      <Button on:click={() => {copy = copyToClipboard()}} corner={"rounded"} title="Copy to clipboard">
          <Clipboard></Clipboard>
          &nbsp;Copy
      </Button>
          {#await copy}
              <p class="ml-2">☑️ Copied</p>
          {/await}
      </div>
    </div>
  </div>
</div>