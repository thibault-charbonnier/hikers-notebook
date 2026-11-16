<!--
  Numbered markers on the map, one per point of the hike (no visible markup:
  everything is drawn on the map).

  - hovering a marker shows its name and description;
  - clicking it opens the edit form (see PointEditor);
  - dragging it moves the point and recomputes the route around it;
  - right-clicking the first marker closes the loop (with the "add" tool, a
    left click does too). On a loop the first and last points share one
    marker, labelled "1/5" (for example).
-->
<script lang="ts">
  import { Marker, Popup, type Map as MapLibreMap } from "maplibre-gl";
  import { mount, onDestroy, unmount } from "svelte";
  import { hike } from "../lib/hike.svelte.js";
  import PointEditor from "./PointEditor.svelte";

  let { map }: { map: MapLibreMap } = $props();

  const markers = new Map<string, Marker>();
  let hoverPopup: Popup | null = null;
  let editor: { id: string; popup: Popup } | null = null;

  /** Text of the marker of the point at ``index``: "3", or "1/5" for a loop start. */
  function markerLabel(index: number): string {
    return hike.closed && index === 0 ? `1/${hike.points.length}` : String(index + 1);
  }

  /** True if the loop can be closed by using this point (the first one). */
  function canCloseWith(id: string): boolean {
    return !hike.closed && hike.points.length >= 2 && hike.points[0].id === id;
  }

  /** Show a small read-only bubble with the name and description of a point. */
  function showHover(id: string): void {
    hideHover();
    if (editor?.id === id) return;
    const index = hike.points.findIndex((p) => p.id === id);
    if (index < 0) return;
    const point = hike.points[index];

    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = point.name
      ? `${markerLabel(index)} · ${point.name}`
      : `Passage ${markerLabel(index)}`;
    content.append(title);
    if (point.description) {
      const text = document.createElement("p");
      text.textContent = point.description;
      content.append(text);
    }
    hoverPopup = new Popup({ closeButton: false, closeOnClick: false, offset: 18, className: "point-hover" })
      .setLngLat([point.lon, point.lat])
      .setDOMContent(content)
      .addTo(map);
  }

  function hideHover(): void {
    hoverPopup?.remove();
    hoverPopup = null;
  }

  /** Open the edit form in a bubble anchored on the point. */
  function openEditor(id: string): void {
    editor?.popup.remove();
    hideHover();
    const point = hike.points.find((p) => p.id === id);
    if (!point) return;

    const container = document.createElement("div");
    const popup = new Popup({ closeButton: true, closeOnClick: true, offset: 18, maxWidth: "300px", className: "point-editor" })
      .setLngLat([point.lon, point.lat])
      .setDOMContent(container)
      .addTo(map);
    const component = mount(PointEditor, { target: container, props: { pointId: id, onclose: () => popup.remove() } });
    popup.on("close", () => {
      unmount(component);
      if (editor?.popup === popup) editor = null;
    });
    editor = { id, popup };
  }

  /** Create the marker of a point and wire its mouse events. */
  function createMarker(id: string): Marker {
    const element = document.createElement("div");
    element.className = "point-marker";
    const marker = new Marker({ element, draggable: true }).setLngLat([0, 0]).addTo(map);

    let dragged = false;
    element.addEventListener("mouseenter", () => showHover(id));
    element.addEventListener("mouseleave", hideHover);
    element.addEventListener("click", (event) => {
      event.stopPropagation(); // do not let the map treat it as a click on the map
      if (dragged) return;
      if (hike.tool === "add" && canCloseWith(id)) hike.closeLoop();
      else openEditor(id);
    });
    element.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (canCloseWith(id)) {
        hideHover();
        hike.closeLoop();
      }
    });
    marker.on("dragstart", () => {
      dragged = true;
      hideHover();
    });
    marker.on("dragend", () => {
      const { lng, lat } = marker.getLngLat();
      if (!hike.movePoint(id, lng, lat)) {
        // Refused (outside France): put the marker back where it was.
        const point = hike.points.find((p) => p.id === id);
        if (point) marker.setLngLat([point.lon, point.lat]);
      }
      setTimeout(() => (dragged = false), 0);
    });
    return marker;
  }

  // Keep the markers in step with the points: create, move, relabel, remove.
  $effect(() => {
    const last = hike.points.length - 1;
    const ids = new Set<string>();
    hike.points.forEach((point, index) => {
      if (hike.closed && index === last) return; // shares the marker of the first point
      ids.add(point.id);
      let marker = markers.get(point.id);
      if (!marker) {
        marker = createMarker(point.id);
        markers.set(point.id, marker);
      }
      marker.setLngLat([point.lon, point.lat]);
      const element = marker.getElement();
      element.textContent = markerLabel(index);
      element.classList.toggle("start", index === 0);
      element.classList.toggle("end", !hike.closed && index === last && index > 0);
      element.classList.toggle("stage", hike.stagePointIndices.includes(index));
    });
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
