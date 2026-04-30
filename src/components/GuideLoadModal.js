// src/components/GuideLoadModal.js

import { rawGithubJSONRequest, rawGithubTextRequest } from "../pvmeSettings";
import { loadGuideForReview } from "../guidePrApi";

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
                path: channel.path,
                url: `https://raw.githubusercontent.com/pvme/pvme-guides/master/${channel.path}`
            };
        }
    }

    return null;
}

// Fetch guide text plus review metadata from the guide PR backend.
export async function loadGuideText(guide, source = "auto") {
    if (guide?.path) {
        return loadGuideForReview(guide.path, source);
    }

    return {
        source: "master",
        branch: "master",
        baseBranch: "master",
        prUrl: "",
        originalText: await rawGithubTextRequest(guide.url)
    };
}
