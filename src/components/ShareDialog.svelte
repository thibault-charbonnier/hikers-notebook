<!--
  Share window (computers, and phones that cannot open their own share sheet):
  the link of a parcours and a button to copy it.

  The link gives the parcours as it is now: later changes do not reach it.
  Anyone holding it can add a copy to their own account.
-->
<script lang="ts">
  import { library } from "../lib/library.svelte.js";

  let { name, url }: { name: string; url: string } = $props();

  let copied = $state(false);
  let field = $state<HTMLInputElement>();

  function close(): void {
    library.shareFor = null;
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 2500);
    } catch {
      // The browser refuses to write to the clipboard: the link is selected so Ctrl+C does it.
      field?.select();
    }
  }
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && close()} />

<div
  class="backdrop"
  role="presentation"
  onclick={(event) => {
    if (event.target === event.currentTarget) close();
  }}
>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
    <header>
      <h2 id="share-title">Partager le parcours</h2>
      <button type="button" class="close" aria-label="Fermer" onclick={close}>×</button>
    </header>

    <p class="name">« {name} »</p>
    <p class="hint">Toute personne qui a ce lien peut ajouter une copie du parcours à ses « Parcours partagés ».</p>

    <div class="link">
      <input type="text" readonly value={url} bind:this={field} onfocus={(event) => event.currentTarget.select()} aria-label="Lien de partage" />
      <button type="button" class="primary" onclick={copy}>{copied ? "Copié ✓" : "Copier"}</button>
    </div>
  </div>
</div>

<style>
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
    width: min(440px, 100%);
    max-height: 100%;
    overflow-y: auto;
    padding: 18px;
    background: var(--panel);
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
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

  .name {
    margin: 8px 0 4px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .hint {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.45;
    color: var(--muted);
  }

  .link {
    display: flex;
    gap: 8px;
  }

  .link input {
    flex: 1;
    min-width: 0;
    height: 40px;
    padding: 0 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: #fff;
    color: var(--text);
    font: inherit;
    font-size: 13px;
  }

  button.primary {
    flex: none;
    min-width: 88px;
    height: 40px;
    padding: 0 14px;
    border: none;
    border-radius: 10px;
    background: var(--accent);
    color: #fff;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
