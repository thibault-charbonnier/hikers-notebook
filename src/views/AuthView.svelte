<!--
  Login screen: shown instead of the app while nobody is logged in.

  On a computer the overview map of France fills the background (without any
  parcours, only to look nice) and the form floats above it in a tall card that
  can be moved by its top part, to see the landscape behind. On a phone the
  card simply fills the screen.

  The card has four faces:
  - "login" and "signup": the two tabs;
  - "forgot": asks for the e-mail address to send a reset link to;
  - "recovery": chosen automatically when the person comes back from that link,
    to pick a new password.
-->
<script lang="ts">
  import type { Map as MapLibreMap } from "maplibre-gl";
  import { onMount } from "svelte";
  import HelpTip from "../components/HelpTip.svelte";
  import { auth, PASSWORD_RULE, passwordProblem } from "../lib/auth.svelte.js";
  import { createMap } from "../lib/map";
  import { homeStyle } from "../lib/mapStyles";
  import { viewport } from "../lib/viewport.svelte.js";

  type Mode = "login" | "signup" | "forgot";

  let mode = $state<Mode>("login");
  const face = $derived<Mode | "recovery">(auth.recovery ? "recovery" : mode);

  let firstName = $state("");
  let lastName = $state("");
  let email = $state("");
  let password = $state("");
  let code = $state("");
  let showPassword = $state(false);

  let busy = $state(false);
  let error = $state<string | null>(null);
  let notice = $state<string | null>(null);

  function switchTo(next: Mode): void {
    mode = next;
    error = null;
    notice = null;
  }

  /** Check the fields of the current face, and return an error message if one is wrong. */
  function validate(): string | null {
    if (face === "signup" && (!firstName.trim() || !lastName.trim())) return "Renseigne ton prénom et ton nom.";
    if (!email.trim() && face !== "recovery") return "Renseigne ton adresse e-mail.";
    if (face === "forgot") return null;
    if (face === "login" && !password) return "Renseigne ton mot de passe.";
    if (face !== "login") {
      const problem = passwordProblem(password);
      if (problem) return problem;
    }
    if (face === "signup" && !code.trim()) return "Renseigne le code d'invitation.";
    return null;
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    error = validate();
    notice = null;
    if (error) return;

    busy = true;
    const outcome =
      face === "login"
        ? await auth.signIn(email, password)
        : face === "signup"
          ? await auth.signUp({ firstName, lastName, email, password, code })
          : face === "forgot"
            ? await auth.sendResetLink(email)
            : await auth.changePassword(password);
    busy = false;

    error = outcome.error;
    if (!outcome.error && outcome.notice) notice = outcome.notice;
    if (!outcome.error) password = "";
  }

  // ----- Background map and movable card -----

  let mapContainer = $state<HTMLDivElement>();
  let backgroundMap: MapLibreMap | undefined;

  onMount(() => {
    // The map is for decoration: it cannot be moved, and it is not drawn on a phone.
    if (viewport.phone || !mapContainer) return;
    backgroundMap = createMap(mapContainer, { style: homeStyle(), maxZoom: 9, interactive: false }, null);
    return () => backgroundMap?.remove();
  });

  let offset = $state({ x: 0, y: 0 });
  let drag: { startX: number; startY: number; from: { x: number; y: number } } | null = null;

  function startDrag(event: PointerEvent): void {
    if (viewport.phone) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag = { startX: event.clientX, startY: event.clientY, from: { ...offset } };
  }

  function moveDrag(event: PointerEvent): void {
    if (!drag) return;
    // Keep the card inside the window: it can go as far as the edges, not beyond.
    const limitX = Math.max(0, (innerWidth - 380) / 2 - 8);
    const limitY = Math.max(0, innerHeight / 2 - 120);
    offset = {
      x: Math.min(limitX, Math.max(-limitX, drag.from.x + event.clientX - drag.startX)),
      y: Math.min(limitY, Math.max(-limitY, drag.from.y + event.clientY - drag.startY)),
    };
  }

  const endDrag = (): void => {
    drag = null;
  };
</script>

<!-- The red "(*)" that marks a required field. -->
{#snippet star()}<span class="star" aria-hidden="true">(*)</span>{/snippet}

{#if !viewport.phone}
  <div class="map" bind:this={mapContainer}></div>
{/if}

<div class="stage">
  <div class="card" style:transform="translate({offset.x}px, {offset.y}px)">
    <!-- Dragging with the mouse or a finger is an extra: nothing depends on it. -->
    <header
      class="brand"
      role="presentation"
      class:movable={!viewport.phone}
      onpointerdown={startDrag}
      onpointermove={moveDrag}
      onpointerup={endDrag}
      onpointercancel={endDrag}
    >
      <svg width="34" height="34" viewBox="0 0 28 28" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 23 L11 9 L16 17 L19 12 L25 23 Z" />
      </svg>
      <h1>Hiker's Notebook</h1>
      <p>Prépare tes randonnées, retrouve-les partout.</p>
    </header>

    <div class="body">
      {#if face === "login" || face === "signup"}
        <div class="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={face === "login"} class:active={face === "login"} onclick={() => switchTo("login")}>
            Connexion
          </button>
          <button type="button" role="tab" aria-selected={face === "signup"} class:active={face === "signup"} onclick={() => switchTo("signup")}>
            Inscription
          </button>
        </div>
      {:else if face === "forgot"}
        <h2>Mot de passe oublié</h2>
        <p class="hint">Indique ton adresse e-mail : tu recevras un lien pour choisir un nouveau mot de passe.</p>
      {:else}
        <h2>Nouveau mot de passe</h2>
        <p class="hint">Choisis un nouveau mot de passe pour ton compte.</p>
      {/if}

      <form onsubmit={submit} novalidate>
        {#if face === "signup"}
          <div class="row">
            <label>
              <span class="caption">Prénom {@render star()}</span>
              <input type="text" bind:value={firstName} autocomplete="given-name" aria-required="true" />
            </label>
            <label>
              <span class="caption">Nom {@render star()}</span>
              <input type="text" bind:value={lastName} autocomplete="family-name" aria-required="true" />
            </label>
          </div>
        {/if}

        {#if face !== "recovery"}
          <label>
            <span class="caption">Adresse e-mail {#if face === "signup"}{@render star()}{/if}</span>
            <input type="email" bind:value={email} autocomplete="email" inputmode="email" aria-required="true" />
          </label>
        {/if}

        {#if face !== "forgot"}
          <label>
            <span class="caption">
              {face === "recovery" ? "Nouveau mot de passe" : "Mot de passe"}
              {#if face !== "login"}
                {@render star()}
                <HelpTip label="Règles du mot de passe" text={PASSWORD_RULE} />
              {/if}
            </span>
            <span class="password">
              <input
                type={showPassword ? "text" : "password"}
                bind:value={password}
                autocomplete={face === "login" ? "current-password" : "new-password"}
                aria-required="true"
              />
              <button type="button" class="toggle" onclick={() => (showPassword = !showPassword)}>
                {showPassword ? "Masquer" : "Afficher"}
              </button>
            </span>
          </label>
        {/if}

        {#if face === "signup"}
          <label>
            <span class="caption">
              Code d'invitation {@render star()}
              <HelpTip
                label="À quoi sert le code d'invitation ?"
                text="L'application est en version bêta : pour le moment, un code d'invitation est nécessaire pour créer un compte. Demande-le à la personne qui t'a invité."
              />
            </span>
            <input type="text" bind:value={code} autocomplete="off" autocapitalize="characters" spellcheck="false" aria-required="true" />
          </label>
          <p class="legend">{@render star()} Champ obligatoire</p>
        {/if}

        {#if error}<p class="message error" role="alert">{error}</p>{/if}
        {#if notice}<p class="message notice" role="status">{notice}</p>{/if}

        <button type="submit" class="submit" disabled={busy}>
          {#if busy}<span class="spinner"></span>{/if}
          {face === "login"
            ? "Se connecter"
            : face === "signup"
              ? "Créer mon compte"
              : face === "forgot"
                ? "Envoyer le lien"
                : "Enregistrer le mot de passe"}
        </button>
      </form>

      {#if face === "login"}
        <button type="button" class="link" onclick={() => switchTo("forgot")}>Mot de passe oublié ?</button>
      {:else if face === "forgot"}
        <button type="button" class="link" onclick={() => switchTo("login")}>← Retour à la connexion</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .map {
    position: fixed;
    inset: 0;
  }

  /* Lets the map show through around the card. */
  .stage {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    pointer-events: none;
  }

  .card {
    width: min(380px, 100%);
    max-height: 100%;
    overflow-y: auto;
    pointer-events: auto;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 18px;
    box-shadow: 0 14px 44px rgba(31, 42, 36, 0.4);
  }

  .brand {
    padding: 26px 24px 16px;
    text-align: center;
    color: var(--accent);
    touch-action: none; /* dragging must not scroll the page */
    user-select: none;
  }

  .brand.movable {
    cursor: grab;
  }

  .brand.movable:active {
    cursor: grabbing;
  }

  h1 {
    margin: 4px 0 4px;
    color: var(--text);
    font-family: var(--font-title);
    font-size: 24px;
  }

  .brand p {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }

  .body {
    padding: 4px 24px 24px;
  }

  h2 {
    margin: 4px 0 6px;
    font-family: var(--font-title);
    font-size: 19px;
  }

  .hint {
    margin: 0 0 14px;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.45;
  }

  .tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }

  .tabs button {
    min-height: 42px;
    border: none;
    border-bottom: 3px solid transparent;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }

  .tabs button.active {
    border-bottom-color: var(--accent);
    color: var(--accent);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  label {
    position: relative; /* the help bubbles are as wide as their field */
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
  }

  .caption {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }

  .star {
    color: #c0392b;
    font-weight: 700;
  }

  .legend {
    margin: -4px 0 0;
    color: var(--muted);
    font-size: 12px;
  }

  input {
    width: 100%;
    min-height: 42px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: #fff;
    color: var(--text);
    font: inherit;
    font-size: 16px; /* 16 px keeps phones from zooming into the field */
    font-weight: 400;
  }

  input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }

  .password {
    position: relative;
    display: block;
  }

  .password input {
    padding-right: 84px;
  }

  .toggle {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    padding: 0 12px;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .message {
    margin: 0;
    padding: 9px 12px;
    border-radius: 9px;
    font-size: 13px;
    line-height: 1.4;
  }

  .error {
    background: #fbe9e6;
    color: #9c2a1c;
  }

  .notice {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .submit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 46px;
    border: none;
    border-radius: 10px;
    background: var(--accent);
    color: #fff;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }

  .submit:hover:not(:disabled) {
    background: #244a38;
  }

  .submit:disabled {
    opacity: 0.7;
    cursor: progress;
  }

  .submit .spinner {
    border-color: rgba(255, 255, 255, 0.35);
    border-top-color: #fff;
  }

  .link {
    display: block;
    margin: 14px auto 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  /* Phone: the card is the whole screen. */
  @media (max-width: 720px) {
    .stage {
      padding: 0;
      background: var(--bg);
      overflow-y: auto;
      align-items: flex-start;
    }

    .card {
      width: 100%;
      max-height: none;
      min-height: 100%;
      border: none;
      border-radius: 0;
      box-shadow: none;
    }
  }
</style>
