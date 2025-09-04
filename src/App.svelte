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
	import { populateConstants, rawGithubJSONRequest, rawGithubTextRequest } from './pvmeSettings';
	import { text } from './stores';


	let editor;
	let validText = $text;	//  bug: exiting last session with invalid text
	let selectedLineText = '';
	let showView = true;
  let scrollBottom = false;

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

		// Attach to the CodeMirror wrapper element
		const wrapper = editor.getWrapperElement();

		wrapper.addEventListener('dblclick', (e) => {
			// Wait until CodeMirror has updated the cursor/selection
			const pos = editor.coordsChar({ left: e.clientX, top: e.clientY });
			const lineText = editor.getLine(pos.line).trim();
			selectedLineText = lineText;
			requestAnimationFrame(() => {
				let discordView = document.getElementsByClassName('discord-view')[0];
				let selectedEl = discordView?.querySelector('.selected');
				selectedEl?.scrollIntoView({behavior: 'smooth', block: 'center'});
			});
		}, true); // capture = true helps if CM swallows the event

		


		editor.setOption("extraKeys", {
			'Ctrl-B': bold,
			'Ctrl-I': italic,
			'Ctrl-U': underline,
			'Ctrl-Alt-S': strikethrough,
			'Ctrl-Alt-1': h1,
			'Ctrl-Alt-2': h2,
			'Ctrl-Alt-3': h3,
			'Enter': 'newlineAndIndentContinueMarkdownList',
			'Tab': 'autoIndentMarkdownList',
			'Shift-Tab': 'autoUnindentMarkdownList'
		});
		editor.setValue($text);
		const urlParams = new URLSearchParams(window.location.search);
		if(urlParams.has('id')) {
			loadGuide(urlParams.get('id'));
		}
		validateText();		
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

	function link() {
		updateInlineFormat('[', '](<#>)');
	}

	function h1() {
		updateLineFormat('# ', '\n.tag:[title]');	
	}

	function h2() {
		updateLineFormat('## __', '__\n.tag:[tagname]');	
	}

	function h3() {
		updateLineFormat('### ');
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
  async function loadGuide(paramID) {
    //paramID could either be the channelID in discord, or the url of the website
    //if paramID is a website url path, we can determine that if the param includes a /, but only if the / isnt the last character as that could just be a normal url
    //not pretty, but it works
    let isPath = paramID.indexOf('/') < paramID.length-1;
    const channelsJSON = await rawGithubJSONRequest('https://raw.githubusercontent.com/pvme/pvme-settings/pvme-discord/channels.json');
	for(const channel of channelsJSON) {
	  if(channel.id === paramID || (isPath && channel.path?.includes(paramID.substring(0,paramID.length-2)))) { 
	    // the website url has a trailing slash hence the length-2 and no .txt
	    let guideUrl = `https://raw.githubusercontent.com/pvme/pvme-guides/master/${channel.path}`;
	    if(window.confirm(`Click confirm to overwrite your current progress with the ${channel.name} guide`)) {
		  editor.setValue(await rawGithubTextRequest(guideUrl));
		  // remove /?id= when loading a guide from ID
		  window.history.pushState({}, document.title, "/guide-editor");
		}
		break;
	  }
	}
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
			on:h3={h3}
			on:link={link}
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
						<DiscordView text={validText} scrollBottom={scrollBottom} selectedLineText={selectedLineText}/>	
					</div>
				{/if}
			{:catch error}
					<p style="color: red">{error.message}</p>
			{/await}
		</div>
    </div>
</main>

