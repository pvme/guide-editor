<script>
    import InfoCircle from "svelte-bootstrap-icons/lib/InfoCircle.svelte";
    import Modal from "./Modal.svelte";

    let open = false;
</script>

<button
    class="rounded-r bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-2
           active:bg-indigo-800 text-sm border border-indigo-700"
    title="Info"
    on:click={() => (open = true)}
>
    <InfoCircle />
</button>

<Modal {open} close={() => (open = false)}>
    <h2 class="text-2xl font-semibold mb-4">About this editor</h2>

    <p>This is a live preview editor for
        <a href="https://discord.gg/6djqFVN" target="_new"
           class="text-blue-400 visited:text-purple-400">PVME Discord</a>
        guides.
    </p>

    <p class="mt-2">
        If you have questions, ask in
        <strong>
            <a href="https://discord.com/channels/534508796639182860/724129126314803230"
               target="_new"
               class="text-blue-400 visited:text-purple-400">#editors-chat</a>
        </strong> and ask for x222, Rcm37 or Pleb.
    </p>

    <h2 class="text-lg mt-4 mb-1">Useful Links</h2>
    <ul class="list-disc ml-4">
        <li><a href="https://github.com/pvme/guide-editor"
               class="text-blue-400 visited:text-purple-400">Github</a></li>
        <li><a href="https://github.com/pvme/pvme-guides"
               class="text-blue-400 visited:text-purple-400">pvme-guides Github</a></li>
        <li><a href="https://pvme.github.io/rotation-builder/"
               class="text-blue-400 visited:text-purple-400">Rotation builder</a></li>
    </ul>

    <h2 class="text-lg mt-4 mb-1">Disclaimer</h2>
    <p>The Discord preview is a live renderer and is not 100% accurate.</p>
    <p>
        To see the real version, post to
        <strong>
            <a href="https://discord.com/channels/534508796639182860/689575078698287152"
               target="_new"
               class="text-blue-400 visited:text-purple-400">#bot-test</a>
        </strong>
        with <code>pvme$txtpost</code>.
    </p>
</Modal>

