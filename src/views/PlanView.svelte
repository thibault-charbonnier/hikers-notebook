<!--
  Planning page: the IGN map (contour lines, paths) with, on top of it, the
  hike bar (name, tags), the tool palette, the numbered points and the route;
  and a folding, resizable details panel on the right.

  On a phone the right panel becomes a sheet that slides up from the bottom, the
  hike bar spans the top and the tool palette floats on the left.

  The map is limited to France (the only place with detailed IGN data, the
  rest is dimmed), and points cannot be placed outside it. The user's position
  is shown as a blue dot.
-->
<script lang="ts">
  import { AttributionControl, ScaleControl, type Map as MapLibreMap } from "maplibre-gl";
  import { onMount, untrack } from "svelte";
  import BottomSheet from "../components/BottomSheet.svelte";
  import CommentDialog from "../components/CommentDialog.svelte";
  import DetailsPanel from "../components/DetailsPanel.svelte";
  import MapTools from "../components/MapTools.svelte";
  import PoiMarkers from "../components/PoiMarkers.svelte";
  import PointMarkers from "../components/PointMarkers.svelte";
  import ResizeHandle from "../components/ResizeHandle.svelte";
  import SideToggle from "../components/SideToggle.svelte";
  import Toast from "../components/Toast.svelte";
  import TopBar from "../components/TopBar.svelte";
  import { openParcours } from "../lib/actions";
  import { loadFrance } from "../lib/france";
  import { formatDistance, formatMeters } from "../lib/format";
  import { hike } from "../lib/hike.svelte.js";
  import { showUserLocation } from "../lib/location";
  import { createMap, fitBoundsAndSettle } from "../lib/map";
  import { pinInfo } from "../lib/poi";
  import { viewport } from "../lib/viewport.svelte.js";
  import { addFranceMask, IGN_ATTRIBUTION, IGN_STYLE_URL } from "../lib/mapStyles";
  import { addRouteLayers, setRouteColor, updateRoute } from "../lib/routeLayer";

  /** Saved parcours to open (from the address), or ``null`` to keep the current one. */
  let { id }: { id: string | null } = $props();

  let container: HTMLDivElement;
  let map = $state.raw<MapLibreMap>();
  let mapReady = $state(false);
  let panelOpen = $state(true);
  let panelWidth = $state(440);
  let panelResizing = $state(false);
  /** The saved parcours that has been opened and framed on the map (markers wait for it). */
  let framedId = $state<string | null>(null);

  onMount(() => {
    loadFrance();
    const instance = createMap(container, {
      style: IGN_STYLE_URL,
      maxZoom: 18,
      attributionControl: false,
    });
    instance.addControl(new AttributionControl({ customAttribution: IGN_ATTRIBUTION }));
    instance.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    instance.on("load", () => {
      addFranceMask(instance);
      addRouteLayers(instance);
      mapReady = true;
    });
    // Left click places a point with the "add" tool; right click always does.
    instance.on("click", (event) => {
      if (hike.tool === "add") hike.addPoint(event.lngLat.lng, event.lngLat.lat);
      else if (hike.tool === "poi") placePin(event.lngLat.lng, event.lngLat.lat);
    });
    instance.on("contextmenu", (event) => hike.addPoint(event.lngLat.lng, event.lngLat.lat));
    const hideBrowserMenu = (event: Event) => event.preventDefault();
    container.addEventListener("contextmenu", hideBrowserMenu);

    const stopLocation = showUserLocation(instance);
    map = instance;

    return () => {
      stopLocation();
      container.removeEventListener("contextmenu", hideBrowserMenu);
      instance.remove();
    };
  });

  // Redraw the route whenever it changes, in the colour of the parcours.
  $effect(() => {
    if (map && mapReady) updateRoute(map, hike.route);
  });
  $effect(() => {
    if (map && mapReady) setRouteColor(map, hike.routeColor);
  });

  // Open the saved parcours named in the address, then frame it on the map.
  $effect(() => {
    const target = id;
    const instance = map;
    if (!target || !instance) return;
    untrack(async () => {
      if (hike.id !== target) await openParcours(target);
      if (hike.id === target && hike.points.length > 0) {
        const lons = hike.points.map((p) => p.lon);
        const lats = hike.points.map((p) => p.lat);
        await fitBoundsAndSettle(
          instance,
          [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
          {
            padding: viewport.phone ? { top: 190, bottom: 110, left: 70, right: 30 } : 120,
            maxZoom: 15,
            duration: 700,
          },
        );
      }
      framedId = target;
    });
  });

  // Crosshair cursor while the "add" tool is active.
  $effect(() => {
    if (map) map.getCanvas().style.cursor = hike.tool === "move" ? "" : "crosshair";
  });

  /** Place the chosen point of interest (or comment), then go back to the "move" tool. */
  function placePin(lon: number, lat: number): void {
    const id = hike.addPoi(lon, lat, hike.poiToPlace);
    if (!id) return;
    hike.tool = "move";
    if (hike.poiToPlace === "comment") hike.commentOpenId = id; // write it right away
  }

  /** Keyboard: Ctrl+Z undo, Ctrl+Y or Ctrl+Shift+Z redo, Escape back to "move". */
  function onKeydown(event: KeyboardEvent): void {
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    if (typing) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      if (event.shiftKey) hike.redo();
      else hike.undo();
    } else if ((event.ctrlKey || event.metaKey) && key === "y") {
      event.preventDefault();
      hike.redo();
    } else if (event.key === "Escape") {
      hike.tool = "move";
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if hike.commentOpenId}
  <CommentDialog id={hike.commentOpenId} />
{/if}

<div class="plan">
  <div class="map-area">
    <div class="map" bind:this={container}></div>
    <TopBar />
    <MapTools />
    <Toast />
    {#if !viewport.phone || hike.tool !== "move"}
      <p class="hint">
        {#if viewport.phone}
          {hike.tool === "add"
            ? "Touche la carte pour placer un point de passage"
            : `Touche la carte pour placer : ${pinInfo(hike.poiToPlace).label}`}
        {:else}
          {hike.tool === "add"
            ? "Clic gauche pour placer un point de passage · Échap pour se déplacer"
            : hike.tool === "poi"
              ? `Clique sur la carte pour placer : ${pinInfo(hike.poiToPlace).label} · Échap pour annuler`
              : "Clic droit sur la carte pour placer un point de passage"}
        {/if}
      </p>
    {/if}
    {#if map && (!id || framedId === id)}
      <PointMarkers {map} />
      <PoiMarkers {map} />
    {/if}
    {#if viewport.phone}
      <BottomSheet>
        {#snippet header()}
          {#if hike.stats}
            {formatDistance(hike.stats.distance)}
            <span class="figure up">▲ {formatMeters(hike.stats.ascent)}</span>
            <span class="figure down">▼ {formatMeters(hike.stats.descent)}</span>
          {:else}
            Parcours
          {/if}
        {/snippet}
        <DetailsPanel />
      </BottomSheet>
    {:else}
      <SideToggle
        side="right"
        open={panelOpen}
        label={panelOpen ? "Replier les détails" : "Déplier les détails"}
        ontoggle={() => (panelOpen = !panelOpen)}
      />
    {/if}
  </div>

  {#if !viewport.phone}
    <div
      class="panel-wrap"
      class:closed={!panelOpen}
      class:resizing={panelResizing}
      style:width={panelOpen ? `${panelWidth}px` : "0px"}
    >
      {#if panelOpen}
        <ResizeHandle
          grows="left"
          width={panelWidth}
          min={320}
          max={760}
          onresize={(value) => (panelWidth = value)}
          onstart={() => (panelResizing = true)}
          onend={() => (panelResizing = false)}
        />
      {/if}
      <div class="panel-inner" style:width="{panelWidth}px"><DetailsPanel /></div>
    </div>
  {/if}
</div>

<style>
  .plan {
    position: absolute;
    inset: 0;
    display: flex;
  }

  .map-area {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .map {
    position: absolute;
    inset: 0;
  }

  .hint {
    position: absolute;
    bottom: 16px;
    left: 50%;
    z-index: 3;
    transform: translateX(-50%);
    margin: 0;
    padding: 6px 14px;
    background: rgba(251, 249, 243, 0.92);
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 13px;
    color: var(--muted);
    white-space: nowrap;
    pointer-events: none;
  }

  /* Phone: the hint sits just above the closed sheet, to the right of the tool palette. */
  @media (max-width: 720px) {
    .hint {
      bottom: 104px;
      left: 68px;
      right: 12px;
      transform: none;
      border-radius: 14px;
      white-space: normal;
    }
  }

  .figure {
    font-size: 14px;
    font-weight: 600;
  }

  .figure.up {
    color: #2f6b45;
  }

  .figure.down {
    color: #9a4426;
  }

  .panel-wrap {
    position: relative;
    flex: none;
    overflow: hidden;
    border-left: 1px solid var(--border);
    transition: width 0.2s ease;
  }

  .panel-wrap.closed {
    border-left-width: 0;
  }

  .panel-wrap.resizing {
    transition: none;
  }

  /* Width set from the script, so the content does not reflow while the panel folds. */
  .panel-inner {
    height: 100%;
  }
</style>
