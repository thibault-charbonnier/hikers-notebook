<!--
  Small tab with an arrow, stuck to the edge of a side bar, to fold or unfold
  it. Place it inside a positioned parent, at the edge of the bar it controls.
-->
<script lang="ts">
  let {
    side,
    open,
    label,
    ontoggle,
  }: { side: "left" | "right"; open: boolean; label: string; ontoggle: () => void } = $props();

  // The arrow points toward the side the bar will fold to (or unfold from).
  const pointsRight = $derived(side === "left" ? !open : open);
</script>

<button class="toggle {side}" type="button" aria-label={label} aria-expanded={open} onclick={ontoggle}>
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
       style:transform={pointsRight ? "rotate(180deg)" : "none"}>
    <path d="M9 2 L4 7 L9 12" />
  </svg>
</button>

<style>
  .toggle {
    position: absolute;
    top: 50%;
    z-index: 5;
    width: 22px;
    height: 56px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translateY(-50%);
    background: var(--panel);
    color: var(--muted);
    border: 1px solid var(--border);
    cursor: pointer;
  }

  .toggle:hover {
    color: var(--accent);
  }

  .left {
    left: 0;
    border-left: none;
    border-radius: 0 10px 10px 0;
  }

  .right {
    right: 0;
    border-right: none;
    border-radius: 10px 0 0 10px;
  }
</style>
