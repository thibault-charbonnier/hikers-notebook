/**
 * Conversions between the hex colours the app stores (``#RRGGBB``) and the
 * hue / saturation / value model a colour picker works with:
 *
 * - hue: the position on the colour wheel, 0 to 360 degrees;
 * - saturation: from grey (0) to vivid (1);
 * - value: from black (0) to bright (1).
 */

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

/** True for a complete ``#RRGGBB`` colour. */
export function isHex(text: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(text);
}

/**
 * Convert ``#RRGGBB`` to hue, saturation and value.
 *
 * Parameters
 * ----------
 * hex : str
 *     A valid ``#RRGGBB`` colour.
 *
 * Returns
 * -------
 * Hsv
 *     ``h`` in degrees (0 to 360), ``s`` and ``v`` from 0 to 1.
 */
export function hexToHsv(hex: string): Hsv {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

/**
 * Convert hue, saturation and value to ``#RRGGBB``.
 *
 * Parameters
 * ----------
 * h, s, v : float
 *     Hue in degrees, saturation and value from 0 to 1.
 *
 * Returns
 * -------
 * str
 *     The colour as ``#RRGGBB`` (upper case).
 */
export function hsvToHex(h: number, s: number, v: number): string {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(channel(5))}${hex(channel(3))}${hex(channel(1))}`.toUpperCase();
}
