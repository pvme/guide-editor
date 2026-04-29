const ALLOWED_EMOJI_NEIGHBOR_CHARS = /[\\`"'[\](){}.,!?;:_*\-]/;
const EMOJI_REGEX = /<:[^:>]+:\d+>/g;
const INVISIBLE_SPACE_CHARS = /[\u200B\u00A0]/;

function escapeRegex(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function maskIgnoredInlineSpans(line) {
	return line
		.replace(/`[^`]*`/g, match => " ".repeat(match.length))
		.replace(/<[^<>\s]+>/g, match => " ".repeat(match.length));
}

function hasInvalidSymbolSpacing(line) {
	const maskedLine = maskIgnoredInlineSpans(line);

	for (let index = 0; index < maskedLine.length; index++) {
		if (maskedLine[index] !== "→") {
			continue;
		}

		const before = maskedLine[index - 1] || "";
		const after = maskedLine[index + 1] || "";
		const hasValidBefore = index === 0 || /\s/.test(before);
		const hasValidAfter = index === maskedLine.length - 1 || /\s/.test(after);

		if (!hasValidBefore || !hasValidAfter) {
			return true;
		}
	}

	return false;
}

function isStandaloneEmojiPrefix(line, emojiStart) {
	const prefix = line[emojiStart - 1] || "";

	if (!/[rs_]/.test(prefix)) {
		return false;
	}

	const beforePrefix = line[emojiStart - 2] || "";

	return emojiStart === 1
		|| /\s/.test(beforePrefix)
		|| ALLOWED_EMOJI_NEIGHBOR_CHARS.test(beforePrefix);
}

function isInsideMarkdownLinkText(line) {
	return /\[[^\]]*<:[^:>]+:\d+>[^\]]*\]\([^)]*\)/.test(line);
}

function isInsideBackticks(line, emoji) {
	return new RegExp("`[^`]*" + escapeRegex(emoji) + "[^`]*`").test(line);
}

function hasZeroWidthSpacePrefix(line, emoji, emojiStart) {
	const before = line[emojiStart - 1] || "";
	return INVISIBLE_SPACE_CHARS.test(before)
		|| line.startsWith("\\u200B" + emoji, emojiStart - 6)
		|| line.startsWith("\\u00A0" + emoji, emojiStart - 6);
}

function hasValidEmojiBefore(line, emoji, emojiStart) {
	if (emojiStart === 0) {
		return true;
	}

	const before = line[emojiStart - 1] || "";

	return before === " "
		|| ALLOWED_EMOJI_NEIGHBOR_CHARS.test(before)
		|| isStandaloneEmojiPrefix(line, emojiStart)
		|| hasZeroWidthSpacePrefix(line, emoji, emojiStart);
}

function hasValidEmojiAfter(line, emojiEnd) {
	if (emojiEnd === line.length) {
		return true;
	}

	const after = line[emojiEnd] || "";

	return after === " " || ALLOWED_EMOJI_NEIGHBOR_CHARS.test(after);
}

function findEmbedJsonLineIndexes(lines) {
	const indexes = new Set();
	let block = null;

	function updateBlockState(block, line) {
		for (let i = 0; i < line.length; i++) {
			const char = line[i];

			if (block.escape) {
				block.escape = false;
				continue;
			}

			if (char === "\\") {
				block.escape = block.inString;
				continue;
			}

			if (char === "\"") {
				block.inString = !block.inString;
				continue;
			}

			if (block.inString) {
				continue;
			}

			if (char === "{") {
				block.depth++;
			} else if (char === "}") {
				block.depth--;
			}
		}
	}

	function nextNonEmptyTrim(startIndex) {
		for (let i = startIndex; i < lines.length; i++) {
			const trimmed = lines[i].trim();
			if (trimmed !== "") {
				return trimmed;
			}
		}

		return "";
	}

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		const trimmed = raw.trim();

		if (!block && trimmed.startsWith("{")) {
			block = {
				indexes: [i],
				depth: 0,
				inString: false,
				escape: false
			};
			updateBlockState(block, raw);

			if (block.depth <= 0 && nextNonEmptyTrim(i + 1) !== ".embed:json") {
				for (const index of block.indexes) {
					indexes.add(index);
				}
				block = null;
			}
			continue;
		}

		if (!block) {
			continue;
		}

		if (trimmed === ".embed:json") {
			for (const index of block.indexes) {
				indexes.add(index);
			}
			block = null;
			continue;
		}

		block.indexes.push(i);
		updateBlockState(block, raw);

		if (block.depth <= 0 && nextNonEmptyTrim(i + 1) !== ".embed:json") {
			for (const index of block.indexes) {
				indexes.add(index);
			}
			block = null;
		}
	}

	if (block) {
		for (const index of block.indexes) {
			indexes.add(index);
		}
	}

	return indexes;
}

function findStyleErrors(text) {
    /* state values
	 * 0 - parsing message content
	 * 1 - parsing message commands
	 */
    const lines = text.split('\n');
	const embedJsonLineIndexes = findEmbedJsonLineIndexes(lines);
	let state = 0;
	const messages = [];
	const results = [];

	let message = {
		text: "",
		firstline: 1
	};

	for (let i = 0; i < lines.length; i++) {
		if (embedJsonLineIndexes.has(i)) {
			continue;
		}

		if (i > 0 && /^#{1,3}(?!#)(?:\s|$)/.test(lines[i]) && lines[i - 1].trim() !== ".") {
			results.push({
				line: i + 1,
				type: "error",
				text: "Headings must be preceded by a line containing only '.'"
			});
		}
	}

	for (let i = 0; i < lines.length; i ++) {
		let line = lines[i];

		if (line[0] === ".") {
			line = line.slice(1);

			if (line.trim().length === 0) {
				if (!message.lastline) {
					message.lastline = i;
				}
				messages.push(message);
				message = {
					text: "",
					firstline: i + 2
				};
				state = 0;
				continue;
			}

			if (line[0] !== ".") {
				if (state === 0) {
					message.lastline = i;
					state = 1;
				}

				if (line.indexOf(":") === -1) {
					// Command must contain colon
					continue;
				}

				const parse = line.trim().match(/^(.*?):(.*)$/);
				const base = parse[1];
				const param = parse[2];

				if (base === "img" || base === "file") {
					if (param.match(/^https?:\/\/cdn\.discord(app)?\.com/)) {
						results.push({
							line: i + 1,
							type: "error",
							text: "Discord CDN should not be used for images"
						});
					}
				}
				continue;
			}
		}

		if (embedJsonLineIndexes.has(i)) {
			continue;
		}

		if (state === 1) {
			messages.push(message);
			message = {
				text: "",
				firstline: i + 1
			};
			state = 0;
		}

		message.text += "\n" + line;
	}

	if (!message.lastline) {
		message.lastline = lines.length;
	}
	messages.push(message);

	for (let i = 0; i < messages.length; i ++) {
		const message = messages[i];
		message.text = message.text
			.slice(1)
			.replace(/\$linkmsg_(.*?)\$/g, "https://discordapp.com/channels/00000000000000000000/00000000000000000000/00000000000000000000");

		if (message.text.match(/^\n/)) {
			results.push({
				line: message.firstline,
				type: "error",
				text: "Message should not start with an empty line"
			});
		}

		if (message.text.match(/^[ \n]/)) {
			message.text = "\u200b" + message.text;
		}

		if (message.text.match(/\n$/)) {
			message.text = message.text + "\u200b";
		}

		if (message.text === "") {
			message.text = "\u200b";
		}

		const mlines = message.text.split("\n");

		for (let i = 0; i < mlines.length; i ++) {
			let match;
			if (match = mlines[i].match(/^\u200B?(\s*)⬥/)) {
				if (match[1].length > 0) {
					results.push({
						line: message.firstline + i,
						type: "error",
						text: "The '⬥' character should not indented"
					});
				}
			}

			if (match = mlines[i].match(/^\u200B?(\s*)•/)) {
				if (match[1] !== "    ") {
					results.push({
						line: message.firstline + i,
						type: "error",
						text: "The '•' character should be indented by exactly four spaces"
					});
				}
			}

			if (match = mlines[i].match(/^\u200B?(\s*)⬩/)) {
				if (match[1] !== "        ") {
					results.push({
						line: message.firstline + i,
						type: "error",
						text: "The '⬩' character should be indented by exactly eight spaces"
					});
				}
			}

			if (match = mlines[i].match(/https?:\/\/streamable.com\/[a-z0-9]{6,}/)) {
				results.push({
					line: message.firstline + i,
					type: "error",
					text: "Use of streamable.com is forbidden"
				});
			}

			if (match = mlines[i].match(/(_ _|__ __)/)) {
				results.push({
					line: message.firstline + i,
					type: "error",
					text: "Do not make use of '_ _'"
				});
			}

			if (match = mlines[i].match(/[ \t]$/)) {
				results.push({
					line: message.firstline + i,
					type: "warn",
					text: "Content should not include trailing whitespace"
				});
			}

			if (match = mlines[i].replace(/^[\u200B\s]+/, "").match(/ {2,}/)) {
				results.push({
					line: message.firstline + i,
					type: "warn",
					text: "Content should not include double spaces"
				});
			}

			if (hasInvalidSymbolSpacing(mlines[i])) {
				results.push({
					line: message.firstline + i,
					type: "warn",
					text: "→ should have spaces around it"
				});
			}

			if (match = mlines[i].match(/#{4,}/)) {
				results.push({
					line: message.firstline + i,
					type: "error",
					text: "Heading format with 4 or more # are not supported in Discord. ### is the max"
				});
			}

			if (match = mlines[i].match(/^#{1,6}\s+.*\*\*.*\*\*.*/)) {
				results.push({
					line: message.firstline + i,
					type: "error",
					text: "Bold formatting **text** is redundant in headers (#, ##, ###). Remove the ** on this line"
				});
			}

			if (match = mlines[i].match(/^(?!.*(?:url|value|title|description|name))(?=.*https:\/\/img\.pvme\.io\/images\/)(?!.*<.*https:\/\/img\.pvme\.io\/images\/.*>).*/i)) {
				results.push({
					line: message.firstline + i,
					type: "warn",
					text: "Image links are normally preceeded by an .img: tag or wrapped in < > to not display"
				});
			}

			EMOJI_REGEX.lastIndex = 0;

			while ((match = EMOJI_REGEX.exec(mlines[i])) !== null) {
				const emoji = match[0];
				const start = match.index;
				const end = start + emoji.length;

				const fullLine = mlines[i];

				// 1) Skip if inside markdown link [text <:e:123>](url)
				if (isInsideMarkdownLinkText(fullLine)) {
					continue;
				}

				// 2) Skip if inside backticks
				if (isInsideBackticks(fullLine, emoji)) {
					continue;
				}

				if (!hasValidEmojiBefore(mlines[i], emoji, start) || !hasValidEmojiAfter(mlines[i], end)) {
					results.push({
						line: message.firstline + i,
						type: "warn",
						text: "Emojis must have valid characters around them"
					});
				}
			}
		}
	}

	for (let i = 0; i < results.length; i ++) {
		if (!Array.isArray(results[i].line)) {
			results[i].line = [ results[i].line, results[i].line ];
		}
	}

	return results;
}

export default findStyleErrors;
