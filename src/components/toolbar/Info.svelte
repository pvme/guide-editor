<script>
    import 'flowbite';
    import InfoCircle from 'svelte-bootstrap-icons/lib/InfoCircle.svelte';
    
</script>


<button id="InfoButton" data-dropdown-toggle="InfoInformation" type="button" class='rounded-r bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-2 active:bg-indigo-800 text-sm border border-indigo-700' title="Info">
    <InfoCircle/>
</button>

<div id="InfoInformation" class="z-10 hidden rounded shadow bg-slate-700 border border-slate-800 overflow-auto" style="max-height: 80vh;">
  <div class="m-4 flex-col inline-flex text-white text-sm">
    <p>Editor for PVME discord guides.</p>
    <p>For more info, check the <a href="https://github.com/Towsti/svelte-deploy-test/blob/master/README.md" class="text-blue-400 visited:text-purple-400">README</a>.</p>
    <p class="font-bold">Links</p>
    <ul class="list-disc ml-4">
        <li><a href="https://github.com/Towsti/svelte-deploy-test" class="text-blue-400 visited:text-purple-400">Github repository</a></li>
        <li><a href="https://discord.gg/6djqFVN" class="text-blue-400 visited:text-purple-400">PVME Discord</a></li>
        <li><a href="https://pvme.github.io/" class="text-blue-400 visited:text-purple-400">PVME website</a></li>
        <li><a href="https://pvme.github.io/rotation-builder/" class="text-blue-400 visited:text-purple-400">Rotation builder</a></li>
    </ul>
    <p>For any questions, feel free to ask in the PVME Discord or DM me Pleb#0025.</p>
    <p>For bug reports, Create a issue in Github or contact me.</p>
  </div>
</div>

<style>
    p {
        margin-bottom: 0.25rem;
    }

    li {
        margin-bottom: 0.25rem;
    }
</style>