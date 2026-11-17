<!--
  Planning page: the IGN map (contour lines, paths) with, on top of it, the
  hike bar (name, tags), the tool palette, the numbered points and the route;
  and a folding, resizable details panel on the right.

  On a phone the right panel becomes a sheet that slides up from the bottom, the
  hike bar spans the top with the tool palette right under it (on the left), the
  action bar (offline, GPX, delete) sits at the bottom left above the scale and
  the layers button alone at the bottom right. On a computer the tool palette is
  at the top left, the action bar at the bottom left (above the scale) and the
  layers button at the bottom right.

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
  import HikeActions from "../components/HikeActions.svelte";
  import LayersButton from "../components/LayersButton.svelte";
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
  import { createCompass, disableTerrain, enableTerrain, TILT_DEGREES } from "../lib/terrain";
  import { ui } from "../lib/ui.svelte.js";
  import { viewport } from "../lib/viewport.svelte.js";
  import { addFranceMask, aerialStyle, capPlanIgnZoom, IGN_ATTRIBUTION, IGN_STYLE_URL } from "../lib/mapStyles";
  import { connection } from "../lib/online.svelte.js";
  import { addOverlayLayers, syncOverlays } from "../lib/overlays";
  import type { BaseMapId } from "../lib/mapLayers";
  import { addRouteLayers, setRouteColor, updateRoute } from "../lib/routeLayer";

  /** Saved parcours to open (from the address), or ``null`` to keep the current one. */
  let { id }: { id: string | null } = $props();

  let container: HTMLDivElement;
  let map = $state.raw<MapLibreMap>();
  let mapReady = $state(false);
  /** Goes up each time a style has been loaded, so what depends on the style is drawn again. */
  let styleVersion = $state(0);
  let panelOpen = $state(true);
  let panelWidth = $state(440);
  let panelResizing = $state(false);
  /** The saved parcours that has been opened and framed on the map (markers wait for it). */
  let framedId = $state<string | null>(null);

  onMount(() => {
    loadFrance();
    // The style is set right after, so it can be adjusted as it loads (see capPlanIgnZoom).
    // A page opened while the 3D view is on starts already tilted: tilting it afterwards would interrupt
    // the framing of the parcours.
    const instance = createMap(container, {
      maxZoom: 18,
      attributionControl: false,
      pitch: ui.viewMode === "3d" ? TILT_DEGREES : 0,
    });
    loadBaseMap(instance, wantedBase);
    shownBase = wantedBase;
    instance.addControl(new AttributionControl({ customAttribution: IGN_ATTRIBUTION }));
    instance.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    // Fires for the first style and again for any later one (a new base map wipes
    // everything added on top of it): so the overlays are put back each time.
    instance.on("style.load", () => {
      addOverlayLayers(instance); // above the base map, below the mask and the route
      addFranceMask(instance);
      addRouteLayers(instance);
      if (ui.viewMode === "3d") enableTerrain(instance, false);
      mapReady = true;
      styleVersion++;
    });
    // Left click places a point with the "add" tool; right click always does.
    instance.on("click", (event) => {
      if (hike.tool === "add") hike.addPoint(event.lngLat.lng, event.lngLat.lat);
      else if (hike.tool === "poi") placePin(event.lngLat.lng, event.lngLat.lat);
    });
    // In 3D a right-click drag turns the map: the click that ends such a drag must not place a point.
    let lastTurnEnd = 0;
    instance.on("rotateend", () => (lastTurnEnd = Date.now()));
    instance.on("pitchend", () => (lastTurnEnd = Date.now()));
    instance.on("contextmenu", (event) => {
      if (Date.now() - lastTurnEnd < 500) return;
      hike.addPoint(event.lngLat.lng, event.lngLat.lat);
    });
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
    void styleVersion;
    if (map && mapReady) updateRoute(map, hike.route);
  });
  $effect(() => {
    void styleVersion;
    if (map && mapReady) setRouteColor(map, hike.routeColor);
  });

  // The base map chosen in the layers window. Only the Plan IGN can be saved for offline use,
  // so without network that is the one shown (what was chosen is remembered for later).
  const wantedBase = $derived<BaseMapId>(connection.online ? ui.baseMap : "plan-ign");
  let shownBase: BaseMapId = "plan-ign";

  /** Load a base map into the map: its style replaces the old one, then ``style.load`` puts the overlays and the route back. */
  function loadBaseMap(instance: MapLibreMap, id: BaseMapId): void {
    if (id === "aerial") instance.setStyle(aerialStyle(), { diff: false });
    else instance.setStyle(IGN_STYLE_URL, { transformStyle: capPlanIgnZoom, diff: false });
  }

  $effect(() => {
    const instance = map;
    const wanted = wantedBase;
    if (!instance || wanted === shownBase) return;
    shownBase = wanted;
    untrack(() => loadBaseMap(instance, wanted));
  });

  // Overlays: switched on and off, and faded, as chosen (and hidden without network).
  $effect(() => {
    void styleVersion;
    const choices = ui.overlays;
    const allowed = connection.online;
    if (map && mapReady) syncOverlays(map, choices, allowed);
  });

  // 2D or 3D, as chosen in the layers window.
  $effect(() => {
    const instance = map;
    const mode = ui.viewMode;
    if (!instance || !mapReady) return;
    untrack(() => {
      if (mode === "3d") enableTerrain(instance);
      else if (instance.getTerrain()) disableTerrain(instance);
    });
  });

  // The compass is only useful in 3D, where the map can be turned.
  $effect(() => {
    const instance = map;
    if (!instance || ui.viewMode !== "3d") return;
    const compass = createCompass();
    instance.addControl(compass, "top-right");
    return () => {
      // Leaving the page removes the whole map, and with it the compass: removing it a second time fails.
      if (instance.hasControl(compass)) instance.removeControl(compass);
    };
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
    <HikeActions />
    <LayersButton />
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

  /* Phone: the hint sits just above the closed sheet, between the tool palette and the action bar. */
  @media (max-width: 720px) {
    .hint {
      bottom: 104px;
      left: 68px;
      right: 70px;
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
