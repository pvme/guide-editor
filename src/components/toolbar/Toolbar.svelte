<script>
    import { createEventDispatcher } from "svelte";

    import ButtonGroup from "./ButtonGroup.svelte";
    import SnippetMenu from "./SnippetMenu.svelte";
    import TemplateMenu from "./TemplateMenu.svelte";
    import StyleGuideMenu from "./StyleGuideMenu.svelte";
    import FormatMenu from "./FormatMenu.svelte";

    import Help from "./Help.svelte";
    import Info from "./Info.svelte";
    import ToggleView from "./ToggleView.svelte";
    import ExportToTxt from "./ExportToTxt.svelte";
    import GuideSearch from "./GuideSearch.svelte";

    export let insertAtCursor;

    const dispatch = createEventDispatcher();
</script>

<header
  class="sticky top-0 z-40
         bg-slate-900/80 backdrop-blur
         border-b border-slate-800
         shadow-sm shadow-[0_1px_0_rgba(15,23,42,0.6)]"
    >
        <div class="flex flex-wrap mt-4 mb-2 mx-2 items-center">

            <FormatMenu {dispatch} />

            <!-- SNIPPETS / TEMPLATE / STYLE GUIDE (desktop only) -->
            <div class="hidden lg:flex ml-2">
                <ButtonGroup><SnippetMenu {insertAtCursor} /></ButtonGroup>
                <ButtonGroup><TemplateMenu {insertAtCursor} /></ButtonGroup>
                <ButtonGroup><StyleGuideMenu /></ButtonGroup>
            </div>


            <!-- RIGHT SIDE -->
            <div class="inline-flex mx-2 ml-auto" role="group">
                <ButtonGroup>
                    <GuideSearch on:select={(e) => dispatch("loadGuide", e.detail)} />
                    <ExportToTxt/>
                </ButtonGroup>
            </div>

            <div class="inline-flex mb-2 mx-2 ml-auto" role="group">
                <ToggleView {dispatch}/>
                <Help/>
                <Info/>
            </div>
        </div>
</header>