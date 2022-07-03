export const avatarURL = 'https://cdn.discordapp.com/avatars/689197754584399963/51fc3581cac941e4adbafd41e7ae2ec3.webp?size=80';
export const username = 'PvM Encyclopedia';

export let channels = {};
export let users = {};
export let roles = {};

export let pvmeSpreadsheet = {};

export let channelsFormat = {};
export let usersFormat = {};
export let rolesFormat = {};
export let emojisFormat = {};

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

async function rawGithubTextRequest(url) {
    const res = await rawGithubGetRequest(url);
    return await res.text();
}

async function rawGithubJSONRequest(url) {
    const res = await rawGithubGetRequest(url);
    return await res.json();
}

async function setStyleGuide() {
    styleGuide = await rawGithubTextRequest('https://raw.githubusercontent.com/pvme/pvme-guides/master/guide-writing/style-guide.txt');
}

async function setPvmeSpreadsheet() {
    pvmeSpreadsheet = await rawGithubJSONRequest('https://raw.githubusercontent.com/Towsti/pvme-settings/master/pvme_spreadsheet.json');
}

async function setChannels() {
    const channelsJSON = await rawGithubJSONRequest('https://raw.githubusercontent.com/pvme/pvme-settings/master/channels.json');
    channels = channelsFormat = {};
    for (const channel of channelsJSON) {
        channels[channel.id] = channel.name;
        channelsFormat[channel.name.toLowerCase()] = channel.id;
    }
}

async function setRoles() {
    const rolesJSON = await rawGithubJSONRequest('https://raw.githubusercontent.com/pvme/pvme-settings/master/roles.json');
    roles = rolesFormat = {};
    for (const role of rolesJSON) {
        roles[role.id] = role.name;
        rolesFormat[role.name.toLowerCase()] = role.id;
    }
}

async function setUsers() {
    const usersJSON = await rawGithubJSONRequest('https://raw.githubusercontent.com/Towsti/pvme-settings/master/users.json');
    users = usersFormat = {};
    for (const user of usersJSON) {
        users[user.id] = user.name;
        usersFormat[user.name.toLowerCase()] = user.id;
    }
}

async function setEmojis() {
    const emojisJSON = await rawGithubJSONRequest('https://raw.githubusercontent.com/pvme/rotation-builder/main/settings.json');
    emojisFormat = {};
    for (const [emoji, aliases] of Object.entries(emojisJSON)) {
        for (const alias of aliases) {
            emojisFormat[alias.toLowerCase()] = emoji;
        }
    }
}
