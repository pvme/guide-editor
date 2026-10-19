import { parseEditorGuide, parserIssues } from '../parser/guideParser.js';

export default function findSyntaxErrors(source) {
  return parserIssues(parseEditorGuide(source));
}
