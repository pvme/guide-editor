import { RangeSet, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, gutter, GutterMarker, gutterLineClass } from "@codemirror/view";

export const setEditorIssuesEffect = StateEffect.define();

class IssueMarker extends GutterMarker {
  constructor(type, title) {
    super();
    this.type = type;
    this.title = title;
  }

  eq(other) {
    return other.type === this.type && other.title === this.title;
  }

  toDOM() {
    const marker = document.createElement("span");
    marker.className = `cm-guide-issue-marker cm-guide-issue-marker--${this.type}`;
    marker.textContent = this.type === "error" ? "❌" : "⚠";
    marker.title = this.title;
    return marker;
  }
}

class IssueLineMarker extends GutterMarker {
  constructor(type) {
    super();
    this.type = type;
  }

  eq(other) {
    return other.type === this.type;
  }

  get elementClass() {
    return `cm-guide-issue-row cm-guide-issue-row--${this.type}`;
  }
}

const lineDecorations = {
  error: Decoration.line({ class: "cm-guide-issue-line cm-guide-issue-line--error" }),
  warning: Decoration.line({ class: "cm-guide-issue-line cm-guide-issue-line--warning" })
};

const markDecorations = {
  error: Decoration.mark({ class: "cm-guide-issue-span cm-guide-issue-span--error" }),
  warning: Decoration.mark({ class: "cm-guide-issue-span cm-guide-issue-span--warning" })
};

function normalizeType(type) {
  return type === "error" ? "error" : "warning";
}

function getIssueColumnRange(issue, line) {
  if (!Array.isArray(issue.column)) {
    return null;
  }

  const [start, end] = issue.column;
  const fromColumn = Math.max(1, Number(start) || 1);
  const toColumn = Math.max(fromColumn, Number(end) || fromColumn);
  const from = Math.min(line.to, line.from + fromColumn - 1);
  const to = Math.min(line.to, line.from + toColumn - 1);

  return from < to ? { from, to } : null;
}

function buildIssueState(doc, issues) {
  const byLine = new Map();
  const markRanges = [];

  for (const issue of issues || []) {
    const issueType = normalizeType(issue.type);
    const [start, end] = Array.isArray(issue.line)
      ? issue.line
      : [issue.line, issue.line];

    const fromLine = Math.max(1, Number(start) || 1);
    const toLine = Math.min(doc.lines, Math.max(fromLine, Number(end) || fromLine));

    if (fromLine === toLine) {
      const line = doc.line(fromLine);
      const columnRange = getIssueColumnRange(issue, line);

      if (columnRange) {
        markRanges.push(markDecorations[issueType].range(columnRange.from, columnRange.to));
      } else if (line.from < line.to) {
        markRanges.push(markDecorations[issueType].range(line.from, line.to));
      }
    } else {
      for (let lineNumber = fromLine; lineNumber <= toLine; lineNumber += 1) {
        const line = doc.line(lineNumber);

        if (line.from < line.to) {
          markRanges.push(markDecorations[issueType].range(line.from, line.to));
        }
      }
    }

    for (let lineNumber = fromLine; lineNumber <= toLine; lineNumber += 1) {
      const current = byLine.get(lineNumber);
      const title = issue.text || (issueType === "error" ? "Error" : "Warning");

      if (!current) {
        byLine.set(lineNumber, { type: issueType, titles: [title] });
        continue;
      }

      if (issueType === "error") current.type = "error";
      current.titles.push(title);
    }
  }

  const markerBuilder = new RangeSetBuilder();
  const gutterClassBuilder = new RangeSetBuilder();
  const decorations = [];

  for (const [lineNumber, issue] of [...byLine].sort((a, b) => a[0] - b[0])) {
    const line = doc.line(lineNumber);
    markerBuilder.add(line.from, line.from, new IssueMarker(issue.type, issue.titles.join("\n")));
    gutterClassBuilder.add(line.from, line.from, new IssueLineMarker(issue.type));
    decorations.push(lineDecorations[issue.type].range(line.from));
  }

  return {
    markers: markerBuilder.finish(),
    gutterClasses: gutterClassBuilder.finish(),
    decorations: Decoration.set([...decorations, ...markRanges], true)
  };
}

function emptyIssueState() {
  return {
    markers: RangeSet.empty,
    gutterClasses: RangeSet.empty,
    decorations: Decoration.none
  };
}

const issueGutterField = StateField.define({
  create() {
    return emptyIssueState();
  },

  update(issueState, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setEditorIssuesEffect)) {
        return buildIssueState(transaction.state.doc, effect.value);
      }
    }

    return {
      markers: issueState.markers.map(transaction.changes),
      gutterClasses: issueState.gutterClasses.map(transaction.changes),
      decorations: issueState.decorations.map(transaction.changes)
    };
  },

  provide(field) {
    return [
      gutterLineClass.from(field, (value) => value.gutterClasses),
      EditorView.decorations.from(field, (value) => value.decorations)
    ];
  }
});

export const errorGutterExtension = [
  issueGutterField,
  gutter({
    class: "cm-guide-issue-gutter",
    markers: (view) => view.state.field(issueGutterField).markers,
    initialSpacer: () => new IssueMarker("warning", "")
  })
];
