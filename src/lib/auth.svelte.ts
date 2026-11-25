/**
 * Who is logged in, and everything that changes it (sign up, log in, log out,
 * forgotten password, profile, account deletion).
 *
 * Supabase does the real work (password storage, tokens, e-mails). This file
 * only wraps it so the interface can stay simple:
 *
 * - ``auth.ready`` becomes true once the browser has been asked whether a
 *   session is already saved (so the login screen does not flash by);
 * - ``auth.user`` is the logged-in person, or ``null``;
 * - each action returns a short message in French when it fails, ``null``
 *   when it worked.
 */

import type { AuthError, Session, User } from "@supabase/supabase-js";
import type { HomeAddress } from "./drive";
import { connection } from "./online.svelte.js";
import { AUTH_STORAGE_KEY, supabase } from "./supabase";

/** Smallest password length accepted by the interface. */
export const MIN_PASSWORD_LENGTH = 8;

/** What a new password must contain, in words (shown next to the "?" help). */
export const PASSWORD_RULE =
  `Au moins ${MIN_PASSWORD_LENGTH} caractères, avec au moins une minuscule, une majuscule et un chiffre.`;

/**
 * Check a new password against the rule above.
 *
 * Supabase applies its own rule too (set in its dashboard, under Authentication,
 * Email): this check only gives the answer at once, without a round trip.
 *
 * Parameters
 * ----------
 * password : str
 *     The password typed by the person.
 *
 * Returns
 * -------
 * str or None
 *     A message in French if the password is too weak, ``null`` if it is fine.
 */
export function passwordProblem(password: string): string | null {
  const ok =
    password.length >= MIN_PASSWORD_LENGTH &&
    /[a-zà-ÿ]/.test(password) &&
    /[A-ZÀ-Þ]/.test(password) &&
    /[0-9]/.test(password);
  return ok ? null : `Mot de passe trop faible. ${PASSWORD_RULE}`;
}

/** Where e-mail links bring the user back: this very page, whatever the host. */
function appUrl(): string {
  return location.origin + location.pathname;
}

/**
 * Turn an error of Supabase (in English) into a message for the screen.
 *
 * Parameters
 * ----------
 * error : AuthError or Error
 *     What Supabase answered.
 *
 * Returns
 * -------
 * str
 *     A sentence in French.
 */
function explain(error: AuthError | Error): string {
  const message = error.message.toLowerCase();
  if (message.includes("invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (message.includes("already registered")) return "Un compte existe déjà avec cet e-mail.";
  // A refusal by the invitation-code rule reaches us under this generic wording.
  if (message.includes("database error saving new user") || message.includes("invitation")) {
    return "Code d'invitation invalide.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Trop de tentatives. Réessaie dans quelques minutes.";
  }
  if (message.includes("different from the old")) return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (message.includes("password")) return `Mot de passe trop faible. ${PASSWORD_RULE}`;
  if (message.includes("not confirmed")) return "Adresse e-mail pas encore confirmée : vérifie ta boîte mail.";
  if (message.includes("invalid email") || message.includes("valid email")) return "Adresse e-mail invalide.";
  if (message.includes("fetch") || message.includes("network")) return "Pas de connexion à internet.";
  return "Une erreur est survenue. Réessaie dans un instant.";
}

/**
 * The session the browser has saved, read without any network.
 *
 * Supabase, at start-up, tries to renew an expired session and retries for a
 * long time when there is no network: the app would wait on a spinner. Without
 * network the saved session is used as it is, which is enough to read the
 * parcours downloaded for offline use.
 */
function readSavedSession(): Session | null {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "null");
    return saved?.user && saved?.access_token ? (saved as Session) : null;
  } catch {
    return null;
  }
}

/** Result of an action: an error message, or nothing if it worked. */
export type Outcome = { error: string; notice?: undefined } | { error: null; notice?: string };

/** The home address kept in the account, if it looks right. */
function readHome(value: unknown): HomeAddress | null {
  const home = value as Partial<HomeAddress> | null | undefined;
  if (home && typeof home.label === "string" && typeof home.lon === "number" && typeof home.lat === "number") {
    return { label: home.label, lon: home.lon, lat: home.lat };
  }
  return null;
}

class Auth {
  /** False until the browser has answered "is there a saved session?". */
  ready = $state(false);
  session = $state.raw<Session | null>(null);
  /** True when the person came back from a "forgotten password" e-mail. */
  recovery = $state(false);

  user = $derived<User | null>(this.session?.user ?? null);
  firstName = $derived<string>(String(this.user?.user_metadata?.first_name ?? ""));
  lastName = $derived<string>(String(this.user?.user_metadata?.last_name ?? ""));
  email = $derived<string>(this.user?.email ?? "");
  /** The home address chosen in the profile (for the time by car), or ``null``. */
  home = $derived<HomeAddress | null>(readHome(this.user?.user_metadata?.home));

  /** "First Last", or the part of the e-mail before "@" if no name was given. */
  displayName = $derived<string>(
    `${this.firstName} ${this.lastName}`.trim() ||
      String(this.user?.user_metadata?.full_name ?? "") ||
      this.email.split("@")[0],
  );

  constructor() {
    // No network: do not wait for Supabase, use the saved session right away.
    const saved = connection.online ? null : readSavedSession();
    if (saved) {
      this.session = saved;
      this.ready = true;
    }
    // Called once at start-up, then at every change. Keep it free of any other
    // call to Supabase (it could block); it only records what happened.
    supabase.auth.onAuthStateChange((event, session) => {
      // Offline, Supabase may end its start-up with "nobody": keep the saved session.
      if (!session && event === "INITIAL_SESSION" && !connection.online && this.session) return;
      this.session = session;
      if (event === "PASSWORD_RECOVERY") this.recovery = true;
      if (event === "SIGNED_OUT") this.recovery = false;
      this.ready = true;
    });
  }

  /** Log in with an e-mail and a password. */
  async signIn(email: string, password: string): Promise<Outcome> {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: explain(error) } : { error: null };
  }

  /**
   * Create an account. The invitation code is checked by the database: a wrong
   * code makes the sign-up fail.
   */
  async signUp(
    fields: { firstName: string; lastName: string; email: string; password: string; code: string },
  ): Promise<Outcome> {
    const { data, error } = await supabase.auth.signUp({
      email: fields.email.trim(),
      password: fields.password,
      options: {
        emailRedirectTo: appUrl(),
        data: {
          first_name: fields.firstName.trim(),
          last_name: fields.lastName.trim(),
          invitation_code: fields.code.trim(),
        },
      },
    });
    if (error) return { error: explain(error) };
    // With "confirm e-mail" on, there is no session yet: the person must click the mail.
    if (!data.session) return { error: null, notice: "Compte créé. Vérifie ta boîte mail pour confirmer ton adresse." };
    return { error: null };
  }

  /** Send an e-mail with a link to choose a new password. */
  async sendResetLink(email: string): Promise<Outcome> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
    if (error) return { error: explain(error) };
    return { error: null, notice: "Si un compte existe avec cet e-mail, un lien de réinitialisation vient d'être envoyé." };
  }

  /** Choose a new password (after the e-mail link, or from the profile). */
  async changePassword(password: string): Promise<Outcome> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: explain(error) };
    this.recovery = false;
    return { error: null };
  }

  /** Save the first and last name. */
  async changeName(firstName: string, lastName: string): Promise<Outcome> {
    const { error } = await supabase.auth.updateUser({
      data: { first_name: firstName.trim(), last_name: lastName.trim() },
    });
    return error ? { error: explain(error) } : { error: null };
  }

  /** Save the home address (picked from the suggestions), or remove it with ``null``. */
  async changeHome(home: HomeAddress | null): Promise<Outcome> {
    const { error } = await supabase.auth.updateUser({ data: { home } });
    return error ? { error: explain(error) } : { error: null };
  }

  /** Log out on this device. */
  async signOut(): Promise<void> {
    await supabase.auth.signOut({ scope: "local" });
  }

  /** Delete the account and everything saved in it, for good. */
  async deleteAccount(): Promise<Outcome> {
    const { error } = await supabase.rpc("delete_my_account");
    if (error) return { error: explain(error) };
    await supabase.auth.signOut({ scope: "local" });
    return { error: null };
  }
}

/** The login state shared by all components. */
export const auth = new Auth();
