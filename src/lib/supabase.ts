/**
 * The connection to Supabase (accounts and, later, saved parcours).
 *
 * Both values below are meant to be public: they are written in the code of
 * every website that uses Supabase. They do not give access to anything by
 * themselves: what each person can read or change is decided by the database
 * rules (Row Level Security), not by hiding these values.
 * The secret "service_role" key must never appear in this project.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hhmxszygztfjegwmawbx.supabase.co";
/**
 * Where the browser keeps the session (the same name Supabase would choose by itself:
 * ``sb-<project>-auth-token``). It is written out so ``auth.svelte.ts`` can read the
 * saved session without waiting for the network.
 */
export const AUTH_STORAGE_KEY = "sb-hhmxszygztfjegwmawbx-auth-token";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_G6McmWBuWWuQX0Z1K0hr3w_4RHq7iiA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // The session (a small token) is kept in the browser and renewed by itself,
    // so nobody has to log in again at each visit.
    persistSession: true,
    storageKey: AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    // "pkce" brings the user back from an e-mail link with "?code=..." in the
    // address. The default way would use "#access_token=...", which would
    // collide with the "#/hike" addresses used to move between pages.
    flowType: "pkce",
    detectSessionInUrl: true,
  },
});
