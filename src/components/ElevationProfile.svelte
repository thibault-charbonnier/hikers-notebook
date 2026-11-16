<!--
  Elevation profile of the hike: elevation (vertical) against distance
  (horizontal), with the numbered points marked. Hover to read the elevation
  at any distance.

  Stages (cut at the points listed in `stageIndices`) are told apart as on
  the map: the first is plain, the next ones are hatched one way, then the
  other way, then it starts again. Dashed lines mark where stages end, and a
  row under the chart names them ("Jour 1"...), so nothing is written over the
  colours of the slopes.

  `width` and `height` are the drawing size; the image scales to its container,
  so a bigger drawing (with a bigger `fontSize`) gives a bigger profile.
-->
<script lang="ts">
  import { formatDistance, formatMeters } from "../lib/format";
  import type { Profile } from "../lib/geo";
  import { SLOPE_COLORS, SLOPE_LEGEND, slopeBins, slopeColor } from "../lib/slope";

  let {
    profile,
    labels,
    stageIndices = [],
    mode = "altitude",
    width = 360,
    height = 170,
    fontSize = 10,
  }: {
    profile: Profile;
    labels: string[];
    /** Indices of the points that end a stage. */
    stageIndices?: number[];
    /** ``slope``: the area under the curve is coloured by the steepness of each stretch. */
    mode?: "altitude" | "slope";
    width?: number;
    height?: number;
    fontSize?: number;
  } = $props();

  /** Makes the ids of the patterns unique when two profiles are on the page. */
  const uid = Math.random().toString(36).slice(2, 8);

  const MAX_DRAWN_SAMPLES = 800;
  const margin = $derived({ left: fontSize * 4.4, right: 12, top: fontSize * 1.8, bottom: fontSize * 2.4 });
  const pointRadius = $derived(fontSize * 0.8);

  const total = $derived(profile.distance[profile.distance.length - 1] || 1);
  const bounds = $derived.by(() => {
    let low = Infinity;
    let high = -Infinity;
    for (const e of profile.elevation) {
      low = Math.min(low, e);
      high = Math.max(high, e);
    }
    const pad = Math.max((high - low) * 0.08, 5);
    return { low: low - pad, high: high + pad };
  });

  const x = (distance: number) => margin.left + (distance / total) * (width - margin.left - margin.right);
  const y = (elevation: number) =>
    margin.top + (1 - (elevation - bounds.low) / (bounds.high - bounds.low)) * (height - margin.top - margin.bottom);

  /** Index of the sample closest to a distance (binary search). */
  function nearestIndex(distance: number): number {
    let lo = 0;
    let hi = profile.distance.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (profile.distance[mid] < distance) lo = mid + 1;
      else hi = mid;
    }
    return lo > 0 && distance - profile.distance[lo - 1] < profile.distance[lo] - distance ? lo - 1 : lo;
  }

  const linePath = $derived.by(() => {
    const stride = Math.ceil(profile.distance.length / MAX_DRAWN_SAMPLES);
    const last = profile.distance.length - 1;
    const parts: string[] = [];
    for (let i = 0; i < last; i += stride) {
      parts.push(`${x(profile.distance[i]).toFixed(1)},${y(profile.elevation[i]).toFixed(1)}`);
    }
    parts.push(`${x(profile.distance[last]).toFixed(1)},${y(profile.elevation[last]).toFixed(1)}`);
    return "M" + parts.join(" L");
  });
  const baseline = $derived(height - margin.bottom);
  const areaPath = $derived(`${linePath} L${x(total).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z`);

  const ticks = $derived([bounds.low, (bounds.low + bounds.high) / 2, bounds.high]);

  /** The stages as horizontal ranges: ``[from, to]`` distances in meters. */
  const stages = $derived.by(() => {
    const cuts = [0, ...stageIndices.map((i) => profile.pointDistances[i]).filter((d) => d !== undefined), total];
    return cuts.slice(0, -1).map((from, k) => ({ from, to: cuts[k + 1] }));
  });

  /** Extra height under the chart for the row that names the stages. */
  const stageRow = $derived(stages.length > 1 ? fontSize * 3 : 0);

  /** The slope of each stretch (100 m or 200 m), and the gradient that colours the area with them. */
  const bins = $derived(slopeBins(profile));

  /** Slope of the stretch under a distance, in percent. */
  function slopeAt(distance: number): number {
    return bins.find((bin) => distance <= bin.to)?.slope ?? bins[bins.length - 1]?.slope ?? 0;
  }

  const formatSlope = (slope: number) =>
    `${slope > 0 ? "+" : slope < 0 ? "−" : ""}${Math.abs(slope).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`;

  let hovered = $state<number | null>(null);

  function onPointerMove(event: PointerEvent): void {
    const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const distance = ((svgX - margin.left) / (width - margin.left - margin.right)) * total;
    hovered = nearestIndex(Math.min(Math.max(distance, 0), total));
  }
</script>

<svg
  viewBox="0 0 {width} {height + stageRow}"
  role="img"
  aria-label="Profil altimétrique de la rando"
  style:--fs="{fontSize}px"
  onpointermove={onPointerMove}
  onpointerleave={() => (hovered = null)}
>
  {#each ticks as tick}
    <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} class="grid" />
    <text x={margin.left - 6} y={y(tick) + fontSize * 0.35} class="label" text-anchor="end">{Math.round(tick)}</text>
  {/each}
  <text x={margin.left} y={height - 6} class="label">0</text>
  <text x={width - margin.right} y={height - 6} class="label" text-anchor="end">{formatDistance(total)}</text>

  <defs>
    <pattern id="hatch-up-{uid}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="7" class="hatch" />
    </pattern>
    <pattern id="hatch-down-{uid}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
      <line x1="0" y1="0" x2="0" y2="7" class="hatch" />
    </pattern>
    {#each stages as stage, k}
      <clipPath id="stage-{uid}-{k}">
        <rect x={x(stage.from)} y={margin.top} width={Math.max(x(stage.to) - x(stage.from), 0)} height={baseline - margin.top} />
      </clipPath>
    {/each}
  </defs>

  {#if mode === "slope"}
    <defs>
      <!-- Hard colour stops: each stretch keeps its own colour (like columns under the curve). -->
      <linearGradient id="slope-{uid}" gradientUnits="userSpaceOnUse" x1={x(0)} x2={x(total)} y1="0" y2="0">
        {#each bins as bin}
          <stop offset={bin.from / total} stop-color={slopeColor(bin.slope)} />
          <stop offset={bin.to / total} stop-color={slopeColor(bin.slope)} />
        {/each}
      </linearGradient>
    </defs>
    <path d={areaPath} fill="url(#slope-{uid})" />
  {:else}
    <path d={areaPath} class="area" />
  {/if}
  {#each stages as stage, k}
    {#if mode !== "slope" && k % 3 !== 0}
      <path d={areaPath} fill="url(#hatch-{k % 3 === 1 ? 'up' : 'down'}-{uid})" clip-path="url(#stage-{uid}-{k})" />
    {/if}
  {/each}
  <path d={linePath} class="line" />

  {#if stages.length > 1}
    {#each stages as stage, k}
      {#if k > 0}
        <line x1={x(stage.from)} x2={x(stage.from)} y1={margin.top} y2={baseline} class="stage-line" />
      {/if}
      {@const barX = x(stage.from) + 1}
      {@const barWidth = Math.max(x(stage.to) - x(stage.from) - 2, 0)}
      {@const barY = height + fontSize * 0.2}
      <!-- The name of the stage, under the chart: plain bar, or hatched like on the map. -->
      <rect x={barX} y={barY} width={barWidth} height={fontSize * 0.6} rx={fontSize * 0.3} class={k % 3 === 0 ? "stage-bar" : "stage-bar pale"} />
      {#if k % 3 !== 0}
        <rect x={barX} y={barY} width={barWidth} height={fontSize * 0.6} rx={fontSize * 0.3} fill="url(#hatch-{k % 3 === 1 ? 'up' : 'down'}-{uid})" />
      {/if}
      <text x={barX + barWidth / 2} y={barY + fontSize * 1.9} class="stage-label" text-anchor="middle">Jour {k + 1}</text>
    {/each}
  {/if}

  {#each profile.pointDistances as distance, i}
    {@const index = nearestIndex(distance)}
    <circle cx={x(distance)} cy={y(profile.elevation[index])} r={pointRadius} class="point" />
    <text x={x(distance)} y={y(profile.elevation[index]) + fontSize * 0.35} class="point-number" text-anchor="middle">
      {labels[i] ?? i + 1}
    </text>
  {/each}

  {#if hovered !== null}
    {@const hx = x(profile.distance[hovered])}
    {@const hy = y(profile.elevation[hovered])}
    <line x1={hx} x2={hx} y1={margin.top} y2={baseline} class="cursor" />
    <circle cx={hx} cy={hy} r={fontSize * 0.4} class="cursor-dot" />
    <text x={Math.min(Math.max(hx, margin.left + 60), width - 70)} y={margin.top - 3} class="tooltip" text-anchor="middle">
      {formatDistance(profile.distance[hovered])} · {formatMeters(profile.elevation[hovered])}{mode === "slope"
        ? ` · ${formatSlope(slopeAt(profile.distance[hovered]))}`
        : ""}
    </text>
  {/if}
</svg>

{#if mode === "slope"}
  <div class="legend" aria-label="Légende des pentes">
    <span class="legend-bar" style:background="linear-gradient(to right, {SLOPE_COLORS.map(([slope, color]) => `${color} ${((slope + 30) / 60) * 100}%`).join(', ')})"></span>
    <span class="legend-ticks">
      {#each SLOPE_LEGEND as slope}
        <span style:left="{((slope + 30) / 60) * 100}%">{slope > 0 ? "+" : slope < 0 ? "−" : ""}{Math.abs(slope)} %</span>
      {/each}
    </span>
  </div>
{/if}

<style>
  .legend {
    margin-top: 6px;
    padding: 0 4px;
  }

  .legend-bar {
    display: block;
    height: 8px;
    border-radius: 4px;
  }

  .legend-ticks {
    position: relative;
    display: block;
    height: 16px;
    margin-top: 3px;
    font-size: 11px;
    color: var(--muted);
  }

  .legend-ticks span {
    position: absolute;
    transform: translateX(-50%);
    white-space: nowrap;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    touch-action: none;
  }

  .grid {
    stroke: var(--border);
    stroke-width: 1;
  }

  .label {
    font-size: var(--fs);
    fill: var(--muted);
  }

  .area {
    fill: #dce8df;
  }

  .hatch {
    stroke: var(--accent);
    stroke-width: 2;
    opacity: 0.45;
  }

  .stage-line {
    stroke: var(--accent);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }

  .stage-label {
    font-size: var(--fs);
    font-weight: 700;
    fill: var(--accent);
    pointer-events: none;
  }

  .stage-bar {
    fill: var(--accent);
  }

  .stage-bar.pale {
    fill: #cfe0d4;
  }

  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linejoin: round;
  }

  .point {
    fill: var(--text);
    stroke: #fff;
    stroke-width: 2;
  }

  .point-number {
    font-size: var(--fs);
    font-weight: 700;
    fill: #fff;
    pointer-events: none;
  }

  .cursor {
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .cursor-dot {
    fill: var(--accent);
    stroke: #fff;
    stroke-width: 2;
  }

  .tooltip {
    font-size: calc(var(--fs) * 1.1);
    font-weight: 600;
    fill: var(--text);
  }
</style>
