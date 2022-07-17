<script>
    import 'flowbite';

    import Button from './Button.svelte';
    import CaretDownFill from 'svelte-bootstrap-icons/lib/CaretDownFill.svelte';
    import Clipboard from 'svelte-bootstrap-icons/lib/Clipboard.svelte';
    import { styleGuide } from './../../pvmeSettings';

    let copy = copyToClipboard;
    
    const credits = 'Title (Courtesy of @user)';
    const eof = '<eofEmoji> with <weaponName> <weaponEmoji>';
    const runePouch = '<pouchEmoji> <rune1> <rune2> ...';
    const link = '**Link text** - <https://...>';
    const guide = 
`> **__Title__**
.img:https://i.imgur.com/gIzPFEV.png

.
> **__Intro__**
.tag:intro
[Describe the boss here]

.
> **__Drops__**
.tag:drops
⬥ [list unique drops here (with emojis) along with rates if known]

.
> **__Presets__**
.tag:presets
⬥ [describe obscure preset items in bullet points]
⬥ [rune pouch contents too]
.
.img:https://i.imgur.com/oVjpPka.png
> **__Mechanics__**
.tag:mechanics
⬥ first mechanic
    • describe the mechanic
        - [describe how to handle mechanic]
.img:https://i.imgur.com/oB20Btb.png
⬥ [Repeat for the rest of the mechanics]

.
> **__The Fight__**
.tag:fight
⬥ [Explain the fight, break it down into phases if applicable]

.
> **__Rotations__**
.tag:rotations
⬥ [Phase 1 rotations]
⬥ [Phase 2 rotations]
⬥ [etc]

.
> **__Example Kills__**
.tag:example`;
    const embedTextFormatting = 
`{
  "embed": {
    "title": "__Embed Template Example__",
    "description": "Ask questions if you get stumped",
    "color": 39423,
    "fields": [
      {
        "name": "__Header 1__",
        "value": "⬥ Header 1 subpoint\\n\\u00a0\\u00a0\\u00a0\\u00a0• Header1 subsubpoint\\n\\u200B"
      },
      {
        "name": "__Header 2__",
        "value": "⬥ Header 2 subpoint\\n\\u00a0\\u00a0\\u00a0\\u00a0• Header2 subsubpoint\\n\\u200B"
      },
      {
        "name": "__Header 3__",
        "value": "⬥ Header 3 subpoint\\n\\u00a0\\u00a0\\u00a0\\u00a0• Header3 subsubpoint with hyperlink to google [here](https://www.google.com/)\\n\\u200B"
      }
    ]
  }
}
.embed:json`;
    
    let templateText = credits;
    
    async function copyToClipboard() {
        await new Promise(r => setTimeout(r, 400));
        const dropdown = new Dropdown(document.getElementById('TemplateInformation'), document.getElementById('TemplateButton'));
        dropdown.hide();
        navigator.clipboard.writeText(templateText);
    }

</script>


<button id="TemplateButton" data-dropdown-toggle="TemplateInformation" type="button" class='inline-flex items-center rounded bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-2 active:bg-indigo-800 text-sm border border-indigo-700' title="Templates">
    Template&nbsp;<CaretDownFill class="mt-1"></CaretDownFill>
</button>

<div id="TemplateInformation" class="z-10 hidden rounded shadow bg-slate-700 border border-slate-800">
    <div class="flex-grow flex flex-row ">
  <div class="ml-4 my-4 mr-2 inline-flex flex-col text-white text-left text-sm">
    <button title="Credits" on:click={() => templateText=credits} class='rounded-t flex-wrap text-left bg-indigo-600 hover:bg-indigo-700 p-2 active:bg-indigo-800 border border-indigo-700' type="button">
      Credits
    </button>
    <button title="Link" on:click={() => templateText=link} class='flex-wrap text-left bg-indigo-600 hover:bg-indigo-700 p-2 active:bg-indigo-800 border border-indigo-700' type="button">
      Link
    </button>
    <button title="Rune pouch" on:click={() => templateText=runePouch} class='flex-wrap text-left bg-indigo-600 hover:bg-indigo-700 p-2 active:bg-indigo-800 border border-indigo-700' type="button">
        Rune pouch
    </button>
    <button title="EoF" on:click={() => templateText=eof} class='rounded-b mb-2 flex-wrap text-left bg-indigo-600 hover:bg-indigo-700 p-2 active:bg-indigo-800 border border-indigo-700' type="button">
        EoF
    </button>
    <button title="Guide" on:click={() => templateText=guide} class='rounded-t flex-wrap text-left bg-indigo-600 hover:bg-indigo-700 p-2 active:bg-indigo-800 border border-indigo-700' type="button">
        Guide
    </button>
    <button title="Embed formatting" on:click={() => templateText=embedTextFormatting} class='flex-wrap text-left bg-indigo-600 hover:bg-indigo-700 p-2 active:bg-indigo-800 border border-indigo-700' type="button">
        Embed formatting
    </button>
    <button title="Style guide" on:click={() => templateText=styleGuide} class='rounded-b flex-wrap text-left bg-indigo-600 hover:bg-indigo-700 p-2 active:bg-indigo-800 border border-indigo-700' type="button">
        Style guide
    </button>
  </div>
    <div class="flex-col">
        <div class="pl-2 pr-4 py-4 text-sm text-white flex-grow">
            <pre class="overflow-auto bg-slate-800 px-2" style="height: 40vh; width: 30vw;">
{templateText}
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