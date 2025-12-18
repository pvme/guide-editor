<script>
    import { createEventDispatcher } from 'svelte';
    import findStyleErrors from './../../syntax/style';
    import findSyntaxErrors from './../../syntax/syntax';
    import Error from './Error.svelte';

    export let text;
    const dispatch = createEventDispatcher();
    $: errors = findErrors(text);
    
    $: if (checkNoCriticalErrors(errors)) {
        dispatch('noCriticalErrors');
    }

    function checkNoCriticalErrors(errors) {
        for (const error of errors) {
            if (error.type == 'error')
                return false;
        }
        return true;
    }

    function findErrors(text) {
        return [...findStyleErrors(text), ...findSyntaxErrors(text)];
    }
</script>

<div class='errorView h-[10vh] mt-4 overflow-auto p-1'>
    <table class="table-auto text-left w-full">
        <tbody>
            {#each errors as error}
                <Error {error}/>
            {/each}
        </tbody>
    </table>
</div>

<style>
    .errorView {
        background-color: #282a36;
    }
</style>