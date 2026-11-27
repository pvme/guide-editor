import { EditorState, Text } from '@codemirror/state';

// String documents are split by CodeMirror on CRLF/lone CR as well as LF.
// Split only LF ourselves so existing CR bytes survive load, edit and recovery.
export const exactDocument = text => Text.of(text.split('\n'));

// Also preserve CR bytes when commands, paste or source-editing tools insert
// strings containing untouched portions of the original document.
export const exactLineSeparator = EditorState.lineSeparator.of('\n');
