<!--
  The weather of one day: the sky and the temperatures, small chips for rain,
  snow and wind, the day hour by hour, and a rough
  temperature at the highest point of the stage.
-->
<script lang="ts">
  import { formatMeters } from "../lib/format";
  import { describeWeather, type DayWeather } from "../lib/weather";
  import HourlyChart from "./HourlyChart.svelte";
  import WeatherIcon from "./WeatherIcon.svelte";

  let {
    title,
    subtitle,
    weather,
    summit = null,
  }: {
    title: string;
    subtitle: string;
    weather: DayWeather;
    /** Highest altitude of the stage, in meters, if known. */
    summit?: number | null;
  } = $props();

  /** The temperature drops by about 6.5 degrees per 1000 m: a rough guide, not a forecast. */
  const LAPSE_PER_KM = 6.5;

  const sky = $derived(describeWeather(weather.code));
  const higher = $derived(summit !== null && summit - weather.elevation > 150 ? summit : null);
  const at = (t: number) => `${Math.round(t - (LAPSE_PER_KM * ((higher ?? 0) - weather.elevation)) / 1000)}°`;
  const number = (value: number, digits = 0) => value.toLocaleString("fr-FR", { maximumFractionDigits: digits });
</script>

<section class="day">
  <header>
    <b>{title}</b>
    <span>{subtitle}</span>
  </header>

  <div class="sky">
    <span class="icon"><WeatherIcon name={sky.icon} size={38} stroke={1.6} /></span>
    <div class="temperatures">
      <span class="max">{Math.round(weather.tMax)}°</span>
      <span class="min">/ {Math.round(weather.tMin)}°</span>
    </div>
    <span class="label">{sky.label}</span>
  </div>

  <div class="chips">
    <span class="chip rain">
      <WeatherIcon name="drop" size={12} />
      {number(weather.precipitation, 1)} mm{weather.probability !== null ? ` · ${weather.probability} %` : ""}
    </span>
    {#if weather.snowfall > 0}
      <span class="chip snow"><WeatherIcon name="snowflake" size={12} />{number(weather.snowfall, 1)} cm</span>
    {/if}
    <span class="chip wind">
      <WeatherIcon name="wind" size={12} />
      {number(weather.wind)} km/h · raf. {number(weather.gusts)}
    </span>
  </div>

  <HourlyChart hours={weather.hours} />

  <p class="altitude">
    Prévision pour {formatMeters(weather.elevation)}
    {#if higher !== null}
      · environ {at(weather.tMax)} / {at(weather.tMin)} à {formatMeters(higher)}
    {/if}
  </p>
</section>

<style>
  .day {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    background: #fff;
    border: 1px solid #e5dfce;
    border-radius: 14px;
  }

  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  header b {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  header span {
    font-size: 12px;
    color: var(--muted);
  }

  .sky {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .icon {
    flex: none;
    display: flex;
    color: #e0a100;
  }

  .temperatures {
    display: flex;
    align-items: baseline;
    gap: 4px;
    font-family: var(--font-title);
  }

  .max {
    font-size: 30px;
    font-weight: 700;
  }

  .min {
    font-size: 16px;
    color: var(--muted);
  }

  .label {
    margin-left: auto;
    font-size: 13px;
    font-weight: 600;
    text-align: right;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 999px;
    background: #eef1ee;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  .chip.rain {
    background: #e3eef8;
    color: #2a5580;
  }

  .chip.snow {
    background: #e6f3f8;
    color: #2f6f89;
  }

  .altitude {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }
</style>
