<script>
  export let text = "";
  export let align = "center";

  let visible = false;
  let autoHideTimer;

  function showTooltip() {
    clearTimeout(autoHideTimer);
    visible = true;
    autoHideTimer = setTimeout(() => {
      visible = false;
    }, 1800);
  }

  function hideTooltip() {
    clearTimeout(autoHideTimer);
    visible = false;
  }

  function hideOnInnerClick(node) {
    node.addEventListener("click", hideTooltip, true);
    node.addEventListener("pointerenter", showTooltip);
    node.addEventListener("focusin", showTooltip);
    node.addEventListener("pointerleave", hideTooltip);
    node.addEventListener("focusout", hideTooltip);

    return {
      destroy() {
        clearTimeout(autoHideTimer);
        node.removeEventListener("click", hideTooltip, true);
        node.removeEventListener("pointerenter", showTooltip);
        node.removeEventListener("focusin", showTooltip);
        node.removeEventListener("pointerleave", hideTooltip);
        node.removeEventListener("focusout", hideTooltip);
      }
    };
  }
</script>

<span
  use:hideOnInnerClick
  class="toolbar-tooltip-wrap"
  class:align-right={align === "right"}
  class:align-left={align === "left"}
  class:visible
>
  <slot />
  {#if text}
    <span class="toolbar-tooltip" role="tooltip">
      {text}
    </span>
  {/if}
</span>

<style>
  .toolbar-tooltip-wrap {
    position: relative;
    display: inline-flex;
  }

  .toolbar-tooltip {
    position: absolute;
    left: 50%;
    top: calc(100% + 0.5rem);
    z-index: 50;
    width: max-content;
    max-width: 18rem;
    border: 1px solid rgb(51 65 85);
    border-radius: 4px;
    background: rgb(15 23 42);
    color: rgb(226 232 240);
    font-size: 0.75rem;
    line-height: 1rem;
    padding: 0.4rem 0.55rem;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, -0.25rem);
    transition:
      opacity 120ms ease,
      transform 120ms ease;
    white-space: normal;
  }

  .toolbar-tooltip::before {
    content: "";
    position: absolute;
    left: 50%;
    top: -0.33rem;
    width: 0.6rem;
    height: 0.6rem;
    border-left: 1px solid rgb(51 65 85);
    border-top: 1px solid rgb(51 65 85);
    background: rgb(15 23 42);
    transform: translateX(-50%) rotate(45deg);
  }

  .toolbar-tooltip-wrap.visible .toolbar-tooltip {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  .align-right .toolbar-tooltip {
    left: auto;
    right: 0;
    transform: translate(0, -0.25rem);
  }

  .align-right .toolbar-tooltip::before {
    left: auto;
    right: 0.9rem;
    transform: rotate(45deg);
  }

  .align-right.visible .toolbar-tooltip {
    transform: translate(0, 0);
  }

  .align-left .toolbar-tooltip {
    left: 0;
    transform: translate(0, -0.25rem);
  }

  .align-left .toolbar-tooltip::before {
    left: 0.9rem;
    transform: rotate(45deg);
  }

  .align-left.visible .toolbar-tooltip {
    transform: translate(0, 0);
  }
</style>
