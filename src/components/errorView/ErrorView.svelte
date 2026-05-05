<script>
    import { createEventDispatcher, tick } from 'svelte';
    import findStyleErrors from './../../syntax/style';
    import findSyntaxErrors from './../../syntax/syntax';
    import Error from './Error.svelte';

    export let text;
    export let flashKey = 0;
    export let ignoredTrailingWhitespaceLine = null;

    const dispatch = createEventDispatcher();
    let errorViewEl;
    let checkerHighlighted = false;

    $: errors = findErrors(text);
    $: if (flashKey > 0) {
        flashChecker();
    }
    
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
        return [
            ...findStyleErrors(text, { ignoredTrailingWhitespaceLine }),
            ...findSyntaxErrors(text)
        ];
    }

    async function flashChecker() {
        if (!errorViewEl) return;

        errorViewEl.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
        checkerHighlighted = false;
        await tick();
        checkerHighlighted = true;
    }
</script>

<div
    bind:this={errorViewEl}
    class='errorView h-[10vh] mt-4 overflow-auto p-1'
    class:highlight={checkerHighlighted}
>
    <table class="table-auto text-left w-full">
        <tbody>
            {#each errors as error}
                <Error {error} on:jump={(e) => dispatch('jump', e.detail)} />
            {/each}
        </tbody>
    </table>
</div>

<style>
    .errorView {
        position: relative;
        overflow: auto;
        background-color: #282a36;
    }

    .errorView.highlight::after {
        content: "";
        position: absolute;
        inset: 3px;
        border-radius: 6px;
        pointer-events: none;
        box-shadow:
            inset 0 0 0 3px rgb(59 130 246 / 1),
            inset 0 0 22px rgb(59 130 246 / 0.35);
        background: rgba(59, 130, 246, 0.28);
        animation: checkerRingFlash 1.8s ease-out forwards;
    }

    @keyframes checkerRingFlash {
        0% {
            opacity: 1;
            box-shadow:
                inset 0 0 0 3px rgb(59 130 246 / 1),
                inset 0 0 30px rgb(59 130 246 / 0.55);
        }
        35% {
            opacity: 0.9;
            box-shadow:
                inset 0 0 0 3px rgb(96 165 250 / 0.9),
                inset 0 0 28px rgb(96 165 250 / 0.42);
        }
        70% {
            opacity: 0.4;
            box-shadow:
                inset 0 0 0 2px rgb(59 130 246 / 0.45),
                inset 0 0 18px rgb(59 130 246 / 0.22);
        }
        100% {
            opacity: 0;
            box-shadow:
                inset 0 0 0 1px rgb(59 130 246 / 0),
                inset 0 0 0 rgb(59 130 246 / 0);
        }
    }
</style>
