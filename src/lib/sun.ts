/**
 * Sunrise and sunset, computed on the device (no network needed).
 *
 * The calculation only needs the date and the position, with the SunCalc
 * library. The first and last light (civil twilight) are also given: on a
 * hike they tell how long it is possible to walk without a headlamp.
 */

import { getTimes } from "suncalc";
import { minutesOfDay } from "./dates";

/** A day and a place to compute the sun times for, with a title for display (for example "Jour 2"). */
export interface SunPlace {
  title: string;
  date: string;
  lat: number;
  lon: number;
}

/** Sun times of one day at one place. Times are minutes since midnight, in French time. */
export interface SunDay {
  /** First light: the sun is 6 degrees below the horizon. */
  dawn: Date;
  sunrise: Date;
  sunset: Date;
  /** Last light. */
  dusk: Date;
  /** Minutes between sunrise and sunset. */
  daylightMinutes: number;
  /** The same four moments, as minutes since midnight. */
  minutes: { dawn: number; sunrise: number; sunset: number; dusk: number };
}

/** The library gives ``null`` where the sun never rises or sets (polar regions): not the case in France. */
function moment(date: Date | null): Date {
  if (!date) throw new Error("The sun does not rise or set here at this date");
  return date;
}

/**
 * Compute the sun times of a day.
 *
 * Parameters
 * ----------
 * date : str
 *     The day, as ``YYYY-MM-DD``.
 * lat, lon : float
 *     Position in degrees.
 *
 * Returns
 * -------
 * SunDay
 *     The times of dawn, sunrise, sunset and dusk.
 */
export function sunDay(date: string, lat: number, lon: number): SunDay {
  // Around noon French time, so the calculation targets the right day.
  const times = getTimes(new Date(`${date}T11:00:00Z`), lat, lon);
  const dawn = moment(times.dawn);
  const sunrise = moment(times.sunrise);
  const sunset = moment(times.sunset);
  const dusk = moment(times.dusk);
  return {
    dawn,
    sunrise,
    sunset,
    dusk,
    daylightMinutes: Math.round((sunset.getTime() - sunrise.getTime()) / 60_000),
    minutes: {
      dawn: minutesOfDay(dawn),
      sunrise: minutesOfDay(sunrise),
      sunset: minutesOfDay(sunset),
      dusk: minutesOfDay(dusk),
    },
  };
}

/**
 * Format a length of time.
 *
 * Parameters
 * ----------
 * minutes : int
 *     A number of minutes.
 *
 * Returns
 * -------
 * str
 *     For example ``"9 h 14"``.
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes - hours * 60).padStart(2, "0")}`;
}
