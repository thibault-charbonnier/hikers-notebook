/**
 * Calendar dates as ``YYYY-MM-DD`` texts, in French time.
 *
 * Weather and sun times are given per day, in the time of the place (France),
 * whatever the time zone of the computer.
 */

const TIME_ZONE = "Europe/Paris";

/** Noon UTC of a date: far from midnight, so adding days never skips a date. */
const noon = (iso: string) => new Date(`${iso}T12:00:00Z`);

/**
 * Give today's date in France.
 *
 * Returns
 * -------
 * str
 *     For example ``"2026-11-16"``.
 */
export function todayIso(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TIME_ZONE });
}

/**
 * Add days to a date.
 *
 * Parameters
 * ----------
 * iso : str
 *     A date as ``YYYY-MM-DD``.
 * days : int
 *     Number of days to add (negative to go back).
 *
 * Returns
 * -------
 * str
 *     The new date.
 */
export function addDays(iso: string, days: number): string {
  const date = noon(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Number of days from ``from`` to ``to`` (both ``YYYY-MM-DD``). */
export function daysBetween(from: string, to: string): number {
  return Math.round((noon(to).getTime() - noon(from).getTime()) / 86_400_000);
}

/**
 * Format a date for display.
 *
 * Parameters
 * ----------
 * iso : str
 *     A date as ``YYYY-MM-DD``.
 * style : {"long", "short"}
 *     ``"long"``: "lundi 17 novembre"; ``"short"``: "lun. 17 nov.".
 *
 * Returns
 * -------
 * str
 *     The date in French.
 */
export function formatDay(iso: string, style: "long" | "short" = "long"): string {
  return noon(iso).toLocaleDateString("fr-FR", {
    weekday: style,
    day: "numeric",
    month: style,
    timeZone: TIME_ZONE,
  });
}

/**
 * Format a time of day in French time.
 *
 * Parameters
 * ----------
 * date : Date
 *     An instant.
 *
 * Returns
 * -------
 * str
 *     For example ``"07:36"``.
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
}

/** Minutes since midnight, in French time, of an instant. */
export function minutesOfDay(date: Date): number {
  const [hours, minutes] = formatTime(date).split(":").map(Number);
  return hours * 60 + minutes;
}
