<script>
    import 'flowbite';

    import Button from './Button.svelte';
    import CaretDownFill from 'svelte-bootstrap-icons/lib/CaretDownFill.svelte';
    import Clipboard from 'svelte-bootstrap-icons/lib/Clipboard.svelte';
    import { styleGuide } from './../../pvmeSettings';

    let copy = copyToClipboard;
    
    const eof = '<eofEmoji> with <weaponName> <weaponEmoji>';
    const runePouch = '<pouchEmoji> <rune1> <rune2> ...';
    const link = '[Link Text](<https://...>)';
    const guide = 
`# Title
.img:https://img.pvme.io/images/ssAwdSFcqC.png

.
## __Intro__
.tag:intro
[Describe the boss here]

.
## __Presets and Relics__
.tag:presets
.
{
  "embed": {
    "color": 39423,
    "image": {
            "url": "https://img.pvme.io/images/ULpvc5dTZC.png"
        },
    "fields":[
        {
            "name":"__Preset Suggestions__",
            "value":"⬥ [Necromancy preset](https://pvme.github.io/preset-maker/#/LINKHERE) <:necromancy:1148995625896120460>\\n⬥ [Magic preset](https://pvme.github.io/preset-maker/#/LINKHERE) <:magic:689504724159823906>\\n⬥ [Hybrid preset](https://pvme.github.io/preset-maker/#/LINKHERE) <:range:580168050121113623> <:melee:1096130867279171706> "
        }
    ]
  }
}
.embed:json

.
## __Mechanics__
.tag:mechanics
⬥ first mechanic
    • describe the mechanic
        ⬩ [describe how to handle mechanic]
.img:https://img.pvme.io/images/Ig3eyaJ8gN.png
⬥ [Repeat for the rest of the mechanics]

.
## __The Fight__
.tag:fight
⬥ [Explain the fight, break it down into phases if applicable]

.
## __Rotations__
.tag:rotations
⬥ [Phase 1 rotations]
⬥ [Phase 2 rotations]
⬥ [etc]

.
## __Example Kills__
.tag:example`;

     const afkGuide =
`# Title
.img:https://img.pvme.io/images/ssAwdSFcqC.png
*Note: a **Table of Contents** can be found in the pins.*

.
## __Disclaimer__
.tag:disclaimer
⬥ **IF YOU CANNOT GET A METHOD TO WORK __DO NOT__ MESSAGE THE CREATOR(S)**
    • It is **more than likely __user error__ or __cutting corners__**, use <#656898197561802760> if you cannot get it to work

.
## __Positioning__
.tag:positioning
.img:https://img.pvme.io/images/SmRV0soAtP.png
⬥ Notes if needed

.
## __Style 1 AFK Method (~X kph)__
.tag:method1
### Overview
.
{
  "embed": {
  "title": "",
    "description":"⬥ The following **ARE REQUIRED** for this method to work:\\n\\u00a0\\u00a0\\u00a0\\u00a0• **Cutting corners will result in failure**\\n\\u00a0\\u00a0\\u00a0\\u00a0• A more extensive list can be found in <#1130180182544744551>",
    "color": 39423,
    "fields": [
      {
        "name": "__Items__",
        "value": "⬥ [Item](link_to_item) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)\\n⬥ [Item](link_to_item) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)\\n⬥ [Item](link_to_item) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)"
      },
      {
        "name": "__Abilities__",
        "value": "⬥ [Greater ability](link_to_ability) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)\\n⬥ [Greater ability](link_to_ability) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)\\n⬥ [Greater ability](link_to_ability) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)"
      },
      {
        "name": "__Other__",
        "value": "⬥ [Other](link_to_other) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)\\n⬥ [Other](link_to_other) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)\\n⬥ [Other](link_to_other) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)"
      }
    ]
   }
}
.embed:json
⬥ Extra notes (if needed)

.
## __Presets and Relics__
.tag:presets
.
{
  "embed": {
    "color": 39423,
    "image": {
            "url": "https://img.pvme.io/images/ULpvc5dTZC.png"
        },
    "fields":[
        {
            "name":"__Preset Suggestions__",
            "value":"⬥ [Necromancy preset](https://pvme.github.io/preset-maker/#/LINKHERE) <:necromancy:1148995625896120460>\\n⬥ [Magic preset](https://pvme.github.io/preset-maker/#/LINKHERE) <:magic:689504724159823906>\\n⬥ [Hybrid preset](https://pvme.github.io/preset-maker/#/LINKHERE) <:range:580168050121113623> <:melee:1096130867279171706> "
        }
    ]
  }
}
.embed:json

.
### Action Bars
.img:https://img.pvme.io/images/uDqiLvEHFf.png
⬥ Notes if needed

.
### Recommendations
[Recommended items and unlocks]

### KPH
⬥ Extra notes

.
### Example Kills
.
⬥ [Title](link)`;

    const slayerGuide = 
`# [Slayer Creature Name]
*Note: a **Table of Contents** can be found in the pins.*

.
## __Introduction__
.tag:intro
[Brief overview]

.
### Stats
⬥ <:slayer:797896049548066857> level: X
⬥ <:slayer:797896049548066857> XP per kill: X
⬥ Optimal kills per hour: ~X <emoji of combat style 1> (AFK)
⬥ Optimal <:slayer:797896049548066857> XP per hour: ~X <emoji of combat style 1> (AFK)

.
## __Desirable drops__
.tag:drops
⬥ Name <emoji>
    • Required for the Slayer collection log (remove if not required)

.
### Useful Items and Unlocks
.tag:useful
{
  "embed": {
    "description":"Owning the following increases the efficiency of your sessions, but is by no means mandatory",
    "color": 39423,
    "fields": [
      {
        "name": "__Items__",
        "value": "⬥ [Slayer Codex](https://runescape.wiki/w/Slayer_Codex) <:slayercodex:1097517249499254875>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Once 50 souls are added, it can be used to teleport to the Sunken Pyramid\\n⬥ [Demon horn necklace](https://runescape.wiki/w/Demon_horn_necklace) <:demonhornnecklace:975765831248130079> and [Attuned ectoplasmator](https://runescape.wiki/w/Attuned_ectoplasmator) <:ectoplasmator:1023152065431744542>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Helps sustain your prayer\\n⬥ [Item](link_to_item) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)\\n⬥ [Item](link_to_item) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)"
      },
      {
        "name": "__Other__",
        "value": "⬥ [Vampyrism aura](https://runescape.wiki/w/Vampyrism_aura) <:vampaura:643505653079343144>\\n⬥ [Other](link_to_other) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)\\n⬥ [Other](link_to_other) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)"
      }
    ]
   }
}
.embed:json
⬥ Replace with relevant items

.
## __Location and How to Get there__
.tag:location
.
[Info]

.
## __Method: Combat Style 1__
.tag:method1
[Describe method]
[Include positioning image with tile markers if necessary]
[Other Essentials such as:
⬥ Pray <:soulsplit:615613924506599497> and <:sorrow:1137941003895046284>
⬥ Sustain <:prayer:1005450651347730533> with <:demonhornnecklace:975765831248130079> + <:ectoplasmator:1023152065431744542> and <:powderofpenance:928221126360969226>
⬥ Ensure <:elderovl:841419289831800882>, <:weppoison:689525476158472288> and <:aggressionpotion:925794592199147581> are active at all times]

.
## __Presets and Relics__
.tag:presets
.
{
  "embed": {
    "color": 39423,
    "image": {
            "url": "https://img.pvme.io/images/ULpvc5dTZC.png"
        },
    "fields":[
        {
            "name":"__Preset Suggestions__",
            "value":"⬥ [Necromancy preset](https://pvme.github.io/preset-maker/#/LINKHERE) <:necromancy:1148995625896120460>\\n⬥ [Magic preset](https://pvme.github.io/preset-maker/#/LINKHERE) <:magic:689504724159823906>\\n⬥ [Hybrid preset](https://pvme.github.io/preset-maker/#/LINKHERE) <:range:580168050121113623> <:melee:1096130867279171706> "
        }
    ]
  }
}
.embed:json

.
### Strategy
[If needed]

.
### Ability Bar
.img:https://img.pvme.io/images/mVxpNHvdJ5.png

.
### Example Kills
.
⬥ [Name](link_to_video)`;

    const presetEmbed = 
`{
  "embed": {
    "color": 39423,
    "image": {
            "url": "https://img.pvme.io/images/ULpvc5dTZC.png"
        },
    "fields":[
        {
            "name":"__Preset Suggestions__",
            "value":"⬥ [Necromancy preset](https://pvme.github.io/preset-maker/#/LINKHERE) <:necromancy:1148995625896120460>\\n⬥ [Magic preset](https://pvme.github.io/preset-maker/#/LINKHERE) <:magic:689504724159823906>\\n⬥ [Hybrid preset](https://pvme.github.io/preset-maker/#/LINKHERE) <:range:580168050121113623> <:melee:1096130867279171706> "
        }
    ]
  }
}
.embed:json`;

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
    
    let templateText = link;
    
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
    <button title="Link" on:click={() => templateText=link} class='rounded-t flex-wrap text-left bg-indigo-600 hover:bg-indigo-700 p-2 active:bg-indigo-800 border border-indigo-700' type="button">
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
    <button title="AFK Guide" on:click={() => templateText=afkGuide} class='flex-wrap text-left bg-indigo-600 hover:bg-indigo-700 p-2 active:bg-indigo-800 border border-indigo-700' type="button">
        AFK guide
    </button>
    <button title="Slayer Guide" on:click={() => templateText=slayerGuide} class='flex-wrap text-left bg-indigo-600 hover:bg-indigo-700 p-2 active:bg-indigo-800 border border-indigo-700' type="button">
        Slayer guide
    </button>
    <button title="Preset embed" on:click={() => templateText=presetEmbed} class='flex-wrap text-left bg-indigo-600 hover:bg-indigo-700 p-2 active:bg-indigo-800 border border-indigo-700' type="button">
        Preset embed
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
