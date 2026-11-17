<!--
  Account button (a small person) and the speech bubble it opens: name, e-mail,
  and two buttons, "Modifier le profil" and "Déconnexion".

  Put it in a corner with a positioned parent; the bubble opens below it, with
  its arrow pointing at the button.
-->
<script lang="ts">
  import { auth } from "../lib/auth.svelte.js";
  import ProfileDialog from "./ProfileDialog.svelte";

  let open = $state(false);
  let editing = $state(false);

  function close(): void {
    open = false;
  }
</script>

<svelte:window
  onkeydown={(event) => event.key === "Escape" && close()}
  onpointerdown={(event) => {
    // A click anywhere else folds the bubble.
    if (open && !(event.target as HTMLElement).closest(".account")) close();
  }}
/>

<div class="account">
  <button
    type="button"
    class="button"
    class:open
    aria-label="Mon compte"
    title="Mon compte"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  </button>

  {#if open}
    <div class="bubble" role="dialog" aria-label="Mon compte">
      <p class="name">{auth.displayName}</p>
      <p class="email">{auth.email}</p>
      <div class="actions">
        <button
          type="button"
          class="secondary"
          onclick={() => {
            close();
            editing = true;
          }}
        >
          Modifier le profil
        </button>
        <button
          type="button"
          class="primary"
          onclick={() => {
            close();
            auth.signOut();
          }}
        >
          Déconnexion
        </button>
      </div>
    </div>
  {/if}
</div>

{#if editing}
  <ProfileDialog onclose={() => (editing = false)} />
{/if}

<style>
  .account {
    position: relative;
  }

  /* Same look as the zoom buttons of the map, in dark green. */
  .button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: var(--accent);
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.15);
    color: #fff;
    cursor: pointer;
  }

  .button:hover,
  .button.open {
    background: #244a38;
  }

  .bubble {
    position: absolute;
    top: 54px;
    right: 0;
    width: 252px;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--panel);
    box-shadow: 0 6px 22px rgba(31, 42, 36, 0.3);
  }

  /* The arrow of the bubble, under the button. */
  .bubble::before {
    content: "";
    position: absolute;
    top: -7px;
    right: 15px;
    width: 12px;
    height: 12px;
    border-top: 1px solid var(--border);
    border-left: 1px solid var(--border);
    background: var(--panel);
    transform: rotate(45deg);
  }

  .name {
    margin: 0;
    font-family: var(--font-title);
    font-size: 16px;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .email {
    margin: 2px 0 12px;
    color: var(--muted);
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .actions button {
    min-height: 36px;
    border-radius: 8px;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    /* a slight bevel, like the map buttons */
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.18);
  }

  .secondary {
    border: 1px solid var(--border);
    background: #fff;
    color: var(--text);
  }

  .secondary:hover {
    background: var(--accent-soft);
  }

  .primary {
    border: none;
    background: var(--accent);
    color: #fff;
  }

  .primary:hover {
    background: #244a38;
  }
</style>
