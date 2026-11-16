<!--
  Switch above the elevation profile: show the slopes in colour (the altitude
  is always drawn).
-->
<script lang="ts">
  import { ui } from "../lib/ui.svelte.js";

  const on = $derived(ui.profileMode === "slope");
</script>

<button
  type="button"
  role="switch"
  aria-checked={on}
  class="switch"
  class:on
  title="Colorer le profil selon la pente"
  onclick={() => (ui.profileMode = on ? "altitude" : "slope")}
>
  <span class="track"><span class="knob"></span></span>
  Pentes
</button>

<style>
  .switch {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 2px 4px 2px 2px;
    border: none;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .switch:hover,
  .switch.on {
    color: var(--text);
  }

  .track {
    position: relative;
    width: 34px;
    height: 18px;
    border-radius: 999px;
    background: #d6d1c0;
    transition: background 0.15s ease;
  }

  /* Switched on, the track shows the colours of the slopes. */
  .on .track {
    background: linear-gradient(90deg, #3b5bc2, #44a8d9, #9bcb6b, #f1c945, #e5533d);
  }

  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    transition: transform 0.15s ease;
  }

  .on .knob {
    transform: translateX(16px);
  }
</style>
