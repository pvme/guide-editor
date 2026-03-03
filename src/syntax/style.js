function findStyleErrors(text) {
    /* state values
	 * 0 - parsing message content
	 * 1 - parsing message commands
	 */
    const lines = text.split('\n');
	let state = 0;
	const messages = [];
	const tags = new Set();

	const results = [];

	let message = {
		text: "",
		firstline: 1
	};

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
			if (match = mlines[i].match(/^(\s*)⬥/)) {
				if (match[1].length > 0) {
					results.push({
						line: message.firstline + i,
						type: "error",
						text: "The '⬥' character should not indented"
					});
				}
			}

			if (match = mlines[i].match(/^(\s*)•/)) {
				if (match[1] !== "    ") {
					results.push({
						line: message.firstline + i,
						type: "error",
						text: "The '•' character should be indented by exactly four spaces"
					});
				}
			}

			if (match = mlines[i].match(/^(\s*)⬩/)) {
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

			const emojiRegex = /<:[^:>]+:\d+>/g;
			const ALLOWED_CHARS = /[\\`"'[\](){}.,!?;:_*\-]/;

			emojiRegex.lastIndex = 0;

			while ((match = emojiRegex.exec(mlines[i])) !== null) {
				const emoji = match[0];
				const start = match.index;
				const end = start + emoji.length;

				const before = mlines[i][start - 1] || "";
				const after = mlines[i][end] || "";
				const fullLine = mlines[i];

				// 1) Skip if inside markdown link [text <:e:123>](url)
				if (/\[[^\]]*<:[^:>]+:\d+>[^\]]*\]\([^)]*\)/.test(fullLine)) {
					continue;
				}

				// 2) Skip if inside backticks
				if (new RegExp("`[^`]*" + emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "[^`]*`").test(fullLine)) {
					continue;
				}

				// 3) Skip if prefixed by r, s, or _
				if (before && /[rs_]/.test(before)) {
					continue;
				}

				// 4) Skip if prefixed by allowed punctuation
				if (before && ALLOWED_CHARS.test(before)) {
					continue;
				}

				// 5) Skip if followed by allowed punctuation
				if (after && ALLOWED_CHARS.test(after)) {
					continue;
				}

				// 6) Skip if prefixed by zero-width space
				if (before === "\u200B") {
					continue;
				}

				// Failed checks, check for start/end of line
				const atStart = start === 0;
				const atEnd = end === mlines[i].length;

				if ((!atStart && before !== " ") || (!atEnd && after !== " ")) {
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
