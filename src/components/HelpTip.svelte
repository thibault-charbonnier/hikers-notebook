<!--
  A small round "?" that explains something in a bubble above it.

  With a mouse the bubble shows while the pointer is over the "?"; a click
  keeps it open until the next click. With a finger, a tap opens it and a tap
  anywhere else closes it.

  The bubble is as wide as the closest positioned parent (here, the label of a
  form field), so it never sticks out of its card.
-->
<script lang="ts">
  let { text, label }: { text: string; label: string } = $props();

  let hovering = $state(false);
  let pinned = $state(false);
  let root = $state<HTMLSpanElement>();
  const open = $derived(hovering || pinned);
</script>

<svelte:window
  onpointerdown={(event) => {
    // A press anywhere except on this very "?" folds the bubble.
    if (pinned && !root?.contains(event.target as Node)) pinned = false;
  }}
  onkeydown={(event) => event.key === "Escape" && (pinned = false)}
/>

<span class="tip" bind:this={root}>
  <button
    type="button"
    class="mark"
    aria-label={label}
    aria-expanded={open}
    onpointerenter={(event) => event.pointerType === "mouse" && (hovering = true)}
    onpointerleave={(event) => event.pointerType === "mouse" && (hovering = false)}
    onclick={() => (pinned = !pinned)}
  >
    ?
  </button>
  {#if open}
    <span class="bubble" role="tooltip">{text}</span>
  {/if}
</span>

<style>
  .tip {
    display: inline-flex;
    vertical-align: middle;
  }

  .mark {
    width: 18px;
    height: 18px;
    padding: 0;
    border: 1.5px solid var(--accent);
    border-radius: 50%;
    background: #fff;
    color: var(--accent);
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    cursor: help;
  }

  .mark:hover,
  .mark[aria-expanded="true"] {
    background: var(--accent);
    color: #fff;
  }

  .bubble {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 5;
    padding: 9px 11px;
    border-radius: 9px;
    background: var(--text);
    color: #fff;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.45;
    text-align: left;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
  }

  /* A bubble is dismissed by hovering away, so keep it from catching the pointer. */
  .bubble {
    pointer-events: none;
  }
</style>
