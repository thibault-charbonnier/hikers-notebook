<!--
  "Explorer" of the home map: a green button (bottom right) and the floating
  window it opens, where the person chooses what the map shows:

  - my parcours;
  - the GR trails;
  - the regional natural parks, hatched;
  - the massifs;
  - summits and passes, with filters on the kind and the lowest altitude.

  The window floats over the map (it does not hide it), so the effect of a
  choice is seen at once. The choices are remembered (see explore.svelte.ts).
  On a phone the window sits above the buttons, along the bottom.
-->
<script lang="ts">
  import { explore } from "../lib/explore.svelte.js";
  import { MAX_MIN_ELE } from "../lib/exploreChoices";

  const choices = $derived(explore.choices);
  const minEleText = $derived(choices.minEle === 0 ? "Aucune" : `${choices.minEle.toLocaleString("fr-FR")} m`);
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && explore.open && (explore.open = false)} />

{#snippet toggle(label: string, hint: string, checked: boolean, onchange: (on: boolean) => void)}
  <label class="row">
    <input type="checkbox" role="switch" {checked} onchange={(event) => onchange(event.currentTarget.checked)} />
    <span class="text">
      <b>{label}</b>
      {#if hint}<small>{hint}</small>{/if}
    </span>
  </label>
{/snippet}

{#snippet option(label: string, checked: boolean, onchange: (on: boolean) => void)}
  <label class="option">
    <input type="checkbox" {checked} onchange={(event) => onchange(event.currentTarget.checked)} />
    {label}
  </label>
{/snippet}

<button
  type="button"
  class="open"
  class:active={explore.open}
  aria-label="Explorer"
  title="Explorer : GR, parcs, massifs, sommets"
  aria-expanded={explore.open}
  onclick={() => (explore.open = !explore.open)}
>
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
</button>

{#if explore.open}
  <section class="panel" aria-label="Explorer">
    <header>
      <h2>Explorer</h2>
      <button type="button" class="close" aria-label="Fermer" onclick={() => (explore.open = false)}>×</button>
    </header>

    <ul>
      <li class:on={choices.parcours}>
        {@render toggle("Mes parcours", "", choices.parcours, (on) => explore.set({ parcours: on }))}
      </li>

      <li class:on={choices.gr}>
        {@render toggle("Sentiers GR", "Itinéraires de grande randonnée", choices.gr, (on) => explore.set({ gr: on }))}
      </li>

      <li class:on={choices.parks}>
        {@render toggle("Parcs naturels régionaux", "", choices.parks, (on) => explore.set({ parks: on }))}
      </li>

      <li class:on={choices.massifs}>
        {@render toggle("Massifs", "Chartreuse, Vercors, Écrins…", choices.massifs, (on) => explore.set({ massifs: on }))}
      </li>

      <li class:on={choices.peaks}>
        {@render toggle("Sommets et cols", "Plus on zoome, plus il y en a", choices.peaks, (on) => explore.set({ peaks: on }))}
        {#if choices.peaks}
          <div class="options">
            {@render option("Sommets", choices.summits, (on) => explore.set({ summits: on }))}
            {@render option("Cols", choices.passes, (on) => explore.set({ passes: on }))}
            {@render option("Crêtes, cirques, gorges…", choices.others, (on) => explore.set({ others: on }))}
          </div>
          <label class="slider">
            <span>Altitude minimale : <b>{minEleText}</b></span>
            <input
              type="range"
              min="0"
              max={MAX_MIN_ELE}
              step="100"
              aria-label="Altitude minimale"
              value={choices.minEle}
              oninput={(event) => explore.set({ minEle: Number(event.currentTarget.value) })}
            />
          </label>
        {/if}
      </li>
    </ul>

    <footer>
      <button type="button" class="reset" onclick={() => explore.reset()}>Tout remettre par défaut</button>
      <small>Données : OpenStreetMap, IGN, refuges.info.</small>
    </footer>
  </section>
{/if}

<style>
  /* Green button with a slight bevel, like the layers button of the planning map. */
  .open {
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

  .open:hover,
  .open.active {
    background: #244a38;
  }

  /* Computer: above its button, so it stays clear of the big compass at the top right. */
  .panel {
    position: absolute;
    bottom: 100px;
    right: 10px;
    z-index: 4;
    width: 310px;
    max-height: calc(100% - 290px);
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: 0 8px 28px rgba(31, 42, 36, 0.3);
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px 4px 16px;
  }

  h2 {
    margin: 0;
    margin-right: auto;
    font-family: var(--font-title);
    font-size: 18px;
  }

  .close {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--muted);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
  }

  .close:hover {
    background: var(--accent-soft);
  }

  ul {
    margin: 0;
    padding: 6px 12px 8px;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
  }

  li {
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: #fff;
  }

  li.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
  }

  /* The on/off switch: a pill with a round knob (same as the layers window). */
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
    line-height: 1.3;
    color: var(--muted);
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 6px;
    padding-left: 48px;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 26px;
    font-size: 13px;
    cursor: pointer;
  }

  .option input {
    flex: none;
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--accent);
  }

  .slider {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
    padding-left: 48px;
    font-size: 12px;
    color: var(--muted);
  }

  .slider b {
    color: var(--text);
  }

  .slider input {
    width: 100%;
    margin: 0;
    accent-color: var(--accent);
  }

  footer {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 4px 16px 12px;
  }

  .reset {
    padding: 4px 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
  }

  footer small {
    font-size: 11px;
    color: var(--muted);
  }

  /* Phone: the window sits above the buttons, along the bottom; the button above the "+". */
  @media (max-width: 720px) {
    .open {
      right: 14px;
      bottom: 176px;
    }

    .panel {
      right: 8px;
      left: 8px;
      bottom: 228px; /* above the button */
      width: auto;
      max-height: min(46%, 360px);
    }
  }
</style>
