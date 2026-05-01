<script>
    import { createEventDispatcher } from 'svelte';

    export let error;
    const dispatch = createEventDispatcher();

    function formatErrorLine(line) {
        return line[0] === line[1] ? `line: ${line[0]}` : `lines: ${line.join('-')}`;
    }

    function formatErrorEmoji(errorType) {
        let emoji = '';
        switch (errorType) {
            case 'error': 
                emoji = '❌';
                break;
            case 'warn':
            case 'warning':
                emoji = '⚠';
                break;
            default:
                emoji = errorType;
        }
        return emoji;
    }

    function jumpToError() {
        dispatch('jump', { line: error.line[0] });
    }

    function onKeydown(e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;

        e.preventDefault();
        jumpToError();
    }
</script>

<tr
    role="button"
    tabindex="0"
    title="Jump to this line in the editor"
    on:click={jumpToError}
    on:keydown={onKeydown}
>
    <td>{formatErrorLine(error.line)}</td>
    <td>{@html formatErrorEmoji(error.type)} {error.text}</td>
</tr>

<style>
    td {
        font-size: 14px;
        color: #f8f8f2;
    }

    tr {
        cursor: pointer;
    }

    tr:hover td,
    tr:focus td {
        background-color: #44475a;
    }
</style>
