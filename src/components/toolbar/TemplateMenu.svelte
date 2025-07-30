<script>
    import 'flowbite';

    import Button from './Button.svelte';
    import CaretDownFill from 'svelte-bootstrap-icons/lib/CaretDownFill.svelte';
    import Clipboard from 'svelte-bootstrap-icons/lib/Clipboard.svelte';
    import { styleGuide } from './../../pvmeSettings';

    let copy = copyToClipboard;

    const link = '';

    const disclaimer = 
`.
> ## ⚠️ Disclaimer
> **This guide may not work after changes to [INSERT DESCRIPTION HERE]**
> Know of a newer method/rotation? Share it in <#1020853673317908500> to help keep this guide up-to-date!
`;

    const guide = 
`# __Boss Name__
.img:https://img.pvme.io/images/ssAwdSFcqC.png
*Note: a **Table of Contents** can be found in the pins.*

.
## __Introduction__
.tag:intro
[Intro to the boss, key reasons for hunting it and any overall guide commentary.]

This is an **advanced guide** which assumes a strong underlying knowledge of all mechanics and information presented in <\\#linkbasicguide>.

.
## <:melee:1096130867279171706> __Melee Strategy__ [copy section below for each combat style]
.tag:melee
### __Preset Suggestions__
.tag:presets
{
  "embed": {
    "color": 39423,
    "image": {
      "url": "https://img.pvme.io/images/ULpvc5dTZC.png"
    },
    "fields": [
      {
        "name": "__Presets, Relics and Familiars__",
        "value": "⬥ [Melee - Basic](https://pvme.github.io/preset-maker/#/#linktopreset) <:melee:1096130867279171706>\\n⬥ [Melee - Advanced](https://pvme.github.io/preset-maker/#/linktopreset) <:melee:1096130867279171706>"
      }
    ]
  }
}
.embed:json

.
### __Rotations__
.tag:rotations
This rotation aims for [use one of these patterns: 4:00–4:30 / sub-3m / 15–17s] kill times.

.
**Outside instance**
[At wars / outside gate]

**Inside instance**
[Before boss spawns]

**Main fight**
[When boss spawns]

.
## __Example Kills__
.tag:examples
<:melee:1096130867279171706> Melee example kills - [Youtube Link](<#>)
.

.
Content managed by: [<@123>]
Content maintained by: [<@123>]

.
{
  "embed": {
    "title": "__Table of Contents__",
    "description": "*To edit this guide in our web editor [click here](<https://pvme.io/guide-editor/?id={{channel:id}}>), or visit <id:customize> and select Entry Editor*\\n⬥ [Introduction]($linkmsg_intro$)\\n⬥ [Melee Strategy]($linkmsg_melee$)\\n\\u00a0\\u00a0\\u00a0\\u00a0• [Preset Suggestions]($linkmsg_presets$)\\n\\u00a0\\u00a0\\u00a0\\u00a0• [Rotations]($linkmsg_rotations$)\\n⬥ [Example Kills]($linkmsg_examples$)",
    "color": 39423
  }
}
.embed:json
.pin:delete`;

    const afkGuide =
`# __AFK Boss Name__
.img:https://img.pvme.io/images/ssAwdSFcqC.png
*Note: a **Table of Contents** can be found in the pins.*

.
## __Disclaimer__
.tag:disclaimer
⬥ **IF YOU CANNOT GET A METHOD TO WORK __DO NOT__ MESSAGE THE CREATOR(S)**
    • It is **more than likely __user error__ or __cutting corners__**, use <#656898197561802760> if you cannot get it to work

.
## <:melee:1096130867279171706> __Method 1: Melee AFK__ [copy section below for each method]
.tag:method1

.
### __Requirements__
You only need to include things which differ from the lists in <#1251377307315077151>, e.g., situational perks <:demonslayerperk:689502842653900818>, niche items <:iritsticks:690987265371144202> or specific ability unlocks for the action bar]
.
{
  "embed": {
    "description": "⬥ The following **ARE REQUIRED** for this method to work:\\n\\u00a0\\u00a0\\u00a0\\u00a0• **Cutting corners will result in failure**\\n\\u00a0\\u00a0\\u00a0\\u00a0• A more extensive list can be found in <#1251377307315077151>",
    "color": 39423,
    "fields": [
      {
        "name": "__Items__",
        "value": "⬥ [Item](#wiki-link) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)\\n⬥ [Item](#wiki-link) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)"
      },
      {
        "name": "__Abilities__",
        "value": "⬥ [Codex-unlocked abilities](#wiki-link) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)\\n⬥ [Talent Tree abilities](#wiki-link) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)"
      },
      {
        "name": "__Other__",
        "value": "⬥ [Other](#wiki-link) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes (if needed)"
      }
    ]
  }
}
.embed:json

.
### __Positioning__
.img:https://img.pvme.io/images/SmRV0soAtP.png
⬥ Notes if needed

.
### __Preset Suggestions__
.
{
  "embed": {
    "color": 39423,
    "image": {
      "url": "https://img.pvme.io/images/ULpvc5dTZC.png"
    },
    "fields": [
      {
        "name": "__Presets, Relics and Familiars__",
        "value": "⬥ [Melee - Advanced](https://pvme.github.io/preset-maker/#/#linktopreset) <:melee:1096130867279171706>\\n⬥ [Magic - Advanced](https://pvme.github.io/preset-maker/#/linktopreset) <:magic:689504724159823906>"
      }
    ]
  }
}
.embed:json

.
### __Action Bars__
.img:https://img.pvme.io/images/uDqiLvEHFf.png
⬥ Notes if needed

.
## __Example Kills__
.tag:examples
<:melee:1096130867279171706> Method 1: Melee example kills - [Youtube Link](<#>)
.

.
Content managed by: [<@123>]
Content maintained by: [<@123>]

.
{
  "embed": {
    "title": "__Table of Contents__",
    "description": "*To edit this guide in our web editor [click here](<https://pvme.io/guide-editor/?id={{channel:id}}>), or visit <id:customize> and select Entry Editor*\\n⬥ [Disclaimer]($linkmsg_disclaimer$)\\n⬥ [ Method 1: Melee AFK]($linkmsg_method1$)\\n⬥ [Example Kills]($linkmsg_examples$)",
    "color": 39423
  }
}
.embed:json
.pin:delete`;

    const slayerGuide = 
`# __[Slayer Creature Name]__
*Note: a **Table of Contents** can be found in the pins.*

.
## __Introduction__
.tag:intro
[Brief overview]

.
### __Stats__
.tag:stats
⬥ <:slayer:797896049548066857> level: X  
⬥ <:slayer:797896049548066857> XP per kill: X  
⬥ Optimal kills per hour: ~X <emoji of combat style 1> (AFK)  
⬥ Optimal <:slayer:797896049548066857> XP per hour: ~X <emoji of combat style 1> (AFK)

.
### __Desirable drops__
.tag:drops
⬥ Name <emoji>
    • Required for the Slayer collection log (remove if not required)

.
## __Location and How to Get there__
[If there are multiple locations, move this section into each Method (after __Requirements__ section)]

[⬥ Notes if needed]
.img:https://img.pvme.io/images/SmRV0soAtP.png

.
## <:melee:1096130867279171706> __Method 1: Melee AFK__ [copy section below for each method]
.tag:method1
[Describe method]
[List other essentials, e.g.:
⬥ Pray <:soulsplit:615613924506599497> and <:sorrow:1137941003895046284>
⬥ Sustain prayer with <:demonhornnecklace:975765831248130079> + <:ectoplasmator:1023152065431744542> and <:powderofpenance:928221126360969226>
⬥ Ensure <:elderovl:841419289831800882>, <:weppoison:689525476158472288> and <:aggressionpotion:925794592199147581> are active at all times]

.
### __Preset Suggestions__
.
{
  "embed": {
    "color": 39423,
    "image": {
      "url": "https://img.pvme.io/images/ULpvc5dTZC.png"
    },
    "fields": [
      {
        "name": "__Presets, Relics and Familiars__",
        "value": "⬥ [Melee - Advanced](https://pvme.github.io/preset-maker/#/#linktopreset) <:melee:1096130867279171706>\\n⬥ [Magic - Advanced](https://pvme.github.io/preset-maker/#/linktopreset) <:magic:689504724159823906>"
      }
    ]
  }
}
.embed:json

.
### __Strategy [Optional section]__
[Use this section if extra guidance is needed, or users find common issues]

.
### __Action Bars__
.img:https://img.pvme.io/images/uDqiLvEHFf.png
⬥ Notes if needed

.
## __Example Kills__
.tag:examples
<:melee:1096130867279171706> Method 1: Melee example kills - [Youtube Link](<#>)
.

.
Content managed by: [<@123>]
Content maintained by: [<@123>]

.
{
  "embed": {
    "title": "__Table of Contents__",
    "description": "*To edit this guide in our web editor [click here](<https://pvme.io/guide-editor/?id={{channel:id}}>), or visit <id:customize> and select Entry Editor*",
    "fields": [
      {
        "name": "__Information__",
        "value": "⬥ [Intro]($linkmsg_intro$)\\n⬥ [Stats]($linkmsg_stats$)\\n⬥ [Drops]($linkmsg_drops$)",
        "inline": true
      },
      {
        "name": "__Methods__",
        "value": "⬥ [Method 1: Melee AFK]($linkmsg_method1$)",
        "inline": true
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
    <button title="Disclaimer" on:click={() => templateText=disclaimer} class='rounded mb-2 flex-wrap text-left bg-indigo-600 hover:bg-indigo-700 p-2 active:bg-indigo-800 border border-indigo-700' type="button">
        Disclaimer
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
