<script>
    import QuestionCircle from "svelte-bootstrap-icons/lib/QuestionCircle.svelte";
    import Modal from "./Modal.svelte";
    import ToolbarTooltip from "./ToolbarTooltip.svelte";

    let open = false;
    let activeTab = "toolbar";

    const tabs = [
        { id: "toolbar", label: "Toolbar" },
        { id: "workspace", label: "Workspace" },
        { id: "submit", label: "Submit & review" },
        { id: "reference", label: "Reference" },
        { id: "support", label: "Support" }
    ];

    const authoringRows = [
        ["Format", "Apply bold, italic, underline, strikethrough, headings, lists, quotes, code blocks, inline code, and wiki links."],
        ["Templates", "Insert guide templates, reusable snippets, commands, embeds, .img, .tag, linkmsg, spreadsheet references, and table-of-contents embeds."],
        ["Style Guide", "Open PvME writing guidance without leaving the editor."],
        ["JSON Assistant", "Create a new Discord embed or update the embed under your cursor. Add properties, author, fields, images, footer, colours, or copy an example."]
    ];

    const workspaceRows = [
        ["Load a guide", "Search PvME guides and open one as a browser-saved draft. Press Ctrl + Space to open search, use arrow keys to move, Enter to load, or Escape to close."],
        ["Submit update", "Becomes available after a loaded PvME guide has real changes. The button explains what is missing when it is disabled."],
        ["My files", "Switch drafts, create a local draft, rename local-only drafts, download any draft as .txt, or discard drafts."],
        ["Account", "Log in with GitHub or Discord, log out, and open Review PRs when your account has reviewer access."],
        ["Options", "Hide the Discord preview, choose what is inserted after emoji completion, and enable rotation builder mode."],
        ["Help", "Open this popup."]
    ];

    const editorRows = [
        ["Editor", "Write or paste guide text. The editor supports multiple selections, undo/redo, autocomplete, bracket matching, and line numbers."],
        ["Discord preview", "Shows the rendered guide. Click a preview message to jump to the matching editor text."],
        ["Editor to preview sync", "Move the cursor or double-click editor content to keep the preview aligned and highlighted."],
        ["Checker", "The panel below the editor lists syntax and style issues. Click an issue to jump to it."],
        ["Local saving", "Drafts save automatically in this browser, including the loaded guide source and original text used for submit checks."]
    ];

    const submitRows = [
        ["Before submitting", "Load a PvME guide, make changes, fill in update notes, and review checker issues."],
        ["Sign in", "GitHub sign-in submits through GitHub. Discord sign-in submits through the PvME guide bot."],
        ["Existing updates", "If a submitted update already exists for the guide, continue that update or start again from the live guide and replace it intentionally."],
        ["Review mode", "Loaded PR files are edited through Review PRs, not the normal submit button."],
        ["Test in Discord", "Download the draft from My files, then post it in #bot-test with pvme$txtpost and the .txt file attached."]
    ];

    const reviewRows = [
        ["Find PRs", "Reviewers can open Review PRs from the account area to load submitted guide updates."],
        ["Check changes", "Review PRs shows guide metadata, changed files, checks, notes, and review status."],
        ["Edit and save", "Load a submitted guide file, make reviewer edits, save them back to the PR, and refresh checks."],
        ["Finish review", "Merge approved guide updates or close updates with a reason when they should not be merged."]
    ];

    const checkerRows = [
        ["Message and command problems", "Invalid commands, bad attachments, invalid embed JSON, message limits, and empty-line issues."],
        ["Formatting structure", "Heading placement, unsupported heading levels, redundant heading bolding, and list indentation."],
        ["Discord reliability", "Emoji spacing, emojis inside links, Discord CDN images, raw PvME image links, and blocked hosts such as streamable.com."],
        ["Cleanup", "Trailing whitespace, accidental double spaces, unspaced arrows, and spacer placeholders like _ _."],
        ["Table of contents", ".tag names and $linkmsg_...$ references are checked both ways."]
    ];

    const shortcutRows = [
        ["Ctrl + B", "Toggle bold"],
        ["Ctrl + I", "Toggle italic"],
        ["Ctrl + U", "Toggle underline"],
        ["Ctrl + Alt + S", "Toggle strikethrough"],
        ["Ctrl + Alt + 1 / 2 / 3", "Toggle H1, H2, or H3"],
        ["Ctrl + Space", "Open guide search"],
        ["Ctrl + D", "Add next occurrence of the selected word"],
        ["Ctrl + Shift + D", "Select all occurrences of the selected word"],
        ["Ctrl + Z / Ctrl + Y", "Undo / redo"]
    ];

    const autocompleteRows = [
        [":emoji or ;emoji;", "Insert a Discord emoji. Example: :gbar or ;gbar;."],
        [";@user; / ;@&role; / ;#channel;", "Insert Discord user, role, or channel mentions."],
        ["Bare words in rotation builder mode", "When enabled, known ability words complete into emojis while typing rotations."],
        ["Preset maker URLs", "pvme.io/preset-maker links are converted to presets.pvme.io links automatically."]
    ];

    const typingRows = [
        ["->", "→", "Plain arrows"],
        [";b1; / ;b2; / ;b3;", "⬥ /     • /         ⬩", "Guide bullets"],
        [";eb1; / ;eb2; / ;eb3;", "⬥ / \\u00A0\\u00A0\\u00A0\\u00A0• / \\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0⬩", "Embed bullets"],
        [";nl; or ;newline;", "new line", "Line breaks"],
        [";empty;", "zero-width space", "Empty embed fields or spacing"],
        [";space;", "non-breaking space", "Preserved spacing"]
    ];

    const tocRows = [
        [".tag:section-name", "Marks a section so a table of contents can link to it."],
        ["$linkmsg_section-name$", "Links to a matching tag. Templates can build compact or categorised ToC embeds from your tags."]
    ];

    const supportRows = [
        ["Questions", "Ask in #editors-chat and tag x222 or Rcm37."],
        ["Guide problems", "Include the guide name, what you changed, and any checker message you are unsure about."],
        ["Submit issues", "Mention whether you used GitHub or Discord login and what the submit modal says is missing."],
        ["Bug reports", "Share what you clicked, what happened, and what you expected to happen."]
    ];

    const supportLinks = [
        ["#editors-chat on PvME Discord", "https://discord.com/channels/534508796639182860/724129126314803230"],
        ["Guide editor on GitHub", "https://github.com/pvme/guide-editor"],
        ["PvME guides on GitHub", "https://github.com/pvme/pvme-guides"]
    ];

    function selectTab(id) {
        activeTab = id;
    }

    function handleTabKeydown(event, index) {
        const lastIndex = tabs.length - 1;
        let nextIndex = index;

        if (event.key === "ArrowRight") nextIndex = index === lastIndex ? 0 : index + 1;
        else if (event.key === "ArrowLeft") nextIndex = index === 0 ? lastIndex : index - 1;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = lastIndex;
        else return;

        event.preventDefault();
        activeTab = tabs[nextIndex].id;
    }
</script>

<ToolbarTooltip text="Help" align="right">
    <button
        class="toolbar-utility-btn rounded"
        type="button"
        on:click={() => (open = true)}
    >
        <QuestionCircle />
        Help
    </button>
</ToolbarTooltip>

<Modal {open} close={() => (open = false)} panelClass="max-w-5xl h-[82vh]">
    <div class="help-modal">
        <header class="help-header">
            <h2>Guide Editor Help</h2>
            <p>Find help by the part of the app you are using.</p>
        </header>

        <div class="help-tabs" role="tablist" aria-label="Help topics">
            {#each tabs as tab, index}
                <button
                    id={`help-tab-${tab.id}`}
                    class:active={activeTab === tab.id}
                    role="tab"
                    type="button"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`help-panel-${tab.id}`}
                    tabindex={activeTab === tab.id ? 0 : -1}
                    on:click={() => selectTab(tab.id)}
                    on:keydown={(event) => handleTabKeydown(event, index)}
                >
                    {tab.label}
                </button>
            {/each}
        </div>

        <div
            id={`help-panel-${activeTab}`}
            class="help-content"
            role="tabpanel"
            aria-labelledby={`help-tab-${activeTab}`}
        >
            {#if activeTab === "toolbar"}
                <section class="help-section">
                    <h3>Left side: authoring</h3>
                    <p>Use these when you are adding structure, inserting common guide text, or working with embeds.</p>
                    <dl class="help-grid">
                        {#each authoringRows as row}
                            <div>
                                <dt>{row[0]}</dt>
                                <dd>{row[1]}</dd>
                            </div>
                        {/each}
                    </dl>
                </section>

                <section class="help-section">
                    <h3>Middle and right side: file, account, settings</h3>
                    <dl class="help-grid">
                        {#each workspaceRows as row}
                            <div>
                                <dt>{row[0]}</dt>
                                <dd>{row[1]}</dd>
                            </div>
                        {/each}
                    </dl>
                </section>
            {:else if activeTab === "workspace"}
                <section class="help-section">
                    <h3>Main workspace</h3>
                    <dl class="help-grid">
                        {#each editorRows as row}
                            <div>
                                <dt>{row[0]}</dt>
                                <dd>{row[1]}</dd>
                            </div>
                        {/each}
                    </dl>
                </section>

                <section class="help-section">
                    <h3>Autocomplete and automatic formatting</h3>
                    <dl class="help-grid">
                        {#each autocompleteRows as row}
                            <div>
                                <dt><code>{row[0]}</code></dt>
                                <dd>{row[1]}</dd>
                            </div>
                        {/each}
                    </dl>
                </section>

                <section class="help-section">
                    <h3>Checker coverage</h3>
                    <dl class="help-grid">
                        {#each checkerRows as row}
                            <div>
                                <dt>{row[0]}</dt>
                                <dd>{row[1]}</dd>
                            </div>
                        {/each}
                    </dl>
                </section>
            {:else if activeTab === "submit"}
                <section class="help-section">
                    <h3>Submit a guide update</h3>
                    <dl class="help-grid">
                        {#each submitRows as row}
                            <div>
                                <dt>{row[0]}</dt>
                                <dd>{row[1]}</dd>
                            </div>
                        {/each}
                    </dl>
                </section>

                <section class="help-section">
                    <h3>Review PRs</h3>
                    <p>Only accounts with reviewer access see this workflow.</p>
                    <dl class="help-grid">
                        {#each reviewRows as row}
                            <div>
                                <dt>{row[0]}</dt>
                                <dd>{row[1]}</dd>
                            </div>
                        {/each}
                    </dl>
                </section>
            {:else if activeTab === "reference"}
                <section class="help-section">
                    <h3>Keyboard shortcuts</h3>
                    <dl class="help-grid compact">
                        {#each shortcutRows as row}
                            <div>
                                <dt><code>{row[0]}</code></dt>
                                <dd>{row[1]}</dd>
                            </div>
                        {/each}
                    </dl>
                </section>

                <section class="help-section">
                    <h3>Typing replacements</h3>
                    <div class="help-token-list" role="list">
                        {#each typingRows as row}
                            <div class="help-token-row" role="listitem">
                                <div>
                                    <span>You type</span>
                                    <code>{row[0]}</code>
                                </div>
                                <div>
                                    <span>Becomes</span>
                                    <code>{row[1]}</code>
                                </div>
                                <p>{row[2]}</p>
                            </div>
                        {/each}
                    </div>
                </section>

                <section class="help-section">
                    <h3>Table of contents links</h3>
                    <dl class="help-grid compact">
                        {#each tocRows as row}
                            <div>
                                <dt><code>{row[0]}</code></dt>
                                <dd>{row[1]}</dd>
                            </div>
                        {/each}
                    </dl>
                </section>

                <section class="help-section">
                    <h3>Useful links</h3>
                    <ul class="help-links">
                        <li><a href="https://github.com/pvme/guide-editor" target="_blank" rel="noreferrer">Guide editor GitHub</a></li>
                        <li><a href="https://github.com/pvme/pvme-guides" target="_blank" rel="noreferrer">PvME guides GitHub</a></li>
                        <li><a href="https://pvme.github.io/rotation-builder/" target="_blank" rel="noreferrer">Rotation builder</a></li>
                    </ul>
                </section>
            {:else if activeTab === "support"}
                <section class="help-section support-section">
                    <div class="support-callout">
                        <h3>Need help?</h3>
                        <p>
                            The fastest route is
                            <a href="https://discord.com/channels/534508796639182860/724129126314803230" target="_blank" rel="noreferrer">#editors-chat</a>.
                            Tag x222 or Rcm37 and include enough context for someone to reproduce the issue.
                        </p>
                    </div>
                </section>

                <section class="help-section">
                    <h3>Useful links</h3>
                    <div class="support-links">
                        {#each supportLinks as link}
                            <a href={link[1]} target="_blank" rel="noreferrer">{link[0]}</a>
                        {/each}
                    </div>
                </section>
            {/if}
        </div>

        <div class="help-credit">
            Built with <span aria-label="love">💗</span> by x222
        </div>
    </div>
</Modal>

<style>
    .help-modal {
        display: flex;
        height: 100%;
        min-height: 0;
        flex-direction: column;
        gap: 0.9rem;
    }

    .help-header {
        padding-right: 2rem;
    }

    .help-header h2 {
        margin: 0;
        color: #f8fafc;
        font-size: 1.45rem;
        font-weight: 700;
    }

    .help-header p {
        margin: 0.25rem 0 0;
        color: #cbd5e1;
        font-size: 0.95rem;
    }

    .help-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        border-bottom: 1px solid #334155;
        padding-bottom: 0.75rem;
    }

    .help-tabs button {
        min-height: 2.25rem;
        border-radius: 0.25rem;
        padding: 0.45rem 0.75rem;
        color: #cbd5e1;
        font-size: 0.9rem;
        transition: background-color 120ms ease, color 120ms ease;
    }

    .help-tabs button:hover,
    .help-tabs button:focus-visible {
        background: #1e293b;
        color: #f8fafc;
        outline: none;
    }

    .help-tabs button.active {
        background: #2563eb;
        color: white;
    }

    .help-content {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding-right: 0.35rem;
    }

    .help-section + .help-section {
        margin-top: 1.25rem;
        border-top: 1px solid #334155;
        padding-top: 1rem;
    }

    .help-section h3 {
        margin: 0 0 0.45rem;
        color: #f8fafc;
        font-size: 1.05rem;
        font-weight: 700;
    }

    .help-section p {
        margin: 0.4rem 0 0;
        color: #cbd5e1;
    }

    .help-grid {
        display: grid;
        gap: 0.45rem;
        margin: 0.65rem 0 0;
    }

    .help-grid div {
        display: grid;
        grid-template-columns: minmax(8rem, 11rem) minmax(0, 1fr);
        gap: 0.9rem;
        align-items: start;
        border: 1px solid rgb(51 65 85 / 0.7);
        border-left: 3px solid rgb(59 130 246 / 0.75);
        border-radius: 0.375rem;
        background:
            linear-gradient(90deg, rgb(30 41 59 / 0.78), rgb(30 41 59 / 0.34) 42%, rgb(15 23 42 / 0.18)),
            rgb(15 23 42 / 0.24);
        padding: 0.65rem 0.75rem;
    }

    .help-grid.compact div {
        grid-template-columns: minmax(11rem, 15rem) minmax(0, 1fr);
    }

    .help-grid dt {
        color: #bfdbfe;
        font-weight: 600;
    }

    .help-grid dd {
        margin: 0;
        color: #cbd5e1;
    }

    .help-token-list {
        display: grid;
        gap: 0.45rem;
        margin-top: 0.65rem;
    }

    .help-token-row {
        display: grid;
        grid-template-columns: minmax(9rem, 1fr) minmax(9rem, 1fr) minmax(8rem, 0.9fr);
        gap: 0.65rem;
        align-items: center;
        border: 1px solid rgb(51 65 85 / 0.7);
        border-left: 3px solid rgb(59 130 246 / 0.75);
        border-radius: 0.375rem;
        background:
            linear-gradient(90deg, rgb(30 41 59 / 0.78), rgb(30 41 59 / 0.34) 42%, rgb(15 23 42 / 0.18)),
            rgb(15 23 42 / 0.24);
        padding: 0.6rem 0.75rem;
    }

    .help-token-row div {
        display: flex;
        min-width: 0;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4rem;
    }

    .help-token-row span {
        color: #94a3b8;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .help-token-row p {
        margin: 0;
        color: #cbd5e1;
    }

    .help-section code {
        border-radius: 0.25rem;
        background: #0f172a;
        box-shadow: inset 0 0 0 1px rgb(51 65 85 / 0.75);
        padding: 0.08rem 0.32rem;
        color: #e2e8f0;
        font-size: 0.86em;
    }

    .help-section a {
        color: #93c5fd;
    }

    .help-section a:visited {
        color: #c4b5fd;
    }

    .help-links {
        margin: 0.55rem 0 0;
        padding-left: 1.2rem;
        color: #cbd5e1;
    }

    .help-links li + li {
        margin-top: 0.25rem;
    }

    .support-callout {
        border: 1px solid rgb(59 130 246 / 0.35);
        border-left: 3px solid rgb(96 165 250 / 0.8);
        border-radius: 0.5rem;
        background:
            linear-gradient(135deg, rgb(30 64 175 / 0.3), rgb(15 23 42 / 0.2) 55%),
            rgb(15 23 42 / 0.35);
        padding: 1rem;
    }

    .support-callout h3 {
        margin-bottom: 0.25rem;
        font-size: 1.18rem;
    }

    .support-links {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.65rem;
    }

    .support-links a {
        border: 1px solid rgb(51 65 85 / 0.85);
        border-radius: 999px;
        background: rgb(15 23 42 / 0.42);
        padding: 0.4rem 0.65rem;
        text-decoration: none;
        transition: border-color 120ms ease, background-color 120ms ease, color 120ms ease;
    }

    .support-links a:hover,
    .support-links a:focus-visible {
        border-color: rgb(96 165 250 / 0.8);
        background: rgb(30 41 59 / 0.8);
        color: #dbeafe;
        outline: none;
    }

    .help-credit {
        margin-top: auto;
        color: #94a3b8;
        font-size: 0.78rem;
        line-height: 1;
    }

    .help-credit span {
        color: #be5b7e;
    }

    @media (max-width: 720px) {
        .help-tabs {
            flex-wrap: nowrap;
            overflow-x: auto;
        }

        .help-tabs button {
            flex: 0 0 auto;
            white-space: nowrap;
        }

        .help-grid div,
        .help-grid.compact div {
            grid-template-columns: 1fr;
            gap: 0.15rem;
        }

        .help-token-row {
            grid-template-columns: 1fr;
            align-items: start;
        }

        .help-token-row div {
            align-items: flex-start;
        }
    }
</style>
