<script>
    import QuestionCircle from "svelte-bootstrap-icons/lib/QuestionCircle.svelte";
    import Modal from "./Modal.svelte";

    let open = false;
</script>

<button
    class="rounded-l bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-2
           active:bg-indigo-800 text-sm border border-indigo-700"
    title="Help"
    on:click={() => (open = true)}
>
    <QuestionCircle />
</button>

<Modal {open} close={() => (open = false)}>

    <!-- USING THE EDITOR -->
    <h2 class="text-2xl font-semibold mb-4">Using the Guide Editor</h2>
    <p>
        The editor is designed to make writing PVME guides fast, consistent, and easy.
        As you type, the preview updates instantly and reflects how your guide will look in Discord.
    </p>

    <!-- AUTO FORMATTING -->
    <h3 class="text-xl font-semibold mt-8 mb-2">Automatic Formatting</h3>
    <p>
        The editor applies a small number of smart formatting rules for convenience.
    </p>

    <table class="table-auto my-4">
        <thead class="bg-slate-700">
            <tr>
                <th class="px-2 py-1">You type…</th>
                <th class="px-2 py-1">It becomes…</th>
                <th class="px-2 py-1">Use it for…</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>-></code></td>
                <td><code>→</code></td>
                <td>Arrows in rotations or explanations</td>
            </tr>
        </tbody>
    </table>

    <p class="mt-2 text-slate-300">
        All other replacements (emojis, channels, users) now use the autocomplete system
        instead of automatic conversion.
    </p>

    <!-- AUTOCOMPLETE -->
    <h3 class="text-xl font-semibold mt-8 mb-2">Autocomplete (Emojis, Channels, Users)</h3>
    <p>
        As you type <code>:</code>, <code>#</code>, or <code>@</code>,
        the editor shows a dropdown of matching items from PVME settings.
        Pick the one you want — no need to memorise names or search JSON.
    </p>

    <ul class="list-disc ml-6 mt-1">
        <li><strong>Emojis</strong> → type <code>:</code> (e.g. <code>:gbar</code>)</li>
        <li><strong>Channels</strong> → type <code>#</code></li>
        <li><strong>Users</strong> → type <code>@</code></li>
    </ul>

    <p class="mt-2">
        The preview displays the correct Discord emoji or mention immediately.
    </p>

    <!-- SYNTAX HELP -->
    <h3 class="text-xl font-semibold mt-8 mb-2">Syntax Helper</h3>
    <p>Useful formatting features supported by the editor:</p>

    <ul class="list-disc ml-6 mt-1">

        <li>
            <strong>Headings</strong> — use <code>#</code>, <code>##</code>, <code>###</code>
        </li>

        <li>
            <strong>Code</strong> — wrap code in backticks:
            <ul class="list-disc ml-6 mt-1">
                <li><strong>Inline</strong>: <code>`example`</code></li>
                <li><strong>Blocks</strong>: triple backticks <code>```</code></li>
            </ul>
        </li>

        <li>
            <strong>Bolding</strong> — <code>**text**</code> or use the toolbar
        </li>

        <li>
            <strong>Hide embeds</strong> — wrap a link in angle brackets:  
            <code>&lt;https://example.com&gt;</code>  
            (prevents Discord from creating an embed)
        </li>

        <li>
            <strong>Images / embeds</strong> — paste a link or use the toolbar
        </li>
    </ul>

    <!-- CLICK-TO-SYNC -->
    <h3 class="text-xl font-semibold mt-8 mb-2">Click-to-Sync (Editor ↔ Preview)</h3>
    <p>
        You can jump between the editor and preview instantly:
    </p>

    <ul class="list-disc ml-6 mt-1">
        <li><strong>Click the preview</strong> → jumps to the matching line in the editor</li>
        <li><strong>Click the editor</strong> → highlights & scrolls the matching message in the preview</li>
    </ul>

    <p class="mt-2">
        This is especially helpful in long guides where scrolling manually is slow.
    </p>

    <!-- TABLE OF CONTENTS -->
    <h3 class="text-xl font-semibold mt-10 mb-2">Table of Contents</h3>
    <p>
        Add a line like <code>.tag:section-name</code> anywhere in your guide.
        The editor automatically creates a clickable table of contents based on these tags.
    </p>

    <p class="mt-3">
        <img
            src="https://i.gyazo.com/660bdd70da519834a2250e8523ae7455.gif"
            alt="Table of contents example"
            class="rounded border border-slate-700"
        />
    </p>

    <!-- HELP -->
    <h3 class="text-xl font-semibold mt-10 mb-2">Need Help?</h3>
    <p>
        Ask anytime in
        <strong>
            <a
                href="https://discord.com/channels/534508796639182860/724129126314803230"
                class="text-blue-400 visited:text-purple-400"
                target="_blank"
            >#editors-chat</a>
        </strong>.
    </p>

</Modal>
