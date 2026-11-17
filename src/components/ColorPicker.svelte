<!--
  A row of basic colours, ending with a "+" that opens a small colour picker
  to choose any other colour. Used for parcours and for labels.

  The picker is drawn by the app itself (not by the browser) so that it looks
  the same everywhere and always stays inside the screen: it is placed next to
  the "+" button, then pushed back inside the window if it would stick out.
  Inside: a square to pick the shade, a rainbow slider, and the hex code.
-->
<script lang="ts">
  import { hexToHsv, hsvToHex, isHex, type Hsv } from "../lib/color";
  import { BASIC_COLORS } from "../lib/parcours";

  let { value, onpick }: { value: string; onpick: (color: string) => void } = $props();

  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  /** The current colour, when it is not one of the basic ones (chosen with the "+"). */
  const custom = $derived(value && !BASIC_COLORS.some((c) => same(c, value)) ? value : null);

  const POPOVER_WIDTH = 236;
  const POPOVER_HEIGHT = 262;
  const MARGIN = 8;

  let open = $state(false);
  let plus = $state<HTMLButtonElement>();
  let popover = $state<HTMLDivElement>();
  let square = $state<HTMLDivElement>();
  let place = $state({ left: 0, top: 0, width: POPOVER_WIDTH });
  let hsv = $state<Hsv>({ h: 210, s: 0.8, v: 0.9 });
  let hexText = $state("");

  /** Open the picker, starting from the current colour, and place it inside the window. */
  function show(): void {
    if (open) {
      open = false;
      return;
    }
    hsv = hexToHsv(isHex(value) ? value : "#1E88E5");
    hexText = hsvToHex(hsv.h, hsv.s, hsv.v);

    const rect = plus!.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, innerWidth - 2 * MARGIN);
    const left = Math.max(MARGIN, Math.min(rect.left + rect.width / 2 - width / 2, innerWidth - width - MARGIN));
    // Below the button if there is room, else above, never out of the window.
    let top = rect.bottom + MARGIN;
    if (top + POPOVER_HEIGHT > innerHeight - MARGIN) top = rect.top - POPOVER_HEIGHT - MARGIN;
    top = Math.max(MARGIN, Math.min(top, innerHeight - POPOVER_HEIGHT - MARGIN));
    place = { left, top, width };
    open = true;
  }

  /** Apply a change of the picker: tell the parent and keep the hex field in step. */
  function apply(next: Hsv): void {
    hsv = next;
    hexText = hsvToHex(next.h, next.s, next.v);
    onpick(hexText);
  }

  function pickInSquare(event: PointerEvent): void {
    if (!square) return;
    const rect = square.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const v = Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height));
    apply({ ...hsv, s, v });
  }

  function onSquareDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pickInSquare(event);
  }

  function onSquareMove(event: PointerEvent): void {
    if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) pickInSquare(event);
  }

  function onHexInput(text: string): void {
    hexText = text;
    const fixed = text.startsWith("#") ? text : `#${text}`;
    if (isHex(fixed)) {
      hsv = hexToHsv(fixed);
      onpick(fixed.toUpperCase());
    }
  }
</script>

<svelte:window
  onpointerdown={(event) => {
    // A press anywhere except on the picker or its "+" button closes the picker.
    const target = event.target as Node;
    if (open && !popover?.contains(target) && !plus?.contains(target)) open = false;
  }}
  onkeydown={(event) => event.key === "Escape" && open && (open = false)}
  onresize={() => (open = false)}
/>

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
  <button
    type="button"
    class="swatch plus"
    title="Choisir une autre couleur"
    aria-label="Choisir une autre couleur"
    aria-expanded={open}
    bind:this={plus}
    onclick={show}
  >
    +
  </button>
</div>

{#if open}
  <div
    class="popover"
    role="dialog"
    aria-label="Choisir une couleur"
    bind:this={popover}
    style:left="{place.left}px"
    style:top="{place.top}px"
    style:width="{place.width}px"
  >
    <div
      class="square"
      role="slider"
      tabindex="0"
      aria-label="Teinte et luminosité"
      aria-valuetext={hexText}
      aria-valuenow={Math.round(hsv.v * 100)}
      bind:this={square}
      style:--hue="hsl({hsv.h}, 100%, 50%)"
      onpointerdown={onSquareDown}
      onpointermove={onSquareMove}
    >
      <span class="knob" style:left="{hsv.s * 100}%" style:top="{(1 - hsv.v) * 100}%"></span>
    </div>

    <input
      class="hue"
      type="range"
      min="0"
      max="360"
      step="1"
      aria-label="Couleur de base"
      value={hsv.h}
      oninput={(event) => apply({ ...hsv, h: Number(event.currentTarget.value) })}
    />

    <div class="code">
      <span class="preview" style:background={hexText}></span>
      <input
        type="text"
        aria-label="Code de la couleur"
        maxlength="7"
        spellcheck="false"
        autocapitalize="characters"
        value={hexText}
        oninput={(event) => onHexInput(event.currentTarget.value)}
      />
      <button type="button" class="done" onclick={() => (open = false)}>OK</button>
    </div>
  </div>
{/if}

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
    font: inherit;
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
  }

  .plus:hover,
  .plus[aria-expanded="true"] {
    color: var(--accent);
  }

  /* Placed from the script, relative to the window, so it never sticks out of it. */
  .popover {
    position: fixed;
    z-index: 70;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    max-height: calc(100dvh - 16px);
    overflow-y: auto;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 8px 28px rgba(31, 42, 36, 0.3);
  }

  .square {
    position: relative;
    height: 140px;
    border-radius: 10px;
    background:
      linear-gradient(to top, #000, transparent),
      linear-gradient(to right, #fff, var(--hue));
    cursor: crosshair;
    touch-action: none; /* dragging must not scroll the page */
  }

  .knob {
    position: absolute;
    width: 18px;
    height: 18px;
    margin: -9px 0 0 -9px;
    border: 2.5px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }

  .hue {
    width: 100%;
    height: 14px;
    margin: 0;
    border-radius: 7px;
    background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
    appearance: none;
    cursor: pointer;
  }

  .hue::-webkit-slider-thumb {
    width: 22px;
    height: 22px;
    border: 3px solid #fff;
    border-radius: 50%;
    background: transparent;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
    appearance: none;
  }

  .hue::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: 3px solid #fff;
    border-radius: 50%;
    background: transparent;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
  }

  .code {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .preview {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    box-shadow: 0 0 0 1px var(--border);
  }

  .code input {
    flex: 1;
    min-width: 0;
    height: 34px;
    padding: 0 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: #fff;
    color: var(--text);
    font: inherit;
    font-size: 16px; /* 16 px keeps phones from zooming into the field */
    text-transform: uppercase;
  }

  .done {
    flex: none;
    height: 34px;
    padding: 0 14px;
    border: none;
    border-radius: 8px;
    background: var(--accent);
    color: #fff;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
