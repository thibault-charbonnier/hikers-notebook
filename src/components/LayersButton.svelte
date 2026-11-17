<!--
  "Calques" button of the planning map (green, bottom right) and the window it
  opens, in the middle of the screen:

  - "Fond de carte": the base maps, as small pictures that show what each one
    looks like (Plan IGN, aerial photos); one at a time;
  - "Superpositions": layers laid over the base map (slopes, hiking routes),
    each with an on/off switch and, once on, a transparency slider.

  Only the Plan IGN works without network: the other choices are greyed out
  then, and say so. (The 2D / 3D choice is the "3D" button of the action bar,
  see HikeActions.svelte.)

  On a phone the button hides while the details of the hike bar are open, so
  the floating buttons never pile up on the bar.
-->
<script lang="ts">
  import { BASE_MAPS, OVERLAYS } from "../lib/mapLayers";
  import { connection } from "../lib/online.svelte.js";
  import { ui } from "../lib/ui.svelte.js";
  import { viewport } from "../lib/viewport.svelte.js";

  let open = $state(false);
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && open && (open = false)} />

{#if !(viewport.phone && ui.detailsOpen)}
  <button
    type="button"
    class="layers"
    aria-label="Calques"
    title="Calques"
    aria-haspopup="dialog"
    onclick={() => (open = true)}
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  </button>
{/if}

{#if open}
  <div
    class="backdrop"
    role="presentation"
    onclick={(event) => {
      if (event.target === event.currentTarget) open = false;
    }}
  >
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="layers-title">
      <header>
        <h2 id="layers-title">Calques</h2>
        <button type="button" class="close" aria-label="Fermer" onclick={() => (open = false)}>×</button>
      </header>

      <p class="group">Fond de carte</p>
      <div class="tiles" role="radiogroup" aria-label="Fond de carte">
        {#each BASE_MAPS as info (info.id)}
          {@const unavailable = !connection.online && !info.offline}
          <button
            type="button"
            role="radio"
            aria-checked={ui.baseMap === info.id}
            class="tile"
            class:selected={ui.baseMap === info.id}
            title={unavailable ? "Nécessite internet" : info.description}
            disabled={unavailable}
            onclick={() => ui.setBaseMap(info.id)}
          >
            <img src={info.thumbnail} alt="" width="360" height="240" />
            <span class="name">{info.label}</span>
            {#if unavailable}<span class="needs-network">En ligne</span>{/if}
          </button>
        {/each}
      </div>

      <p class="group">Superpositions</p>
      <ul class="overlays">
        {#each OVERLAYS as info (info.id)}
          {@const choice = ui.overlays[info.id]}
          <li class:on={choice.on && connection.online}>
            <label class="row">
              <input
                type="checkbox"
                role="switch"
                checked={choice.on}
                disabled={!connection.online}
                onchange={(event) => ui.setOverlay(info.id, { on: event.currentTarget.checked })}
              />
              <span class="text">
                <b>{info.label}</b>
                <small>{connection.online ? info.description : "Nécessite internet"}</small>
              </span>
            </label>
            {#if choice.on && connection.online}
              <label class="opacity">
                <span>Transparence</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  aria-label="Opacité de {info.label}"
                  value={choice.opacity}
                  oninput={(event) => ui.setOverlay(info.id, { opacity: Number(event.currentTarget.value) })}
                />
              </label>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  /* Green button with a slight bevel, like the account button. */
  .layers {
    position: absolute;
    right: 12px;
    bottom: 44px; /* above the map credits */
    z-index: 4;
    width: 44px;
    height: 44px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 10px;
    background: var(--accent);
    box-shadow:
      0 0 0 2px rgba(0, 0, 0, 0.15),
      0 2px 8px rgba(31, 42, 36, 0.3);
    color: #fff;
    cursor: pointer;
  }

  .layers:hover {
    background: #244a38;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(31, 42, 36, 0.45);
  }

  .dialog {
    width: min(400px, 100%);
    max-height: 100%;
    overflow-y: auto;
    padding: 16px 16px 18px;
    background: var(--panel);
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  h2 {
    margin: 0;
    margin-right: auto;
    font-family: var(--font-title);
    font-size: 20px;
  }

  .close {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--muted);
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
  }

  .close:hover {
    background: var(--accent-soft);
  }

  .group {
    margin: 14px 0 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    gap: 8px;
  }

  /* A base map: its picture, with its name written on it. */
  .tile {
    position: relative;
    padding: 0;
    overflow: hidden;
    border: 2px solid transparent;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 0 0 1px var(--border);
    cursor: pointer;
  }

  .tile img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 3 / 2;
    object-fit: cover;
  }

  .tile .name {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 4px 8px;
    background: rgba(31, 42, 36, 0.78);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    text-align: left;
  }

  .tile.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }

  .tile:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .needs-network {
    position: absolute;
    top: 6px;
    right: 6px;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--panel);
    color: var(--muted);
    font-size: 10px;
    font-weight: 600;
  }

  .overlays {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .overlays li {
    padding: 9px 11px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: #fff;
  }

  .overlays li.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
  }

  /* The on/off switch: a pill with a round knob. */
  .row input[type="checkbox"] {
    appearance: none;
    flex: none;
    position: relative;
    width: 38px;
    height: 22px;
    margin: 0;
    border-radius: 999px;
    background: var(--border);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .row input[type="checkbox"]::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    transition: transform 0.15s ease;
  }

  .row input[type="checkbox"]:checked {
    background: var(--accent);
  }

  .row input[type="checkbox"]:checked::after {
    transform: translateX(16px);
  }

  .row input[type="checkbox"]:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .text b {
    font-size: 14px;
    font-weight: 600;
  }

  .text small {
    font-size: 12px;
    line-height: 1.35;
    color: var(--muted);
  }

  .opacity {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
    padding-left: 48px;
    font-size: 12px;
    color: var(--muted);
  }

  .opacity input {
    flex: 1;
    min-width: 0;
    accent-color: var(--accent);
  }

  /* Phone: bottom right, where the action bar used to be. */
  @media (max-width: 720px) {
    .layers {
      right: 8px;
      bottom: 104px;
    }
  }
</style>
