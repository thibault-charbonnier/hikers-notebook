<!--
  The compass of a map. It shows where the top of the screen points to.

  - On a computer it is large (96 px): a dial with N, E, S, O that turns with
    the map, and in the middle the direction (for example NO) and the angle.
  - On a phone it is small (41 px): a letter in the middle and a red mark on
    the north.

  A tap puts the map back with north on top.

  The map turns with two fingers (a phone) or with a right-click drag (a
  computer), in 2D and in 3D alike (see map.ts).
-->
<script lang="ts">
  import type { Map as MapLibreMap } from "maplibre-gl";
  import { viewport } from "../lib/viewport.svelte.js";

  let { map }: { map: MapLibreMap | undefined } = $props();

  /** Direction the top of the map points to, in degrees clockwise from north (0-360). */
  let bearing = $state(0);

  $effect(() => {
    const instance = map;
    if (!instance) return;
    const update = () => (bearing = (instance.getBearing() + 360) % 360);
    update();
    instance.on("rotate", update);
    return () => {
      instance.off("rotate", update);
    };
  });

  const NAMES = ["Nord", "Nord-est", "Est", "Sud-est", "Sud", "Sud-ouest", "Ouest", "Nord-ouest"];
  const SHORT = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const sector = $derived(Math.round(bearing / 45) % 8);
  const size = $derived(viewport.phone ? 41 : 96);
  const northUp = $derived(Math.min(bearing, 360 - bearing) < 0.5);
  const hint = $derived(northUp ? "Nord en haut" : `La carte regarde vers le ${NAMES[sector].toLowerCase()} (toucher : nord en haut)`);

  function press(): void {
    map?.easeTo({ bearing: 0, duration: 400 });
  }

  /** N, E, S, O on the large dial: they follow the map's turn but stay upright, so they are always readable. */
  const cardinals = $derived(
    [
      { text: "N", angle: 0 },
      { text: "E", angle: 90 },
      { text: "S", angle: 180 },
      { text: "O", angle: 270 },
    ].map(({ text, angle }) => {
      const radians = ((angle - bearing) * Math.PI) / 180;
      return { text, x: 50 + 30 * Math.sin(radians), y: 50 - 30 * Math.cos(radians) };
    }),
  );

  /** The 24 ticks of the large dial (every 15 degrees, longer every 45). */
  const TICKS = Array.from({ length: 24 }, (_, i) => i * 15);
</script>

<button type="button" class="compass" aria-label={hint} title={hint} style:width="{size}px" style:height="{size}px" onclick={press}>
  {#if viewport.phone}
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#FAF8F2" stroke="#2F5D46" stroke-width="1.6" />
      <!-- The ring turns with the map: the red mark stays on the north. -->
      <g transform="rotate({-bearing} 18 18)">
        <path d="M18 2.6 L21.4 9 L14.6 9 Z" fill="#C0262D" />
        <path d="M18 33.4 L21 28 L15 28 Z" fill="#9AA79F" />
      </g>
      <text x="18" y="22" text-anchor="middle" font-size="11" font-weight="700" fill="#1F2A24" font-family="Inter, sans-serif">
        {SHORT[sector]}
      </text>
    </svg>
  {:else}
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="47" fill="#FAF8F2" stroke="#2F5D46" stroke-width="2.4" />
      <!-- The dial turns with the map: N stays on the north. -->
      <g transform="rotate({-bearing} 50 50)" font-family="Inter, sans-serif" text-anchor="middle">
        {#each TICKS as angle (angle)}
          <line
            x1="50" y1="5" x2="50" y2={angle % 90 === 0 ? 12 : angle % 45 === 0 ? 10 : 8}
            stroke={angle === 0 ? "#C0262D" : "#6B756F"} stroke-width={angle % 90 === 0 ? 2 : 1.2}
            transform="rotate({angle} 50 50)"
          />
        {/each}
        <path d="M50 6 L54.5 16 L45.5 16 Z" fill="#C0262D" />
      </g>
      {#each cardinals as letter (letter.text)}
        <text x={letter.x} y={letter.y} text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="800"
              fill={letter.text === "N" ? "#C0262D" : "#4B554F"} font-family="Inter, sans-serif">{letter.text}</text>
      {/each}
      <text x="50" y="52" text-anchor="middle" font-size="19" font-weight="800" fill="#1F2A24" font-family="Inter, sans-serif">{SHORT[sector]}</text>
      <text x="50" y="66" text-anchor="middle" font-size="10" fill="#6B756F" font-family="Inter, sans-serif">{Math.round(bearing)}°</text>
    </svg>
  {/if}
</button>

<style>
  .compass {
    padding: 0;
    display: block;
    border: none;
    border-radius: 50%;
    background: none;
    box-shadow: 0 2px 10px rgba(31, 42, 36, 0.3);
    cursor: pointer;
  }

  .compass:hover {
    filter: brightness(0.97);
  }
</style>
