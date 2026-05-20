// src/components/GuideLoadModal.js

import { rawGithubJSONRequest, rawGithubTextRequest } from "../pvmeSettings";
import { loadGuideForReview } from "../guidePrApi";

// Find a guide from ?id=xxxxx (channel ID OR path-like ref)
export async function findGuideFromParam(paramID) {
    const normalized = normalizeGuideParam(paramID);

    if (!normalized) return null;

    const channelsJSON = await rawGithubJSONRequest(
        "https://raw.githubusercontent.com/pvme/pvme-settings/pvme-discord/channels.json"
    );

    for (const channel of channelsJSON) {
        const matches =
            channel.id === normalized.id ||
            (normalized.path && pathsMatch(channel.path, normalized.path));

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

function normalizeGuideParam(paramID) {
    if (!paramID) return null;

    let id = String(paramID).trim();

    try {
        id = decodeURIComponent(id);
    } catch {
        // URLSearchParams already decodes values; keep the original if this is not encoded.
    }

    id = id.replace(/^\/+|\/+$/g, "");

    if (!id) return null;

    if (!id.includes("/")) {
        return { id, path: "" };
    }

    const path = id.endsWith(".txt") ? id : `${id}.txt`;

    return { id, path };
}

function pathsMatch(channelPath, requestedPath) {
    if (!channelPath) return false;

    const normalizedChannelPath = channelPath.replace(/^\/+|\/+$/g, "");

    return normalizedChannelPath === requestedPath;
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
