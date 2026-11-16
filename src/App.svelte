<!--
  Page layout: sidebar on the left, current view on the right.

  Navigation uses the URL hash, which needs no server configuration and keeps
  working on a static host or offline:

  - `#/`                 overview map
  - `#/planifier`        planning page (the parcours being planned)
  - `#/planifier/<id>`   planning page, opening a saved parcours

  The sidebar is open on the overview and folds away by itself on the planning
  page, to leave room for the map. A tab on its edge folds or unfolds it.

  On a phone there is no sidebar: each page has its own sheet that slides up
  from the bottom (see BottomSheet.svelte).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Sidebar from "./components/Sidebar.svelte";
  import SideToggle from "./components/SideToggle.svelte";
  import { hike } from "./lib/hike.svelte.js";
  import { library } from "./lib/library.svelte.js";
  import { viewport } from "./lib/viewport.svelte.js";
  import HomeView from "./views/HomeView.svelte";
  import PlanView from "./views/PlanView.svelte";

  type Route = { name: "home" } | { name: "plan"; id: string | null };

  /** Read the current view from the URL hash. */
  function readRoute(): Route {
    const [, page, id] = location.hash.split("/");
    return page === "planifier" ? { name: "plan", id: id || null } : { name: "home" };
  }

  let route = $state<Route>(readRoute());
  let sidebarOpen = $state(readRoute().name === "home");
  let sidebarWidth = $state(300);
  let sidebarResizing = $state(false);

  function onHashChange(): void {
    const previous = route.name;
    route = readRoute();
    // Open or fold the sidebar when changing page, not when only the id changes.
    // It jumps instead of sliding, so the new map is created at its final size.
    if (route.name !== previous) {
      sidebarResizing = true;
      sidebarOpen = route.name === "home";
      requestAnimationFrame(() => requestAnimationFrame(() => (sidebarResizing = false)));
    }
  }

  onMount(() => {
    library.refresh();
  });
</script>

<svelte:window
  onhashchange={onHashChange}
  onbeforeunload={(event) => {
    if (hike.dirty) event.preventDefault(); // the browser asks before leaving
  }}
/>

<div class="layout">
  {#if !viewport.phone}
    <Sidebar route={route.name} open={sidebarOpen} bind:width={sidebarWidth} bind:resizing={sidebarResizing} />
  {/if}
  <main>
    {#if route.name === "plan"}
      <PlanView id={route.id} />
    {:else}
      <HomeView />
    {/if}
    {#if !viewport.phone}
      <SideToggle
        side="left"
        open={sidebarOpen}
        label={sidebarOpen ? "Replier le menu" : "Déplier le menu"}
        ontoggle={() => (sidebarOpen = !sidebarOpen)}
      />
    {/if}
  </main>
</div>

<style>
  .layout {
    display: flex;
    height: 100dvh;
  }

  main {
    position: relative;
    flex: 1;
    min-width: 0;
  }
</style>
