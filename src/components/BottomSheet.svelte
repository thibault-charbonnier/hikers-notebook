<!--
  Sheet that slides up from the bottom of the screen (phone only).

  It has three heights: "peek" (only the grip and a title, the map stays
  visible), "half" and "full" (covers everything). Drag the grip or the title
  up or down, or tap them to open and close. Inside the sheet, swiping up
  first opens it, and swiping down from the top of its content closes it.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    header,
    children,
  }: {
    /** What the sheet shows next to the grip when it is closed. */
    header: Snippet;
    children: Snippet;
  } = $props();

  /** Height of the closed sheet: the grip and one line of title. */
  const PEEK = 68;
  /** Below this move, in pixels, a gesture counts as a tap. */
  const TAP = 8;
  /** Beyond this move, the sheet goes to the next height even if it stays close to the old one. */
  const STEP = 30;

  type Snap = "peek" | "half" | "full";

  let areaHeight = $state(0);
  let snap = $state<Snap>("peek");
  /** Height while a finger or the mouse is dragging, else ``null``. */
  let dragHeight = $state<number | null>(null);
  let body = $state<HTMLDivElement>();

  const heights = $derived<Record<Snap, number>>({ peek: PEEK, half: Math.round(areaHeight * 0.55), full: areaHeight });
  const height = $derived(dragHeight ?? heights[snap]);

  // A gesture in progress: where it started, and the height at that moment.
  let startY = 0;
  let startHeight = 0;

  function begin(y: number): void {
    startY = y;
    startHeight = heights[snap];
    dragHeight = startHeight;
  }

  function move(y: number): void {
    dragHeight = Math.min(areaHeight, Math.max(PEEK, startHeight + startY - y));
  }

  /** End of the gesture: settle on the closest height, a step further if the move was clear. */
  function end(y: number): void {
    const moved = startY - y; // positive when going up
    const order: Snap[] = ["peek", "half", "full"];
    const current = order.indexOf(snap);
    let target: Snap;
    if (Math.abs(moved) < TAP) {
      target = snap === "peek" ? "half" : "peek"; // a tap opens or closes
    } else {
      const final = Math.min(areaHeight, Math.max(PEEK, startHeight + moved));
      target = order.reduce((best, s) => (Math.abs(heights[s] - final) < Math.abs(heights[best] - final) ? s : best));
      if (target === snap && Math.abs(moved) > STEP) {
        target = order[Math.min(2, Math.max(0, current + (moved > 0 ? 1 : -1)))];
      }
    }
    snap = target;
    dragHeight = null;
  }

  // Grip and title: mouse or finger, through pointer events.
  function onPointerDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    begin(event.clientY);
  }
  function onPointerMove(event: PointerEvent): void {
    if (dragHeight !== null) move(event.clientY);
  }
  function onPointerUp(event: PointerEvent): void {
    if (dragHeight !== null) end(event.clientY);
  }

  // Content: a swipe moves the sheet instead of scrolling the content when the
  // sheet is not fully open (swipe up), or when the content is at its top
  // (swipe down). Needs touch events that can cancel the browser's scrolling.
  $effect(() => {
    const element = body;
    if (!element) return;
    let touchStart = 0;
    let dragging = false;

    const onTouchStart = (event: TouchEvent) => {
      touchStart = event.touches[0].clientY;
      dragging = false;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0].clientY;
      if (!dragging) {
        const down = y > touchStart;
        const opensSheet = !down && snap !== "full";
        const closesSheet = down && element.scrollTop <= 0;
        if (!opensSheet && !closesSheet) return;
        dragging = true;
        begin(touchStart);
      }
      event.preventDefault();
      move(y);
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (!dragging) return;
      dragging = false;
      end(event.changedTouches[0].clientY);
    };

    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    element.addEventListener("touchend", onTouchEnd);
    return () => {
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
    };
  });
</script>

<div class="area" bind:clientHeight={areaHeight}>
  <section class="sheet" class:dragging={dragHeight !== null} style:height="{height}px" aria-label="Panneau du bas">
    <div
      class="head"
      role="button"
      tabindex="0"
      aria-label={snap === "peek" ? "Ouvrir le panneau" : "Fermer le panneau"}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      onkeydown={(event) => {
        if (event.key === "Enter" || event.key === " ") snap = snap === "peek" ? "half" : "peek";
      }}
    >
      <span class="grip"></span>
      <div class="title">{@render header()}</div>
    </div>
    <div class="body" bind:this={body}>{@render children()}</div>
  </section>
</div>

<style>
  /* Covers the screen, but lets touches through to the map except on the sheet itself. */
  .area {
    position: absolute;
    inset: 0;
    z-index: 6;
    pointer-events: none;
  }

  .sheet {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border-radius: 18px 18px 0 0;
    border: 1px solid var(--border);
    border-bottom: none;
    box-shadow: 0 -4px 18px rgba(31, 42, 36, 0.2);
    pointer-events: auto;
    transition: height 0.22s ease;
  }

  .sheet.dragging {
    transition: none;
  }

  .head {
    flex: none;
    height: 68px;
    padding: 8px 18px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  .grip {
    width: 44px;
    height: 5px;
    border-radius: 3px;
    background: #cbc4b0;
  }

  .title {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-title);
    font-size: 17px;
    font-weight: 700;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
</style>
