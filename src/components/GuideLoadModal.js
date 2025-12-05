// src/components/GuideLoadModal.js

import { rawGithubJSONRequest, rawGithubTextRequest } from "../pvmeSettings";

// Find a guide from ?id=xxxxx (channel ID OR path-like ref)
export async function findGuideFromParam(paramID) {
    if (!paramID) return null;

    const isPath = paramID.includes("/") && !paramID.endsWith("/");

    const channelsJSON = await rawGithubJSONRequest(
        "https://raw.githubusercontent.com/pvme/pvme-settings/pvme-discord/channels.json"
    );

    for (const channel of channelsJSON) {
        const matches =
            channel.id === paramID ||
            (isPath && channel.path.includes(paramID.substring(0, paramID.length - 2)));

        if (matches) {
            return {
                name: channel.name,
                url: `https://raw.githubusercontent.com/pvme/pvme-guides/master/${channel.path}`
            };
        }
    }

    return null;
}

// Fetch the raw text of the guide file from GitHub
export async function loadGuideText(url) {
    return rawGithubTextRequest(url);
}
