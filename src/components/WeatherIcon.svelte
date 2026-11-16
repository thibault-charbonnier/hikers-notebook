<!--
  Icon for the sky (sun, cloud, rain...) or for a small weather figure
  (drop, snowflake, wind...). The drawings are fixed strings from
  src/lib/weatherIcons.ts.
-->
<script lang="ts">
  import type { WeatherIconName } from "../lib/weather";
  import { STAT_ICONS, WEATHER_ICONS, type StatIconName } from "../lib/weatherIcons";

  let { name, size = 18, stroke = 2 }: { name: WeatherIconName | StatIconName; size?: number; stroke?: number } = $props();

  const markup = $derived(name in WEATHER_ICONS ? WEATHER_ICONS[name as WeatherIconName] : STAT_ICONS[name as StatIconName]);
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={stroke}
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {@html markup}
</svg>
