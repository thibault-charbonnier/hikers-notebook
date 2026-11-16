/**
 * Weather forecast for one place and one day, from Open-Meteo.
 *
 * Open-Meteo is free (no key, for non-commercial use, generous limits) and
 * gives forecasts up to 15 days ahead. For France it relies on the
 * Météo-France models (AROME, ARPEGE). It is a forecast for the exact
 * coordinates and altitude asked, computed from a model, not a measurement of
 * a weather station.
 *
 * Data: Open-Meteo.com, licence CC BY 4.0 (the credit is shown in the app).
 */

import { daysBetween, todayIso } from "./dates";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 15_000;
const CACHE_MS = 30 * 60 * 1000;

/** Furthest day that can be asked, counted from today (the service goes up to 15). */
export const MAX_DAYS_AHEAD = 14;

/** Water-equivalent: 7 cm of fresh snow is about 10 mm of precipitation. */
const SNOW_CM_PER_MM = 0.7;

const DAILY = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "snowfall_sum",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
];
const HOURLY = ["temperature_2m", "precipitation", "snowfall", "weather_code", "wind_speed_10m"];

/** The weather of one hour. */
export interface HourWeather {
  /** Hour of the day, 0 to 23. */
  hour: number;
  /** Temperature in degrees Celsius. */
  temperature: number;
  /** Rain and snow of the hour, in millimeters of water. */
  rain: number;
  snow: number;
}

/** The weather of one day at one place. */
export interface DayWeather {
  date: string;
  /** WMO weather code (0 clear sky ... 99 thunderstorm). */
  code: number;
  tMax: number;
  tMin: number;
  /** Total precipitation in mm, and snowfall in cm. */
  precipitation: number;
  snowfall: number;
  /** Highest probability of precipitation of the day, in percent. */
  probability: number | null;
  /** Strongest wind and gusts, in km/h. */
  wind: number;
  gusts: number;
  hours: HourWeather[];
  /** Altitude, in meters, the forecast is computed for. */
  elevation: number;
}

/** What WMO weather codes mean, in French, with the matching icon. */
export type WeatherIconName = "sun" | "partly" | "cloud" | "fog" | "rain" | "snow" | "storm";

/**
 * Describe a WMO weather code.
 *
 * Parameters
 * ----------
 * code : int
 *     The code given by the forecast.
 *
 * Returns
 * -------
 * object
 *     ``label``: short French description; ``icon``: icon name.
 */
export function describeWeather(code: number): { label: string; icon: WeatherIconName } {
  if (code === 0) return { label: "Ciel dégagé", icon: "sun" };
  if (code === 1) return { label: "Plutôt dégagé", icon: "sun" };
  if (code === 2) return { label: "Partiellement nuageux", icon: "partly" };
  if (code === 3) return { label: "Couvert", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "Brouillard", icon: "fog" };
  if (code >= 51 && code <= 57) return { label: "Bruine", icon: "rain" };
  if (code === 61 || code === 80) return { label: "Pluie faible", icon: "rain" };
  if (code === 63 || code === 81) return { label: "Pluie", icon: "rain" };
  if (code === 65 || code === 82) return { label: "Forte pluie", icon: "rain" };
  if (code === 66 || code === 67) return { label: "Pluie verglaçante", icon: "rain" };
  if (code === 71 || code === 85) return { label: "Neige faible", icon: "snow" };
  if (code === 73) return { label: "Neige", icon: "snow" };
  if (code === 75 || code === 86) return { label: "Forte neige", icon: "snow" };
  if (code === 77) return { label: "Grains de neige", icon: "snow" };
  if (code >= 95) return { label: "Orage", icon: "storm" };
  return { label: "Variable", icon: "partly" };
}

const cache = new Map<string, { at: number; result: Promise<DayWeather> }>();

/**
 * Check that a day can be forecast.
 *
 * Parameters
 * ----------
 * date : str
 *     A day, as ``YYYY-MM-DD``.
 *
 * Returns
 * -------
 * bool
 *     True from today up to ``MAX_DAYS_AHEAD`` days ahead.
 */
export function isForecastable(date: string): boolean {
  const ahead = daysBetween(todayIso(), date);
  return ahead >= 0 && ahead <= MAX_DAYS_AHEAD + 1;
}

/**
 * Fetch the forecast of one day at one place.
 *
 * Answers are kept for 30 minutes, so going back and forth between days does
 * not ask the service again.
 *
 * Parameters
 * ----------
 * lat, lon : float
 *     Position in degrees.
 * elevation : float or None
 *     Altitude in meters. The temperature is adjusted to it. If ``None`` the
 *     service uses the altitude of its own terrain model.
 * date : str
 *     The day, as ``YYYY-MM-DD`` (from today to about two weeks ahead).
 *
 * Returns
 * -------
 * DayWeather
 *     The forecast.
 *
 * Raises
 * ------
 * Error
 *     If the service is unreachable or refuses the request.
 */
export function fetchDayWeather(lat: number, lon: number, elevation: number | null, date: string): Promise<DayWeather> {
  const key = [lat.toFixed(3), lon.toFixed(3), elevation === null ? "-" : Math.round(elevation), date].join("|");
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.result;

  const result = request(lat, lon, elevation, date);
  cache.set(key, { at: Date.now(), result });
  result.catch(() => cache.delete(key)); // do not remember failures
  return result;
}

async function request(lat: number, lon: number, elevation: number | null, date: string): Promise<DayWeather> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    timezone: "Europe/Paris",
    start_date: date,
    end_date: date,
    wind_speed_unit: "kmh",
    daily: DAILY.join(","),
    hourly: HOURLY.join(","),
  });
  if (elevation !== null) params.set("elevation", String(Math.round(elevation)));

  const response = await fetch(`${FORECAST_URL}?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.reason ?? `Weather service error (HTTP ${response.status})`);
  }
  const data = await response.json();
  const daily = data.daily;
  const hourly = data.hourly;

  const hours: HourWeather[] = hourly.time.map((_: string, i: number) => {
    const snowCm: number = hourly.snowfall[i] ?? 0;
    const snow = snowCm / SNOW_CM_PER_MM; // cm of snow -> mm of water
    const precipitation: number = hourly.precipitation[i] ?? 0;
    return {
      hour: i,
      temperature: hourly.temperature_2m[i] ?? 0,
      snow: Math.min(snow, precipitation),
      rain: Math.max(precipitation - snow, 0),
    };
  });
  return {
    date,
    code: daily.weather_code[0] ?? 0,
    tMax: daily.temperature_2m_max[0],
    tMin: daily.temperature_2m_min[0],
    precipitation: daily.precipitation_sum[0] ?? 0,
    snowfall: daily.snowfall_sum[0] ?? 0,
    probability: daily.precipitation_probability_max?.[0] ?? null,
    wind: daily.wind_speed_10m_max[0] ?? 0,
    gusts: daily.wind_gusts_10m_max[0] ?? 0,
    hours,
    elevation: data.elevation,
  };
}
