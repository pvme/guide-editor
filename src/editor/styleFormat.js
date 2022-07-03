function selectionRangeFixedStartEnd(cm) {
    const selectionRange = cm.listSelections()[0];
    let selection = Object();

    if ((selectionRange.anchor.line < selectionRange.head.line) || 
        (selectionRange.anchor.ch <= selectionRange.head.ch)) {
        selection.start = selectionRange.anchor;
        selection.end = selectionRange.head;
    }
    else {
        selection.start = selectionRange.head;
        selection.end = selectionRange.anchor;
    }
    return selection;
}

function includeBeforeAfterText(cm, fixedSelectionRange, lengthBefore, lengthAfter) {
    return cm.getRange(
        {
            line: fixedSelectionRange.start.line,
            ch: fixedSelectionRange.start.ch - lengthBefore
        },
        {
            line: fixedSelectionRange.end.line,
            ch: fixedSelectionRange.end.ch + lengthAfter
        }
    );
}

function isMultiLineSelection(fixedSelectionRange) {
    return fixedSelectionRange.end.line > fixedSelectionRange.start.line;
}

function insideItalicFormatting(cm, fixedSelectionRange) {
    // workaround for *italic* and **bold**
    // avoids that when you bold "**highlight**" then italic, that it will remove italic "*highlight*"
    const selection = cm.getRange(
        {
            line: fixedSelectionRange.start.line,
            ch: fixedSelectionRange.start.ch - 3
        },
        {
            line: fixedSelectionRange.end.line,
            ch: fixedSelectionRange.end.ch
        }
    );
    // const endFormatting = selection.substring(selection.length - 3);
    // return endFormatting.startsWith('***') || (!endFormatting.startsWith('**') && endFormatting.startsWith('*'));
    if (selection.startsWith('***'))
        return true;
    
    if (selection.startsWith('**') || selection.startsWith('**', 1))
        return false;
    
    if (selection.startsWith('*') || selection.startsWith('*', 1) || selection.startsWith('*', 2))
        return true;
    
    return false;
}

function insideFormatting(cm, fixedSelectionRange, formattingBefore, formattingAfter) {
    const lengthBefore = formattingBefore.length;
    const lengthAfter = formattingAfter.length;
    if (formattingBefore === '*') 
        return insideItalicFormatting(cm, fixedSelectionRange);

    const containedText = includeBeforeAfterText(cm, fixedSelectionRange, lengthBefore, lengthAfter);
    return containedText.startsWith(formattingBefore) && containedText.endsWith(formattingAfter);
}

function updateStyleFormat(cm, textBeforeSelection, textAfterSelection){
    const selectionRange = selectionRangeFixedStartEnd(cm);
    const selection = cm.getSelection();

    const lengthBefore = textBeforeSelection.length;
    const lengthAfter = textAfterSelection.length;
    if (insideFormatting(cm, selectionRange, textBeforeSelection, textAfterSelection)) {
        // remove formatting
        cm.replaceRange(
            selection,
            {
                line: selectionRange.start.line,
                ch: selectionRange.start.ch - lengthBefore
            },
            {
                line: selectionRange.end.line,
                ch: selectionRange.end.ch + lengthAfter
            }
        );
    
        cm.setSelection(
            {
                line: selectionRange.start.line,
                ch: selectionRange.start.ch - lengthBefore
            },
            {
                line: selectionRange.end.line,
                ch: selectionRange.end.ch - (isMultiLineSelection(selectionRange) ? 0 : lengthBefore)
            }
        );
    }
    else {
        // add formatting
        cm.replaceSelection(textBeforeSelection + selection + textAfterSelection, selection);

        cm.setSelection(
            {
                line: selectionRange.start.line,
                ch: selectionRange.start.ch + lengthBefore
            },
            {
                line: selectionRange.end.line,
                ch: selectionRange.end.ch + (isMultiLineSelection(selectionRange) ? 0 : lengthBefore)
            }
        );
    }
}

function updateSingleLineStyleFormat(cm, lineStartText, lineEndText='') {
    const selection = selectionRangeFixedStartEnd(cm);
    const selectedLineText = cm.getLine(selection.start.line);
    const lengthStartText = lineStartText.length;
    const lengthEndText = lineEndText.length;

    if (selectedLineText.startsWith(lineStartText) && selectedLineText.endsWith(lineEndText)) {
        cm.replaceRange(selectedLineText.substring(lengthStartText, selectedLineText.length - lengthEndText), 
            {
                line: selection.start.line, 
                ch: 0
            }, 
            {
                line: selection.start.line, 
                ch: selectedLineText.length
            }
        );
    }
    else {
        cm.replaceRange(lineStartText + selectedLineText + lineEndText, 
            {
                line: selection.start.line, 
                ch: 0
            },
            {
                line: selection.start.line, 
                ch: selectedLineText.length
            }
        );
        
        
        // don't place the cursor at the end of the line when changing a single line
        cm.setSelection({
            line: selection.start.line,
            ch: selectedLineText.length + lengthStartText + (selectedLineText === '' ? 0 : lengthEndText)
        });
    }
}

export { updateStyleFormat, updateSingleLineStyleFormat};