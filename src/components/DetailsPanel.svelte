<!--
  Right-hand panel with two tabs: "Parcours" (below) and "Météo" (weather and sun).

  The "Parcours" tab has separate cards: figures of the hike (distance with its
  stages, ascent, descent, altitude range), the elevation profile (can be
  enlarged), and the list of points with the figures of each stretch.

  A point can be marked as the end of a stage (flag button): dotted lines
  frame it in the list, and the stages get different line styles on the map
  and in the profile.
-->
<script lang="ts">
  import { formatDistance, formatMeters } from "../lib/format";
  import { locateOnRoute } from "../lib/geo";
  import type { Segment } from "../lib/geo";
  import { pinInfo } from "../lib/poi";
  import { hike } from "../lib/hike.svelte.js";
  import { ui } from "../lib/ui.svelte.js";
  import AltitudeGauge from "./AltitudeGauge.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import ElevationProfile from "./ElevationProfile.svelte";
  import PoiIcon from "./PoiIcon.svelte";
  import ProfileModal from "./ProfileModal.svelte";
  import ProfileModeToggle from "./ProfileModeToggle.svelte";
  import WeatherPanel from "./WeatherPanel.svelte";
  import StageBar from "./StageBar.svelte";

  const stats = $derived(hike.stats);
  let enlarged = $state(false);
  let confirmingClear = $state(false);

  /**
   * The point whose description is being edited. A description can only be
   * written from the map; here an existing one can be changed (and the box
   * stays while it is focused, even if the user empties it).
   */
  let editingDescription = $state<string | null>(null);

  /** Position (from 1) of a stage point among the stage points, i.e. the stage it ends. */
  const stageEndedBy = (index: number) => hike.stagePointIndices.indexOf(index) + 1;

  /** Where each point of interest is along the route (only if it is close to it). */
  const poiDistances = $derived.by(() => {
    const places = new Map<string, number>();
    if (hike.loading || hike.segments.length === 0) return places;
    for (const poi of hike.pois) {
      const found = locateOnRoute(hike.segments as Segment[], [poi.lon, poi.lat]);
      if (found && found.offset <= 150) places.set(poi.id, found.distance);
    }
    return places;
  });

  const preview = (text: string) => (text.length > 70 ? `${text.slice(0, 70)}…` : text);
</script>

<div class="panel">
  <header>
    <div class="tabs" role="tablist" aria-label="Contenu du panneau">
      <button type="button" role="tab" aria-selected={ui.panelTab === "route"} class:active={ui.panelTab === "route"} onclick={() => (ui.panelTab = "route")}>
        Parcours
      </button>
      <button type="button" role="tab" aria-selected={ui.panelTab === "weather"} class:active={ui.panelTab === "weather"} onclick={() => (ui.panelTab = "weather")}>
        Météo
      </button>
    </div>
    {#if hike.loading && ui.panelTab === "route"}
      <span class="status"><span class="spinner" aria-hidden="true"></span>Calcul en cours…</span>
    {/if}
  </header>

  {#if ui.panelTab === "weather"}
    <WeatherPanel />
  {:else}

  <section class="summary">
    <div class="card distance">
      <span class="value big">{stats ? formatDistance(stats.distance) : "—"}</span>
      <span class="label">Distance</span>
      {#if hike.stageCount > 1}
        <span class="stages">
          <StageBar lengths={hike.stageLengths} color={hike.routeColor} />
          <b>{hike.stageCount} étapes</b>
        </span>
      {/if}
    </div>
    <div class="card">
      <span class="value">{stats ? formatMeters(stats.ascent) : "—"}</span>
      <span class="label">Dénivelé +</span>
    </div>
    <div class="card">
      <span class="value">{stats ? formatMeters(stats.descent) : "—"}</span>
      <span class="label">Dénivelé −</span>
    </div>
    <div class="card altitude">
      <AltitudeGauge min={stats?.minElevation ?? null} max={stats?.maxElevation ?? null} />
    </div>
  </section>

  {#if hike.points.length === 0}
    <p class="empty">Clic droit sur la carte pour poser le premier point de passage, ou choisis l'outil « cible » en haut à gauche.</p>
  {:else if hike.points.length === 1}
    <p class="empty">Pose un deuxième point de passage : le tracé se calcule entre eux.</p>
  {/if}

  {#if hike.profile}
    <section class="card block">
      <div class="block-header">
        <h3>Profil altimétrique</h3>
        <ProfileModeToggle />
        <button type="button" class="icon-button" aria-label="Agrandir le profil" title="Agrandir" onclick={() => (enlarged = true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" />
          </svg>
        </button>
      </div>
      <ElevationProfile profile={hike.profile} labels={hike.labelsOnProfile} stageIndices={hike.stagePointIndices} mode={ui.profileMode} />
    </section>
  {/if}

  {#if hike.freeSegmentCount > 0}
    <p class="warning">
      {hike.freeSegmentCount} tronçon{hike.freeSegmentCount > 1 ? "s" : ""} en ligne droite (pointillés) :
      aucun sentier trouvé entre ces points.
    </p>
  {/if}
  {#if hike.missingElevation}
    <p class="warning">L'altitude n'a pas pu être récupérée pour certains tronçons (service IGN indisponible ?). Modifie un point de passage pour réessayer.</p>
  {/if}

  {#if hike.points.length > 0}
    <section class="card block">
      <div class="block-header">
        <h3>Points de passage</h3>
        {#if hike.closed}
          <span class="loop-chip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
              <path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
            </svg>
            Boucle
          </span>
        {/if}
      </div>
      <ol class="points">
        {#each hike.points as point, i (point.id)}
          {@const isClosing = hike.closed && i === hike.points.length - 1}
          {@const isStage = hike.stagePointIndices.includes(i)}
          {@const canBeStage = i > 0 && i < hike.points.length - 1}
          {@const leg = i > 0 ? hike.legs[i - 1] : undefined}
          <li class:stage={isStage}>
            <span class="badge" class:start={i === 0} class:closing={isClosing}>{hike.labelsOnProfile[i]}</span>
            <div class="body">
              {#if isClosing}
                <b class="closing-title">Retour au départ</b>
              {:else}
                <input
                  class="edit title"
                  aria-label="Nom du point de passage {i + 1}"
                  placeholder="Passage {i + 1}"
                  value={point.name}
                  oninput={(event) => (point.name = event.currentTarget.value)}
                />
                {#if point.description !== "" || editingDescription === point.id}
                  <textarea
                    class="edit description"
                    rows="1"
                    aria-label="Description du point de passage {i + 1}"
                    placeholder="Description…"
                    value={point.description}
                    oninput={(event) => (point.description = event.currentTarget.value)}
                    onfocus={() => (editingDescription = point.id)}
                    onblur={() => (editingDescription = null)}
                  ></textarea>
                {/if}
              {/if}

              {#if i > 0}
                <span class="leg">
                  {#if leg === null}
                    <span class="chip">calcul…</span>
                  {:else if leg}
                    <span class="chip distance-chip">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
                           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6" /></svg>
                      {formatDistance(leg.distance)}
                    </span>
                    <span class="chip up-chip">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4 22 20H2z" /></svg>
                      {leg.ascent === null ? "—" : formatMeters(leg.ascent)}
                    </span>
                    <span class="chip down-chip">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20 2 4h20z" /></svg>
                      {leg.descent === null ? "—" : formatMeters(leg.descent)}
                    </span>
                  {/if}
                </span>
              {/if}
              {#if isStage}
                <span class="stage-note">Fin de l'étape {stageEndedBy(i)}</span>
              {/if}
            </div>
            {#if canBeStage}
              <button
                type="button"
                class="flag"
                class:active={isStage}
                aria-pressed={isStage}
                aria-label={isStage ? "Ce passage n'est plus une étape" : "Faire de ce passage une étape"}
                title={isStage ? "Retirer l'étape" : "Faire de ce passage une étape"}
                onclick={() => hike.toggleStage(point.id)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M5 21V4" /><path d="M5 4h12l-2 4 2 4H5" />
                </svg>
              </button>
            {/if}
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  {#if hike.pois.length > 0}
    <section class="card block">
      <div class="block-header">
        <h3>Points d'intérêt</h3>
      </div>
      <ul class="pois">
        {#each hike.pois as poi (poi.id)}
          {@const info = pinInfo(poi.type)}
          {@const along = poiDistances.get(poi.id)}
          <li style:--pin-color={info.color}>
            <span class="poi-badge"><PoiIcon type={poi.type} size={15} /></span>
            <div class="poi-body">
              {#if poi.type === "comment"}
                <button type="button" class="comment-preview" onclick={() => (hike.commentOpenId = poi.id)}>
                  <b>{poi.name || info.label}</b>
                  {#if poi.description}<span>{preview(poi.description)}</span>{/if}
                </button>
              {:else}
                <input
                  class="edit title"
                  aria-label="Nom du point d'intérêt"
                  placeholder={info.label}
                  value={poi.name}
                  oninput={(event) => (poi.name = event.currentTarget.value)}
                />
                {#if poi.description}<span class="poi-description">{preview(poi.description)}</span>{/if}
              {/if}
              {#if along !== undefined}<span class="along">à {formatDistance(along)} du départ</span>{/if}
            </div>
            <button type="button" class="remove" aria-label="Supprimer ce point d'intérêt" title="Supprimer" onclick={() => hike.removePoi(poi.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if hike.points.length > 0 || hike.pois.length > 0}
    <button type="button" class="clear" onclick={() => (confirmingClear = true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
        </svg>
        Vider le parcours
    </button>
  {/if}
  {/if}
</div>

{#if enlarged}
  <ProfileModal onclose={() => (enlarged = false)} />
{/if}

{#if confirmingClear}
  <ConfirmDialog
    title="Vider le parcours ?"
    message="Tous les points de passage, les points d'intérêt, les commentaires et le tracé seront supprimés. Le nom, les labels et les détails sont conservés, et tu peux annuler avec Ctrl+Z."
    confirmLabel="Vider"
    oncancel={() => (confirmingClear = false)}
    onconfirm={() => {
      hike.clearPoints();
      confirmingClear = false;
    }}
  />
{/if}

<style>
  .panel {
    height: 100%;
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: var(--bg);
  }

  /* Phone: the sheet around the panel does the scrolling. */
  @media (max-width: 720px) {
    .panel {
      height: auto;
      overflow: visible;
      padding: 8px 14px 40px;
    }
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 28px;
  }

  /* Tabs: the selected one is dark green. */
  .tabs {
    flex: 1;
    display: flex;
    gap: 4px;
    padding: 3px;
    background: #e9e4d3;
    border-radius: 12px;
  }

  .tabs button {
    flex: 1;
    min-height: 32px;
    padding: 0 18px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .tabs button:hover:not(.active) {
    color: var(--accent);
  }

  .tabs button.active {
    background: var(--accent);
    color: #fff;
  }

  h3 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--accent);
    font-weight: 600;
  }

  .summary {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-areas:
      "distance distance altitude"
      "gain loss altitude";
    gap: 10px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px;
    background: #fff;
    border: 1px solid #e5dfce;
    border-radius: 14px;
  }

  .distance {
    grid-area: distance;
  }

  .altitude {
    grid-area: altitude;
  }

  .value {
    font-family: var(--font-title);
    font-weight: 700;
    font-size: 20px;
    white-space: nowrap;
  }

  .value.big {
    font-size: 30px;
  }

  .label {
    font-size: 12px;
    color: var(--muted);
  }

  /* Number of stages: a thin bar cut into stages, and the count. */
  .stages {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
  }

  .stages b {
    flex: none;
    font-size: 12px;
    color: var(--accent);
  }

  .block {
    gap: 10px;
  }

  .block-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 28px;
  }

  .icon-button {
    width: 28px;
    height: 28px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel);
    color: var(--muted);
    cursor: pointer;
  }

  .icon-button:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  .empty,
  .warning {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--muted);
  }

  .warning {
    padding: 10px 12px;
    background: #fbe9e2;
    color: #8c3a1b;
    border-radius: 10px;
  }

  .loop-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
  }

  .points {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 14px;
    font-size: 13px;
  }

  .points li {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  /* A stage point is framed by dotted lines, before and after. */
  .points li.stage {
    margin: 2px -4px;
    padding: 10px 4px;
    border-top: 2px dotted var(--accent);
    border-bottom: 2px dotted var(--accent);
  }

  .badge {
    flex: none;
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: var(--text);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
  }

  .stage .badge {
    border-radius: 7px;
  }

  .badge.start {
    background: var(--accent);
  }

  .badge.closing {
    background: #d6246e;
  }

  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  /* Names and descriptions are edited in place: they look like text until hovered or focused. */
  .edit {
    width: calc(100% + 12px);
    margin-left: -6px;
    padding: 1px 6px;
    line-height: 1.4;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 13px;
  }

  .edit:hover {
    border-color: var(--border);
  }

  .edit:focus {
    border-color: var(--accent);
    background: #fff;
    outline: none;
  }

  .title {
    font-weight: 700;
  }

  .description {
    padding-top: 0;
    padding-bottom: 0;
    resize: none;
    field-sizing: content;
    min-height: 1.5em;
    line-height: 1.5;
    color: var(--muted);
  }

  .closing-title {
    font-size: 13px;
  }

  /* Distance, ascent and descent of the stretch, as small coloured chips. */
  .leg {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 3px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #eef1ee;
    color: var(--text);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  .up-chip {
    background: #e2efe5;
    color: #2a6a45;
  }

  .down-chip {
    background: #fbe9e2;
    color: #8c3a1b;
  }

  .stage-note {
    margin-top: 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--accent);
  }

  /* Flag button: makes the point the end of a stage. */
  .flag {
    flex: none;
    width: 28px;
    height: 28px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    opacity: 0.35;
    cursor: pointer;
  }

  li:hover .flag,
  li:focus-within .flag,
  .flag.active {
    opacity: 1;
  }

  .flag:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .flag.active {
    background: var(--accent);
    color: #fff;
  }

  /* Points of interest: a coloured icon, the name, where it is along the route. */
  .pois {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13px;
  }

  .pois li {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .poi-badge {
    flex: none;
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--pin-color);
    border-radius: 50%;
    background: #fff;
    color: var(--pin-color);
  }

  .poi-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .poi-description,
  .along {
    font-size: 12px;
    color: var(--muted);
  }

  .comment-preview {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .comment-preview b {
    font-size: 13px;
  }

  .comment-preview span {
    font-size: 12px;
    color: var(--muted);
  }

  .comment-preview:hover b {
    color: var(--accent);
  }

  .remove {
    flex: none;
    width: 26px;
    height: 26px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    opacity: 0;
    cursor: pointer;
  }

  .pois li:hover .remove,
  .remove:focus-visible {
    opacity: 1;
  }

  .remove:hover {
    background: #fbe9e2;
    color: #c0392b;
  }

  .clear {
    align-self: center;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 22px;
    margin-bottom: 6px;
    min-height: 32px;
    padding: 0 18px;
    border: none;
    border-radius: 10px;
    background: #c0392b;
    color: #fff;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .clear:hover {
    background: #a93226;
  }
</style>
