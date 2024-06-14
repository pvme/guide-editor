<script>
    import { createEventDispatcher } from 'svelte';

    import CodeSquare from 'svelte-bootstrap-icons/lib/CodeSquare.svelte';
	import Code from 'svelte-bootstrap-icons/lib/Code.svelte';
	import TypeBold from 'svelte-bootstrap-icons/lib/TypeBold.svelte';
	import TypeItalic from 'svelte-bootstrap-icons/lib/TypeItalic.svelte';
	import TypeUnderline from 'svelte-bootstrap-icons/lib/TypeUnderline.svelte';
	import TypeStrikethrough from 'svelte-bootstrap-icons/lib/TypeStrikethrough.svelte';
	import TypeH1 from 'svelte-bootstrap-icons/lib/TypeH1.svelte';
	import TypeH2 from 'svelte-bootstrap-icons/lib/TypeH2.svelte';
	import TypeH3 from 'svelte-bootstrap-icons/lib/TypeH3.svelte';
	import ListUl from 'svelte-bootstrap-icons/lib/ListUl.svelte';
	import ListOl from 'svelte-bootstrap-icons/lib/ListOl.svelte';

    import Button from './Button.svelte';
    import ButtonGroup from './ButtonGroup.svelte';
    import ToCDropdown from './ToCDropdown.svelte';
    import TemplateMenu from './TemplateMenu.svelte';
    import CommandMenu from './CommandMenu.svelte';
    import Help from './Help.svelte';
    import Info from './Info.svelte';
    import ToggleView from './ToggleView.svelte';
    import ToggleScrollBottom from './ToggleScrollBottom.svelte';
    import ExportToTxt from './ExportToTxt.svelte';
    import Tutorial from './Tutorial.svelte';

    
    const dispatch = createEventDispatcher();
</script>

<div class="flex flex-wrap mt-4 mb-2 mx-2">
    <ButtonGroup>
        <Button on:click={() => dispatch('bold')} title='Bold - Ctrl+B' corner='rounded-l' ><TypeBold/></Button>
        <Button on:click={() => dispatch('italic')} title='Italic - Ctrl+I'><TypeItalic/></Button>
        <Button on:click={() => dispatch('underline')} title='Italic - Ctrl+U'><TypeUnderline/></Button>
        <Button on:click={() => dispatch('strikethrough')} title='Strikethrough - Ctrl+Alt+S' corner='rounded-r'><TypeStrikethrough/></Button>
    </ButtonGroup>
    <ButtonGroup>
        <Button on:click={() => dispatch('h1')} title='Header 1 - Ctrl+Alt+1' corner='rounded-l'><TypeH1/></Button>
		<Button on:click={() => dispatch('h2')} title='Header 2  - Ctrl+Alt+2'><TypeH2/></Button>
		<Button on:click={() => dispatch('h3')} title='Header 3  - Ctrl+Alt+3' corner='rounded-r'><TypeH3/></Button>
    </ButtonGroup>

    <ButtonGroup>
        <Button on:click={() => dispatch('unorderedList')} title='Unordered list' corner='rounded-l'><ListUl/></Button>
		<Button on:click={() => dispatch('orderedList')} title='Ordered list' corner='rounded-r'><ListOl/></Button>
    </ButtonGroup>

    <ButtonGroup>
        <Button on:click={() => dispatch('inlineCode')} title='Inline Code' corner='rounded-l'><Code/></Button>
		<Button on:click={() => dispatch('codeBlock')} title='Code block' corner='rounded-r'><CodeSquare/></Button>
    </ButtonGroup>

    <ButtonGroup>
        <CommandMenu {dispatch}></CommandMenu>
    </ButtonGroup>

    <ButtonGroup>
        <TemplateMenu></TemplateMenu>
    </ButtonGroup>

    <ButtonGroup>
        <ToCDropdown></ToCDropdown>
    </ButtonGroup>
    
    <div class="inline-flex mx-2 ml-auto" role="group">
        <ButtonGroup>
            <Tutorial></Tutorial>
        </ButtonGroup>
        <ButtonGroup>
            <ExportToTxt></ExportToTxt>
        </ButtonGroup>
    </div>
    
    <div class="inline-flex mb-2 mx-2 ml-auto" role="group">
        <ToggleScrollBottom {dispatch}/>
        <ToggleView {dispatch}/>
        <Help></Help>
        <Info></Info>
    </div>
</div>
