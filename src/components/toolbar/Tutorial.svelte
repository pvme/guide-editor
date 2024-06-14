<script>
    import { onMount } from 'svelte';

    onMount(async () => {
      document.addEventListener("DOMContentLoaded", (event) => {
        if(!localStorage.getItem('first-visit')) {
          document.getElementById('TutorialButton').click();
          localStorage.setItem('first-visit', 'false')
        }
		  });
    });
</script>


<button id="TutorialButton" data-dropdown-toggle="TutorialOptions" type="button" class='inline-flex items-center rounded bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-2 active:bg-indigo-800 text-sm border border-indigo-700' title="Tutorial">
  Tutorial&nbsp;
</button>

<div id="TutorialOptions" class="z-10 hidden rounded shadow bg-slate-700 border border-slate-800" style="max-width:669px">
  <div class="m-4 flex-col inline-flex text-white text-left text-sm">
    <h1>How to Use the Guide Editor</h1>
    <p>This guide editor allows us to test out changes to various guides and see how they would look in Discord. Additionally, it tells us whenever the syntax of a guide has a problem that requires fixing before it can be merged.</p>
    <p>The view on the left is just a standard text file. The view on the right is how that file would look in Discord upon being posted by the PvM Encyclopedia bot.</p>
    <p>Various tools can help to start guides from a template, insert formatting, and use Discord emojis much easier than doing it manually.</p>
    <p>Check out all of the menu bar options to see what is available for you!</p>
    <h1>How Can I Change an Existing PvME Guide?</h1>
    <p>You most likely arrived here by clicking a link within a PvME guide that prompted you to load a guide into the website. You should see that guide displayed on the page.</p>
    <p>To have changes made to this guide <b>without touching GitHub</b> simply: <br>1. Make your desired changes to the left-hand side of the page<br>2. When satisfied, click the "Export to .txt" button in the menu bar<br>3. Send the .txt file in the <a href="https://discord.com/channels/534508796639182860/1020853673317908500" class="text-blue-400 visited:text-purple-400">PvME Discord #suggestion channel</a></p>
  </div>
</div>

<style>
  h1 {
    all: revert;
  }
  p {
    all: revert;
    margin-bottom: 0.3rem;
  }
  b {
    all: revert;
  }
  a {
    all: revert;
  }
</style>