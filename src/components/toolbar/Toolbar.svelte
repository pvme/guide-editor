<script>
    import { createEventDispatcher } from "svelte";

    import FormatMenu from "./FormatMenu.svelte";
    import InsertMenu from "./InsertMenu.svelte";
    import StyleGuideMenu from "./StyleGuideMenu.svelte";
    import EmbedGuide from "./EmbedGuide.svelte";

    import Help from "./Help.svelte";
    import Info from "./Info.svelte";
    import ToggleView from "./ToggleView.svelte";
    import ExportToTxt from "./ExportToTxt.svelte";
    import SubmitPr from "./SubmitPr.svelte";
    import ToolbarTooltip from "./ToolbarTooltip.svelte";

    export let insertAtCursor;
    export let getEditorCursorPosition;
    export let replaceEditorText;

    const dispatch = createEventDispatcher();
</script>

<header
  class="sticky top-0 z-40
         bg-slate-900/80 backdrop-blur
         border-b border-slate-800
         shadow-sm shadow-[0_1px_0_rgba(15,23,42,0.6)]"
    >
        <div class="mx-2 flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:pl-3">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2 lg:flex-none">
                <ToolbarTooltip text="PvME Guide Editor" align="left">
                    <img
                        src="https://pvme.io/assets/logo-no-bg.png"
                        alt="PVME logo"
                        class="h-9 w-auto flex-shrink-0"
                    />
                </ToolbarTooltip>

                <div class="inline-flex flex-wrap items-center gap-3">
                    <FormatMenu {dispatch} />
                    <InsertMenu {insertAtCursor} />
                    <StyleGuideMenu />
                    <EmbedGuide {insertAtCursor} {getEditorCursorPosition} {replaceEditorText} />
                </div>
            </div>

            <div class="flex justify-start lg:flex-1 lg:justify-center" role="group">
                <div class="inline-flex">
                    <SubmitPr
                        corner="rounded"
                        on:loadGuide={() => dispatch("openGuideSearch")}
                        on:open={() => dispatch("openSubmitPr")}
                    />
                </div>
            </div>

            <div class="flex flex-wrap items-center gap-3 lg:flex-none lg:justify-end">
                <ToggleView {dispatch}/>
                <ExportToTxt iconOnly />
                <Help/>
                <Info/>
            </div>
        </div>
</header>
