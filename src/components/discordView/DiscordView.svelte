<script>
  import { createEventDispatcher, afterUpdate, onMount } from "svelte";
  import Message from "./Message.svelte";
  import Bot from "./Bot.svelte";
  import { parseMessages } from "../../parser/parseMessages.js";
  import { highlightPreviewMessage } from "../../codemirror/messageSync.js";

  export let text;
  export let scrollBottom = false;

  export let messages = [];
  export let offsets = [];

  const dispatch = createEventDispatcher();
  let container;

  /* -------------------------------------------------------
     Parse messages + offsets
  ------------------------------------------------------- */
  $: messages = parseMessages(text);

  $: offsets = (() => {
    let acc = 0;
    return messages.map((m) => {
      const start = acc;
      acc += m.lineMap.length;
      return start;
    });
  })();

  /* -------------------------------------------------------
     Link Intercept Popover
  ------------------------------------------------------- */
  let popover = null; // { url, x, y }
  let tagFlashTimer = null;

  function handleRootClick(event) {
    // Detect any link in ancestry
    const link = event.target.closest("a[href]");
    if (!link) return;

    // Stop navigation & message-click handlers
    event.preventDefault();
    event.stopPropagation();

    const targetTag = getLinkmsgTarget(link);
    if (targetTag) {
      closePopover();
      scrollToTag(targetTag);
      return;
    }

    // Show popover
    const linkBox = link.getBoundingClientRect();
    const containerBox = container.getBoundingClientRect();

    const x = linkBox.left - containerBox.left + linkBox.width / 2;
    const y = linkBox.top - containerBox.top + container.scrollTop;

    openPopover(link.href, x, y);
  }

  function getLinkmsgTarget(link) {
    const rawHref = link.getAttribute("href") || "";
    const candidates = [
      rawHref,
      safeDecode(rawHref),
      link.href,
      safeDecode(link.href)
    ];

    for (const candidate of candidates) {
      const match = candidate.match(/\$linkmsg_([^$]+)\$/);
      if (match) return match[1];
    }

    return null;
  }

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function scrollToTag(tag) {
    const targetIndex = messages.findIndex((msg) =>
      msg.tag?.toLowerCase() === tag.toLowerCase()
    );
    if (targetIndex === -1) return;

    const target = container.querySelector(
      `.pvme-message[data-msg-index="${targetIndex}"]`
    );
    target?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    clearTimeout(tagFlashTimer);
    tagFlashTimer = setTimeout(() => {
      highlightPreviewMessage(targetIndex);
    }, 180);
  }

  function openPopover(url, x, y) {
    popover = { url, x, y };
  }

  function closePopover() {
    popover = null;
  }

  function confirmOpen() {
    if (popover?.url) {
      window.open(popover.url, "_blank", "noopener,noreferrer");
    }
    closePopover();
  }

  /* -------------------------------------------------------
     Click on message block → emit event (ignore links)
  ------------------------------------------------------- */
  function handleMessageClick(i, e) {
    if (e.target.closest("a[href]")) return; // don't trigger message click
    e.stopPropagation();
    dispatch("messageClick", { index: i, messages, offsets });
  }

  /* -------------------------------------------------------
     Scroll bottom after render
  ------------------------------------------------------- */
  afterUpdate(() => {
    if (scrollBottom) container.scrollTop = container.scrollHeight;
  });

  /* -------------------------------------------------------
     Close popover when clicking outside
  ------------------------------------------------------- */
    onMount(() => {
      window.addEventListener("click", (e) => {
        if (!popover) return;

        // Clicking inside popover? do nothing.
        if (e.target.closest(".popover-menu")) return;

        // Clicking on a link should NOT immediately reopen a new popover
        if (e.target.closest("a[href]")) {
          // Let handleRootClick intercept it normally
          return;
        }

        // Anything else closes popover
        closePopover();
      }, true); // ← capture mode fixes bubbling conflicts
    });

</script>

<!-- ROOT WRAPPER -->
<div
  bind:this={container}
  class="discord-view relative"
  role="button"
  tabindex="0"
  on:click|capture={handleRootClick}
  on:keydown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleRootClick(e);
    }
  }}
>

  <!-- ============================
       LINK POPOVER
       ============================ -->
  {#if popover}
    <div
      class="popover-menu absolute z-50 px-4 py-2 rounded-md shadow-xl 
             bg-gray-800 text-gray-100 text-sm border border-gray-700 
             flex items-center space-x-3 transform -translate-x-1/2 -translate-y-full
             animate-pop"
      style="left:{popover.x}px; top:{popover.y}px;"
    >
      <span>Open link?</span>

      <button
        class="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded 
               text-white text-xs focus:outline-none"
        on:click|stopPropagation={confirmOpen}
      >
        Open
      </button>

      <button
        class="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded 
               text-white text-xs focus:outline-none"
        on:click|stopPropagation={closePopover}
      >
        Cancel
      </button>
    </div>
  {/if}

  <!-- ============================
       MESSAGE LIST
       ============================ -->
  <div class="flex-vertical whitney theme-dark">
    <div class="chat flex-vertical flex-spacer">
      <div class="content flex-horizontal flex-spacer">
        <div class="flex-spacer flex-vertical messages-wrapper">
          <div class="scroller-wrap">
            <div class="scroller messages">
              <div class="message-group">

                <div class="comment">
                  <div class="message first">
                    <Bot />
                  </div>

                  {#each messages as msg, i}
                    <div
                      class="message pvme-message"
                      class:pvme-message--json-embed={msg.lineMap?.some((item) => item.type === "embed")}
                      class:pvme-message--after-attachment={msg.followsAttachment}
                      class:pvme-message--trailing-blank={msg.hasTrailingBlank}
                      data-msg-index={i}
                      data-tag={msg.tag || undefined}
                      role="button"
                      tabindex="0"
                      on:dblclick={(e) => handleMessageClick(i, e)}
                      on:keydown={(e) => {
                        if (e.target.closest("a[href]")) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleMessageClick(i, e);
                        }
                      }}
                    >
                      <Message
                        lineMap={msg.lineMap}
                        globalOffset={offsets[i]}
                      />
                    </div>
                  {/each}
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
