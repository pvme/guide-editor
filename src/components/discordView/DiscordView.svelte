<script>
    import Message from './Message.svelte';
    import Avatar from './Avatar.svelte';
    import Bot from './Bot.svelte';

    import { onMount, afterUpdate } from 'svelte';


    export let text;
    export let scrollBottom = false;
    export let selectedLineText;
    let scrollViewElement;

    //likely not exhaustive, but it's a start
    const autoscrollIgnoredLines = [
        "",
        ".",
        "{",
        "[",
        "\"embed\": {",
        "\"fields\": [",
        "\"footer\": {",
        "\"inline\": true",
        "}",
        "]",
        ".embed:json",
        "},"
    ];

    onMount(()=>{
        scrollViewElement = document.getElementById('scroll-view');
    });

    afterUpdate(() => {
        if (scrollBottom) scrollViewElement.scrollTop = scrollViewElement.scrollHeight;
    });

    function splitMessages(text, selectedLineText) {
        // todo: ignore commands inside code block
        let messages = [];
        let message = {
            content: '',
            command: '',
            selected: false
        };
        const lines = text.split('\n');
        for (const line of lines) {
            if (message.content !== '') message.content += '\n';

            if (line.startsWith('..')) {
                message.content += line.substring(1);
            }
            else if (line.startsWith('.')) {
                message.command = line
                messages.push(message);
                message = {
                    content: '',
                    command: '',
                    selected: false
                };
            }
            else {
                message.content += line;
            }
            if(!autoscrollIgnoredLines.includes(selectedLineText)) {
                if(line.trim().includes(selectedLineText)) {
                    message.selected = true;
                }
            }
        }

        if (message.content !== '') messages.push(message);

        return messages;
    }
</script>

<div class='discord-view'>
    <div class='flex-vertical whitney theme-dark'>
        <div class='chat flex-vertical flex-spacer'>
            <div class='content flex-spacer flex-horizontal'>
                <div class='flex-spacer flex-vertical messages-wrapper'>
                    <div class='scroller-wrap'>
                        <div class='scroller messages'>
                            <div class='message-group hide-overflow min-h-screen'>
                                <Avatar/>
                                <div class='comment'>
                                    <div class='message first'>
                                        <Bot/>
                                        {#each splitMessages(text, selectedLineText) as message}
                                            <Message {...message}/>
                                        {/each}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
	/* Glow outline animation */
	@keyframes flash-outline {
		0%   { box-shadow: 0 0 0px rgba(255, 215, 0, 0); }
  		30%  { box-shadow: 0 0 12px 4px rgba(255, 215, 0, 0.9); }
  		70%  { box-shadow: 0 0 12px 4px rgba(255, 215, 0, 0.9); }
  		100% { box-shadow: 0 0 0px rgba(255, 215, 0, 0); }
	}

	/* Helper class */
	:global(.flash-message) {
		animation: flash-outline 2s ease-out;
	}
</style>