<script>
    import 'flowbite';
    import QuestionCircle from 'svelte-bootstrap-icons/lib/QuestionCircle.svelte';
</script>


<button id="HelpButton" data-dropdown-toggle="HelpInformation" type="button" class='rounded-l bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-2 active:bg-indigo-800 text-sm border border-indigo-700' title="Help">
    <QuestionCircle/>
</button>

<div id="HelpInformation" class="z-10 hidden rounded shadow bg-slate-700 border border-slate-800 overflow-auto" style="max-height: 80vh;">
  <div class="m-4 flex-col inline-flex text-white text-left text-sm">
    <h2 class="text-lg">Auto formatting</h2>
    <table class="table-auto my-2">
        <thead class="bg-slate-800">
          <tr>
            <th>Input</th>
            <th>Output</th>
            <th>List</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>-></code></td>
            <td><code>→</code></td>
            <td></td>
          </tr>
          <tr>
            <td><code>;gbarge;</code>, <code>;greaterbarge;</code></td>
            <td><code>&lt;:gbarge:535532879250456578&gt;</code></td>
            <td><a href="https://raw.githubusercontent.com/pvme/rotation-builder/main/settings.json" class="text-blue-400 visited:text-purple-400">emojis.json</a> (same as <a href="https://pvme.github.io/rotation-builder/" class="text-blue-400 visited:text-purple-400">rotation builder</a>)</td>
          </tr>
          <tr>
            <td><code>;#armour-and-weapons;</code></td>
            <td><code>&lt;#689235882724818962&gt;</code></td>
            <td><a href="https://raw.githubusercontent.com/pvme/pvme-settings/master/channels.json" class="text-blue-400 visited:text-purple-400">channels.json</a></td>
          </tr>
          <tr>
            <td><code>;@&pride of zaros;</code></td>
            <td><code>&lt;@&581216406570532875&gt;</code></td>
            <td><a href="https://github.com/pvme/pvme-settings/blob/master/roles.json" class="text-blue-400 visited:text-purple-400">roles.json</a></td>
          </tr>
          <tr>
            <td><code>;@pleb;</code></td>
            <td><code>&lt;@207588233780002818&gt;</code></td>
            <td><a href="https://raw.githubusercontent.com/Towsti/pvme-settings/master/users.json" class="text-blue-400 visited:text-purple-400">users.json</a></td>
          </tr>
        </tbody>
      </table>
      <h2 class="text-lg">Table of Contents</h2>
      <p>The table of contents is automatically generated from every <code>.tag:tagname</code>:</p>
      <p><a href="https://gyazo.com/660bdd70da519834a2250e8523ae7455"><img src="https://i.gyazo.com/660bdd70da519834a2250e8523ae7455.gif" alt="Image from Gyazo" class="media"/></a></p>
      <h2 class="text-lg">Lists</h2>
      <p>Use <code>Tab</code> and <code>Shift</code> + <code>Tab</code> to change the bullet type.</p>
      <p>Press <code>Enter</code> after a empty bullet to close the list.</p>
      <p><a href="https://gyazo.com/7c4cf8bd4c28ecb8051a1f44b774d047"><img src="https://i.gyazo.com/7c4cf8bd4c28ecb8051a1f44b774d047.gif" alt="Image from Gyazo" class="media"/></a></p>
      <h2 class="text-lg">Inline formatting</h2>
      <p>Use a shortcut (see tooltip) or click the formatting options to (un-)format text:</p>
      <p><a href="https://gyazo.com/541d606b59339ccb21fa85c3f54bffe1"><img src="https://i.gyazo.com/541d606b59339ccb21fa85c3f54bffe1.gif" alt="Image from Gyazo" class="media"/></a></p>
    </div>
</div>

<style>
    td,th {
        padding: 5px;
        border-width: 2px;
        border-color: rgb(30 41 59);
    }

    code {
        background-color: rgb(30 41 59);
        padding: 1px;
    }

    h2 {
      margin-top: 8px;
    }
</style>