const EMBED_BASE = "https://pvme.io/preset-maker-storage/embeds/";
const PRESET_ID = /^[a-z0-9_-]+$/i;
const LAYOUTS = ["7x4", "4x7"];

// Resolve legacy share links locally; their host may still use the old renderer.
export function getPresetEmbedUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) return null;

        if (parsed.hostname === "pvme.io") {
            const match = parsed.pathname.match(/^\/preset-maker-storage\/embeds\/([^/]+)\/(7x4|4x7)\/?$/);
            if (!match || !PRESET_ID.test(match[1])) return null;
            return `${EMBED_BASE}${match[1]}/${match[2]}/${parsed.search}`;
        }

        if (parsed.hostname !== "presets.pvme.io" || parsed.pathname !== "/") return null;

        // Older guides also use a second '?' before layout instead of '&'.
        const params = new URLSearchParams(parsed.search.slice(1).replace(/\?/g, "&"));
        const id = params.get("id");
        const layout = params.get("layout") || "7x4";
        if (!id || !PRESET_ID.test(id) || !LAYOUTS.includes(layout)) return null;

        const version = params.get("v");
        const search = version ? `?${new URLSearchParams({ v: version })}` : "";
        return `${EMBED_BASE}${id}/${layout}/${search}`;
    } catch {
        return null;
    }
}

export function readPresetEmbedMetadata(html, embedUrl) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const title = doc.querySelector('meta[property="og:title"]')?.content || "PvME Preset";
    const image = doc.querySelector('meta[property="og:image"]')?.content;
    if (!image) throw new Error("Preset preview image is missing");

    const imageUrl = new URL(image, embedUrl);
    // Published metadata can use HTTP even though the images support HTTPS.
    if (imageUrl.protocol === "http:") imageUrl.protocol = "https:";
    if (imageUrl.protocol !== "https:") throw new Error("Invalid preset preview image");

    return { title, imageUrl: imageUrl.href };
}
