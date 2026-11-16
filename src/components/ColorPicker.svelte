<!--
  A row of basic colours, ending with a "+" that opens the system colour
  picker to choose any other colour. Used for parcours and for labels.
-->
<script lang="ts">
  import { BASIC_COLORS } from "../lib/parcours";

  let { value, onpick }: { value: string; onpick: (color: string) => void } = $props();

  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  /** The current colour, when it is not one of the basic ones (chosen with the "+"). */
  const custom = $derived(value && !BASIC_COLORS.some((c) => same(c, value)) ? value : null);
</script>

<div class="swatches" role="radiogroup" aria-label="Couleur">
  {#each BASIC_COLORS as color (color)}
    <button
      type="button"
      role="radio"
      aria-checked={same(color, value)}
      aria-label="Couleur {color}"
      class="swatch"
      class:selected={same(color, value)}
      style:background={color}
      onclick={() => onpick(color)}
    ></button>
  {/each}
  {#if custom}
    <button type="button" role="radio" aria-checked="true" aria-label="Couleur choisie" class="swatch selected" style:background={custom}></button>
  {/if}
  <label class="swatch plus" title="Choisir une autre couleur">
    +
    <input type="color" aria-label="Choisir une autre couleur" value={value || "#1E88E5"} oninput={(event) => onpick(event.currentTarget.value)} />
  </label>
</div>

<style>
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .swatch {
    position: relative;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 1px var(--border);
    cursor: pointer;
  }

  .swatch.selected {
    box-shadow: 0 0 0 2px var(--text);
  }

  .plus {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    color: var(--muted);
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
  }

  .plus:hover {
    color: var(--accent);
  }

  /* The real input covers the "+": clicking it opens the picker. */
  .plus input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
</style>
