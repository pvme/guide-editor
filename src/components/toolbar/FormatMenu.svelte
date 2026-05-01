<script>
    import DropdownPanel from "./DropdownPanel.svelte";
    import CaretDownFill from "svelte-bootstrap-icons/lib/CaretDownFill.svelte";
    import ToolbarTooltip from "./ToolbarTooltip.svelte";

    // Formatting icons
    import BlockquoteLeft from "svelte-bootstrap-icons/lib/BlockquoteLeft.svelte";
    import CodeSquare from "svelte-bootstrap-icons/lib/CodeSquare.svelte";
    import Code from "svelte-bootstrap-icons/lib/Code.svelte";
    import TypeBold from "svelte-bootstrap-icons/lib/TypeBold.svelte";
    import TypeItalic from "svelte-bootstrap-icons/lib/TypeItalic.svelte";
    import TypeUnderline from "svelte-bootstrap-icons/lib/TypeUnderline.svelte";
    import TypeStrikethrough from "svelte-bootstrap-icons/lib/TypeStrikethrough.svelte";
    import TypeH1 from "svelte-bootstrap-icons/lib/TypeH1.svelte";
    import TypeH2 from "svelte-bootstrap-icons/lib/TypeH2.svelte";
    import TypeH3 from "svelte-bootstrap-icons/lib/TypeH3.svelte";
    import ListUl from "svelte-bootstrap-icons/lib/ListUl.svelte";
    import ListOl from "svelte-bootstrap-icons/lib/ListOl.svelte";
    import Link45deg from "svelte-bootstrap-icons/lib/Link45deg.svelte";

    export let dispatch;

    // ------------------------------------------------------
    // Formatting groups (full desktop toolbar representation)
    // ------------------------------------------------------
    const groups = [
        {
            buttons: [
                { cmd: "bold",       icon: TypeBold,          title: "Bold – Ctrl+B" },
                { cmd: "italic",     icon: TypeItalic,        title: "Italic – Ctrl+I" },
                { cmd: "underline",  icon: TypeUnderline,     title: "Underline – Ctrl+U" },
                { cmd: "strikethrough", icon: TypeStrikethrough, title: "Strikethrough – Ctrl+Alt+S" }
            ]
        },
        {
            buttons: [
                { cmd: "h1", icon: TypeH1, title: "H1 – Ctrl+Alt+1" },
                { cmd: "h2", icon: TypeH2, title: "H2 – Ctrl+Alt+2" },
                { cmd: "h3", icon: TypeH3, title: "H3 – Ctrl+Alt+3" }
            ]
        },
        {
            buttons: [
                { cmd: "unorderedList", icon: ListUl, title: "Unordered List" },
                { cmd: "orderedList",   icon: ListOl, title: "Ordered List" }
            ]
        },
        {
            buttons: [
                { cmd: "blockquote", icon: BlockquoteLeft, title: "Blockquote" },
                { cmd: "inlineCode", icon: Code, title: "Inline Code" },
                { cmd: "codeBlock",  icon: CodeSquare, title: "Code Block" }
            ]
        },
        {
            buttons: [
                { cmd: "wikiLink", icon: Link45deg, title: "Insert Wiki Link" }
            ]
        }
    ];

    // ------------------------------------------------------
    // Mobile dropdown state
    // ------------------------------------------------------
    let open = false;
    let trigger;
</script>


<div class="relative inline-block">
    <ToolbarTooltip text="Formatting tools">
        <button
            bind:this={trigger}
            class="toolbar-btn rounded"
            on:click={() => (open = !open)}
        >
            Format&nbsp;<CaretDownFill class="mt-1" />
        </button>
    </ToolbarTooltip>

    <DropdownPanel
        {open}
        close={() => (open = false)}
        width="260px"
        centered={false}
        bind:registerTrigger={trigger}
    >
        <div class="flex flex-col p-2 text-sm w-full">
            {#each groups as group}
                {#each group.buttons as b}
                    <button
                        class="toolbar-submenu-option mb-1 flex items-center gap-2"
                        on:click={() => {
                            dispatch("command", b.cmd);
                            open = false;
                        }}
                    >
                        <svelte:component this={b.icon} />
                        <span class="flex-1">{b.title}</span>
                    </button>
                {/each}
            {/each}
        </div>
    </DropdownPanel>
</div>
