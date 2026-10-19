<script>
    import { onDestroy } from "svelte";
    import { safeUrl } from '../../renderer/guideRenderer.js';
    import { getPresetEmbedUrl, readPresetEmbedMetadata } from "../../presetEmbeds.js";

    export let url;

    let presetTitle = "PvME Preset";
    let presetImageUrl = "";
    let presetError = false;
    let presetRequest;

    $: presetShareUrl = getPresetEmbedUrl(url);
    $: urlHTML = urlToHTML(url);
    $: loadPresetPreview(presetShareUrl);

    onDestroy(() => presetRequest?.abort());

    function escapeAttr(value) {
        return value
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    async function loadPresetPreview(embedUrl) {
        presetRequest?.abort();
        presetImageUrl = "";
        presetTitle = "PvME Preset";
        presetError = false;
        if (!embedUrl) return;
        const request = new AbortController();
        presetRequest = request;

        try {
            const response = await fetch(embedUrl, { signal: request.signal });
            if (!response.ok) throw new Error("Preset preview is unavailable");
            const metadata = readPresetEmbedMetadata(await response.text(), embedUrl);
            if (request.signal.aborted) return;
            presetTitle = metadata.title;
            presetImageUrl = metadata.imageUrl;
        } catch {
            if (!request.signal.aborted) presetError = true;
        }
    }

    function renderImage(url) {
        const safeUrl = escapeAttr(url);
        return `<img class='media' src='${safeUrl}' alt='Attachment preview'>`;
    }

    function renderVideo(url) {
        const safeUrl = escapeAttr(url);
        return `<video class='media' controls preload='metadata'>
            <source src='${safeUrl}'>
            <a href='${safeUrl}'>${safeUrl}</a>
        </video>`;
    }

    function getYouTubeId(rawUrl) {
        try {
            const parsed = new URL(rawUrl);
            const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");

            if (host === "youtu.be") {
                return parsed.pathname.split("/").filter(Boolean)[0] || null;
            }

            if (host !== "youtube.com") return null;

            if (parsed.pathname === "/watch") {
                return parsed.searchParams.get("v");
            }

            const parts = parsed.pathname.split("/").filter(Boolean);
            if (["embed", "shorts", "live"].includes(parts[0])) {
                return parts[1] || null;
            }
        } catch {
            return null;
        }

        return null;
    }

    function urlToHTML(url) {
        url = safeUrl(url);
        if (!url) return '';
        let match;

        if (url.match(/https?:\/\/i?\.?imgur\.com\/([a-zA-Z0-9]+)/))
            return `${renderImage(url)}<p class='bg-red-900 p-2 my-2'
                style='color: hsla(0,0%,100%,.7)'>Warning! imgur links are now deprecated… 
                <a href='${escapeAttr(url)}'>${escapeAttr(url)}</a></p>`;

        if (url.match(/https?:\/\/img\.?pvme\.io\/images\/([a-zA-Z0-9]+)\.(mp4|webm|mov)(?:\?.*)?$/i))
            return renderVideo(url);

        if (url.match(/https?:\/\/img\.?pvme\.io\/images\/([a-zA-Z0-9]+)\.(png|jpg|jpeg|gif|webp)(?:\?.*)?$/i))
            return renderImage(url);

        if (url.match(/^https?:\/\/.+\.(mp4|webm|mov)(?:\?.*)?$/i))
            return renderVideo(url);

        if (url.match(/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)(?:\?.*)?$/i))
            return renderImage(url);

        const youtubeId = getYouTubeId(url);
        if (youtubeId) {
            return `<iframe class='media' width='560' height='315'
                src='https://www.youtube.com/embed/${escapeAttr(youtubeId)}'
                frameborder='0' allow='autoplay; encrypted-media; picture-in-picture'
                allowfullscreen></iframe>`;
        }

        // --- FIXED FALLBACK ---
        return `<p class='bg-red-900 p-2 my-2 pvme-attachment-error' style='color: hsla(0,0%,100%,.7)'>Can't embed <a href='${escapeAttr(url)}'>${escapeAttr(url)}</a></p>`;
    }
</script>

{#if presetShareUrl}
    <a class="attachment-og-title" href={presetShareUrl} rel="noopener noreferrer">
        {presetTitle}
    </a>
    {#if presetImageUrl}
        <img class="media" src={presetImageUrl} alt="Preset preview">
    {:else if presetError}
        <p class="pvme-attachment-error">Couldn't load preset preview.</p>
    {/if}
{:else}
    {@html urlHTML}
{/if}
