<!--
  Small question in the middle of the screen, with a dark backdrop. Escape or
  a click outside cancels. The confirm button is red by default (for deletions)
  or green with ``tone="primary"`` (for harmless actions such as a download).
-->
<script lang="ts">
  let {
    title,
    message,
    confirmLabel,
    tone = "danger",
    onconfirm,
    oncancel,
  }: {
    title: string;
    message: string;
    confirmLabel: string;
    /** "danger" (red button) for something that cannot be undone, "primary" (green) otherwise. */
    tone?: "danger" | "primary";
    onconfirm: () => void;
    oncancel: () => void;
  } = $props();
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && oncancel()} />

<div
  class="backdrop"
  role="presentation"
  onclick={(event) => {
    if (event.target === event.currentTarget) oncancel();
  }}
>
  <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
    <h2 id="confirm-title">{title}</h2>
    <p id="confirm-message">{message}</p>
    <div class="actions">
      <button type="button" class="cancel" onclick={oncancel}>Annuler</button>
      <button type="button" class={tone} onclick={onconfirm}>{confirmLabel}</button>
    </div>
  </div>
</div>

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
    width: min(420px, 100%);
    padding: 22px;
    background: var(--panel);
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  }

  h2 {
    margin: 0 0 8px;
    font-family: var(--font-title);
    font-size: 20px;
  }

  p {
    margin: 0 0 18px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--muted);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
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

  .cancel {
    border: 1px solid var(--border);
    background: #fff;
    color: var(--text);
  }

  .danger {
    border: none;
    background: #c0392b;
    color: #fff;
  }

  .primary {
    border: none;
    background: var(--accent);
    color: #fff;
  }
</style>
