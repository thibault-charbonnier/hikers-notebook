/** Number formatting for the interface (French conventions). */

const oneDecimal = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/**
 * Format a distance: meters below 1 km, kilometers above.
 *
 * Parameters
 * ----------
 * meters : float
 *     The distance in meters.
 *
 * Returns
 * -------
 * str
 *     For example ``"850 m"`` or ``"12,4 km"``.
 */
export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${integer.format(meters)} m`
    : `${oneDecimal.format(meters / 1000)} km`;
}

/**
 * Format a date for display.
 *
 * Parameters
 * ----------
 * isoDate : str
 *     A date as ``YYYY-MM-DD``.
 *
 * Returns
 * -------
 * str
 *     For example ``"12/09/2026"``.
 */
export function formatDate(isoDate: string): string {
  // Noon avoids a one-day shift in some time zones.
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("fr-FR");
}

/**
 * Format a whole number of meters (elevation, ascent).
 *
 * Parameters
 * ----------
 * meters : float
 *     The value in meters.
 *
 * Returns
 * -------
 * str
 *     For example ``"1 234 m"``.
 */
export function formatMeters(meters: number): string {
  return `${integer.format(meters)} m`;
}
