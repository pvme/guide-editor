<script>
    import Message from './Message.svelte';
    import Avatar from './Avatar.svelte';
    import Bot from './Bot.svelte';

    export let text;

    function splitMessages(text) {
        // todo: ignore commands inside code block
        let messages = [];
        let message = {
            content: '',
            command: ''
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
                    command: ''
                };
            }
            else {
                message.content += line;
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
                                        {#each splitMessages(text) as message}
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