/*YEP 
a mix of the codemirror continuelist: 
// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE 

a patch that adds basic indent support:
https://github.com/joel-porquet/CodeMirror-markdown-list-autoindent

and my own modifications for different bullet types, alphabetical character increment.
*/
import CodeMirror from "codemirror";


(function (mod) {
    // if (typeof exports == "object" && typeof module == "object") // CommonJS
    //     mod(require("codemirror"));
    // else if (typeof define == "function" && define.amd) // AMD
    //     define(["codemirror"], mod);
    // else // Plain browser env
    mod(CodeMirror);
})(function (CodeMirror) {
    "use strict";

    var listRE = /^(\s*)([⬩⬥•]\s|(\w|\d+)(\.))(\s*)/,
        emptyListRE = /^(\s*)([⬩⬥•]|(\w|\d+)\.)(\s*)$/,
        unorderedListRE = /[⬩⬥•]/,
        numberedListRE = /\d+\./,
        alphabeticalListRE = /\w\./;

    var Pos = CodeMirror.Pos;
    var lastIndentCharacter = false;

    CodeMirror.commands.newlineAndIndentContinueMarkdownList = function (cm) {
        var ranges = cm.listSelections(), replacements = [];
        for (var i = 0; i < ranges.length; i++) {
            var pos = ranges[i].head;

            // If we're not in Markdown mode, fall back to normal newlineAndIndent
            var eolState = cm.getStateAfter(pos.line);
            var inner = CodeMirror.innerMode(cm.getMode(), eolState);
            eolState = inner.state;

            var inList = eolState.list !== false;
            var inQuote = eolState.quote !== 0;

            var line = cm.getLine(pos.line), match = listRE.exec(line);
            var cursorBeforeBullet = /^\s*$/.test(line.slice(0, pos.ch));
            if (!ranges[i].empty() || (!inList && !inQuote) || !match || cursorBeforeBullet) {
                cm.execCommand("newlineAndIndent");
                return;
            }
            if (emptyListRE.test(line)) {
                var endOfQuote = inQuote && />\s*$/.test(line)
                var endOfList = !/>\s*$/.test(line)
                if (endOfQuote || endOfList) cm.replaceRange("", {
                    line: pos.line, ch: 0
                }, {
                    line: pos.line, ch: pos.ch + 1
                });
                replacements[i] = "";
            } else {
                var indent = match[1], after = match[5];
                
                var bullet = '';
                if (numberedListRE.test(match[2])) {
                    bullet = (parseInt(match[3], 10) + 1) + match[4];
                    incrementRemainingMarkdownListNumbers(cm, pos);
                }
                else if (alphabeticalListRE.test(match[2])) {
                    bullet = String.fromCharCode(match[3].charCodeAt(0) + 1) + match[4];
                    incrementRemainingMarkdownListCharacters(cm, pos);
                }
                else {
                    bullet = match[2];
                }
                
                replacements[i] = "\n" + indent + bullet + after;
            }
        }
        cm.replaceSelections(replacements);
    };

    function matchListToken(pos, cm) {
        /* Get some info about the current state */
        var eolState = cm.getStateAfter(pos.line);
        var inList = eolState.list !== false;
        var inQuote = eolState.quote !== 0;

        /* Get the line from the start to where the cursor currently is */
        var lineStart = cm.getRange(Pos(pos.line, 0), pos);

        /* Matches the beginning of the list line with the list token RE */
        var match = emptyListRE.exec(lineStart);

        /* Not being in a list, or being in a list but not right after the list
         * token, are both not considered a match */
        if ((!inList && !inQuote) || !match)
            return false
        else
            return true
    }

    // Auto-updating Markdown list numbers when a new item is added to the
    // middle of a list
    function incrementRemainingMarkdownListNumbers(cm, pos) {
        var startLine = pos.line, lookAhead = 0, skipCount = 0;
        var startItem = listRE.exec(cm.getLine(startLine)), startIndent = startItem[1];

        do {
            lookAhead += 1;
            var nextLineNumber = startLine + lookAhead;
            var nextLine = cm.getLine(nextLineNumber), nextItem = listRE.exec(nextLine);

            if (nextItem) {
                var nextIndent = nextItem[1];
                var newNumber = (parseInt(startItem[3], 10) + lookAhead - skipCount);
                var nextNumber = (parseInt(nextItem[3], 10)), itemNumber = nextNumber;

                if (startIndent === nextIndent && !isNaN(nextNumber)) {
                    if (newNumber === nextNumber) itemNumber = nextNumber + 1;
                    if (newNumber > nextNumber) itemNumber = newNumber + 1;
                    cm.replaceRange(
                        nextLine.replace(listRE, nextIndent + itemNumber + nextItem[4] + nextItem[5]),
                        {
                            line: nextLineNumber, ch: 0
                        }, {
                        line: nextLineNumber, ch: nextLine.length
                    });
                } else {
                    if (startIndent.length > nextIndent.length) return;
                    // This doesn't run if the next line immediately indents, as it is
                    // not clear of the users intention (new indented item or same level)
                    if ((startIndent.length < nextIndent.length) && (lookAhead === 1)) return;
                    skipCount += 1;
                }
            }
        } while (nextItem);
    }

    // Auto-updating Markdown list characters when a new item is added to the
    // middle of a list
    function incrementRemainingMarkdownListCharacters(cm, pos) {
        var startLine = pos.line, lookAhead = 0, skipCount = 0;
        var startItem = listRE.exec(cm.getLine(startLine)), startIndent = startItem[1];

        do {
            lookAhead += 1;
            var nextLineNumber = startLine + lookAhead;
            var nextLine = cm.getLine(nextLineNumber), nextItem = listRE.exec(nextLine);

            if (nextItem) {
                var nextIndent = nextItem[1];
                var newNumber = startItem[3].charCodeAt(0) + lookAhead - skipCount;
                var nextNumber = startItem[3].charCodeAt(0), 
                    itemNumber = nextNumber;

                if (startIndent === nextIndent && !isNaN(nextNumber)) {
                    if (newNumber === nextNumber) itemNumber = nextNumber + 1;
                    if (newNumber > nextNumber) itemNumber = newNumber + 1;
                    cm.replaceRange(
                        nextLine.replace(listRE, nextIndent + String.fromCharCode(itemNumber) + nextItem[4] + nextItem[5]),
                        {
                            line: nextLineNumber, ch: 0
                        }, {
                        line: nextLineNumber, ch: nextLine.length
                    });
                } else {
                    if (startIndent.length > nextIndent.length) return;
                    // This doesn't run if the next line immediately indents, as it is
                    // not clear of the users intention (new indented item or same level)
                    if ((startIndent.length < nextIndent.length) && (lookAhead === 1)) return;
                    skipCount += 1;
                }
            }
        } while (nextItem);
    }


    CodeMirror.commands.autoIndentMarkdownList = function (cm) {
        var ranges = cm.listSelections();
        for (var i = 0; i < ranges.length; i++) {
            var pos = ranges[i].head;

            if (!ranges[i].empty() || !matchListToken(pos, cm)) {
                /* If no match, call regular Tab handler */
                cm.execCommand("defaultTab");
                return;
            }
            
            var match = emptyListRE.exec(cm.getRange(Pos(pos.line, 0), pos));
            cm.indentLine(pos.line, 4);
            if (unorderedListRE.test(match[2])) {
                cm.replaceRange(getBulletType(pos.ch + 2), { line: pos.line, ch: pos.ch + 2 }, { line: pos.line, ch: pos.ch + 3 });           
                lastIndentCharacter = false;
            }
            else {
                cm.replaceRange(getAlphaNumericalType(pos.ch + 1), { line: pos.line, ch: pos.ch + 1 }, { line: pos.line, ch: pos.ch + 3 });
                lastIndentCharacter = true;
            }
        }
    };

    function getAlphaNumericalType(ch) {
        if (ch <= 0) return '1.';
        if (ch === 4) return 'a.';
        return '⬩';
    }

    function getBulletType(ch) {
        if (ch <= 0) return '⬥';
        if (ch === 4) return '•';
        return '⬩';
    }

    CodeMirror.commands.autoUnindentMarkdownList = function (cm) {
        var ranges = cm.listSelections();
        for (var i = 0; i < ranges.length; i++) {
            var pos = ranges[i].head;

            if (!ranges[i].empty() || !matchListToken(pos, cm)) {
                /* If no match, call regular Shift-Tab handler */

                cm.execCommand("indentAuto");
                return;
            }
            var match = emptyListRE.exec(cm.getRange(Pos(pos.line, 0), pos));
            if (pos.ch >= 4){
                cm.indentLine(pos.line, -4);

                if (unorderedListRE.test(match[2])) {
                    if (lastIndentCharacter)
                        cm.replaceRange(getAlphaNumericalType(pos.ch - 6), { line: pos.line, ch: pos.ch - 6 }, { line: pos.line, ch: pos.ch - 5 });
                    else
                        cm.replaceRange(getBulletType(pos.ch - 6), { line: pos.line, ch: pos.ch - 6 }, { line: pos.line, ch: pos.ch - 5 });
                }
                else 
                    cm.replaceRange(getAlphaNumericalType(pos.ch - 7), { line: pos.line, ch: pos.ch - 7 }, { line: pos.line, ch: pos.ch - 5 });
            }
        }
    };
});
