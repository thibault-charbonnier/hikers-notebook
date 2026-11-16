<!--
  "Météo" tab of the right-hand panel: a day picker, the forecast of each day
  of the hike (one day per stage, at most three) at the start of that stage,
  and the sun times.

  The forecast comes from Open-Meteo (Météo-France models for France); the sun
  times are computed on the device. Only the position and altitude of the
  start of each stage are sent to the weather service.
-->
<script lang="ts">
  import { addDays, formatDay } from "../lib/dates";
  import { hike } from "../lib/hike.svelte.js";
  import { connection } from "../lib/online.svelte.js";
  import { elevationAt } from "../lib/slope";
  import type { SunPlace } from "../lib/sun";
  import { ui } from "../lib/ui.svelte.js";
  import { fetchDayWeather, isForecastable, type DayWeather } from "../lib/weather";
  import DaySelector from "./DaySelector.svelte";
  import SunCard from "./SunCard.svelte";
  import WeatherDay from "./WeatherDay.svelte";

  /** More days do not fit in a narrow vertical panel. */
  const MAX_DAYS_SHOWN = 3;

  /** What is needed to forecast one stage: where it starts, when, and its highest altitude. */
  interface Stage {
    index: number;
    date: string;
    lat: number;
    lon: number;
    elevation: number | null;
    summit: number | null;
  }

  type Result = { status: "loading" } | { status: "ok"; data: DayWeather } | { status: "error"; message: string };

  const stages = $derived.by((): Stage[] => {
    if (hike.points.length === 0) return [];
    const profile = hike.profile;
    const cuts = [0, ...hike.stagePointIndices, hike.points.length - 1];
    return Array.from({ length: Math.min(hike.stageCount, MAX_DAYS_SHOWN) }, (_, k) => {
      const start = hike.points[cuts[k]];
      let elevation: number | null = null;
      let summit: number | null = null;
      if (profile) {
        const from = profile.pointDistances[cuts[k]];
        const to = profile.pointDistances[cuts[k + 1]];
        elevation = elevationAt(profile, from);
        for (let i = 0; i < profile.distance.length; i++) {
          if (profile.distance[i] >= from && profile.distance[i] <= to) {
            summit = Math.max(summit ?? -Infinity, profile.elevation[i]);
          }
        }
      }
      return { index: k, date: addDays(ui.weatherDate, k), lat: start.lat, lon: start.lon, elevation, summit };
    });
  });

  /** Changes only when what the forecast depends on changes (not when a name is typed). */
  const signature = $derived(JSON.stringify(stages));

  let results = $state<Record<number, Result>>({});

  // Ask the forecast of every stage whenever the stages or the day change,
  // or when the connection comes back.
  $effect(() => {
    if (!connection.online) return;
    const wanted = JSON.parse(signature) as Stage[];
    let cancelled = false;
    for (const stage of wanted) {
      if (!isForecastable(stage.date)) {
        results[stage.index] = { status: "error", message: "Pas de prévision pour ce jour." };
        continue;
      }
      results[stage.index] = { status: "loading" };
      fetchDayWeather(stage.lat, stage.lon, stage.elevation, stage.date)
        .then((data) => {
          if (!cancelled) results[stage.index] = { status: "ok", data };
        })
        .catch((error: Error) => {
          if (!cancelled) results[stage.index] = { status: "error", message: error.message };
        });
    }
    return () => {
      cancelled = true;
    };
  });

  const title = (stage: Stage) => (hike.stageCount > 1 ? `Jour ${stage.index + 1}` : "Journée");
  const sunPlaces = $derived<SunPlace[]>(stages.map((s) => ({ title: title(s), date: s.date, lat: s.lat, lon: s.lon })));
</script>

<div class="weather" class:centered={!connection.online}>
  {#if !connection.online}
    <p class="offline">
      <b>Hors ligne</b>
      Nécessite internet pour afficher les prévisions météo.
    </p>
  {:else if stages.length === 0}
    <p class="empty">Pose un premier point de passage : la météo et le soleil sont donnés pour le départ du parcours.</p>
  {:else}
    <DaySelector />

    {#each stages as stage (stage.index)}
      {@const result = results[stage.index]}
      {#if result?.status === "ok"}
        <WeatherDay title={title(stage)} subtitle={formatDay(stage.date, "short")} weather={result.data} summit={stage.summit} />
      {:else if result?.status === "error"}
        <section class="state error">
          <b>{title(stage)} · {formatDay(stage.date, "short")}</b>
          <p>Météo indisponible : {result.message}</p>
        </section>
      {:else}
        <section class="state">
          <b>{title(stage)} · {formatDay(stage.date, "short")}</b>
          <p><span class="spinner" aria-hidden="true"></span>Chargement de la météo…</p>
        </section>
      {/if}
    {/each}

    {#if hike.stageCount > MAX_DAYS_SHOWN}
      <p class="note">Seuls les {MAX_DAYS_SHOWN} premiers jours sont affichés ({hike.stageCount} étapes).</p>
    {/if}

    <SunCard days={sunPlaces} />

    <p class="credit">
      Prévisions : <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (modèles Météo-France),
      calculées pour le départ de chaque étape, pas mesurées par une station. Soleil : calcul sur l'appareil.
    </p>
  {/if}
</div>

<style>
  .weather {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* Offline: the message sits in the middle of the panel. */
  .weather.centered {
    align-items: center;
    justify-content: center;
  }

  .offline {
    max-width: 240px;
    margin: 0;
    text-align: center;
    font-size: 14px;
    line-height: 1.5;
    color: var(--muted);
  }

  .offline b {
    display: block;
    margin-bottom: 4px;
    font-family: var(--font-title);
    font-size: 18px;
    color: var(--text);
  }

  .empty,
  .note,
  .credit {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--muted);
  }

  .credit {
    font-size: 11px;
  }

  .credit a {
    color: var(--accent);
  }

  .state {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px;
    background: #fff;
    border: 1px solid #e5dfce;
    border-radius: 14px;
    font-size: 13px;
  }

  .state p {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: var(--muted);
  }

  .state.error {
    background: #fbe9e2;
    border-color: #e3b9a8;
  }

  .state.error p {
    color: #8c3a1b;
  }
</style>
