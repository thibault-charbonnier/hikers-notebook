<!--
  Page layout: sidebar on the left, current view on the right.

  Navigation uses the URL hash, which needs no server configuration and keeps
  working on a static host or offline:

  - `#/`                 overview map
  - `#/hike`             planning page (the parcours being planned)
  - `#/hike/<id>`        planning page, opening a saved parcours
    (`#/planifier` is the old name of these addresses and still works)

  The sidebar is open on the overview and folds away by itself on the planning
  page, to leave room for the map. A tab on its edge folds or unfolds it.

  On a phone there is no sidebar: each page has its own sheet that slides up
  from the bottom (see BottomSheet.svelte).

  Nothing of this is shown until someone is logged in: before that, the login
  screen (see AuthView.svelte) takes the whole window.
-->
<script lang="ts">
  import Sidebar from "./components/Sidebar.svelte";
  import SideToggle from "./components/SideToggle.svelte";
  import MessageDialog from "./components/MessageDialog.svelte";
  import OfflineDialog from "./components/OfflineDialog.svelte";
  import ParcoursOptionsDialog from "./components/ParcoursOptionsDialog.svelte";
  import { auth } from "./lib/auth.svelte.js";
  import { hike } from "./lib/hike.svelte.js";
  import { library } from "./lib/library.svelte.js";
  import { offline } from "./lib/offline.svelte.js";
  import { connection } from "./lib/online.svelte.js";
  import { ensureOverviewPack } from "./lib/overviewPack";
  import { viewport } from "./lib/viewport.svelte.js";
  import AuthView from "./views/AuthView.svelte";
  import HomeView from "./views/HomeView.svelte";
  import PlanView from "./views/PlanView.svelte";

  type Route = { name: "home" } | { name: "plan"; id: string | null };

  /** Read the current view from the URL hash. */
  function readRoute(): Route {
    const [, page, id] = location.hash.split("/");
    return page === "hike" || page === "planifier" ? { name: "plan", id: id || null } : { name: "home" };
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

  /**
   * Whether the service worker is in charge of this page. Without it (the development server never
   * has one) the saved maps cannot be shown: the banner says so instead of leaving a blank map.
   */
  const hasWorker = typeof navigator !== "undefined" && Boolean(navigator.serviceWorker?.controller);

  // Load the saved parcours when someone logs in (and again when the network comes
  // or goes: offline, only the downloaded parcours are listed); forget them when
  // they log out, so the next person never sees them.
  let loadedFor: string | null = null;
  $effect(() => {
    const id = auth.user?.id ?? null;
    const key = `${id}:${connection.online}`;
    if (key === loadedFor) return;
    loadedFor = key;
    if (id) {
      void offline.load(id);
      library.refresh();
      // Quietly save the overview map for offline use, a few seconds after the start.
      if (connection.online) setTimeout(() => void ensureOverviewPack(), 4000);
    } else {
      void offline.load(null);
      library.reset();
    }
  });
</script>

<svelte:window
  onhashchange={onHashChange}
  onbeforeunload={(event) => {
    if (hike.dirty) event.preventDefault(); // the browser asks before leaving
  }}
/>

{#if !auth.ready}
  <!-- The browser is still looking for a saved session: show nothing but a spinner. -->
  <div class="loading"><span class="spinner"></span></div>
{:else if !auth.user || auth.recovery}
  <AuthView />
{:else}
  {#if !connection.online}
    <div class="offline-banner" role="status">
      <b>Hors réseau</b> · seuls les parcours téléchargés sont disponibles, en lecture seule
      {#if !hasWorker}· cartes indisponibles : il faut le site construit (npm run build, npm run preview){/if}
    </div>
  {/if}
  <div class="layout" class:with-banner={!connection.online}>
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
  {#if library.optionsFor}
    <ParcoursOptionsDialog item={library.optionsFor} />
  {/if}
  {#if library.offlineFor}
    <OfflineDialog item={library.offlineFor} />
  {/if}
{/if}

<!-- The standard window for information and problems, above everything else. -->
<MessageDialog />

<style>
  .loading {
    height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .layout {
    display: flex;
    height: 100dvh;
  }

  /* Without network: a thin banner on top, and the page below it. */
  .layout.with-banner {
    height: calc(100dvh - 26px);
  }

  .offline-banner {
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    background: #7a5600;
    color: #fff;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  main {
    position: relative;
    flex: 1;
    min-width: 0;
  }
</style>
