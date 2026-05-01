<script>
    import InfoCircle from "svelte-bootstrap-icons/lib/InfoCircle.svelte";
    import FileEarmarkArrowDown from "svelte-bootstrap-icons/lib/FileEarmarkArrowDown.svelte";
    import Modal from "./Modal.svelte";
    import { Code } from "svelte-bootstrap-icons";

    let open = false;
</script>

<button
    class="toolbar-btn rounded"
    title="About"
    type="button"
    on:click={() => (open = true)}
>
    <InfoCircle />
    About
</button>

<Modal {open} close={() => (open = false)}>
    <h2 class="text-2xl font-semibold mb-4">About this editor</h2>

    <p>
        This app is used to create and update
        <a href="https://discord.gg/6djqFVN" target="_blank" rel="noreferrer"
           class="text-blue-400 visited:text-purple-400">PVME Discord</a>
        guides with formatting tools, styleguide checks,
        a preview of what it will look like in Discord,
        and an feature to submit changes for review on GitHub.
    </p>

    <h2 class="text-xl mt-8 mb-1">Disclaimer</h2>
    <p class="mt-4">Discord may render some messages slightly differently to your web browser.</p>
    <p class="mt-4">To see what it will really look like in Discord:</p>
    <ul class="mt-2 list-disc list-outside pl-6">
        <li>Press the top-right <FileEarmarkArrowDown class="inline" /> menu button to download your guide as a <code>.txt</code> file</li>
        <li>
            Open the
            <a href="https://discord.com/channels/534508796639182860/689575078698287152"
                target="_blank"
                rel="noreferrer"
                class="text-blue-400 visited:text-purple-400">#bot-test</a>
            channel in Discord
        </li>
        <li>Send the message <code>pvme$txtpost</code> with your <code>.txt</code> file attached</li>
    </ul>

    <h2 class="text-xl mt-8 mb-1">Need support?</h2>
    <p>
        If you need help or have a question to ask, join
        <strong>
            <a href="https://discord.com/channels/534508796639182860/724129126314803230"
               target="_blank"
               rel="noreferrer"
               class="text-blue-400 visited:text-purple-400">#editors-chat</a>
        </strong> and tag x222 or Rcm37.
    </p>

    <h2 class="text-xl mt-8 mb-1">Useful Links</h2>
    <ul class="list-disc list-outside pl-6">
        <li><a href="https://github.com/pvme/guide-editor" target="_blank" rel="noreferrer"
               class="text-blue-400 visited:text-purple-400">Github</a></li>
        <li><a href="https://github.com/pvme/pvme-guides" target="_blank" rel="noreferrer"
               class="text-blue-400 visited:text-purple-400">pvme-guides Github</a></li>
        <li><a href="https://pvme.github.io/rotation-builder/" target="_blank" rel="noreferrer"
               class="text-blue-400 visited:text-purple-400">Rotation builder</a></li>
    </ul>
</Modal>
