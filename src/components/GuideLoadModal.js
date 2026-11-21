// src/components/GuideLoadModal.js

import { rawGithubJSONRequest, rawGithubTextRequest } from "../pvmeSettings.js";
import { loadGuideForReview } from "../guidePrApi.js";

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

    if (normalized.path) {
        return {
            name: normalized.path.split("/").pop().replace(/\.txt$/, ""),
            path: normalized.path,
            url: `https://raw.githubusercontent.com/pvme/pvme-guides/master/${normalized.path}`
        };
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

    if (/[\\?#\u0000-\u001f:]/.test(path) || path.split("/").some(part => !part || part === "." || part === "..")) {
        return null;
    }

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
        try {
            return await loadGuideForReview(guide.path, source);
        } catch (error) {
            const unavailable = error instanceof TypeError || [502, 503, 504].includes(error.status);
            if (source === "review" || !unavailable) throw error;

            return {
                source: "master",
                branch: "master",
                baseBranch: "master",
                prUrl: "",
                originalText: await rawGithubTextRequest(guide.url),
                notice: "Loaded the PvME guide directly from GitHub. Submitted updates could not be checked because the guide API is unavailable."
            };
        }
    }

    return {
        source: "master",
        branch: "master",
        baseBranch: "master",
        prUrl: "",
        originalText: await rawGithubTextRequest(guide.url)
    };
}
