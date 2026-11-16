<!--
  Large elevation profile in the middle of the screen (not full screen).
  Closes with the cross, the Escape key, or a click outside.
-->
<script lang="ts">
  import { hike } from "../lib/hike.svelte.js";
  import { ui } from "../lib/ui.svelte.js";
  import ElevationProfile from "./ElevationProfile.svelte";
  import ProfileModeToggle from "./ProfileModeToggle.svelte";

  let { onclose }: { onclose: () => void } = $props();
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && onclose()} />

<div
  class="backdrop"
  role="presentation"
  onclick={(event) => {
    if (event.target === event.currentTarget) onclose();
  }}
>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Profil altimétrique">
    <header>
      <h2>Profil altimétrique</h2>
      <ProfileModeToggle />
      <button type="button" aria-label="Fermer" onclick={onclose}>×</button>
    </header>
    {#if hike.profile}
      <ElevationProfile profile={hike.profile} labels={hike.labelsOnProfile} stageIndices={hike.stagePointIndices} mode={ui.profileMode} width={1000} height={440} fontSize={13} />
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(31, 42, 36, 0.45);
  }

  .dialog {
    width: min(1100px, 100%);
    padding: 18px 22px 22px;
    background: var(--panel);
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  }

  header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 8px;
  }

  header h2 {
    flex: 1;
  }

  h2 {
    margin: 0;
    font-family: var(--font-title);
    font-size: 20px;
  }

  button {
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--muted);
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
  }

  button:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
</style>
