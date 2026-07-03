import { persistBrowserLocal } from "@macfja/svelte-persistent-store";
import { derived, writable } from "svelte/store";

const base = writable("");
export let text =
  typeof window === "undefined" ? base : persistBrowserLocal(base, "text");

const loadedGuideBase = writable(null);
export let loadedGuide =
  typeof window === "undefined"
    ? loadedGuideBase
    : persistBrowserLocal(loadedGuideBase, "loadedGuide");

export const authUser = writable(null);
export const reviewSession = writable(null);

const DRAFTS_STORAGE_KEY = "guideEditorDrafts";

function createDraftId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getDraftTitle(draft) {
  if (draft?.name) return draft.name;
  if (draft?.loadedGuide?.name) return draft.loadedGuide.name;
  if (draft?.loadedGuide?.path) return draft.loadedGuide.path.split("/").pop();
  return "Untitled draft";
}

export function getGuideSourceName(source) {
  if (source === "master") return "PvME guide";
  if (source === "user-pr") return "submitted update";
  if (source === "review-pr") return "pull request review";
  return "loaded guide";
}

export function getGuideSourceContext(guide) {
  if (!guide?.path) return "Local draft";
  return `Started from ${getGuideSourceName(guide.source || "master")}`;
}

export function createDraft({
  id = createDraftId(),
  name = "Untitled draft",
  content = "",
  loadedGuide = null,
  createdAt = Date.now(),
  updatedAt = Date.now(),
} = {}) {
  return {
    id,
    name,
    content,
    loadedGuide,
    createdAt,
    updatedAt,
  };
}

function normalizeDraft(rawDraft) {
  const draft = rawDraft && typeof rawDraft === "object" ? rawDraft : {};
  return createDraft({
    id: typeof draft.id === "string" && draft.id ? draft.id : createDraftId(),
    name:
      typeof draft.name === "string" && draft.name
        ? draft.name
        : "Untitled draft",
    content: typeof draft.content === "string" ? draft.content : "",
    loadedGuide:
      draft.loadedGuide && typeof draft.loadedGuide === "object"
        ? draft.loadedGuide
        : null,
    createdAt: Number(draft.createdAt) || Date.now(),
    updatedAt: Number(draft.updatedAt) || Date.now(),
  });
}

function isReviewDraft(draft) {
  return draft?.loadedGuide?.source === "review-pr";
}

function normalizeDraftState(rawState) {
  const state = rawState && typeof rawState === "object" ? rawState : {};
  const rawDrafts = Array.isArray(state.drafts) ? state.drafts : [];
  const normalizedDrafts = rawDrafts
    .map(normalizeDraft)
    .filter((draft) => !isReviewDraft(draft));
  const drafts = normalizedDrafts.length ? normalizedDrafts : [createDraft()];
  const activeDraftId = drafts.some((draft) => draft.id === state.activeDraftId)
    ? state.activeDraftId
    : drafts[0].id;

  return {
    version: 1,
    activeDraftId,
    drafts,
    switchCount: state.switchCount || 0,
    isDeletionSwitch: state.isDeletionSwitch || false,
  };
}

function loadDraftState() {
  if (typeof window === "undefined") {
    return normalizeDraftState();
  }

  try {
    const stored = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
    return normalizeDraftState(stored ? JSON.parse(stored) : null);
  } catch {
    return normalizeDraftState();
  }
}

function createDraftsStore() {
  const store = writable(loadDraftState());

  if (typeof window !== "undefined") {
    store.subscribe((state) => {
      window.localStorage.setItem(
        DRAFTS_STORAGE_KEY,
        JSON.stringify(normalizeDraftState(state)),
      );
    });
  }

  return {
    subscribe: store.subscribe,
    set: (state) => store.set(normalizeDraftState(state)),
    update: (updater) =>
      store.update((state) =>
        normalizeDraftState(updater(normalizeDraftState(state))),
      ),
    create: (draftInput) => {
      const draft = createDraft(draftInput);
      store.update((state) =>
        normalizeDraftState({
          ...state,
          activeDraftId: draft.id,
          drafts: [...state.drafts, draft],
        }),
      );
      return draft;
    },
    switchTo: (draftId) => {
      store.update((state) =>
        state.drafts.some((draft) => draft.id === draftId)
          ? {
              ...state,
              activeDraftId: draftId,
              switchCount: (state.switchCount || 0) + 1,
              isDeletionSwitch: false,
            }
          : state,
      );
    },
    rename: (draftId, name) => {
      const nextName = name.trim() || "Untitled draft";
      store.update((state) => ({
        ...state,
        drafts: state.drafts.map((draft) =>
          draft.id === draftId
            ? { ...draft, name: nextName, updatedAt: Date.now() }
            : draft,
        ),
      }));
    },
    delete: (draftId) => {
      store.update((state) => {
        const drafts = state.drafts.filter((draft) => draft.id !== draftId);
        const nextDrafts = drafts.length ? drafts : [createDraft()];
        const activeDraftId =
          state.activeDraftId === draftId
            ? nextDrafts[0].id
            : state.activeDraftId;

        return {
          ...state,
          activeDraftId,
          drafts: nextDrafts,
          isDeletionSwitch: state.activeDraftId === draftId,
        };
      });
    },
    updateActive: (patch) => {
      store.update((state) => ({
        ...state,
        drafts: state.drafts.map((draft) =>
          draft.id === state.activeDraftId
            ? { ...draft, ...patch, updatedAt: Date.now() }
            : draft,
        ),
      }));
    },
  };
}

export const drafts = createDraftsStore();
export const activeDraft = derived(drafts, ($drafts) => {
  const draft =
    $drafts.drafts.find((draft) => draft.id === $drafts.activeDraftId) ||
    $drafts.drafts[0];
  // Include switchCount to force updates even when the same draft is switched to
  // Include isDeletionSwitch to detect when activeDraftId changes due to deletion
  return {
    draft,
    switchCount: $drafts.switchCount,
    isDeletionSwitch: $drafts.isDeletionSwitch,
  };
});

export const defaultEditorSettings = {
  emojiTrailingInsert: "none",
  rotationBuilderMode: false,
  showPreview: true,
};

const editorSettingsBase = writable(defaultEditorSettings);
export let editorSettings =
  typeof window === "undefined"
    ? editorSettingsBase
    : persistBrowserLocal(editorSettingsBase, "editorSettings");

export function normalizeEditorSettings(settings) {
  const rawSettings = settings || {};
  const emojiTrailingInsert =
    typeof rawSettings.emojiTrailingInsert === "string"
      ? rawSettings.emojiTrailingInsert
      : rawSettings.autoSpaceAfterEmoji
        ? "space"
        : defaultEditorSettings.emojiTrailingInsert;

  return {
    ...defaultEditorSettings,
    ...rawSettings,
    emojiTrailingInsert,
    rotationBuilderMode: Boolean(rawSettings.rotationBuilderMode),
  };
}
