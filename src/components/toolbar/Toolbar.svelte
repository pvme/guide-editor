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

    export let insertAtCursor;

    const dispatch = createEventDispatcher();
</script>


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
        <ButtonGroup><ExportToTxt/></ButtonGroup>
    </div>

    <div class="inline-flex mb-2 mx-2 ml-auto" role="group">
        <ToggleView {dispatch}/>
        <Help/>
        <Info/>
    </div>
</div>
