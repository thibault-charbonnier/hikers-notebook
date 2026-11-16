<!--
  Rating from 0.5 to 5 stars, in steps of half a star: the left half of a star
  gives x.5, the right half gives the whole number. Click the current value
  again (or the cross) to remove the rating.
-->
<script lang="ts">
  let { value, onchange }: { value: number | null; onchange: (value: number | null) => void } = $props();

  const STAR = "M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z";
  const STARS = [1, 2, 3, 4, 5];

  let hovered = $state<number | null>(null);
  const shown = $derived(hovered ?? value ?? 0);

  /** Part (0 to 1) of a star that is filled. */
  const filled = (star: number) => Math.min(1, Math.max(0, shown - (star - 1)));
  const format = (rating: number) => rating.toLocaleString("fr-FR");

  function choose(next: number): void {
    onchange(value === next ? null : next);
  }
</script>

<!-- The handler only clears the hover preview; keyboard users use the focusable buttons. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="rating" onpointerleave={() => (hovered = null)}>
  <div class="stars" role="radiogroup" aria-label="Note">
  {#each STARS as star (star)}
    <span class="star">
      <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} class="empty" /></svg>
      <span class="fill" style:width="{filled(star) * 100}%">
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} class="full" /></svg>
      </span>
      <button
        type="button"
        role="radio"
        class="half left"
        aria-checked={value === star - 0.5}
        aria-label="{format(star - 0.5)} étoiles"
        onpointerenter={() => (hovered = star - 0.5)}
        onclick={() => choose(star - 0.5)}
      ></button>
      <button
        type="button"
        role="radio"
        class="half right"
        aria-checked={value === star}
        aria-label="{format(star)} étoile{star > 1 ? 's' : ''}"
        onpointerenter={() => (hovered = star)}
        onclick={() => choose(star)}
      ></button>
    </span>
  {/each}
  </div>
  <span class="value">{value === null ? "Pas de note" : `${format(value)} / 5`}</span>
  {#if value !== null}
    <button type="button" class="clear" aria-label="Effacer la note" onclick={() => onchange(null)}>×</button>
  {/if}
</div>

<style>
  .rating {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .stars {
    display: flex;
    gap: 2px;
  }

  .star {
    position: relative;
    width: 26px;
    height: 26px;
  }

  .star svg {
    display: block;
  }

  .fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    overflow: hidden;
  }

  .empty {
    fill: #e5dfce;
    stroke: #cfc8b2;
    stroke-width: 1;
    stroke-linejoin: round;
  }

  .full {
    fill: #f5b301;
    stroke: #d99a00;
    stroke-width: 1;
    stroke-linejoin: round;
  }

  .half {
    position: absolute;
    top: 0;
    width: 50%;
    height: 100%;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .left {
    left: 0;
  }

  .right {
    right: 0;
  }

  .value {
    margin-left: 8px;
    font-size: 13px;
    color: var(--muted);
  }

  .clear {
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--muted);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
  }

  .clear:hover {
    background: rgba(0, 0, 0, 0.08);
  }
</style>
