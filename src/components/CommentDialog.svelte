<!--
  A comment pinned on the map, opened in a large window in the middle of the
  screen: an optional title and a big text. Closes with the button, the Escape
  key or a click outside. An empty comment that is closed is removed.
-->
<script lang="ts">
  import { hike } from "../lib/hike.svelte.js";

  let { id }: { id: string } = $props();

  const comment = $derived(hike.pois.find((p) => p.id === id));
  let textarea = $state<HTMLTextAreaElement>();

  // Ready to type as soon as the window opens.
  $effect(() => {
    textarea?.focus();
  });

  function close(): void {
    // A comment with nothing in it is not worth keeping.
    if (comment && comment.name === "" && comment.description === "") hike.removePoi(id);
    hike.commentOpenId = null;
  }
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && close()} />

{#if comment}
  <div
    class="backdrop"
    role="presentation"
    onclick={(event) => {
      if (event.target === event.currentTarget) close();
    }}
  >
    <div class="dialog" role="dialog" aria-modal="true" aria-label="Commentaire">
      <header>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <input
          class="title"
          aria-label="Titre du commentaire"
          placeholder="Titre (facultatif)"
          value={comment.name}
          oninput={(event) => (comment.name = event.currentTarget.value)}
        />
      </header>
      <textarea
        bind:this={textarea}
        aria-label="Texte du commentaire"
        placeholder="Écris ton commentaire…"
        value={comment.description}
        oninput={(event) => (comment.description = event.currentTarget.value)}
      ></textarea>
      <div class="actions">
        <button type="button" class="danger" onclick={() => hike.removePoi(id)}>Supprimer</button>
        <button type="button" class="ok" onclick={close}>Fermer</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(31, 42, 36, 0.45);
  }

  .dialog {
    width: min(640px, 100%);
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px 22px 22px;
    background: var(--panel);
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  }

  header {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #b07a00;
  }

  .title {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    font-family: var(--font-title);
    font-size: 20px;
    font-weight: 700;
  }

  .title:hover,
  .title:focus {
    border-color: var(--border);
    background: #fff;
    outline: none;
  }

  textarea {
    min-height: 220px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
    font: inherit;
    font-size: 15px;
    line-height: 1.55;
    resize: vertical;
  }

  textarea:focus {
    border-color: var(--accent);
    outline: none;
  }

  .actions {
    display: flex;
    justify-content: space-between;
  }

  button {
    min-height: 38px;
    padding: 0 18px;
    border-radius: 10px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .ok {
    border: none;
    background: var(--accent);
    color: #fff;
  }

  .danger {
    border: 1px solid #d9b3a6;
    background: #fff;
    color: #8c3a1b;
  }
</style>
