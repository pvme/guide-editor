import { persistBrowserLocal } from '@macfja/svelte-persistent-store';
import { writable } from 'svelte/store';

const base = writable('');
export let text = typeof window === 'undefined'
    ? base
    : persistBrowserLocal(base, 'text');

const loadedGuideBase = writable(null);
export let loadedGuide = typeof window === 'undefined'
    ? loadedGuideBase
    : persistBrowserLocal(loadedGuideBase, 'loadedGuide');

export const authUser = writable(null);

export const defaultEditorSettings = {
    emojiTrailingInsert: 'none',
    showPreview: true
};

const editorSettingsBase = writable(defaultEditorSettings);
export let editorSettings = typeof window === 'undefined'
    ? editorSettingsBase
    : persistBrowserLocal(editorSettingsBase, 'editorSettings');

export function normalizeEditorSettings(settings) {
    const rawSettings = settings || {};
    const emojiTrailingInsert = typeof rawSettings.emojiTrailingInsert === 'string'
        ? rawSettings.emojiTrailingInsert
        : rawSettings.autoSpaceAfterEmoji
            ? 'space'
            : defaultEditorSettings.emojiTrailingInsert;

    return {
        ...defaultEditorSettings,
        ...rawSettings,
        emojiTrailingInsert
    };
}
