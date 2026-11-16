<!--
  A thin bar cut into one piece per stage, to show at a glance how many stages
  a parcours has (and, with real lengths, how long each is). Stages use the
  same styles as on the map: the first is plain, the second hatched one way,
  the third hatched the other way, then it starts again.
-->
<script lang="ts">
  import { STAGE_PATTERN_COUNT } from "../lib/parcours";

  let {
    lengths,
    color = "var(--accent)",
    height = 8,
  }: { lengths: number[]; color?: string; height?: number } = $props();

  const total = $derived(lengths.reduce((sum, length) => sum + length, 0) || 1);
</script>

<span class="bar" style:--stage-color={color} style:height="{height}px" aria-hidden="true">
  {#each lengths as length, i}
    <span class="piece pattern-{i % STAGE_PATTERN_COUNT}" style:flex="{Math.max(length / total, 0.08)} 1 0"></span>
  {/each}
</span>

<style>
  .bar {
    display: flex;
    gap: 2px;
    width: 100%;
    min-width: 24px;
  }

  .piece {
    min-width: 4px;
    border-radius: 3px;
    background: var(--stage-color);
  }

  /* Hatched: stripes of the colour on a pale background. */
  .pattern-1 {
    background:
      repeating-linear-gradient(45deg, var(--stage-color) 0 2px, transparent 2px 5px),
      color-mix(in srgb, var(--stage-color) 22%, white);
  }

  .pattern-2 {
    background:
      repeating-linear-gradient(-45deg, var(--stage-color) 0 2px, transparent 2px 5px),
      color-mix(in srgb, var(--stage-color) 22%, white);
  }
</style>
