<!--
  What happens when a share link is opened (address ``#/shared/<token>``) by
  someone who is logged in: a copy of the parcours is made in their account,
  then it is opened. A small card says so while it works.

  Whoever is not logged in sees the login screen first (App.svelte keeps the
  link and brings them back here once they are in).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { feedback } from "../lib/feedback.svelte.js";
  import { hike } from "../lib/hike.svelte.js";
  import { library } from "../lib/library.svelte.js";
  import { connection } from "../lib/online.svelte.js";
  import { InvalidShareLink, pendingShare, receiveShared } from "../lib/sharing";

  let { token }: { token: string } = $props();

  onMount(async () => {
    if (!connection.online) {
      pendingShare.clear();
      feedback.info("Hors réseau", "Il faut du réseau pour recevoir un parcours partagé. Rouvre le lien quand tu es connecté.");
      location.hash = "#/";
      return;
    }
    try {
      const id = await receiveShared(token);
      pendingShare.clear();
      await library.refresh();
      location.hash = `#/hike/${id}`;
      // The page of the parcours has just opened: its small message says what happened.
      setTimeout(() => hike.notify("Parcours ajouté à tes « Parcours partagés ».", "success"), 1800);
    } catch (error) {
      pendingShare.clear();
      location.hash = "#/";
      if (error instanceof InvalidShareLink) {
        feedback.info("Lien invalide", "Ce lien de partage n'est pas valide. Vérifie qu'il est complet.");
      } else {
        feedback.problem("recevoir le parcours partagé", error);
      }
    }
  });
</script>

<div class="card" role="status">
  <span class="spinner"></span>
  Réception du parcours partagé…
</div>

<style>
  .card {
    position: absolute;
    top: 24px;
    left: 50%;
    z-index: 30;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--panel);
    box-shadow: 0 6px 22px rgba(31, 42, 36, 0.25);
    font-size: 14px;
    font-weight: 600;
  }
</style>
