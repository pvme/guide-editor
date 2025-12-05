<script>
    import InfoCircle from 'svelte-bootstrap-icons/lib/InfoCircle.svelte';
    
</script>


<button id="InfoButton" data-dropdown-toggle="InfoInformation" type="button" class='rounded-r bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-2 active:bg-indigo-800 text-sm border border-indigo-700' title="Info">
    <InfoCircle/>
</button>

<div id="InfoInformation" class="z-10 hidden rounded shadow bg-slate-700 border border-slate-800 overflow-auto" style="max-height: 80vh;">
  <div class="m-4 flex-col inline-flex text-white text-sm">
    <p>This is live preview editor for <a href="https://discord.gg/6djqFVN" target="_new" class="text-blue-400 visited:text-purple-400">PVME Discord</a> guides.</p>
    <p>If you have questions or need support, please ask in <strong><a href="https://discord.com/channels/534508796639182860/724129126314803230" target="_new" class="text-blue-400 visited:text-purple-400">#editors-chat</a></strong>.</p>
    <h2 class="text-lg">Useful Links</h2>
    <ul class="list-disc ml-4">
        <li><a href="https://github.com/pvme/guide-editor" class="text-blue-400 visited:text-purple-400">Github</a></li>
        <li><a href="https://github.com/pvme/pvme-guides" class="text-blue-400 visited:text-purple-400">pvme-guides Github</a></li>
        <li><a href="https://pvme.github.io/rotation-builder/" class="text-blue-400 visited:text-purple-400">Rotation builder</a></li>
    </ul>
    <h2 class="text-lg">Disclaimer</h2>
    <p>The Discord preview is a live-editor recreation of Discord and is not 100% accurate.</p>
    <p>You can see a "real" version by posting your file to <strong><a href="https://discord.com/channels/534508796639182860/689575078698287152" target="_new" class="text-blue-400 visited:text-purple-400">#bot-test</a></strong> alongside the command <code>pvme$txtpost</code>.</p>
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