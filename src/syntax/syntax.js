import { embedSchema } from "./embedSchema.js";
import Ajv from "ajv";


const ajv = new Ajv({allErrors:true});
const validator = ajv.compile(embedSchema);
const SECTION_NAME_REGEX = /^[A-Za-z0-9_-]+$/;
const LINKMSG_TOKEN_REGEX = /\$linkmsg[^$]*\$/g;
const VALID_LINKMSG_REGEX = /^\$linkmsg_([A-Za-z0-9_-]+)\$$/;


function normalizeEmbedJson(json) {
	return json
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
		.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ");
}

function extractEmbed(json) {
	if (json.embeds) {
		return json.embeds[0];
	}

	if (json.embed) {
		return json.embed;
	}

	return json;
}

function getJsonErrorLocation(jsonText, error) {
	const message = error?.message || "Invalid JSON";
	const lineColumnMatch = message.match(/line (\d+) column (\d+)/i);

	if (lineColumnMatch) {
		return {
			lineOffset: Number(lineColumnMatch[1]) - 1,
			column: Number(lineColumnMatch[2]),
			position: null,
			message
		};
	}

	const positionMatch = message.match(/position (\d+)/i);
	if (!positionMatch) {
		const tokenMatch = message.match(/Unexpected token '([^']+)'/i);
		if (tokenMatch) {
			const token = tokenMatch[1];
			let inString = false;
			let escape = false;

			for (let i = 0; i < jsonText.length; i++) {
				const char = jsonText[i];

				if (escape) {
					escape = false;
					continue;
				}

				if (char === "\\") {
					escape = inString;
					continue;
				}

				if (char === "\"") {
					inString = !inString;
					continue;
				}

				if (!inString && char === token) {
					const before = jsonText.slice(0, i);
					const lineOffset = before.split("\n").length - 1;
					const lastNewline = before.lastIndexOf("\n");
					const column = i - lastNewline;

					return {
						lineOffset,
						column,
						position: i,
						message
					};
				}
			}
		}

		return {
			lineOffset: 0,
			column: 1,
			position: null,
			message
		};
	}

	const position = Number(positionMatch[1]);
	const before = jsonText.slice(0, position);
	const lineOffset = before.split("\n").length - 1;
	const lastNewline = before.lastIndexOf("\n");
	const column = position - lastNewline;

	return {
		lineOffset,
		column,
		position,
		message
	};
}

function formatJsonParseError(jsonText, location) {
	const lines = jsonText.split("\n");
	const errorLine = lines[location.lineOffset] || "";
	const valueStart = Math.max(location.column - 1, 0);
	const beforeValue = errorLine.slice(0, valueStart);
	const valueText = errorLine.slice(valueStart).trim();
	const fieldMatch = beforeValue.match(/"([^"]+)"\s*:\s*$/);

	if (/Bad control character in string literal/i.test(location.message)) {
		const unterminatedStringMatch = errorLine.match(/"([^"]+)"\s*:\s*"([^"]*)$/);

		if (unterminatedStringMatch) {
			const fieldName = unterminatedStringMatch[1];
			const preview = unterminatedStringMatch[2].slice(0, 30);

			return `JSON embed is invalid near column ${location.column}: field "${fieldName}" looks like it is missing a closing quote after ${JSON.stringify(preview)}`;
		}
	}

	if (fieldMatch && valueText) {
		const fieldName = fieldMatch[1];
		const preview = valueText
			.replace(/[",\s]+$/g, "")
			.slice(0, 30);

		return `JSON embed is invalid near column ${location.column}: field "${fieldName}" looks like it is missing an opening quote before ${JSON.stringify(preview)}`;
	}

	return `JSON embed is invalid near column ${location.column}: ${location.message}`;
}

function formatError(error) {
    if (error.keyword === 'additionalProperties')
        return `Unrecognised property '${error.params.additionalProperty}'`;
    else
        return `'${error.instancePath.slice(1)}' ${error.message}`;
}

function validateEmbedSchema(results, line, embed) {
    const valid = validator(embed);
    if (!valid) {
        for (const error of validator.errors) {
            results.push({
                line: line,
                type: "error",
                text: formatError(error)
            });
        }
    }
}

function validateEmbedFields(results, line, embed) {
	try {
		if (embed.fields) {
			for(let j = 0 ; j < embed.fields.length; j++) {
				if(embed.fields[j].name.trim().length == 0) {
					results.push({
						line: line,
						type: "error",
						text: "JSON embed object is invalid: \"name\" is empty in an embed field"
					});
				}
				if(embed.fields[j].value.trim() == 0) {
					results.push({
						line: line,
						type: "error",
						text: "JSON embed object is invalid: \"value\" is empty in an embed field"
					});
				}
			}
		}
	}
	catch(e) {
		console.log("Error parsing embed fields: " + e);
	}
}

function validateEmbedJsonText(results, line, jsonText) {
	let json;
	const normalizedJsonText = normalizeEmbedJson(jsonText);

	try {
		json = JSON.parse(normalizedJsonText);
	} catch (e) {
		const location = getJsonErrorLocation(normalizedJsonText, e);
		results.push({
			line: line + location.lineOffset,
			type: "error",
			text: formatJsonParseError(normalizedJsonText, location)
		});
		return null;
	}

	const embed = extractEmbed(json);
	validateEmbedFields(results, line, embed);
	validateEmbedSchema(results, line, embed);

	return { json, embed };
}

function findPotentialEmbedJsonBlocks(lines) {
	const blocks = [];
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
				startLine: i + 1,
				lines: [raw],
				hasEmbedCommand: false,
				depth: 0,
				inString: false,
				escape: false
			};
			updateBlockState(block, raw);

			if (block.depth <= 0 && nextNonEmptyTrim(i + 1) !== ".embed:json") {
				blocks.push(block);
				block = null;
			}
			continue;
		}

		if (!block) {
			continue;
		}

		if (trimmed === ".embed:json") {
			block.hasEmbedCommand = true;
			blocks.push(block);
			block = null;
			continue;
		}

		block.lines.push(raw);
		updateBlockState(block, raw);

		if (block.depth <= 0 && nextNonEmptyTrim(i + 1) !== ".embed:json") {
			blocks.push(block);
			block = null;
		}
	}

	if (block) {
		blocks.push(block);
	}

	return blocks;
}

function validatePotentialEmbedJsonBlocks(results, lines) {
	for (const block of findPotentialEmbedJsonBlocks(lines)) {
		if (block.hasEmbedCommand) {
			continue;
		}

		validateEmbedJsonText(results, block.startLine, block.lines.join("\n"));
	}
}

function findSyntaxErrors(text) {
    /* state values
    * 0 - parsing message content
    * 1 - parsing message commands
    */
	const lines = text.split('\n');
    let state = 0;
	const messages = [];
	const tags = new Set();
	const tagLines = new Map();

	const results = [];

	let message = {
		text: "",
		firstline: 1
	};

	validatePotentialEmbedJsonBlocks(results, lines);

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
					results.push({
						line: i + 1,
						type: "error",
						text: "Command must contain colon"
					});
					continue;
				}
				else {
					if(line[line.indexOf(":")+1] == " ") {
						results.push({
							line: i + 1,
							type: "error",
							text: "Command must not have trailing whitespace after the colon and before the content"
						});
						continue;
					}
				}

				const parse = line.trim().match(/^(.*?):(.*)$/);
				const base = parse[1];
				const param = parse[2];

				if (base === "blank") {
				    // .blank: must have no parameters
				    if (param.trim() !== "") {
				        results.push({
				            line: i + 1,
				            type: "error",
				            text: ".blank: command must not have parameters"
				        });
				    }

				    // mark the message as a forced blank
				    // (DiscordView will turn this into a blank message)
				    if (!message.lastline) {
				        message.lastline = i;
				    }
				    messages.push({
				        text: "",
				        firstline: i + 1,
				        lastline: i + 1,
				        isBlankCommand: true  // ← NEW FLAG
				    });

				    // begin a new message afterward
				    message = {
				        text: "",
				        firstline: i + 2
				    };

				    state = 0;
				    continue;
				}

				if (base === "img" || base === "file") {
					if (!param.match(/https?:\/\/.*?/)) {
						results.push({
							line: i + 1,
							type: "error",
							text: "Invalid attachment URL"
						});
					}
					if (message.attachment) {
						results.push({
							line: i + 1,
							type: "error",
							text: "Message already contains attachment"
						});
					}

					message.attachment = true;
				} else if (base === "tag") {
					if (message.tag) {
						results.push({
							line: i + 1,
							type: "error",
							text: "Message already tagged"
						});
					}

					if (!SECTION_NAME_REGEX.test(param)) {
						results.push({
							line: i + 1,
							type: "error",
							text: ".tag: value must contain only letters, numbers, underscores, or hyphens"
						});
					} else if (tags.has(param)) {
						results.push({
							line: i + 1,
							type: "error",
							text: "Tag already defined"
						});
					} else {
						tags.add(param);
						tagLines.set(param, i + 1);
						message.tag = param;
					}
				} else if (base === "pin") {
					if (param !== "delete" && param !== "") {
						results.push({
							line: i + 1,
							type: "error",
							text: "Pin parameter must either be delete or empty"
						});
					}
				} else if (base === "embed") {
					if (param !== "json" && param !== "") {
						// Suppress any further checking of the content
						message.text = "";

						results.push({
							line: i + 1,
							type: "error",
							text: "Embed parameter must either be json or empty"
						});
					}

					if (param === "json") {
						message.linkText = message.text;
						const embedText = message.text.slice(1);
						const embedResult = validateEmbedJsonText(results, message.firstline, embedText);
						if (!embedResult) {
							// Suppress any further checking of the content
							message.text = "";
							continue;
						}

						const json = embedResult.json;
						message.text = json.content ? json.content : "";
						delete json.content;

					}
				} else if (base === "react") {
				} else {
					results.push({
						line: i + 1,
						type: "error",
						text: "No such command"
					});
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

	const linkedTags = new Set();

	for (let i = 0; i < messages.length; i ++) {
		const message = messages[i];
		const linkText = message.linkText ?? message.text;
		let msgLinks = linkText.match(LINKMSG_TOKEN_REGEX);
		if (msgLinks) {
			for (let j = 0 ; j < msgLinks.length ; j++) {
				const linkMatch = msgLinks[j].match(VALID_LINKMSG_REGEX);

				if (!linkMatch) {
					results.push({
						line: [ message.firstline, message.lastline ],
						type: "error",
						text: "$linkmsg_ references must use only letters, numbers, underscores, or hyphens"
					});
					continue;
				}

				const sectionName = linkMatch[1];
				linkedTags.add(sectionName);
				if (!tags.has(sectionName)) {
					results.push({
						line: [ message.firstline, message.lastline ],
						type: "warn",
						text: `$linkmsg_${sectionName}$ does not match any .tag:${sectionName}`
					});
				}
			}
		}
		
		message.text = message.text
			.slice(1)
			.replace(/\$linkmsg_(.*?)\$/g, "https://discordapp.com/channels/00000000000000000000/00000000000000000000/00000000000000000000");

		if (message.text.match(/^[ \n]/)) {
			message.text = "\u200b" + message.text;
		}

		if (message.text.match(/\n$/)) {
			message.text = message.text + "\u200b";
		}

		if (message.text === "") {
			message.text = "\u200b";
		}

		const linkWithDiscordEmoji = /\[[^\]]*<a?:\w+:\d+>[^\]]*\]\([^)]+\)/g;

		if (linkWithDiscordEmoji.test(message.text)) {
			results.push({
				line: [message.firstline, message.lastline],
				type: "error",
				text: "Discord emoji must not appear inside links"
			});
		}

		if (message.text.length > 2000) {
			results.push({
				line: [ message.firstline, message.lastline ],
				type: "error",
				text: "Message text exceeds 2000 characters"
			});
		}
	}

	for (const tag of tags) {
		if (!linkedTags.has(tag)) {
			const line = tagLines.get(tag);
			results.push({
				line: line,
				type: "warn",
				text: `.tag:${tag} does not have a matching $linkmsg_${tag}$ reference`
			});
		}
	}

	for (let i = 0; i < results.length; i ++) {
		if (!Array.isArray(results[i].line)) {
			results[i].line = [ results[i].line, results[i].line ];
		}
	}

	return results;
}

export default findSyntaxErrors;
