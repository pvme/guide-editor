<script>
    import DropdownPanel from "./DropdownPanel.svelte";
    import CaretDownFill from "svelte-bootstrap-icons/lib/CaretDownFill.svelte";

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

    import Button from "./Button.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";

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
        }
    ];

    // ------------------------------------------------------
    // Mobile dropdown state
    // ------------------------------------------------------
    let open = false;
    let trigger;
</script>


<!-- =======================================================
   DESKTOP FORMAT TOOLBAR (visible only at lg and up)
======================================================= -->
<div class="hidden lg:flex space-x-1">
    {#each groups as group}
        <ButtonGroup>
            {#each group.buttons as b, i}
                <Button
                    title={b.title}
                    corner={i === 0 ? "rounded-l" : i === group.buttons.length - 1 ? "rounded-r" : undefined}
                    on:click={() => dispatch("command", b.cmd)}
                >
                    <svelte:component this={b.icon} />
                </Button>
            {/each}
        </ButtonGroup>
    {/each}
</div>


<!-- =======================================================
   MOBILE/TABLET: FORMAT DROPDOWN
======================================================= -->
<div class="lg:hidden relative inline-block mr-2">
    <button
        bind:this={trigger}
        class="inline-flex items-center rounded bg-indigo-600 hover:bg-indigo-700
               text-white px-3 py-2 text-sm border border-indigo-700"
        on:click={() => (open = !open)}
    >
        Format&nbsp;<CaretDownFill class="mt-1" />
    </button>

    <DropdownPanel
        {open}
        close={() => (open = false)}
        width="200px"
        centered={false}
        bind:registerTrigger={trigger}
    >
        <div class="flex flex-col p-2 text-sm w-full">
            {#each groups as group}
                {#each group.buttons as b}
                    <button
                        class="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
                               border border-indigo-700 p-2 mb-1 rounded text-left flex items-center gap-2"
                        on:click={() => {
                            dispatch("command", b.cmd);
                            open = false;
                        }}
                    >
                        <svelte:component this={b.icon} />
                        {b.title}
                    </button>
                {/each}
            {/each}
        </div>
    </DropdownPanel>
</div>