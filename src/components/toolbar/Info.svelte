<script>
    import 'flowbite';
    import InfoCircle from 'svelte-bootstrap-icons/lib/InfoCircle.svelte';
    
</script>


<button id="InfoButton" data-dropdown-toggle="InfoInformation" type="button" class='rounded-r bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-2 active:bg-indigo-800 text-sm border border-indigo-700' title="Info">
    <InfoCircle/>
</button>

<div id="InfoInformation" class="z-10 hidden rounded shadow bg-slate-700 border border-slate-800 overflow-auto" style="max-height: 80vh;">
  <div class="m-4 flex-col inline-flex text-white text-sm">
    <p>Editor for <a href="https://discord.gg/6djqFVN" class="text-blue-400 visited:text-purple-400">PVME Discord</a> guides.</p>
    <p>For any questions, feel free to ask in the PVME Discord or DM me Pleb#0025.</p>
    <h2 class="text-lg">Links</h2>
    <ul class="list-disc ml-4">
        <li><a href="https://github.com/pvme/guide-editor" class="text-blue-400 visited:text-purple-400">Github</a></li>
        <li><a href="https://github.com/pvme/guide-editor/issues" class="text-blue-400 visited:text-purple-400">Planned updates and bugfixes</a></li>
        <li><a href="https://github.com/pvme/pvme-guides" class="text-blue-400 visited:text-purple-400">pvme-guides Github</a></li>
        <li><a href="https://pvme.github.io/" class="text-blue-400 visited:text-purple-400">PVME website</a></li>
        <li><a href="https://pvme.github.io/rotation-builder/" class="text-blue-400 visited:text-purple-400">Rotation builder</a></li>
    </ul>
    <h2 class="text-lg">Disclaimer</h2>
    <p>The Discord preview is a recreation of Discord that is not 100% accurate.</p>
    <p>For example, embedded urls:</p>
    <p><img src="https://i.imgur.com/5L9iJF1.png" alt="preview-compare" class="media"></p>
    <p>The preview is therefore not a replacement of <code>pvme$txtpost</code>.</p>
  </div>
</div>

<style>
    p {
        margin-bottom: 0.25rem;
    }

    li {
        margin-bottom: 0.25rem;
    }

    code {
        background-color: rgb(30 41 59);
        padding: 1px;
    }

    h2 {
      margin-top: 8px;
    }
</style>