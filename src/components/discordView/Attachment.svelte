<script>
    export let url;

    $: urlHTML = urlToHTML(url);

    function urlToHTML(url) {
        let match;
        if (url.match(/https?:\/\/i?\.?imgur\.com\/([a-zA-Z0-9]+)\.png/))
            return `<img class='media' src='${url}'>`;
        
        if (url.match(/https?:\/\/i?\.?imgur\.com\/([a-zA-Z0-9]+)\.jpg/))
            return `<img class='media' src='${url}'>`;
        
        if (url.match(/https?:\/\/i?\.?imgur\.com\/([a-zA-Z0-9]+)\.mp4/))
            return `<video class='media' controls><source src='${url}' type='video/mp4' />`;
        
        if (match = url.match(/https?:\/\/youtu\.be\/([a-zA-Z0-9_\-]+)/)) {
            return `<iframe class='media' width='560' height='315' src='https://www.youtube.com/embed/${match[1]}' frameborder='0' allow='accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture' allowfullscreen></iframe>`;
        }
        return `<p class='embed-error bg-red-900 p-2 my-2' style='color: hsla(0, 0%, 100%, .7)'>Can't embed <a href='${url}'>${url}</a></p>`;
    }
</script>

{@html urlHTML}

<style>
    .embed-error {
        color: hsla(0, 0%, 100%, .7) !important;
        background-color: aqua;
    }
</style>