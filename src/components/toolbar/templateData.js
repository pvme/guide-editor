// --------------------------------------------------------------
// Template Data for TemplateMenu
// --------------------------------------------------------------

export const disclaimer = `.
> ## ⚠️ Disclaimer
> **Some methods in this guide may not work after [INSERT CHANGE HERE]**
> Know of a newer method/rotation? Got a video? Share it in <#1020853673317908500>!
`;

export const bossGuide = `# <Boss Name> — Boss Guide
.img:https://img.pvme.io/images/dx3gXBIgpJ.png

.
## __General Information__
.tag:generalInfo
⬥ <Boss overview: LP, phases, immunities, enrage, etc. - see previous examples created in this thread>
⬥ <Boss Name> has <Life points> LP, across <a single fight phase / X fight phases>.
⬥ <Boss Name> is immune to <list immunities>.

Other guides: link to forum of rotation guides, mechanics if they exist, afk if that exists etc.

.
## __Gear, Relics and Familiars__
.tag:GearRelicsFamiliars
:Combat style icon: [Combat style name](<preset_link>)

.
## __Fight Mechanics__
.tag:fightMechanics
⬥ <Key requirements or notable restrictions that cover the entire fight>

.
### Attack Rotation
<High-level boss attack order>
*Repeat*

.
### <Name of Mechanic 1> [(Example gif link)](<example_link>)
**Mechanic:**
<What the boss does>
**Solution:**
⬥ <Responses>

.
### <Name of Mechanic 2> [(Example gif link)](<example_link>)
**Mechanic:**
<What the boss does>
**Solution:**
⬥ <Responses>


.
## __Videos__
.tag:videos
⬥ [Example kill](<video_link>)

.
{
  "embed": {
    "title": "__Table of Contents__",
    "description": "*To edit this guide in our web editor [click here](<https://pvme.io/guide-editor/?id={{channel:id}}>), or visit <id:customize> and select Entry Editor*\\n⬥ [General Info]($linkmsg_generalInfo$)\\n⬥ [Gear, Relics and Familiars]($linkmsg_GearRelicsFamiliars$)\\n⬥ [Fight Mechanics]($linkmsg_fightMechanics$)\\n⬥ [Videos]($linkmsg_videos$)",
    "color": 39423
  }
}
.embed:json
.pin:delete`;

export const afkGuide = `# __AFK Boss Name__
.img:https://img.pvme.io/images/ssAwdSFcqC.png
*Note: a **Table of Contents** can be found in the pins.*

.
## __Disclaimer__
.tag:disclaimer
⬥ **IF YOU CANNOT GET A METHOD TO WORK __DO NOT__ MESSAGE THE CREATOR(S)**
    • It is **more than likely __user error__ or __cutting corners__**, use <#656898197561802760> if you cannot get it to work

.
## <:melee:1096130867279171706> __Method 1: Melee AFK__
.tag:method1

.
### __Requirements__
[Only include deviations from standard lists, etc.]

.
{
  "embed": {
    "description": "⬥ The following **ARE REQUIRED** for this method to work:\\n\\u00a0\\u00a0\\u00a0\\u00a0• **Cutting corners will result in failure**\\n\\u00a0\\u00a0\\u00a0\\u00a0• A more extensive list can be found in <#1251377307315077151>",
    "color": 39423,
    "fields": [
      {
        "name": "__Items__",
        "value": "⬥ [Item](#wiki-link) <emoji>\\n\\u00a0\\u00a0\\u00a0\\u00a0• Notes..."
      },
      {
        "name": "__Abilities__",
        "value": "⬥ [Codex-unlocked abilities](#wiki-link) <emoji> ..."
      },
      {
        "name": "__Other__",
        "value": "⬥ [Other](#wiki-link) <emoji> ..."
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
⬥ [Melee - Basic](https://presets.pvme.io/?id=<presetID>) <:melee:1096130867279171706>
⬥ [Melee - Advanced](https://presets.pvme.io/?id=<presetID>) <:melee:1096130867279171706>

.
### __Action Bars__
.img:https://img.pvme.io/images/uDqiLvEHFf.png
⬥ Notes if needed

.
## __Example Kills__
.tag:examples
<:melee:1096130867279171706> Method 1 example - [Youtube Link](<#>)
.

.
Content managed by: [<@123>]
Content maintained by: [<@123>]

.
{
  "embed": {
    "title": "__Table of Contents__",
    "description": "*To edit this guide in our web editor [click here](<https://pvme.io/guide-editor/?id={{channel:id}}>), or visit <id:customize> and select Entry Editor*\\n⬥ [Disclaimer]($linkmsg_disclaimer$)\\n⬥ [Method 1]($linkmsg_method1$)\\n⬥ [Example Kills]($linkmsg_examples$)",
    "color": 39423
  }
}
.embed:json
.pin:delete`;

export const slayerGuide = `# __[Slayer Creature Name]__
*Note: a **Table of Contents** can be found in the pins.*

.
## __Introduction__
.tag:intro
[Brief overview]

.
### __Stats__
.tag:stats
⬥ <:slayer:797896049548066857> level: X
⬥ XP per kill: X
⬥ Optimal kills/hr: X
⬥ Optimal XP/hr: X

.
### __Desirable drops__
.tag:drops
⬥ Name <emoji>

.
## __Location__
[Details, image, etc.]

.img:https://img.pvme.io/images/SmRV0soAtP.png

.
## <:melee:1096130867279171706> __Method 1__
.tag:method1
[Description]

.
### __Preset Suggestions__
⬥ [Melee - Basic](https://presets.pvme.io/?id=<presetID>)
⬥ [Melee - Advanced](https://presets.pvme.io/?id=<presetID>)

.
### __Action Bars__
.img:https://img.pvme.io/images/uDqiLvEHFf.png

.
## __Example Kills__
.tag:examples
Example kill - [Youtube Link](<#>)
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
        "value": "⬥ [Method 1]($linkmsg_method1$)",
        "inline": true
      }
    ]
  }
}
.embed:json`;

export const commandTemplate = `{
  "embed": {
  	"title": "__Insert command title or question here__",
    "description": "(Optional) short purpose of the command",
    "color": 39423,
    "fields": [
      {
        "name": "__Insert sub-heading 1 here__",
        "value": "⬥ Ideally keep bullets to a single line with no wrap\\n⬥ Dont have too many bullets - less is more"
      },
      {
        "name": "__Insert sub-heading 2 here__",
        "value": "⬥ Used for counter-arguments or additional information"
      }
    ]
  }
}
.embed:json`;

export const embedTextFormatting = `{
  "embed": {
    "title": "__Embed Template Example__",
    "description": "Ask questions if you get stumped",
    "color": 39423,
    "fields": [
      {
        "name": "__Header 1__",
        "value": "⬥ Header 1 subpoint..."
      },
      {
        "name": "__Header 2__",
        "value": "⬥ Header 2 subpoint..."
      },
      {
        "name": "__Header 3__",
        "value": "⬥ Header 3 subpoint with hyperlink..."
      }
    ]
  }
}
.embed:json`;
