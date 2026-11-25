/**
 * Which way the phone is facing, from its compass sensor (like the arrow of
 * Google Maps). Only on a phone or tablet: a computer has no such sensor.
 *
 * How it works, in short:
 *
 * - the browser sends "device orientation" events; on an iPhone they carry the
 *   compass heading directly (``webkitCompassHeading``), on Android the
 *   "absolute" ones carry three angles from which the heading is computed;
 * - iPhones ask the person's permission first, which must be requested from a tap;
 * - the raw heading jitters, so it is smoothed (a running average of the
 *   direction, not of the angle, which would go wrong around north).
 *
 * Nothing is recorded or sent anywhere.
 */

const DEGREES = Math.PI / 180;
/** How much of each new reading is mixed into the smoothed heading (0-1). */
const SMOOTHING = 0.2;
/** How long to wait for the first reading before concluding there is no sensor. */
const FIRST_READING_TIMEOUT_MS = 1800;

type OrientationEventWithCompass = DeviceOrientationEvent & { webkitCompassHeading?: number };

/** Heading in degrees (0 = north, clockwise) from an Android absolute orientation reading, or ``null``. */
function androidHeading(event: DeviceOrientationEvent): number | null {
  const { alpha, beta, gamma } = event;
  if (alpha === null || beta === null || gamma === null) return null;
  // The direction the top edge of the phone's back points to (W3C "compass heading" recipe).
  const x = beta * DEGREES;
  const y = gamma * DEGREES;
  const z = alpha * DEGREES;
  const cosY = Math.cos(y);
  const sinY = Math.sin(y);
  const cosZ = Math.cos(z);
  const sinZ = Math.sin(z);
  const sinX = Math.sin(x);
  const cosX = Math.cos(x);
  const east = -cosZ * sinY - sinZ * sinX * cosY;
  const north = -sinZ * sinY + cosZ * sinX * cosY;
  const heading = Math.atan2(east, north) / DEGREES;
  return (heading + 360) % 360;
}

class Heading {
  /** True on a phone or tablet (a touch screen with orientation events). */
  available = typeof window !== "undefined" && "DeviceOrientationEvent" in window && matchMedia("(pointer: coarse)").matches;
  /** True while the sensor is being listened to. */
  active = $state(false);
  /** The smoothed heading, 0-360 degrees clockwise from north, or ``null`` before the first reading. */
  degrees = $state<number | null>(null);

  #sin = 0;
  #cos = 0;
  #seen = false;
  #listeners = new Set<() => void>();

  /** Be told at every new reading (for things drawn outside Svelte, such as the dot on the map). */
  onChange(callback: () => void): () => void {
    this.#listeners.add(callback);
    return () => this.#listeners.delete(callback);
  }

  #read = (event: Event): void => {
    const orientation = event as OrientationEventWithCompass;
    let heading: number | null = null;
    if (typeof orientation.webkitCompassHeading === "number") heading = orientation.webkitCompassHeading; // iPhone
    else if (event.type === "deviceorientationabsolute") heading = androidHeading(orientation);
    if (heading === null) return;

    // The screen may be turned (landscape): the top of the screen is then not the top of the phone.
    heading = (heading + (screen.orientation?.angle ?? 0) + 360) % 360;

    const sin = Math.sin(heading * DEGREES);
    const cos = Math.cos(heading * DEGREES);
    if (!this.#seen) {
      this.#sin = sin;
      this.#cos = cos;
      this.#seen = true;
    } else {
      this.#sin += (sin - this.#sin) * SMOOTHING;
      this.#cos += (cos - this.#cos) * SMOOTHING;
    }
    this.degrees = (Math.atan2(this.#sin, this.#cos) / DEGREES + 360) % 360;
    this.#listeners.forEach((callback) => callback());
  };

  /**
   * Start listening to the compass sensor.
   *
   * Must be called from a tap (iPhones ask for permission and refuse otherwise).
   *
   * Returns
   * -------
   * Promise<bool>
   *     ``true`` once readings arrive, ``false`` if the person refused or the
   *     device has no compass.
   */
  async start(): Promise<boolean> {
    if (this.active) return true;
    const DeviceOrientation = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DeviceOrientation.requestPermission === "function") {
      try {
        if ((await DeviceOrientation.requestPermission()) !== "granted") return false;
      } catch {
        return false;
      }
    }
    this.#seen = false;
    this.degrees = null;
    window.addEventListener("deviceorientationabsolute", this.#read, true);
    window.addEventListener("deviceorientation", this.#read, true);
    this.active = true;

    const arrived = await new Promise<boolean>((resolve) => {
      const started = Date.now();
      const check = () => {
        if (this.degrees !== null) resolve(true);
        else if (Date.now() - started > FIRST_READING_TIMEOUT_MS) resolve(false);
        else setTimeout(check, 100);
      };
      check();
    });
    if (!arrived) this.stop();
    return arrived;
  }

  /** Stop listening (saves the battery). */
  stop(): void {
    window.removeEventListener("deviceorientationabsolute", this.#read, true);
    window.removeEventListener("deviceorientation", this.#read, true);
    this.active = false;
    this.degrees = null;
    this.#listeners.forEach((callback) => callback());
  }
}

export const heading = new Heading();
