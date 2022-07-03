import { persist, localStorage } from '@macfja/svelte-persistent-store';
import { writable } from 'svelte/store';

export let text = persist(writable(''), localStorage(), 'text');