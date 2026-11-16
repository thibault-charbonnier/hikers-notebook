<!--
  Left menu. Top: app name, link to the overview map, and the button that
  opens the planning map. Below: all saved parcours, grouped by label.
  Folds away and can be resized, to give the map more room.
-->
<script lang="ts">
  import { goToParcours, prepareNewPlanning } from "../lib/actions";
  import { library } from "../lib/library.svelte.js";
  import ParcoursList from "./ParcoursList.svelte";
  import ResizeHandle from "./ResizeHandle.svelte";

  let {
    route,
    open,
    width = $bindable(),
    resizing = $bindable(false),
  }: { route: "home" | "plan"; open: boolean; width: number; resizing?: boolean } = $props();

  /** On the overview, picking a parcours selects it on the map; elsewhere it opens it. */
  function pick(id: string): void {
    if (route === "home") library.selectedId = id;
    else goToParcours(id);
  }
</script>

<aside class:closed={!open} class:resizing style:width={open ? `${width}px` : "0px"}>
  {#if open}
    <ResizeHandle
      grows="right"
      {width}
      min={240}
      max={520}
      onresize={(value) => (width = value)}
      onstart={() => (resizing = true)}
      onend={() => (resizing = false)}
    />
  {/if}
  <div class="inner" style:width="{width}px">
    <div class="top">
      <div class="brand">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 23 L11 9 L16 17 L19 12 L25 23 Z" />
        </svg>
        <span>Hiker's Notebook</span>
      </div>

      <nav aria-label="Navigation principale">
        <a href="#/" class:active={route === "home"} aria-current={route === "home" ? "page" : undefined}>
          Vue générale
        </a>
      </nav>

      <a href="#/planifier" class="cta" aria-current={route === "plan" ? "page" : undefined} onclick={prepareNewPlanning}>
        + Planifier un parcours
      </a>
    </div>

    <div class="library">
      <ParcoursList onpick={pick} />
    </div>
  </div>
</aside>

<style>
  aside {
    position: relative;
    flex: none;
    overflow: hidden;
    background: var(--panel);
    border-right: 1px solid var(--border);
    transition: width 0.2s ease;
  }

  aside.closed {
    border-right-width: 0;
  }

  aside.resizing {
    transition: none;
  }

  /* Width set from the script, so the content does not reflow while the bar folds. */
  .inner {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .top {
    flex: none;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .library {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 18px 20px 24px;
    border-top: 1px solid var(--border);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--accent);
    font-family: var(--font-title);
    font-weight: 700;
    font-size: 20px;
  }

  .brand span {
    color: var(--text);
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  nav a {
    padding: 10px 12px;
    border-radius: 8px;
    color: var(--text);
    font-size: 15px;
    text-decoration: none;
  }

  nav a.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }

  .cta {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    border-radius: 10px;
    background: var(--accent);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
  }

  .cta:hover {
    background: #244a38;
  }
</style>
