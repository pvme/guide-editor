<script>
    export let url;

    $: urlHTML = urlToHTML(url);

    function urlToHTML(url) {
        let match;

        if (url.match(/https?:\/\/i?\.?imgur\.com\/([a-zA-Z0-9]+)/))
            return `<img class='media' src='${url}'><p class='bg-red-900 p-2 my-2'
                style='color: hsla(0,0%,100%,.7)'>Warning! imgur links are now deprecated… 
                <a href='${url}'>${url}</a></p>`;

        if (url.match(/https?:\/\/img\.?pvme\.io\/images\/([a-zA-Z0-9]+)\.(png|jpg|jpeg|gif|mp4|webp)/))
            return `<img class='media' src='${url}'>`;

        if (url.match(/https?:\/\/presets\.pvme\.io\/?\?id=/)) {
            const id = new URL(url).searchParams.get("id");
            return `<img class='media'
                src='https://firebasestorage.googleapis.com/v0/b/preset-images/o/images%2F${id}.png?alt=media'>`;
        }

        if ((match = url.match(/https?:\/\/(?:youtu\.be\/|(?:www\.)?youtube\.com\/watch\?v=)([a-zA-Z0-9_\-]+)/))) {
            return `<iframe class='media' width='560' height='315'
                src='https://www.youtube.com/embed/${match[1]}'
                frameborder='0' allow='autoplay; encrypted-media; picture-in-picture'
                allowfullscreen></iframe>`;
        }

        // --- FIXED FALLBACK ---
        return `<p class='bg-red-900 p-2 my-2 pvme-attachment-error' style='color: hsla(0,0%,100%,.7)'>Can't embed <a href='${url}'>${url}</a></p>`;
    }
</script>

{@html urlHTML}
