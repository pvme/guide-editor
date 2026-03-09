export let channels = {};
export let users = {};
export let roles = {};

export let pvmeSpreadsheet = {};

export let channelsFormat = {};
export let usersFormat = {};
export let rolesFormat = {};
export let emojisFormat = {};
export let emojiSearch = [];

export let styleGuide = ''; // doesn't fit here but it is what it is


export async function populateConstants() {
    // await new Promise(r => setTimeout(r, 2000));
    await setChannels();
    await setRoles();
    await setUsers();
    await setPvmeSpreadsheet();
    await setEmojis();
    await setStyleGuide();
}

async function rawGithubGetRequest(url) {
    const res = await fetch(url, {
        method: 'GET'
    });

    if (!res.ok)
        throw new Error(await res.text());

    return res;
}

export async function rawGithubTextRequest(url) {
    const res = await rawGithubGetRequest(url);
    return await res.text();
}

export async function rawGithubJSONRequest(url) {
    const res = await rawGithubGetRequest(url);
    return await res.json();
}

async function setStyleGuide() {
    styleGuide = await rawGithubTextRequest('https://raw.githubusercontent.com/pvme/pvme-guides/master/editor-resources/editor-references/style-guide.txt');
}

async function setPvmeSpreadsheet() {
    pvmeSpreadsheet = await rawGithubJSONRequest('https://raw.githubusercontent.com/pvme/pvme-settings/settings/pvme-spreadsheet/pvme_spreadsheet.json');
}

async function setChannels() {
    const channelsJSON = await rawGithubJSONRequest('https://raw.githubusercontent.com/pvme/pvme-settings/pvme-discord/channels.json');
    channels = channelsFormat = {};
    for (const channel of channelsJSON) {
        channels[channel.id] = channel.name;
        channelsFormat[channel.name.toLowerCase()] = channel.id;
    }
}

async function setRoles() {
    const rolesJSON = await rawGithubJSONRequest('https://raw.githubusercontent.com/pvme/pvme-settings/pvme-discord/roles.json');
    roles = rolesFormat = {};
    for (const role of rolesJSON) {
        roles[role.id] = role.name;
        rolesFormat[role.name.toLowerCase()] = role.id;
    }
}

async function setUsers() {
    const usersJSON = await rawGithubJSONRequest('https://raw.githubusercontent.com/pvme/pvme-settings/settings/users/users.json');
    users = usersFormat = {};
    for (const user of usersJSON) {
        users[user.id] = user.name;
        usersFormat[user.name.toLowerCase()] = user.id;
    }
}

async function setEmojis() {
    const emojisJSON = await rawGithubJSONRequest(
        'https://raw.githubusercontent.com/pvme/pvme-settings/master/emojis/emojis_v2.json'
    );

    emojisFormat = {};
    emojiSearch = [];

    const categories = Array.isArray(emojisJSON.categories)
        ? emojisJSON.categories
        : [];

    const allEmojis = categories.flatMap(c =>
        Array.isArray(c.emojis) ? c.emojis : []
    );

    for (const emoji of allEmojis) {

        if (!emoji || typeof emoji.id !== "string") continue;
        if (!emoji.emoji_id) continue;

        const emojiFormat = `<:${emoji.id}:${emoji.emoji_id}>`;

        const idKey = emoji.id.toLowerCase();

        emojisFormat[idKey] = emojiFormat;

        const searchTerms = new Set();

        searchTerms.add(idKey);

        if (typeof emoji.name === "string") {
            searchTerms.add(emoji.name.toLowerCase());
            searchTerms.add(emoji.name.toLowerCase().replace(/\s+/g, ""));
        }

        if (Array.isArray(emoji.id_aliases)) {
            for (const alias of emoji.id_aliases) {
                if (typeof alias === "string") {
                    const a = alias.toLowerCase();
                    searchTerms.add(a);
                    emojisFormat[a] = emojiFormat;
                }
            }
        }

        emojiSearch.push({
            id: idKey,
            format: emojiFormat,
            search: [...searchTerms]
        });
    }

    emojisFormat["wenspore"] =
        `<:wenarrow:971025697046925362>` +
        ` <:grico:787904334812807238>` +
        ` <:deathsporearrows:900758234527301642>`;

    console.log(emojiSearch.find(e => e.id.includes("nightmare")));
}
