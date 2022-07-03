<script>
    export let error;

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
</script>

<tr>
    <td>{formatErrorLine(error.line)}</td>
    <td>{@html formatErrorEmoji(error.type)} {error.text}</td>
</tr>

<style>
    td {
        font-size: 14px;
        color: #f8f8f2;
    }
</style>