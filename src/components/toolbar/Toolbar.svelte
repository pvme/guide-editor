<script>
    import { createEventDispatcher } from "svelte";

    import FormatMenu from "./FormatMenu.svelte";
    import InsertMenu from "./InsertMenu.svelte";
    import StyleGuideMenu from "./StyleGuideMenu.svelte";
    import EmbedGuide from "./EmbedGuide.svelte";

    import Help from "./Help.svelte";
    import Settings from "./Settings.svelte";
    import DraftsMenu from "./DraftsMenu.svelte";
    import ExportToTxt from "./ExportToTxt.svelte";
    import SubmitPr from "./SubmitPr.svelte";
    import ToolbarTooltip from "./ToolbarTooltip.svelte";

    export let insertAtCursor;
    export let getEditorCursorPosition;
    export let replaceEditorText;
    export let showView = true;

    const dispatch = createEventDispatcher();
</script>

<header
  class="sticky top-0 z-40
         bg-slate-900/80 backdrop-blur
         border-b border-slate-800
         shadow-sm shadow-[0_1px_0_rgba(15,23,42,0.6)]"
    >
        <div class="toolbar-shell mx-2 py-3 2xl:py-4 2xl:pl-3">
            <div class="toolbar-section toolbar-authoring">
                <ToolbarTooltip text="PvME Guide Editor" align="left">
                    <img
                        src="https://pvme.io/assets/logo-no-bg.png"
                        alt="PVME logo"
                        class="hidden h-9 w-auto flex-shrink-0 xl:block"
                    />
                </ToolbarTooltip>

                <div class="toolbar-button-cluster">
                    <FormatMenu {dispatch} />
                    <InsertMenu {insertAtCursor} />
                    <StyleGuideMenu />
                    <EmbedGuide {insertAtCursor} {getEditorCursorPosition} {replaceEditorText} />
                </div>
            </div>

            <div class="toolbar-section toolbar-workspace" role="group">
                <div class="toolbar-button-cluster">
                    <SubmitPr
                        corner="rounded"
                        on:loadGuide={() => dispatch("openGuideSearch")}
                        on:open={() => dispatch("openSubmitPr")}
                    />
                    <DraftsMenu
                        on:newDraft={() => dispatch("newDraft")}
                        on:renameDraft={(e) => dispatch("renameDraft", e.detail)}
                        on:deleteDraft={(e) => dispatch("deleteDraft", e.detail)}
                    />
                    <ExportToTxt label="Export" />
                </div>
            </div>

            <div class="toolbar-section toolbar-utility">
                <Settings {showView} on:toggleView={() => dispatch("toggleView")} />
                <Help/>
            </div>
        </div>
</header>

<style>
    .toolbar-shell {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 0.75rem;
    }

    .toolbar-section,
    .toolbar-button-cluster {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .toolbar-section :global(> *),
    .toolbar-button-cluster :global(> *) {
        flex-shrink: 0;
    }

    .toolbar-workspace,
    .toolbar-utility {
        justify-content: flex-start;
    }

    .toolbar-authoring {
        order: 3;
    }

    .toolbar-workspace {
        order: 2;
    }

    .toolbar-utility {
        order: 1;
    }

    @media (max-width: 639px) {
        .toolbar-shell {
            gap: 0.65rem;
        }

        .toolbar-section {
            width: 100%;
        }

        .toolbar-authoring {
            align-items: flex-start;
        }

        .toolbar-button-cluster {
            flex: 1;
        }

        .toolbar-button-cluster > :global(*),
        .toolbar-workspace > :global(*),
        .toolbar-utility > :global(*) {
            flex: 1 1 calc(50% - 0.375rem);
            min-width: 0;
        }

        .toolbar-button-cluster > :global(*) :global(button),
        .toolbar-workspace > :global(*) :global(button),
        .toolbar-utility > :global(*) :global(button) {
            width: 100%;
        }

        .toolbar-workspace > :global(.submit-guide-group),
        .toolbar-workspace > :global(.submit-guide-group) :global(.submit-guide-main) {
            width: 100%;
        }
    }

    @media (min-width: 1024px) and (max-width: 1535px) {
        .toolbar-shell {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
        }

        .toolbar-authoring {
            flex-basis: 100%;
        }

        .toolbar-workspace {
            justify-content: flex-start;
        }

        .toolbar-utility {
            justify-content: flex-start;
        }
    }

    @media (min-width: 1280px) {
        .toolbar-shell {
            grid-template-columns: auto minmax(0, 1fr) auto;
            align-items: center;
        }

        .toolbar-authoring {
            grid-column: auto;
            flex-wrap: nowrap;
            order: 1;
        }

        .toolbar-button-cluster,
        .toolbar-workspace,
        .toolbar-utility {
            flex-wrap: nowrap;
        }

        .toolbar-workspace {
            justify-content: center;
            order: 2;
        }

        .toolbar-utility {
            order: 3;
        }
    }
</style>
