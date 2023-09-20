<script>
	import DiscordView from './components/discordView/DiscordView.svelte';
	import ErrorView from './components/errorView/ErrorView.svelte';
  import Toolbar from './components/toolbar/Toolbar.svelte';

  import CodeMirror from 'codemirror';
	import 'codemirror/lib/codemirror.css';
	import 'codemirror/addon/display/placeholder.js';
	import 'codemirror/theme/dracula.css';
	import 'codemirror/addon/edit/closebrackets';
	import 'codemirror/addon/edit/matchbrackets';
	import 'codemirror/addon/edit/trailingspace';
	import 'codemirror/addon/selection/active-line';

  import './editor/autoIndent';
  import { onMount } from 'svelte';
	import { updateStyleFormat, updateSingleLineStyleFormat } from './editor/styleFormat';
	import autoformatText from './editor/autoformat';  
	import { populateConstants } from './pvmeSettings';
	import { text } from './stores';


	let editor;
	let validText = $text;	//  bug: exiting last session with invalid text
	let showView = true;
  let scrollBottom = false;
  let guideUrl = '';

	onMount(async ()=>{
		editor = CodeMirror.fromTextArea(document.getElementById('input'), {
			theme: 'dracula',
			lineNumbers: true,
			lineWrapping: true,
			autoCloseBrackets: true,
  		matchBrackets: true,
			autofocus: true,
			tabSize: 2,	
			cursorScrollMargin: 12,
			showTrailingSpace: true,
			styleActiveLine: true,
			viewportMargin: Infinity
		});

		editor.setSize('100%', '100%');
		editor.on('change', updater);
		editor.on('inputRead', newInput);

		editor.setOption("extraKeys", {
			'Ctrl-B': bold,
			'Ctrl-I': italic,
			'Ctrl-U': underline,
			'Ctrl-Alt-S': strikethrough,
			'Ctrl-Alt-1': h1,
			'Ctrl-Alt-2': h2,
			'Enter': 'newlineAndIndentContinueMarkdownList',
			'Tab': 'autoIndentMarkdownList',
			'Shift-Tab': 'autoUnindentMarkdownList'
		});
		editor.setValue($text);
		validateText();
		const urlParams = new URLSearchParams(window.location.search);
		if(urlParams.has('id')) {
			const channelsJSON = await rawGithubJSONRequest('https://raw.githubusercontent.com/pvme/pvme-settings/pvme-discord/channels.json');
			for(const channel of channelsJSON) {
				if(channel.id === urlParams.get('id')) {
					//showModal = true;
					guideUrl = `https://raw.githubusercontent.com/pvme/pvme-guides/master/${channel.path}`;
					if(window.confirm(`Click confirm to overwrite your current progress with the ${channel.name} guide`)) {
						loadGuide();
					}
					
					break;
				}
			}
		}
		
		
	});
	
	function newInput(cm, change) {
		autoformatText(cm);
	}

	function validateText(){
		validText = $text;
	}

	function updateInlineFormat(textBeforeSelection, textAfterSelection){
		updateStyleFormat(editor, textBeforeSelection, textAfterSelection);
		editor.focus();
	}

	function updateLineFormat(lineStartText, lineEndText='') {
		updateSingleLineStyleFormat(editor, lineStartText, lineEndText);
		editor.focus();
	}

	function bold() {
		updateInlineFormat('**', '**');
	}

	function italic() {
		updateInlineFormat('*', '*');
	}

	function underline() {
		updateInlineFormat('__', '__');
	}

	function strikethrough() {
		updateInlineFormat('~~', '~~');
	}

	function h1() {
		updateLineFormat('> __**', '**__\n.tag:[tagname]');	
	}

	function h2() {
		updateLineFormat('__**', '**__');
	}

	function updater(cm, change) {
		$text = cm.getValue();
	}

	function command(event) {
		editor.replaceSelection(event.detail.command);
		editor.focus();
	}

  function toggleScrollBottom() {
    scrollBottom = !scrollBottom;
    editor.focus();
  }
  async function rawGithubGetRequest(url) {
    const res = await fetch(url, {
        method: 'GET'
    });
    
    if (!res.ok)
        throw new Error(await res.text());

    return res;
}
async function rawGithubTextRequest(url) {
    const res = await rawGithubGetRequest(url);
    return await res.text();
}

async function rawGithubJSONRequest(url) {
    const res = await rawGithubGetRequest(url);
    return await res.json();
}
export async function loadGuide() {
	editor.setValue(await rawGithubTextRequest(guideUrl));
}
</script>

<main>
	<div class='flex flex-col h-screen bg-indigo-400'>
		<Toolbar
			on:bold={bold} 
			on:italic={italic} 
			on:underline={underline} 
			on:strikethrough={strikethrough}
			on:h1={h1} 
			on:h2={h2}
			on:unorderedList={() => updateLineFormat('⬥ ')} 
			on:orderedList={() => updateLineFormat('1. ')} 
			on:inlineCode={() => updateInlineFormat('\`', '\`')} 
			on:codeBlock={() => updateInlineFormat('\`\`\`', '\`\`\`')}
			on:command={command}
			on:toggleView={() => showView = !showView}
      on:toggleScrollBottom={toggleScrollBottom}
		/>
		<div class='flex-grow flex flex-row overflow-auto'>
			<div class='w-1/2 ml-4 mr-2 mb-4 flex flex-col' class:w-full="{showView === false}" class:mr-4="{showView === false}">
				<textarea id="input" placeholder="Click ❔ for tips on autoformatting..."></textarea>
				<ErrorView text={$text} on:noCriticalErrors={validateText}/>
			</div>
			{#await populateConstants()}
				<p class="ml-2">Waiting for channels, users, and prices to load...</p>	
			{:then}
				{#if showView}
					<div class='w-1/2 mr-4 ml-2 mb-4 overflow-auto' id='scroll-view'>
						<DiscordView text={validText} scrollBottom={scrollBottom}/>	
					</div>
				{/if}
			{:catch error}
					<p style="color: red">{error.message}</p>
			{/await}
		</div>
    </div>
</main>

