<!--
  Picks the day of the hike (the first day, when there are several stages) for
  the weather and the sun times: previous and next day, from today up to the
  furthest day the forecast covers.
-->
<script lang="ts">
  import { addDays, daysBetween, formatDay, todayIso } from "../lib/dates";
  import { MAX_DAYS_AHEAD } from "../lib/weather";
  import { ui } from "../lib/ui.svelte.js";

  const ahead = $derived(daysBetween(todayIso(), ui.weatherDate));
  const label = $derived(
    ahead === 0 ? "Aujourd'hui" : ahead === 1 ? "Demain" : ahead === 2 ? "Après-demain" : `Dans ${ahead} jours`,
  );

  function move(days: number): void {
    const next = addDays(ui.weatherDate, days);
    const nextAhead = daysBetween(todayIso(), next);
    if (nextAhead >= 0 && nextAhead <= MAX_DAYS_AHEAD) ui.weatherDate = next;
  }
</script>

<div class="selector">
  <button type="button" aria-label="Jour précédent" disabled={ahead <= 0} onclick={() => move(-1)}>
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2 L4 7 L9 12" /></svg>
  </button>
  <div class="day" aria-live="polite">
    <b>{label}</b>
    <span>{formatDay(ui.weatherDate, "long")}</span>
  </div>
  <button type="button" aria-label="Jour suivant" disabled={ahead >= MAX_DAYS_AHEAD} onclick={() => move(1)}>
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 2 L10 7 L5 12" /></svg>
  </button>
</div>

<style>
  .selector {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: #fff;
    border: 1px solid #e5dfce;
    border-radius: 14px;
  }

  button {
    flex: none;
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--panel);
    color: var(--text);
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    color: var(--accent);
    border-color: var(--accent);
  }

  button:disabled {
    color: #b9bdb6;
    cursor: default;
  }

  .day {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.25;
  }

  .day b {
    font-family: var(--font-title);
    font-size: 15px;
  }

  .day span {
    font-size: 12px;
    color: var(--muted);
  }
</style>
