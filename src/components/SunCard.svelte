<!--
  Sunrise, sunset and length of the day, for each day of the hike. A thin bar
  shows the 24 hours: the pale part is the twilight (first and last light), the
  yellow part is the time the sun is up.
-->
<script lang="ts">
  import { formatDay, formatTime } from "../lib/dates";
  import { formatDuration, sunDay, type SunPlace } from "../lib/sun";
  import WeatherIcon from "./WeatherIcon.svelte";

  let { days }: { days: SunPlace[] } = $props();

  const rows = $derived(days.map((d) => ({ ...d, sun: sunDay(d.date, d.lat, d.lon) })));
  const percent = (minutes: number) => `${(minutes / 1440) * 100}%`;
</script>

<section class="sun">
  <h3>Soleil</h3>
  {#each rows as row (row.date + row.title)}
    {@const sun = row.sun}
    <div class="row">
      <div class="when">
        <b>{row.title}</b>
        <span>{formatDay(row.date, "short")}</span>
      </div>
      <div class="times">
        <span class="time up"><WeatherIcon name="sunrise" size={15} />{formatTime(sun.sunrise)}</span>
        <span class="time down"><WeatherIcon name="sunset" size={15} />{formatTime(sun.sunset)}</span>
        <span class="duration">{formatDuration(sun.daylightMinutes)} de jour</span>
      </div>
      <div class="bar" role="img" aria-label="Première lueur {formatTime(sun.dawn)}, dernière lueur {formatTime(sun.dusk)}">
        <span class="twilight" style:left={percent(sun.minutes.dawn)} style:width="calc({percent(sun.minutes.dusk)} - {percent(sun.minutes.dawn)})"></span>
        <span class="daylight" style:left={percent(sun.minutes.sunrise)} style:width="calc({percent(sun.minutes.sunset)} - {percent(sun.minutes.sunrise)})"></span>
        <span class="mark" style:left={percent(720)}></span>
      </div>
      <div class="scale"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>24 h</span></div>
      <p class="light">Première lueur {formatTime(sun.dawn)} · dernière lueur {formatTime(sun.dusk)}</p>
    </div>
  {/each}
</section>

<style>
  .sun {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 14px;
    background: #fff;
    border: 1px solid #e5dfce;
    border-radius: 14px;
  }

  h3 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .row + .row {
    padding-top: 12px;
    border-top: 1px dashed #e5dfce;
  }

  .when {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-size: 13px;
  }

  .when span {
    font-size: 12px;
    color: var(--muted);
  }

  .times {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .time {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-title);
    font-size: 18px;
    font-weight: 700;
  }

  .time.up {
    color: #c07a00;
  }

  .time.down {
    color: #b0502a;
  }

  .duration {
    margin-left: auto;
    font-size: 12px;
    color: var(--muted);
  }

  .bar {
    position: relative;
    height: 8px;
    margin-top: 6px;
    border-radius: 4px;
    background: #e8e5f0;
  }

  .bar span {
    position: absolute;
    top: 0;
    height: 100%;
  }

  .twilight {
    background: #f6dfa6;
  }

  .daylight {
    border-radius: 4px;
    background: #f2b01e;
  }

  .mark {
    width: 2px;
    margin-left: -1px;
    background: rgba(31, 42, 36, 0.35);
  }

  .scale {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--muted);
  }

  .light {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
</style>
