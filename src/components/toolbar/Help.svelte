<script>
    import QuestionCircle from "svelte-bootstrap-icons/lib/QuestionCircle.svelte";
    import Modal from "./Modal.svelte";
    import ToolbarTooltip from "./ToolbarTooltip.svelte";

    let open = false;
</script>

<ToolbarTooltip text="Help" align="right">
    <button
        class="toolbar-btn rounded"
        type="button"
        on:click={() => (open = true)}
    >
        <QuestionCircle />
        Help
    </button>
</ToolbarTooltip>

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

    <!-- ERROR CHECKER -->
    <h3 class="text-xl font-semibold mt-8 mb-2">Error Checker</h3>
    <p>
        The checker appears below the editor as you write. It looks for common issues that
        can break publishing, preview badly in Discord, or make table-of-contents links fail.
    </p>

    <ul class="list-disc ml-6 mt-3">
        <li>
            <strong>Message and command problems</strong> — invalid commands, bad attachments,
            invalid embed JSON, messages over Discord limits, and empty-line issues.
        </li>
        <li>
            <strong>Formatting structure</strong> — heading placement, unsupported heading levels,
            redundant heading bolding, and list indentation.
        </li>
        <li>
            <strong>Discord reliability</strong> — emoji spacing, emojis inside links,
            Discord CDN images, raw PVME image links, and blocked hosts such as <code>streamable.com</code>.
        </li>
        <li>
            <strong>Cleanup</strong> — trailing whitespace, accidental double spaces,
            unspaced arrows, and spacer placeholders like <code>_ _</code>.
        </li>
        <li>
            <strong>Table of contents links</strong> — <code>.tag:</code> names and
            <code>$linkmsg_...$</code> references are checked both ways so typos are easier to catch.
        </li>
    </ul>

    <!-- KEYBINDS -->
    <h3 class="text-xl font-semibold mt-8 mb-2">Keyboard Shortcuts</h3>

    <p>
        The editor supports several keyboard shortcuts to speed up formatting and editing.
    </p>

    <table class="table-auto my-4">
        <thead class="bg-slate-700">
            <tr>
                <th class="px-2 py-1">Shortcut</th>
                <th class="px-2 py-1">Action</th>
            </tr>
        </thead>

        <tbody>

            <!-- Formatting -->
            <tr>
                <td><code>Ctrl + B</code></td>
                <td>Toggle bold formatting</td>
            </tr>

            <tr>
                <td><code>Ctrl + I</code></td>
                <td>Toggle italic formatting</td>
            </tr>

            <tr>
                <td><code>Ctrl + U</code></td>
                <td>Toggle underline formatting</td>
            </tr>

            <tr>
                <td><code>Ctrl + Alt + S</code></td>
                <td>Toggle strikethrough formatting</td>
            </tr>

            <!-- Headings -->
            <tr>
                <td><code>Ctrl + Alt + 1</code></td>
                <td>Toggle H1 heading</td>
            </tr>

            <tr>
                <td><code>Ctrl + Alt + 2</code></td>
                <td>Toggle H2 heading</td>
            </tr>

            <tr>
                <td><code>Ctrl + Alt + 3</code></td>
                <td>Toggle H3 heading</td>
            </tr>

            <!-- Editing -->
            <tr>
                <td><code>Ctrl + D</code></td>
                <td>Add the next occurrence of the selected word (multi-cursor)</td>
            </tr>

            <tr>
                <td><code>Ctrl + Shift + D</code></td>
                <td>Select all occurrences of the selected word</td>
            </tr>

            <tr>
                <td><code>Ctrl + Z</code></td>
                <td>Undo</td>
            </tr>

            <tr>
                <td><code>Ctrl + Y</code></td>
                <td>Redo</td>
            </tr>

        </tbody>
    </table>

    <!-- CLICK-TO-SYNC -->
    <h3 class="text-xl font-semibold mt-8 mb-2">Click-to-Sync (Editor ↔ Preview)</h3>
    <p>
        You can jump between the editor and preview instantly:
    </p>

    <ul class="list-disc ml-6 mt-1">
        <li><strong>Click the preview</strong> → jumps to the matching line in the editor</li>
        <li><strong>Double-click the editor</strong> → highlights & scrolls the matching message in the preview</li>
    </ul>

    <p class="mt-2">
        This is especially helpful in long guides where scrolling manually is slow.
    </p>

    <!-- TABLE OF CONTENTS -->
    <h3 class="text-xl font-semibold mt-10 mb-2">Table of Contents</h3>
    <p>
        Add a line like <code>.tag:section-name</code> anywhere in your guide.
        Reference it with <code>$linkmsg_section-name$</code>, either by itself or inside a link.
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
                rel="noreferrer"
            >#editors-chat</a>
        </strong>.
    </p>

</Modal>
