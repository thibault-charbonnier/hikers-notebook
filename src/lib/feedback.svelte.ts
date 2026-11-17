/**
 * The standard message window of the app: one place that shows either a piece
 * of information ("not available yet") or a problem ("could not save").
 *
 * Any button that talks to the database or the network calls
 * ``feedback.problem("save the parcours", error)`` when it fails, so the app
 * never crashes silently and the person always gets the same clear window.
 * ``installGlobalErrorHandlers`` adds a safety net for every other failure
 * nobody thought about.
 */

import { connection } from "./online.svelte.js";

export interface Message {
  kind: "info" | "error";
  title: string;
  text: string;
  /** Technical details of an error, shown on demand. */
  detail?: string;
}

/** Turn whatever was thrown into a short text, or nothing. */
function describe(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return undefined;
}

class Feedback {
  current = $state.raw<Message | null>(null);

  /** Show a piece of information. */
  info(title: string, text: string): void {
    this.current = { kind: "info", title, text };
  }

  /**
   * Show that something failed.
   *
   * Parameters
   * ----------
   * action : str
   *     What was being done, as it completes "Impossible de ..." (for example
   *     ``"enregistrer le parcours"``).
   * error : unknown
   *     What was thrown, if known (kept as technical details).
   * cause : str
   *     ``"network"`` (the default: the server or the connection) or
   *     ``"unexpected"`` (a mistake in the app itself), which changes the advice given.
   */
  problem(action: string, error?: unknown, cause: "network" | "unexpected" = "network"): void {
    console.error(`Failed to ${action}`, error);
    // One window at a time: a second failure behind the first adds nothing.
    if (this.current?.kind === "error") return;
    const reason =
      cause === "unexpected"
        ? "Une erreur inattendue s'est produite. Recharge la page, puis réessaie."
        : connection.online
          ? "Le serveur n'a pas répondu comme prévu. Réessaie dans un instant."
          : "Tu n'as pas de connexion à internet. Reconnecte-toi, puis réessaie.";
    this.current = {
      kind: "error",
      title: "Un problème est survenu",
      text: `Impossible de ${action}. ${reason}`,
      detail: describe(error),
    };
  }

  close(): void {
    this.current = null;
  }
}

/** The message window shared by the whole app. */
export const feedback = new Feedback();

/** Failures that are normal and must not bother anybody (a cancelled request, a layout notice). */
function isHarmless(reason: unknown): boolean {
  const text = describe(reason) ?? "";
  return (
    (reason instanceof DOMException && reason.name === "AbortError") ||
    /abort|ResizeObserver|Script error/i.test(text)
  );
}

/**
 * Show the message window for any failure that was not handled where it
 * happened (a promise nobody waited for, an unexpected error).
 */
export function installGlobalErrorHandlers(): void {
  window.addEventListener("unhandledrejection", (event) => {
    if (isHarmless(event.reason)) return;
    feedback.problem("terminer cette action", event.reason, "unexpected");
  });
  window.addEventListener("error", (event) => {
    if (isHarmless(event.error ?? event.message)) return;
    feedback.problem("terminer cette action", event.error ?? event.message, "unexpected");
  });
}
