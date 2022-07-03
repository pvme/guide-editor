<script>
    import 'flowbite';

    import Button from './Button.svelte';
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

	function generateToC() {
		// .tag:introduction
		const regexp = /\n.tag:([^\n]+)/g;
		const results = [...$text.matchAll(regexp)];
		let fields = [];
		for (const result of results){
			fields.push(`      {
        "name": "__${result[1]}__",
        "value": "[Link]($linkmsg_${result[1]}$)",
        "inline": true
      }`);
		}
		
		toc = `
{
  "embed": {
    "title": "Table of Contents",
    "color": 39423,
    "fields": [
${fields.join(',\n')}
    ]
  }
}
.embed:json
.pin:delete`;
    }
</script>


<button id="ToCButton" data-dropdown-toggle="ToCInformation" on:click={generateToC} type="button" class='rounded bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-2 active:bg-indigo-800 text-sm border border-indigo-700' title="Create table of contents">
  Table of contents
</button>

<div id="ToCInformation" class="z-10 hidden rounded shadow bg-slate-700 border border-slate-800">
  <div class="px-4 py-4 text-sm text-white">
    <pre class="overflow-auto bg-slate-800 px-2" style="height: 40vh; width: 30vw">
      {toc}
    </pre>
  </div>
  <div class="flex items-center mx-4 mb-4 text-white">
    <Button on:click={() => {copy = copyToClipboard()}} corner={"rounded"} title="Copy to clipboard">
      <Clipboard></Clipboard>
      &nbsp;Copy
    </Button>
      {#await copy}
          <p class="ml-2">☑️ Copied</p>
      {/await}
  </div>
</div>