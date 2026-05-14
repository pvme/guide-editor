import { Compartment, Facet } from "@codemirror/state";

export const defaultCodeMirrorEditorSettings = {
  emojiTrailingInsert: "none"
};

export const editorSettingsFacet = Facet.define({
  combine(values) {
    return {
      ...defaultCodeMirrorEditorSettings,
      ...(values.at(-1) || {})
    };
  }
});

export const editorSettingsCompartment = new Compartment();

export function editorSettingsExtension(settings) {
  return editorSettingsCompartment.of(editorSettingsFacet.of(settings || {}));
}

export function reconfigureEditorSettings(settings) {
  return editorSettingsCompartment.reconfigure(editorSettingsFacet.of(settings || {}));
}
