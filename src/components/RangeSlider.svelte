<!--
  Slider with two handles, to pick a range of values. The chosen range is a
  dashed bar that does not cover the whole track.
-->
<script lang="ts">
  let {
    min,
    max,
    step = 1,
    low,
    high,
    label,
    onchange,
  }: {
    min: number;
    max: number;
    step?: number;
    low: number;
    high: number;
    /** Name of what is measured, for screen readers (for example "kilomètres"). */
    label: string;
    onchange: (low: number, high: number) => void;
  } = $props();

  const span = $derived(Math.max(max - min, 1));
  const from = $derived((low - min) / span);
  const to = $derived((high - min) / span);
</script>

<div class="slider" style:--from={from} style:--to={to}>
  <span class="track"></span>
  <span class="range"></span>
  <input
    type="range"
    {min}
    {max}
    {step}
    value={low}
    aria-label="{label} : minimum"
    oninput={(event) => onchange(Math.min(Number(event.currentTarget.value), high), high)}
  />
  <input
    type="range"
    {min}
    {max}
    {step}
    value={high}
    aria-label="{label} : maximum"
    oninput={(event) => onchange(low, Math.max(Number(event.currentTarget.value), low))}
  />
</div>

<style>
  .slider {
    position: relative;
    height: 28px;
  }

  .track,
  .range {
    position: absolute;
    top: 12px;
    height: 4px;
    border-radius: 2px;
  }

  .track {
    left: 8px;
    right: 8px;
    background: #e5dfce;
  }

  /* The chosen part: a dashed bar, between the two handles. */
  .range {
    left: calc(8px + (100% - 16px) * var(--from));
    width: calc((100% - 16px) * (var(--to) - var(--from)));
    background: repeating-linear-gradient(90deg, var(--accent) 0 6px, transparent 6px 9px);
  }

  /* Both real sliders sit on top of each other: only their handles take the mouse. */
  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    background: transparent;
    pointer-events: none;
    appearance: none;
    -webkit-appearance: none;
  }

  input::-webkit-slider-runnable-track {
    background: transparent;
  }

  input::-moz-range-track {
    background: transparent;
  }

  input::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border: 2px solid var(--accent);
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(31, 42, 36, 0.3);
    cursor: grab;
    pointer-events: auto;
  }

  input::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: 2px solid var(--accent);
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(31, 42, 36, 0.3);
    cursor: grab;
    pointer-events: auto;
  }

  input:focus-visible::-webkit-slider-thumb {
    outline: 2px solid var(--text);
  }
</style>
