<!--
  Pop-up message at the top of the planning map (for instance when a point is
  placed outside France). It disappears by itself after a few seconds.
-->
<script lang="ts">
  import { hike } from "../lib/hike.svelte.js";
</script>

{#if hike.notice}
  <div class="toast" class:success={hike.notice.kind === "success"} role="alert">
    <span>{hike.notice.text}</span>
    <button type="button" aria-label="Fermer le message" onclick={() => hike.dismissNotice()}>×</button>
  </div>
{/if}

<style>
  .toast {
    position: absolute;
    top: 150px;
    left: 50%;
    z-index: 6;
    transform: translateX(-50%);
    max-width: min(520px, calc(100% - 200px));
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    background: #fbe9e2;
    border: 1px solid #e3b9a8;
    border-radius: 12px;
    box-shadow: 0 4px 14px rgba(31, 42, 36, 0.2);
    color: #8c3a1b;
    font-size: 14px;
    line-height: 1.4;
  }

  .toast.success {
    background: #e6efe8;
    border-color: #b6cfbd;
    color: #2f5d46;
  }

  button {
    flex: none;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }

  button:hover {
    background: rgba(0, 0, 0, 0.08);
  }
</style>
