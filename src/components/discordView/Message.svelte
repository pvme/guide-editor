<script>
    import markdownToHTML from './../../markdown';
    import Embed from './Embed.svelte';
    import Attachment from './Attachment.svelte'

    export let content;
    export let command;
    export let selected;
    
    let oldContent;
    let oldCommand;
    let messageFormatted;

    $: if (content !== oldContent || command !== oldCommand) {
        oldContent = content;
        oldCommand = command;
        
        if (command === '.embed:json') {
            messageFormatted = {
                content: '',
                embed: JSON.parse(content).embed
            };
        }
        else {
            messageFormatted = markdownToHTML(content);
            if (command.startsWith('.img'))
                messageFormatted.commandAttachment = command.substring('.img:'.length);
        }
    }
</script>


<!-- todo: don't use nested object -->
<div class='message-text hover:message-selected' class:selected={selected}>
    <div class='markup'>
        {@html messageFormatted.content}
    </div>
    {#if messageFormatted.messageAttachments}
        {#each messageFormatted.messageAttachments as attachment}
            <Attachment url={attachment}/>
        {/each}
    {/if}
    {#if messageFormatted.commandAttachment}
        <Attachment url={messageFormatted.commandAttachment}/>
    {/if}
</div>

{#if messageFormatted.embed}
    <Embed {...messageFormatted.embed} selected={selected}/>
{/if}

<style>
    .hover\:message-selected:hover {
        /* background-color: #36393f; */
        background-color: #2f3136;
    }
    /* Style currently empty but visual indicator is planned for future */
    .selected {
        /* background-color: red; */
    }
</style>