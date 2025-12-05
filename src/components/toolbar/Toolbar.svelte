<script>
    import { createEventDispatcher } from "svelte";

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
    import ToCDropdown from "./ToCDropdown.svelte";
    import TemplateMenu from "./TemplateMenu.svelte";
    import CommandMenu from "./CommandMenu.svelte";
    import Help from "./Help.svelte";
    import Info from "./Info.svelte";
    import ToggleView from "./ToggleView.svelte";
    import ToggleScrollBottom from "./ToggleScrollBottom.svelte";
    import ExportToTxt from "./ExportToTxt.svelte";
    import Tutorial from "./Tutorial.svelte";

    const dispatch = createEventDispatcher();

    // ----------------------------------------------------------
    // DATA-DRIVEN BUTTON DEFINITIONS
    // ----------------------------------------------------------
    const groups = [
        {
            buttons: [
                { cmd: "bold", icon: TypeBold, title: "Bold – Ctrl+B" },
                { cmd: "italic", icon: TypeItalic, title: "Italic – Ctrl+I" },
                { cmd: "underline", icon: TypeUnderline, title: "Underline – Ctrl+U" },
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
                { cmd: "orderedList", icon: ListOl, title: "Ordered List" }
            ]
        },
        {
            buttons: [
                { cmd: "inlineCode", icon: Code, title: "Inline Code" },
                { cmd: "codeBlock", icon: CodeSquare, title: "Code Block" }
            ]
        }
    ];
</script>

<div class="flex flex-wrap mt-4 mb-2 mx-2">

    <!-- AUTO-RENDERED BUTTON GROUPS -->
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

    <!-- Commands -->
    <ButtonGroup>
        <CommandMenu {dispatch} />
    </ButtonGroup>

    <!-- Templates -->
    <ButtonGroup>
        <TemplateMenu />
    </ButtonGroup>

    <!-- Table of Contents -->
    <ButtonGroup>
        <ToCDropdown />
    </ButtonGroup>

    <!-- Right side items -->
    <div class="inline-flex mx-2 ml-auto" role="group">
        <ButtonGroup>
            <Tutorial />
        </ButtonGroup>
        <ButtonGroup>
            <ExportToTxt />
        </ButtonGroup>
    </div>

    <div class="inline-flex mb-2 mx-2 ml-auto" role="group">
        <ToggleScrollBottom {dispatch} />
        <ToggleView {dispatch} />
        <Help />
        <Info />
    </div>
</div>
