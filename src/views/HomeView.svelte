<!--
  Overview map: a light map of France, with the rest of the world dimmed, on
  which the saved parcours are drawn (one colour each, line style by type).

  It is framed exactly like the planning map, but zooms in less and shows
  fewer layers, so it stays fast. Hover a parcours for its card, click it (or
  pick it in the side menu) to select it and open it.

  The zoom buttons are at the bottom left; the account button (see
  AccountMenu.svelte) is at the top right, on the map.

  On a phone the side menu is a sheet at the bottom (the list of parcours) and
  a round "+" button at the bottom right starts a new parcours; a band with the
  name of the app runs along the top, with the account button just under it, on
  the map; picking a parcours in the list opens it.
-->
<script lang="ts">
  import { Popup, type Map as MapLibreMap } from "maplibre-gl";
  import { onMount } from "svelte";
  import { goToParcours, prepareNewPlanning } from "../lib/actions";
  import AccountMenu from "../components/AccountMenu.svelte";
  import BottomSheet from "../components/BottomSheet.svelte";
  import ParcoursList from "../components/ParcoursList.svelte";
  import { addParcoursLayers, boundsOf, HIT_LAYER, routeOf, updateParcours } from "../lib/homeRoutes";
  import { library } from "../lib/library.svelte.js";
  import { createMap, fitBoundsAndSettle, keepPopupInView } from "../lib/map";
  import { homeStyle } from "../lib/mapStyles";
  import { buildParcoursCard } from "../lib/parcoursCard";
  import { viewport } from "../lib/viewport.svelte.js";

  let container: HTMLDivElement;
  let map = $state.raw<MapLibreMap>();
  let ready = $state(false);

  let hoverPopup: Popup | null = null;
  let pinnedPopup: Popup | null = null;

  function hideHover(): void {
    hoverPopup?.remove();
    hoverPopup = null;
  }

  onMount(() => {
    // Zoom buttons at the bottom left, next to the side menu; none on a phone (two fingers).
    const instance = createMap(container, { style: homeStyle(), maxZoom: 9 }, viewport.phone ? null : "bottom-left");

    instance.on("load", () => {
      addParcoursLayers(instance);
      ready = true;
    });

    instance.on("mousemove", HIT_LAYER, (event) => {
      instance.getCanvas().style.cursor = "pointer";
      const id = event.features?.[0]?.properties?.id;
      const item = library.items.find((i) => i.id === id);
      if (!item || id === library.selectedId) return hideHover();
      hideHover();
      hoverPopup = new Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: "300px", className: "parcours-card hover" })
        .setLngLat(event.lngLat)
        .setDOMContent(buildParcoursCard(item))
        .addTo(instance);
    });
    instance.on("mouseleave", HIT_LAYER, () => {
      instance.getCanvas().style.cursor = "";
      hideHover();
    });
    instance.on("click", HIT_LAYER, (event) => {
      const id = event.features?.[0]?.properties?.id;
      if (id) library.selectedId = id;
    });
    // A click on empty map clears the selection.
    instance.on("click", (event) => {
      if (instance.queryRenderedFeatures(event.point, { layers: [HIT_LAYER] }).length === 0) {
        library.selectedId = null;
      }
    });

    map = instance;
    return () => {
      hideHover();
      pinnedPopup?.remove();
      instance.remove();
    };
  });

  // Draw the saved parcours whenever the list changes.
  $effect(() => {
    if (map && ready) updateParcours(map, library.visibleItems);
  });

  // Show the selected parcours: zoom to it and pin its card on the route.
  $effect(() => {
    const instance = map;
    const item = library.items.find((i) => i.id === library.selectedId);
    pinnedPopup?.remove();
    pinnedPopup = null;
    if (!instance || !ready || !item) return;

    hideHover();
    const line = routeOf(item);
    const settled = fitBoundsAndSettle(instance, boundsOf(item), {
      padding: { top: 90, bottom: 90, left: 90, right: 90 },
      maxZoom: 9,
    });
    const popup = new Popup({ closeButton: true, closeOnClick: false, offset: 12, maxWidth: "300px", className: "parcours-card" })
      .setLngLat(line[Math.floor(line.length / 2)])
      .setDOMContent(buildParcoursCard(item, () => goToParcours(item.id)))
      .addTo(instance);
    popup.on("close", () => {
      if (library.selectedId === item.id) library.selectedId = null;
    });
    pinnedPopup = popup;
    // Once the map has settled, nudge it so the whole card is visible (clear of the bars and the sheet).
    settled.then(() =>
      keepPopupInView(
        instance,
        popup,
        viewport.phone
          ? { top: 120, bottom: 90, left: 8, right: 8 }
          : { top: 70, bottom: 16, left: 16, right: 60 },
      ),
    );
  });
</script>

<div class="map" bind:this={container}></div>

<div class="account-corner"><AccountMenu /></div>

{#if viewport.phone}
  <header class="band">
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 23 L11 9 L16 17 L19 12 L25 23 Z" />
    </svg>
    <span>Hiker's Notebook</span>
  </header>
  <a class="add" href="#/hike" aria-label="Planifier un parcours" title="Planifier un parcours" onclick={prepareNewPlanning}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
  </a>
  <BottomSheet>
    {#snippet header()}
      Mes parcours <span class="count">{library.items.length}</span>
    {/snippet}
    <div class="sheet-list"><ParcoursList onpick={goToParcours} showTitle={false} /></div>
  </BottomSheet>
{/if}

<style>
  .map {
    position: absolute;
    inset: 0;
  }

  .band {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 4;
    height: 52px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 16px;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 2px 8px rgba(31, 42, 36, 0.12);
    color: var(--accent);
    font-family: var(--font-title);
    font-size: 19px;
    font-weight: 700;
  }

  .band span {
    color: var(--text);
  }

  /* Top right of the map, where the zoom buttons used to be (on a phone: just under the band). */
  .account-corner {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 5;
  }

  @media (max-width: 720px) {
    .account-corner {
      top: 62px;
    }
  }

  /* Above the closed sheet and the map credits. */
  .add {
    position: absolute;
    bottom: 116px;
    right: 14px;
    z-index: 4;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    box-shadow: 0 3px 12px rgba(31, 42, 36, 0.35);
  }

  .count {
    padding: 1px 9px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 13px;
  }

  .sheet-list {
    padding: 0 18px 28px;
  }
</style>
