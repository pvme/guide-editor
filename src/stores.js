import { persistBrowserLocal } from '@macfja/svelte-persistent-store';
import { writable } from 'svelte/store';

const base = writable('');
export let text = typeof window === 'undefined'
    ? base
    : persistBrowserLocal(base, 'text');
