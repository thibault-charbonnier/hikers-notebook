<!--
  Vertical gauge of the altitude range of the hike: the bottom of the gauge is
  the lowest altitude, the top is the highest.
-->
<script lang="ts">
  import { formatMeters } from "../lib/format";

  let { min, max }: { min: number | null; max: number | null } = $props();
</script>

<div class="gauge">
  <div class="bar" class:empty={min === null} aria-hidden="true"></div>
  <div class="labels">
    <div>
      <b>{max === null ? "—" : formatMeters(max)}</b>
      <small>Altitude max</small>
    </div>
    <div>
      <b>{min === null ? "—" : formatMeters(min)}</b>
      <small>Altitude min</small>
    </div>
  </div>
</div>

<style>
  .gauge {
    display: flex;
    gap: 12px;
    height: 100%;
    min-height: 96px;
  }

  .bar {
    flex: none;
    width: 14px;
    border-radius: 7px;
    background: linear-gradient(to top, #dce8df, #2f5d46);
  }

  .bar.empty {
    background: #e5dfce;
  }

  .labels {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .labels div {
    display: flex;
    flex-direction: column;
  }

  b {
    font-family: var(--font-title);
    font-size: 16px;
    white-space: nowrap;
  }

  small {
    font-size: 12px;
    color: var(--muted);
  }
</style>
