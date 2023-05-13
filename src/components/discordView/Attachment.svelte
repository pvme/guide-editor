<script>
    export let url;

    $: urlHTML = urlToHTML(url);

    function urlToHTML(url) {
        let match;
        if (url.match(/https?:\/\/i?\.?imgur\.com\/([a-zA-Z0-9]+)\.(png|jpg|jpeg|mp4)/))
            return `<img class='media' src='${url}'><p class='bg-red-900 p-2 my-2' style='color: hsla(0, 0%, 100%, .7)'>Warning! imgur links are now deprecated in PvME guides. Please replace this link with a pvme.io image link. For questions, contact any member of Editing Staff. <a href='${url}'>${url}</a></p>`;
        
        if(url.match(/https?:\/\/img\.?pvme\.io\/images\/([a-zA-Z0-9]+)\.(png|jpg|jpeg)/)) 
            return `<img class='media' src='${url}'>`;
        
        if (match = url.match(/https?:\/\/(?:youtu\.be\/|(?:www\.)?youtube\.com\/watch\?v=)([a-zA-Z0-9_\-]+)/)) {
            return `<iframe class='media' width='560' height='315' src='https://www.youtube.com/embed/${match[1]}' frameborder='0' allow='accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture' allowfullscreen></iframe>`;
        }
        return `<p class='bg-red-900 p-2 my-2' style='color: hsla(0, 0%, 100%, .7)'>Can't embed <a href='${url}'>${url}</a></p>`;
    }
</script>

{@html urlHTML}