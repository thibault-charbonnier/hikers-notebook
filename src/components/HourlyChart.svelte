<!--
  The day hour by hour, from 6 h to 21 h: bars for the rain (blue) and the
  snow (light blue) of each hour, and the temperature as a line on top.
-->
<script lang="ts">
  import type { HourWeather } from "../lib/weather";

  let { hours }: { hours: HourWeather[] } = $props();

  const FIRST_HOUR = 6;
  const LAST_HOUR = 21;
  const WIDTH = 320;
  const HEIGHT = 112;
  const MARGIN = { left: 8, right: 8, top: 16, bottom: 18 };
  /** The bars use the lower half of the chart, the temperature line the whole height. */
  const BAR_SHARE = 0.5;

  const shown = $derived(hours.filter((h) => h.hour >= FIRST_HOUR && h.hour <= LAST_HOUR));
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const slot = $derived(plotWidth / Math.max(shown.length, 1));

  const maxRain = $derived(Math.max(2, ...shown.map((h) => h.rain + h.snow)));
  const tMin = $derived(Math.min(...shown.map((h) => h.temperature)));
  const tMax = $derived(Math.max(...shown.map((h) => h.temperature)));

  const cx = (index: number) => MARGIN.left + slot * (index + 0.5);
  const ty = (t: number) => MARGIN.top + (1 - (t - tMin) / Math.max(tMax - tMin, 1)) * plotHeight;
  const barHeight = (mm: number) => (mm / maxRain) * plotHeight * BAR_SHARE;
  const baseline = MARGIN.top + plotHeight;

  const line = $derived(shown.map((h, i) => `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)},${ty(h.temperature).toFixed(1)}`).join(" "));
  const coldest = $derived(shown.findIndex((h) => h.temperature === tMin));
  const warmest = $derived(shown.findIndex((h) => h.temperature === tMax));

  const degrees = (t: number) => `${Math.round(t)}°`;
  const hasPrecipitation = $derived(shown.some((h) => h.rain + h.snow > 0.05));
</script>

<svg viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label="Température et précipitations heure par heure">
  <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={baseline} y2={baseline} class="axis" />

  {#each shown as h, i}
    {#if h.rain + h.snow > 0.05}
      <g>
        <title>{h.hour} h : {(h.rain + h.snow).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} mm</title>
        <rect x={cx(i) - slot * 0.35} y={baseline - barHeight(h.rain + h.snow)} width={slot * 0.7} height={barHeight(h.rain)} class="rain" />
        <rect x={cx(i) - slot * 0.35} y={baseline - barHeight(h.rain + h.snow)} width={slot * 0.7}
              height={barHeight(h.snow)} class="snow" />
      </g>
    {/if}
    {#if h.hour % 3 === 0}
      <text x={cx(i)} y={HEIGHT - 4} class="hour" text-anchor="middle">{h.hour} h</text>
    {/if}
  {/each}

  <path d={line} class="temperature" />
  {#if shown.length > 0}
    <circle cx={cx(warmest)} cy={ty(tMax)} r="3" class="dot" />
    <text x={cx(warmest)} y={ty(tMax) - 6} class="value" text-anchor="middle">{degrees(tMax)}</text>
    {#if coldest !== warmest}
      <circle cx={cx(coldest)} cy={ty(tMin)} r="3" class="dot" />
      <text x={cx(coldest)} y={ty(tMin) + 13} class="value" text-anchor="middle">{degrees(tMin)}</text>
    {/if}
  {/if}
  {#if !hasPrecipitation}
    <text x={WIDTH - MARGIN.right} y={baseline - 6} class="note" text-anchor="end">Pas de précipitations</text>
  {/if}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .axis {
    stroke: var(--border);
    stroke-width: 1;
  }

  .rain {
    fill: #4a90d9;
  }

  .snow {
    fill: #a9d9ea;
    stroke: #6bb3cf;
    stroke-width: 0.6;
  }

  .temperature {
    fill: none;
    stroke: #d9602b;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .dot {
    fill: #d9602b;
    stroke: #fff;
    stroke-width: 1.5;
  }

  .value {
    font-size: 11px;
    font-weight: 700;
    fill: var(--text);
  }

  .hour {
    font-size: 10px;
    fill: var(--muted);
  }

  .note {
    font-size: 10px;
    fill: var(--muted);
  }
</style>
