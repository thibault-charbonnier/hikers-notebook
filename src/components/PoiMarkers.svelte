<!--
  Markers of the points of interest and comments on the map (no visible
  markup: everything is drawn on the map).

  - hovering a marker shows its name and description;
  - clicking a point of interest opens its edit form; clicking a comment opens
    it in a large window;
  - dragging a marker moves it.
-->
<script lang="ts">
  import { Marker, Popup, type Map as MapLibreMap } from "maplibre-gl";
  import { mount, onDestroy, unmount } from "svelte";
  import { hike } from "../lib/hike.svelte.js";
  import { keepPopupInView, planPopupInsets } from "../lib/map";
  import { pinInfo } from "../lib/poi";
  import PoiEditor from "./PoiEditor.svelte";

  let { map }: { map: MapLibreMap } = $props();

  const markers = new Map<string, Marker>();
  let hoverPopup: Popup | null = null;
  let editor: { id: string; popup: Popup } | null = null;

  /** Build the inside of a marker: the icon of its type (a fixed drawing from src/lib/poi.ts). */
  function iconMarkup(type: Parameters<typeof pinInfo>[0]): string {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pinInfo(type).icon}</svg>`;
  }

  function showHover(id: string): void {
    hideHover();
    if (editor?.id === id) return;
    const poi = hike.pois.find((p) => p.id === id);
    if (!poi) return;
    const info = pinInfo(poi.type);

    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = poi.name || info.label;
    content.append(title);
    if (poi.description) {
      const text = document.createElement("p");
      text.textContent = poi.description.length > 160 ? `${poi.description.slice(0, 160)}…` : poi.description;
      content.append(text);
    }
    hoverPopup = new Popup({ closeButton: false, closeOnClick: false, offset: 20, className: "point-hover" })
      .setLngLat([poi.lon, poi.lat])
      .setDOMContent(content)
      .addTo(map);
  }

  function hideHover(): void {
    hoverPopup?.remove();
    hoverPopup = null;
  }

  function openEditor(id: string): void {
    editor?.popup.remove();
    hideHover();
    const poi = hike.pois.find((p) => p.id === id);
    if (!poi) return;

    const container = document.createElement("div");
    const popup = new Popup({ closeButton: true, closeOnClick: true, offset: 20, maxWidth: "300px", className: "point-editor" })
      .setLngLat([poi.lon, poi.lat])
      .setDOMContent(container)
      .addTo(map);
    const component = mount(PoiEditor, { target: container, props: { poiId: id, onclose: () => popup.remove() } });
    keepPopupInView(map, popup, planPopupInsets()); // never cut off by the screen edge or the bars
    popup.on("close", () => {
      unmount(component);
      if (editor?.popup === popup) editor = null;
    });
    editor = { id, popup };
  }

  function createMarker(id: string): Marker {
    const element = document.createElement("div");
    element.className = "poi-marker";
    const marker = new Marker({ element, draggable: true }).setLngLat([0, 0]).addTo(map);

    let dragged = false;
    element.addEventListener("mouseenter", () => showHover(id));
    element.addEventListener("mouseleave", hideHover);
    element.addEventListener("click", (event) => {
      event.stopPropagation(); // not a click on the map
      if (dragged) return;
      hideHover();
      if (hike.pois.find((p) => p.id === id)?.type === "comment") hike.commentOpenId = id;
      else openEditor(id);
    });
    element.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation(); // a right click here must not place a point de passage
    });
    marker.on("dragstart", () => {
      dragged = true;
      hideHover();
    });
    marker.on("dragend", () => {
      const { lng, lat } = marker.getLngLat();
      if (!hike.movePoi(id, lng, lat)) {
        const poi = hike.pois.find((p) => p.id === id);
        if (poi) marker.setLngLat([poi.lon, poi.lat]);
      }
      setTimeout(() => (dragged = false), 0);
    });
    return marker;
  }

  // Keep the markers in step with the points of interest: create, move, restyle, remove.
  $effect(() => {
    const ids = new Set<string>();
    for (const poi of hike.pois) {
      ids.add(poi.id);
      let marker = markers.get(poi.id);
      if (!marker) {
        marker = createMarker(poi.id);
        markers.set(poi.id, marker);
      }
      marker.setLngLat([poi.lon, poi.lat]);
      const element = marker.getElement();
      element.style.setProperty("--pin-color", pinInfo(poi.type).color);
      element.classList.toggle("comment", poi.type === "comment");
      element.innerHTML = iconMarkup(poi.type);
    }
    for (const [id, marker] of markers) {
      if (ids.has(id)) continue;
      marker.remove();
      markers.delete(id);
      if (editor?.id === id) editor.popup.remove();
    }
  });

  onDestroy(() => {
    hideHover();
    editor?.popup.remove();
    for (const marker of markers.values()) marker.remove();
    markers.clear();
  });
</script>
