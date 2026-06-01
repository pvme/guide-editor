<script>
  import { createEventDispatcher } from "svelte";
  import BoxArrowRight from "svelte-bootstrap-icons/lib/BoxArrowRight.svelte";
  import Github from "svelte-bootstrap-icons/lib/Github.svelte";
  import PersonCircle from "svelte-bootstrap-icons/lib/PersonCircle.svelte";
  import Modal from "./Modal.svelte";
  import ToolbarTooltip from "./ToolbarTooltip.svelte";
  import { authUser } from "../../stores";
  import {
    getDiscordLoginUrl,
    getGithubLoginUrl,
    logoutDiscord
  } from "../../guidePrApi";

  export let loginRequestId = 0;
  export let submitAfterLogin = false;

  const dispatch = createEventDispatcher();

  let open = false;
  let busy = "";
  let loginForSubmit = false;
  let lastLoginRequestId = loginRequestId;

  $: signedIn = Boolean($authUser?.discordId || $authUser?.githubId);
  $: canReview = Boolean($authUser?.canReviewPrs);
  $: provider = $authUser?.provider === "github" ? "GitHub" : "Discord";
  $: displayName = $authUser?.displayName || $authUser?.globalName || $authUser?.username || $authUser?.githubLogin || provider;

  $: if (loginRequestId !== lastLoginRequestId) {
    lastLoginRequestId = loginRequestId;
    loginForSubmit = submitAfterLogin;
    open = true;
  }

  function loginWithGithub() {
    busy = "github";
    window.location.href = getGithubLoginUrl({ submitAfterLogin: loginForSubmit });
  }

  function loginWithDiscord() {
    busy = "discord";
    window.location.href = getDiscordLoginUrl({ submitAfterLogin: loginForSubmit });
  }

  async function logout() {
    if (busy) return;
    busy = "logout";

    try {
      await logoutDiscord();
      authUser.set(null);
    } finally {
      busy = "";
    }
  }

  $: if (signedIn && open) {
    open = false;
    busy = "";
  }
</script>

{#if signedIn}
  <div class="account-signed-in" class:has-review={canReview}>
    {#if canReview}
      <ToolbarTooltip text="Review pull requests">
        <button class="account-control account-review" type="button" on:click={() => dispatch("openReviewPr")}>
          <Github />
          <span>Review PRs</span>
        </button>
      </ToolbarTooltip>
    {/if}
    <ToolbarTooltip text={`Signed in with ${provider}`}>
      <span class="account-control account-identity" aria-label={`Signed in with ${provider} as ${displayName}`}>
        {#if $authUser?.provider === "github"}
          <Github />
        {:else}
          <span class="discord-mark account-provider-mark">D</span>
        {/if}
        <span>{displayName}</span>
      </span>
    </ToolbarTooltip>
    <ToolbarTooltip text={`Log out of ${provider}`} align="right">
      <button class="account-control account-logout" type="button" on:click={logout} disabled={busy === "logout"} aria-label={`Log out of ${provider}`}>
        {#if busy === "logout"}
          <span class="loading-spinner" aria-hidden="true"></span>
        {:else}
          <BoxArrowRight />
        {/if}
      </button>
    </ToolbarTooltip>
  </div>
{:else}
  <ToolbarTooltip text="Log in" align="right">
    <button
      class="account-control account-login"
      type="button"
      on:click={() => {
        loginForSubmit = false;
        open = true;
      }}
    >
      <PersonCircle />
      <span>Log in</span>
    </button>
  </ToolbarTooltip>
{/if}

<Modal {open} close={() => (open = false)} panelClass="max-w-sm !p-0">
  <div class="border-b border-slate-700 px-5 py-4 pr-12">
    <h2 class="text-lg font-semibold text-white">Log in</h2>
  </div>

  <div class="space-y-2 p-5">
    <button class="login-choice" type="button" on:click={loginWithGithub} disabled={Boolean(busy)}>
      <Github />
      <span class="min-w-0 flex-1">
        <span class="block font-medium text-slate-100">GitHub</span>
        <span class="block text-xs text-slate-500">Submit and review using your GitHub account</span>
      </span>
      {#if busy === "github"}
        <span class="loading-spinner" aria-hidden="true"></span>
      {/if}
    </button>

    <button class="login-choice" type="button" on:click={loginWithDiscord} disabled={Boolean(busy)}>
      <span class="discord-mark">D</span>
      <span class="min-w-0 flex-1">
        <span class="block font-medium text-slate-100">Discord</span>
        <span class="block text-xs text-slate-500">Submit through the PvME guide bot</span>
      </span>
      {#if busy === "discord"}
        <span class="loading-spinner" aria-hidden="true"></span>
      {/if}
    </button>
  </div>
</Modal>

<style>
  .account-control {
    display: inline-flex;
    height: 2.5rem;
    min-width: 0;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: 1px solid rgb(71 85 105);
    border-radius: 0.25rem;
    background: rgb(51 65 85);
    color: rgb(241 245 249);
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    transition:
      background 150ms ease,
      border-color 150ms ease,
      color 150ms ease;
    white-space: nowrap;
  }

  button.account-control:hover,
  button.account-control:focus {
    border-color: rgb(100 116 139);
    background: rgb(71 85 105);
    color: white;
    outline: none;
  }

  button.account-control:active {
    background: rgb(30 41 59);
  }

  button.account-control:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .account-login {
    max-width: 8rem;
  }

  .account-identity {
    max-width: 12rem;
  }

  .account-review {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .account-identity span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-signed-in {
    display: inline-flex;
    flex-wrap: nowrap;
    min-width: 0;
    max-width: 22rem;
  }

  .account-signed-in :global(.toolbar-tooltip-wrap) {
    min-width: 0;
  }

  .account-login :global(svg),
  .account-review :global(svg),
  .account-identity :global(svg) {
    flex-shrink: 0;
  }

  .account-signed-in.has-review .account-identity {
    border-left: 0;
    border-radius: 0;
  }

  .account-signed-in:not(.has-review) .account-identity {
    border-top-left-radius: 0.25rem;
    border-bottom-left-radius: 0.25rem;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .account-logout {
    border-left: 0;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    width: 2.5rem;
    padding-left: 0;
    padding-right: 0;
  }

  .login-choice {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.75rem;
    border: 1px solid rgb(51 65 85);
    border-radius: 0.375rem;
    background: rgb(15 23 42 / 0.55);
    padding: 0.8rem;
    text-align: left;
    transition:
      background 120ms ease,
      border-color 120ms ease;
  }

  .login-choice:hover,
  .login-choice:focus {
    border-color: rgb(59 130 246 / 0.75);
    background: rgb(30 41 59 / 0.85);
    outline: none;
  }

  .login-choice:disabled {
    cursor: wait;
    opacity: 0.75;
  }

  .discord-mark {
    display: inline-flex;
    width: 1.1rem;
    height: 1.1rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background: rgb(88 101 242);
    color: white;
    font-size: 0.65rem;
    font-weight: 700;
  }

  .account-provider-mark {
    width: 1rem;
    height: 1rem;
  }
</style>
