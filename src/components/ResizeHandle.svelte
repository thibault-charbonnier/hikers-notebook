<!--
  Thin strip on the edge of a side bar: drag it (or use the arrow keys when it
  is focused) to change the width of the bar. Place it inside the bar, which
  must be positioned.

  `grows` tells where the bar gets wider when the strip is dragged: "right"
  for a bar on the left of the screen, "left" for a bar on the right.
-->
<script lang="ts">
  let {
    grows,
    width,
    min,
    max,
    onresize,
    onstart,
    onend,
  }: {
    grows: "left" | "right";
    width: number;
    min: number;
    max: number;
    onresize: (width: number) => void;
    onstart?: () => void;
    onend?: () => void;
  } = $props();

  const KEY_STEP = 16;
  let startX = 0;
  let startWidth = 0;
  let dragging = false;

  const clamp = (value: number) => Math.min(Math.max(value, min), max);
  const direction = $derived(grows === "right" ? 1 : -1);

  function onPointerDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    startX = event.clientX;
    startWidth = width;
    dragging = true;
    onstart?.();
  }

  function onPointerMove(event: PointerEvent): void {
    if (dragging) onresize(clamp(startWidth + direction * (event.clientX - startX)));
  }

  function onPointerUp(): void {
    if (!dragging) return;
    dragging = false;
    onend?.();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const sign = event.key === "ArrowRight" ? 1 : -1;
    onresize(clamp(width + direction * sign * KEY_STEP));
  }
</script>

<!-- A focusable separator is the standard "window splitter" pattern; the lint rules do not know it. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="handle {grows === 'right' ? 'on-right' : 'on-left'}"
  role="separator"
  aria-orientation="vertical"
  aria-label="Redimensionner la barre"
  aria-valuenow={width}
  aria-valuemin={min}
  aria-valuemax={max}
  tabindex="0"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  onkeydown={onKeyDown}
></div>

<style>
  .handle {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 5;
    width: 8px;
    cursor: col-resize;
    touch-action: none;
  }

  .on-right {
    right: 0;
  }

  .on-left {
    left: 0;
  }

  .handle:hover,
  .handle:focus-visible {
    background: rgba(47, 93, 70, 0.25);
    outline: none;
  }
</style>
