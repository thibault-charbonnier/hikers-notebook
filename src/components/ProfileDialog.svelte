<!--
  "Modifier le profil": change the name, the home address (for the time by car
  to the parcours), or the password, or delete the account.
  Deleting asks for a confirmation first, since everything saved goes with it.
-->
<script lang="ts">
  import { auth, PASSWORD_RULE, passwordProblem } from "../lib/auth.svelte.js";
  import type { HomeAddress } from "../lib/drive";
  import AddressField from "./AddressField.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  let { onclose }: { onclose: () => void } = $props();

  let firstName = $state(auth.firstName);
  let lastName = $state(auth.lastName);
  let password = $state("");

  /** The address picked from the suggestions, ``null`` while none is (or it is being retyped). */
  let pickedHome = $state<HomeAddress | null>(auth.home);
  let homeMessage = $state<{ ok: boolean; text: string } | null>(null);
  let nameMessage = $state<{ ok: boolean; text: string } | null>(null);
  let passwordMessage = $state<{ ok: boolean; text: string } | null>(null);
  let deleteError = $state<string | null>(null);
  let confirmingDelete = $state(false);
  let busy = $state(false);

  async function saveName(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      nameMessage = { ok: false, text: "Renseigne ton prénom et ton nom." };
      return;
    }
    busy = true;
    const outcome = await auth.changeName(firstName, lastName);
    busy = false;
    nameMessage = outcome.error ? { ok: false, text: outcome.error } : { ok: true, text: "Nom enregistré." };
  }

  async function saveHome(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!pickedHome) {
      homeMessage = { ok: false, text: "Choisis une adresse dans la liste qui s'affiche quand tu tapes." };
      return;
    }
    busy = true;
    const outcome = await auth.changeHome(pickedHome);
    busy = false;
    homeMessage = outcome.error ? { ok: false, text: outcome.error } : { ok: true, text: "Adresse enregistrée. Les temps de trajet se calculent." };
  }

  async function removeHome(): Promise<void> {
    busy = true;
    const outcome = await auth.changeHome(null);
    busy = false;
    if (!outcome.error) {
      pickedHome = null;
      homeMessage = { ok: true, text: "Adresse supprimée." };
    } else homeMessage = { ok: false, text: outcome.error };
  }

  async function savePassword(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const problem = passwordProblem(password);
    if (problem) {
      passwordMessage = { ok: false, text: problem };
      return;
    }
    busy = true;
    const outcome = await auth.changePassword(password);
    busy = false;
    passwordMessage = outcome.error ? { ok: false, text: outcome.error } : { ok: true, text: "Mot de passe modifié." };
    if (!outcome.error) password = "";
  }

  async function deleteAccount(): Promise<void> {
    busy = true;
    const outcome = await auth.deleteAccount();
    busy = false;
    confirmingDelete = false;
    // On success the person is logged out and this dialog disappears with the app.
    deleteError = outcome.error;
  }
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && !confirmingDelete && onclose()} />

<div
  class="backdrop"
  role="presentation"
  onclick={(event) => {
    if (event.target === event.currentTarget) onclose();
  }}
>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title">
    <header>
      <h2 id="profile-title">Mon profil</h2>
      <button type="button" class="close" aria-label="Fermer" onclick={onclose}>×</button>
    </header>

    <form onsubmit={saveName} novalidate>
      <div class="row">
        <label>
          Prénom
          <input type="text" bind:value={firstName} autocomplete="given-name" />
        </label>
        <label>
          Nom
          <input type="text" bind:value={lastName} autocomplete="family-name" />
        </label>
      </div>
      <label>
        Adresse e-mail
        <input type="email" value={auth.email} disabled />
      </label>
      {#if nameMessage}<p class="message" class:error={!nameMessage.ok}>{nameMessage.text}</p>{/if}
      <button type="submit" class="save" disabled={busy}>Enregistrer le nom</button>
    </form>

    <form onsubmit={saveHome} novalidate>
      <h3>Adresse du domicile</h3>
      <p>
        Sert à calculer le temps de trajet en voiture jusqu'aux parcours. Elle reste dans ton compte ; seule sa position est
        envoyée au service de calcul de l'IGN.
      </p>
      {#key auth.home?.label}
        <AddressField initial={auth.home} onpick={(address) => (pickedHome = address)} />
      {/key}
      {#if homeMessage}<p class="message" class:error={!homeMessage.ok}>{homeMessage.text}</p>{/if}
      <button type="submit" class="save" disabled={busy || !pickedHome || pickedHome.label === auth.home?.label}>Enregistrer l'adresse</button>
      {#if auth.home}
        <button type="button" class="link" disabled={busy} onclick={removeHome}>Supprimer l'adresse</button>
      {/if}
    </form>

    <form onsubmit={savePassword} novalidate>
      <h3>Mot de passe</h3>
      <label>
        Nouveau mot de passe
        <input type="password" bind:value={password} autocomplete="new-password" />
      </label>
      <p>{PASSWORD_RULE}</p>
      {#if passwordMessage}<p class="message" class:error={!passwordMessage.ok}>{passwordMessage.text}</p>{/if}
      <button type="submit" class="save" disabled={busy}>Changer le mot de passe</button>
    </form>

    <section class="danger-zone">
      <h3>Supprimer mon compte</h3>
      <p>Le compte et tous les parcours enregistrés sont effacés définitivement.</p>
      {#if deleteError}<p class="message error">{deleteError}</p>{/if}
      <button type="button" class="delete" disabled={busy} onclick={() => (confirmingDelete = true)}>
        Supprimer mon compte
      </button>
    </section>
  </div>
</div>

{#if confirmingDelete}
  <ConfirmDialog
    title="Supprimer le compte ?"
    message="Ton compte et tous tes parcours seront effacés pour toujours. Il n'y a pas de retour en arrière."
    confirmLabel="Supprimer définitivement"
    onconfirm={deleteAccount}
    oncancel={() => (confirmingDelete = false)}
  />
{/if}

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
    width: min(420px, 100%);
    max-height: 100%;
    overflow-y: auto;
    padding: 20px 22px 22px;
    background: var(--panel);
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  h2 {
    margin: 0;
    font-family: var(--font-title);
    font-size: 20px;
  }

  h3 {
    margin: 0;
    font-family: var(--font-title);
    font-size: 15px;
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

  .close:hover {
    background: var(--accent-soft);
  }

  form,
  .danger-zone {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 16px;
    margin-top: 16px;
    border-top: 1px solid var(--border);
  }

  form:first-of-type {
    padding-top: 0;
    margin-top: 0;
    border-top: none;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
  }

  input {
    width: 100%;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: #fff;
    color: var(--text);
    font: inherit;
    font-size: 16px;
    font-weight: 400;
  }

  input:disabled {
    background: #efece2;
    color: var(--muted);
  }

  input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }

  .message {
    margin: 0;
    padding: 8px 12px;
    border-radius: 9px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 13px;
  }

  .message.error {
    background: #fbe9e6;
    color: #9c2a1c;
  }

  p {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.45;
  }

  .save,
  .delete {
    min-height: 40px;
    border-radius: 10px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .save {
    border: none;
    background: var(--accent);
    color: #fff;
  }

  .link {
    align-self: flex-start;
    padding: 2px 0;
    border: none;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 13px;
    text-decoration: underline;
    cursor: pointer;
  }

  .delete {
    border: 1px solid #c0392b;
    background: #fff;
    color: #c0392b;
  }

  .delete:hover {
    background: #fbe9e6;
  }

  button:disabled {
    opacity: 0.6;
    cursor: progress;
  }
</style>
