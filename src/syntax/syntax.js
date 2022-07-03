import { embedSchema } from "./embedSchema";
import Ajv from "ajv";


const ajv = new Ajv({allErrors:true});
const validator = ajv.compile(embedSchema);


function formatError(error) {
    if (error.keyword === 'additionalProperties')
        return `Unrecognized property '${error.params.additionalProperty}'`;
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

function findSyntaxErrors(text) {
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
					results.push({
						line: i + 1,
						type: "error",
						text: "Command must contain colon"
					});
					continue;
				}

				const parse = line.trim().match(/^(.*?):(.*)$/);
				const base = parse[1];
				const param = parse[2];

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

					if (tags.has(param)) {
						results.push({
							line: i + 1,
							type: "error",
							text: "Tag already defined"
						});
					} else {
						tags.add(param);
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
						let json;

						try {
							json = JSON.parse(message.text);
						} catch (e) {
							// Suppress any further checking of the content
							message.text = "";

							results.push({
								line: i + 1,
								type: "error",
								text: "JSON embed object is invalid"
							});
							continue;
						}

						let embed;

						message.text = json.content ? json.content : "";
						delete json.content;

						if (json.embeds) {
							// if (json.embeds > 1) {
							// 	const err = new Error("Message too long");
							// 	err.reply = "Message #" + (messages.length + 1) +
							// 		" contains multiple embeds, limit 1 embed per" +
							// 		" message.";
							// 	throw err;
							// }

							embed = json.embeds[0];
						} else if (json.embed) {
							embed = json.embed;
						} else {
							embed = json;
						}

						// TODO: validate embed object
                        const embedValid = validateEmbedSchema(results, i + 1, embed);

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

	for (let i = 0; i < messages.length; i ++) {
		const message = messages[i];
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

		if (message.text.length > 2000) {
			results.push({
				line: [ message.firstline, message.lastline ],
				type: "error",
				text: "Message text exceeds 2000 characters"
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