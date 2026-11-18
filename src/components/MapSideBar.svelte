<!--
  The tools of the planning map, kept together:

  - the palette (move, waypoints, points of interest, undo / redo), see MapTools.svelte;
  - the actions (3D, offline, GPX, share, delete), see HikeActions.svelte.

  On a computer they are two separate floating bars (the palette at the top
  left, the actions at the bottom left): this component adds nothing there.
  On a phone they become ONE bar down the left side, between the hike bar (top)
  and the map scale (bottom). Its buttons shrink, down to 30 px, so that the whole
  bar always fits whatever the height of the screen and of the hike bar. It
  hides while the hike details are open.
-->
<script lang="ts">
  import { ui } from "../lib/ui.svelte.js";
  import { viewport } from "../lib/viewport.svelte.js";
  import HikeActions from "./HikeActions.svelte";
  import MapTools from "./MapTools.svelte";
</script>

{#if !(viewport.phone && ui.detailsOpen)}
  <div class="side" style:--top-bar-bottom="{ui.topBarBottom}px">
    <MapTools />
    <HikeActions />
  </div>
{/if}

<style>
  /* Computer: no box of its own, the two bars place themselves. */
  .side {
    display: contents;
  }

  /* Phone: one bar. */
  @media (max-width: 720px) {
    .side {
      position: absolute;
      left: 8px;
      top: calc(var(--top-bar-bottom, 190px) + 8px);
      z-index: 4;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px;
      /* room left for the map scale and the closed sheet below */
      --room: calc(100dvh - var(--top-bar-bottom, 190px) - 8px - 104px);
      /* 10 buttons share the room (what is left once gaps, separators and padding are taken off) */
      --btn: clamp(30px, calc((var(--room) - 50px) / 10), 44px);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(31, 42, 36, 0.15);
    }
  }
</style>
