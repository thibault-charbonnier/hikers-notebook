<!--
  The standard message window (see src/lib/feedback.svelte.ts), shown in the
  middle of the screen: either a piece of information or a problem, with the
  usual way out (reload the page, or contact the administrator).
-->
<script lang="ts">
  import { feedback } from "../lib/feedback.svelte.js";

  const message = $derived(feedback.current);
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && feedback.close()} />

{#if message}
  <div
    class="backdrop"
    role="presentation"
    onclick={(event) => {
      if (event.target === event.currentTarget) feedback.close();
    }}
  >
    <div class="dialog" class:error={message.kind === "error"} role="alertdialog" aria-modal="true" aria-labelledby="message-title">
      <div class="icon" aria-hidden="true">
        {#if message.kind === "error"}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" /><path d="M12 17h.01" />
          </svg>
        {:else}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
          </svg>
        {/if}
      </div>
      <h2 id="message-title">{message.title}</h2>
      <p>{message.text}</p>

      {#if message.kind === "error"}
        <p class="help">
          Si le problème continue, recharge la page. S'il persiste, contacte l'administrateur du site.
        </p>
        {#if message.detail}
          <details>
            <summary>Détails techniques</summary>
            <code>{message.detail}</code>
          </details>
        {/if}
      {/if}

      <div class="actions">
        {#if message.kind === "error"}
          <button type="button" class="secondary" onclick={() => location.reload()}>Recharger la page</button>
        {/if}
        <button type="button" class="primary" onclick={() => feedback.close()}>
          {message.kind === "error" ? "Fermer" : "OK"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(31, 42, 36, 0.45);
  }

  .dialog {
    width: min(420px, 100%);
    padding: 22px;
    background: var(--panel);
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    margin-bottom: 10px;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
  }

  .error .icon {
    background: #fbe9e6;
    color: #c0392b;
  }

  h2 {
    margin: 0 0 8px;
    font-family: var(--font-title);
    font-size: 20px;
  }

  p {
    margin: 0 0 12px;
    font-size: 14px;
    line-height: 1.5;
  }

  .help {
    color: var(--muted);
    font-size: 13px;
  }

  details {
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--muted);
  }

  summary {
    cursor: pointer;
  }

  code {
    display: block;
    margin-top: 6px;
    padding: 8px 10px;
    border-radius: 8px;
    background: #efece2;
    color: var(--text);
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
  }

  button {
    min-height: 38px;
    padding: 0 16px;
    border-radius: 10px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .secondary {
    border: 1px solid var(--border);
    background: #fff;
    color: var(--text);
  }

  .primary {
    border: none;
    background: var(--accent);
    color: #fff;
  }
</style>
