<script>
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

      <!-- Arrow -->
      <tr>
        <td><code>-></code></td>
        <td><code>→</code></td>
        <td></td>
      </tr>

      <!-- Emojis -->
      <tr>
        <td>
          <code>:gbarge</code>, <code>:greaterbarge</code><br>
          <code>;:gbarge;</code> (semicolon form also works)
        </td>
        <td><code>&lt;:gbarge:535532879250456578&gt;</code></td>
        <td>
          <a href="https://raw.githubusercontent.com/pvme/pvme-settings/master/emojis/emojis.json"
             class="text-blue-400 visited:text-purple-400">emojis.json</a>
        </td>
      </tr>

      <!-- Channels -->
      <tr>
        <td>
          <code>#armour-and-weapons</code><br>
          <code>;#armour-and-weapons;</code>
        </td>
        <td><code>&lt;#689235882724818962&gt;</code></td>
        <td>
          <a href="https://raw.githubusercontent.com/pvme/pvme-settings/pvme-discord/channels.json"
             class="text-blue-400 visited:text-purple-400">channels.json</a>
        </td>
      </tr>

      <!-- Roles -->
      <tr>
        <td>
          <code>@&pride-of-zaros</code><br>
          <code>;@&pride-of-zaros;</code>
        </td>
        <td><code>&lt;@&581216406570532875&gt;</code></td>
        <td>
          <a href="https://raw.githubusercontent.com/pvme/pvme-settings/pvme-discord/roles.json"
             class="text-blue-400 visited:text-purple-400">roles.json</a>
        </td>
      </tr>

      <!-- Users -->
      <tr>
        <td>
          <code>@x222</code><br>
          <code>;@x222;</code>
        </td>
        <td><code>&lt;@207588233780002818&gt;</code></td>
        <td>
          <a href="https://raw.githubusercontent.com/pvme/pvme-settings/settings/users/users.json"
             class="text-blue-400 visited:text-purple-400">users.json</a>
        </td>
      </tr>

    </tbody>
  </table>


      <h2 class="text-lg">Table of Contents</h2>
      <p>The table of contents is automatically generated from every <code>.tag:tagname</code>:</p>
      <p><a href="https://gyazo.com/660bdd70da519834a2250e8523ae7455"><img src="https://i.gyazo.com/660bdd70da519834a2250e8523ae7455.gif" alt="" class="media"/></a></p>
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
