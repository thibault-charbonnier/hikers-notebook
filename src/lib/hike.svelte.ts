/**
 * State of the parcours being planned.
 *
 * A parcours is an ordered list of points placed on the map. Between two
 * consecutive points there is a "segment": the walking route (or a straight
 * line if no path is found) with its elevation. Segments are fetched from the
 * IGN services in the background, and each one is remembered, so moving or
 * adding a point only recomputes the segments around it.
 *
 * A parcours can be closed into a loop: a last point, placed exactly on the
 * first one, is then added to the list (``closed`` is true). The map shows
 * both as a single marker.
 *
 * Besides the route, a parcours has a name, a description, a type, labels, a
 * colour and a "done" status with a date and a comment. It can be turned into
 * a file (``toFile``) and rebuilt from one (``load``), without any network
 * request, because the file keeps the segments.
 */

import { isInFrance } from "./france";
import { buildProfile, elevationChange, lineLength, resampleLine } from "./geo";
import type { LngLat, Profile, Segment, Stats } from "./geo";
import { fetchElevations } from "./elevation";
import type { PinType, Poi } from "./poi";
import { buildPreview, decodeSegment, encodeSegment, STAGE_PATTERN_COUNT } from "./parcours";
import type { ParcoursFile, ParcoursType } from "./parcours";
import { fetchWalkingRoute } from "./routing";

export type { Stats };

/** Shortest spacing in meters of the elevation samples along the route. */
const SAMPLE_STEP_M = 25;
/** Very long segments get a wider spacing, to keep the number of requests low. */
const MAX_SAMPLES_PER_SEGMENT = 1200;
const HISTORY_LIMIT = 100;
const NOTICE_DURATION_MS = 6000;
const OUTSIDE_FRANCE_MESSAGE =
  "Cet endroit est hors de France. Les cartes et les sentiers IGN ne couvrent que la France : reste dans la France.";
/** Colour of the route while the parcours has none yet (it gets one when saved). */
export const DEFAULT_ROUTE_COLOR = "#D6246E";

/** A point placed on the map by the user. */
export interface HikePoint {
  id: string;
  lon: number;
  lat: number;
  name: string;
  description: string;
  /** True if this point ends a stage (a day) of the parcours. */
  stage: boolean;
}

/** Map tool: ``move`` pans the map, ``add`` places a point on each click. */
/** Map tool: ``move`` pans the map, ``add`` places a point de passage on each click,
 * ``poi`` places the pin chosen in ``poiToPlace``. */
export type Tool = "move" | "add" | "poi";

/** A message shown to the user. */
export interface Notice {
  text: string;
  kind: "warning" | "success";
}

/** Figures of the stretch that leads to a point, from the previous point. */
export interface Leg {
  distance: number;
  /** ``null`` if the elevation is unavailable. */
  ascent: number | null;
  descent: number | null;
}

interface Snapshot {
  points: HikePoint[];
  closed: boolean;
  pois: Poi[];
}

/**
 * Build the segment between two positions.
 *
 * Never fails: if the route cannot be found, the segment is a straight line;
 * if the elevation cannot be fetched, ``elevation`` is ``null``.
 *
 * Parameters
 * ----------
 * start, end : LngLat
 *     The two positions.
 *
 * Returns
 * -------
 * Segment
 *     The segment, ready to display.
 */
async function buildSegment(start: LngLat, end: LngLat): Promise<Segment> {
  let coordinates: LngLat[];
  let snapped = true;
  try {
    coordinates = await fetchWalkingRoute(start, end);
  } catch {
    coordinates = [start, end];
    snapped = false;
  }

  const step = Math.max(SAMPLE_STEP_M, lineLength(coordinates) / MAX_SAMPLES_PER_SEGMENT);
  const samples = resampleLine(coordinates, step);
  let elevation: number[] | null = null;
  try {
    elevation = await fetchElevations(samples.coordinates);
  } catch {
    // Leave ``null``: the panel explains that elevation is unavailable.
  }

  const length = samples.distance[samples.distance.length - 1];
  return { coordinates, snapped, length, distance: samples.distance, elevation };
}

/** Figures of one segment. */
function legOf(segment: Segment): Leg {
  if (!segment.elevation) return { distance: segment.length, ascent: null, descent: null };
  return { distance: segment.length, ...elevationChange(segment.elevation) };
}

/**
 * Compute the figures of the whole parcours.
 *
 * Ascent and descent are the sums of those of each segment, so the total
 * always matches the per-point figures shown in the list.
 */
function buildStats(segments: Segment[], profile: Profile): Stats {
  const legs = segments.map(legOf);
  const { distance, elevation } = profile;
  return {
    distance: distance[distance.length - 1],
    ascent: legs.reduce((sum, leg) => sum + (leg.ascent ?? 0), 0),
    descent: legs.reduce((sum, leg) => sum + (leg.descent ?? 0), 0),
    maxElevation: elevation.reduce((a, b) => Math.max(a, b)),
    minElevation: elevation.reduce((a, b) => Math.min(a, b)),
  };
}

/** Identify a segment by the positions of its two ends. */
function segmentKey(a: HikePoint, b: HikePoint): string {
  return [a.lon, a.lat, b.lon, b.lat].map((v) => v.toFixed(6)).join(",");
}

function newPoint(lon: number, lat: number): HikePoint {
  return { id: crypto.randomUUID(), lon, lat, name: "", description: "", stage: false };
}

/** Round a coordinate to 6 decimals (about 10 cm), as stored in files. */
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

/** Round the figures of a parcours to 0.1 m, as stored in files. */
function roundStats(stats: Stats): Stats {
  const round1 = (value: number) => Math.round(value * 10) / 10;
  return {
    distance: round1(stats.distance),
    ascent: round1(stats.ascent),
    descent: round1(stats.descent),
    maxElevation: round1(stats.maxElevation),
    minElevation: round1(stats.minElevation),
  };
}

class Hike {
  #savedSignature = $state("");

  id = $state<string>(crypto.randomUUID());
  name = $state("Ma rando");
  description = $state("");
  type = $state<ParcoursType>("randonnee");
  done = $state(false);
  /** Date of completion, ``YYYY-MM-DD``. */
  doneOn = $state<string | null>(null);
  doneComment = $state("");
  /** Rating from 0.5 to 5 stars, in steps of 0.5. */
  rating = $state<number | null>(null);
  labels = $state<string[]>([]);
  /** Colour on the overview map. Empty until the first save, which picks a free one. */
  color = $state("");
  points = $state<HikePoint[]>([]);
  /** Points of interest and comments: not numbered, they do not shape the route. */
  pois = $state<Poi[]>([]);
  /** The pin the next click places, when the tool is ``poi``. */
  poiToPlace = $state<PinType>("water");
  /** The comment currently open in its large window, if any. */
  commentOpenId = $state<string | null>(null);
  tool = $state<Tool>("move");
  /** True if the last point closes the loop on the first one. */
  closed = $state(false);
  /** Message shown to the user, or ``null``. */
  notice = $state<Notice | null>(null);
  /** True once this parcours exists in the storage. */
  isSaved = $state(false);
  undoCount = $state(0);
  redoCount = $state(0);

  /** ``segments[i]`` joins ``points[i]`` to ``points[i + 1]``; ``null`` while loading. */
  segments = $state.raw<(Segment | null)[]>([]);
  /** Elevation profile. Kept from the last complete computation while loading. */
  profile = $state.raw<Profile | null>(null);
  /** Figures of the whole parcours. Kept from the last complete computation while loading. */
  stats = $state.raw<Stats | null>(null);

  /** True if something changed since the last save (or since the start). */
  dirty = $derived(this.#signature() !== this.#savedSignature);
  routeColor = $derived(this.color || DEFAULT_ROUTE_COLOR);
  loading = $derived(this.segments.some((s) => s === null));
  freeSegmentCount = $derived(this.segments.filter((s) => s && !s.snapped).length);
  missingElevation = $derived(this.segments.some((s) => s && s.elevation === null));

  /** ``legs[i]`` is the stretch that leads to ``points[i + 1]`` (``null`` while loading). */
  legs = $derived(this.segments.map((s) => (s ? legOf(s) : null)));

  /** Text of each point on the profile and in the list: its number (the last point of a loop included). */
  labelsOnProfile = $derived(this.points.map((_, i) => String(i + 1)));

  /** Indices of the points that end a stage (the first and last points never do). */
  stagePointIndices = $derived(
    this.points.flatMap((p, i) => (p.stage && i > 0 && i < this.points.length - 1 ? [i] : [])),
  );

  /** Number of stages: the stage points cut the parcours into this many parts. */
  stageCount = $derived(this.stagePointIndices.length + 1);

  /** Stage (counted from 0) of each segment. */
  stageOfSegment = $derived(this.segments.map((_, i) => this.stagePointIndices.filter((k) => k <= i).length));

  /** Length in meters of each stage (the loaded segments only). */
  stageLengths = $derived.by(() => {
    const lengths: number[] = Array.from({ length: this.stageCount }, () => 0);
    this.segments.forEach((segment, i) => {
      if (segment) lengths[this.stageOfSegment[i]] += segment.length;
    });
    return lengths;
  });

  /**
   * The whole route as GeoJSON, ready for the map. Segments still loading are
   * drawn as a straight line right away, and replaced when the route arrives.
   */
  route = $derived.by(() => ({
    type: "FeatureCollection" as const,
    features: this.points.slice(0, -1).map((a, i) => {
      const segment = this.segments[i] ?? null;
      const b = this.points[i + 1];
      return {
        type: "Feature" as const,
        properties: {
          snapped: segment?.snapped ?? false,
          pending: segment === null,
          // Line style of the stage: 0 solid, 1 and 2 hatched in turn.
          style: (this.stageOfSegment[i] ?? 0) % STAGE_PATTERN_COUNT,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: segment ? segment.coordinates : [[a.lon, a.lat], [b.lon, b.lat]],
        },
      };
    }),
  }));

  #createdAt: string | null = null;
  #ready = new Map<string, Segment>();
  #pending = new Set<string>();
  #undoStack: Snapshot[] = [];
  #redoStack: Snapshot[] = [];
  #noticeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.#savedSignature = this.#signature();
  }

  /** A text that changes whenever something worth saving changes. */
  #signature(): string {
    return JSON.stringify([
      this.name, this.description, this.type, this.done, this.doneOn, this.doneComment, this.rating,
      this.labels, this.color, this.closed,
      this.points.map((p) => [round6(p.lon), round6(p.lat), p.name, p.description, p.stage]),
      this.pois.map((p) => [round6(p.lon), round6(p.lat), p.type, p.name, p.description]),
    ]);
  }

  /** Start a new, empty parcours. */
  reset(): void {
    this.id = crypto.randomUUID();
    this.name = "Ma rando";
    this.description = "";
    this.type = "randonnee";
    this.done = false;
    this.doneOn = null;
    this.doneComment = "";
    this.rating = null;
    this.labels = [];
    this.color = "";
    this.points = [];
    this.pois = [];
    this.commentOpenId = null;
    this.closed = false;
    this.tool = "move";
    this.isSaved = false;
    this.#createdAt = null;
    this.#undoStack = [];
    this.#redoStack = [];
    this.#updateCounts();
    this.#update();
    this.#savedSignature = this.#signature();
  }

  /**
   * Replace the current parcours by one read from a file.
   *
   * The segments of the file fill the cache, so nothing is fetched.
   *
   * Parameters
   * ----------
   * file : ParcoursFile
   *     A parcours as returned by the storage.
   */
  load(file: ParcoursFile): void {
    this.id = file.id;
    this.name = file.name;
    this.description = file.description;
    this.type = file.type;
    this.done = file.done;
    this.doneOn = file.doneOn;
    this.doneComment = file.doneComment;
    this.rating = file.rating ?? null;
    this.labels = [...file.labels];
    this.color = file.color;
    this.tool = "move";

    const points: HikePoint[] = file.waypoints.map((w) => ({
      id: crypto.randomUUID(),
      lon: w.lon,
      lat: w.lat,
      name: w.name ?? "",
      description: w.description ?? "",
      stage: w.stage === true,
    }));
    if (file.closed && points.length > 0) points.push(newPoint(points[0].lon, points[0].lat));
    this.points = points;
    this.pois = (file.pois ?? []).map((p) => ({
      id: crypto.randomUUID(),
      lon: p.lon,
      lat: p.lat,
      type: p.type,
      name: p.name ?? "",
      description: p.description ?? "",
    }));
    this.commentOpenId = null;
    this.closed = file.closed;
    points.slice(0, -1).forEach((a, i) => {
      if (file.segments[i]) this.#ready.set(segmentKey(a, points[i + 1]), decodeSegment(file.segments[i]));
    });

    this.#createdAt = file.createdAt;
    this.isSaved = true;
    this.#undoStack = [];
    this.#redoStack = [];
    this.#updateCounts();
    this.#update();
    this.#savedSignature = this.#signature();
  }

  /**
   * Describe the parcours as a file, ready to be saved.
   *
   * Returns
   * -------
   * ParcoursFile or null
   *     ``null`` if there are fewer than two points or if the route is still
   *     being computed.
   */
  toFile(): ParcoursFile | null {
    if (this.points.length < 2 || this.loading) return null;
    const segments = this.segments as Segment[];
    const now = new Date().toISOString();
    const stored = this.closed ? this.points.slice(0, -1) : this.points;
    const length = segments.reduce((sum, s) => sum + s.length, 0);
    return {
      version: 1,
      id: this.id,
      name: this.name.trim() || "Sans nom",
      description: this.description,
      type: this.type,
      done: this.done,
      doneOn: this.done ? this.doneOn : null,
      doneComment: this.done ? this.doneComment : "",
      rating: this.done ? this.rating : null,
      labels: [...this.labels],
      color: this.color,
      stages: this.stageCount,
      createdAt: this.#createdAt ?? now,
      updatedAt: now,
      stats: roundStats(this.stats ?? { distance: length, ascent: 0, descent: 0, maxElevation: 0, minElevation: 0 }),
      preview: buildPreview(segments),
      closed: this.closed,
      waypoints: stored.map((p) => ({
        lon: round6(p.lon),
        lat: round6(p.lat),
        ...(p.name && { name: p.name }),
        ...(p.description && { description: p.description }),
        ...(p.stage && { stage: true as const }),
      })),
      segments: segments.map(encodeSegment),
      pois: this.pois.map((p) => ({
        lon: round6(p.lon),
        lat: round6(p.lat),
        type: p.type,
        ...(p.name && { name: p.name }),
        ...(p.description && { description: p.description }),
      })),
    };
  }

  /** Record that the current state has just been saved. */
  markSaved(file: ParcoursFile): void {
    this.#createdAt = file.createdAt;
    this.isSaved = true;
    this.#savedSignature = this.#signature();
  }

  /**
   * Add a point at the end of the parcours (before the closing point of a loop).
   *
   * Returns
   * -------
   * bool
   *     False if the position is outside France (the user is warned).
   */
  addPoint(lon: number, lat: number): boolean {
    if (!this.#accept(lon, lat)) return false;
    this.#record();
    const point = newPoint(lon, lat);
    if (this.closed) this.points.splice(this.points.length - 1, 0, point);
    else this.points.push(point);
    this.#update();
    return true;
  }

  /** Close the parcours into a loop: add a last point on the first one. */
  closeLoop(): void {
    if (this.closed || this.points.length < 2) return;
    this.#record();
    const first = this.points[0];
    this.points.push(newPoint(first.lon, first.lat));
    this.closed = true;
    this.#update();
  }

  /**
   * Move a point. On a loop, the first and last points move together.
   *
   * Returns
   * -------
   * bool
   *     False if the position is outside France (nothing moves).
   */
  movePoint(id: string, lon: number, lat: number): boolean {
    const index = this.points.findIndex((p) => p.id === id);
    if (index < 0 || !this.#accept(lon, lat)) return false;
    this.#record();
    const last = this.points.length - 1;
    const moved = this.closed && (index === 0 || index === last) ? [0, last] : [index];
    for (const i of moved) {
      this.points[i].lon = lon;
      this.points[i].lat = lat;
    }
    this.#update();
    return true;
  }

  /** Move a point to a given position in the order (``number`` starts at 1). */
  renumber(id: string, number: number): void {
    const from = this.points.findIndex((p) => p.id === id);
    const last = this.points.length - 1;
    if (from < 0 || !Number.isFinite(number)) return;
    if (this.closed && (from === 0 || from === last)) return; // ends of a loop stay in place
    const low = this.closed ? 1 : 0;
    const high = this.closed ? last - 1 : last;
    const to = Math.min(Math.max(Math.round(number) - 1, low), high);
    if (to === from) return;
    this.#record();
    const [point] = this.points.splice(from, 1);
    this.points.splice(to, 0, point);
    this.#update();
  }

  /** Remove a point. Removing an end of a loop opens the loop. */
  removePoint(id: string): void {
    const index = this.points.findIndex((p) => p.id === id);
    if (index < 0) return;
    this.#record();
    const last = this.points.length - 1;
    if (this.closed && index === 0) {
      this.points.splice(last, 1);
      this.points.splice(0, 1);
      this.closed = false;
    } else if (this.closed && index === last) {
      this.points.splice(last, 1);
      this.closed = false;
    } else {
      this.points.splice(index, 1);
      if (this.closed && this.points.length < 3) {
        this.points.pop(); // nothing left to loop around
        this.closed = false;
      }
    }
    this.#update();
  }

  /** Make a point the end of a stage (or not). The first and last points cannot be. */
  toggleStage(id: string): void {
    const index = this.points.findIndex((p) => p.id === id);
    if (index <= 0 || index >= this.points.length - 1) return;
    this.#record();
    this.points[index].stage = !this.points[index].stage;
    this.#update();
  }

  /**
   * Place a point of interest or a comment.
   *
   * Returns
   * -------
   * string or null
   *     The id of the new pin, or ``null`` if the position is outside France.
   */
  addPoi(lon: number, lat: number, type: PinType): string | null {
    if (!this.#accept(lon, lat)) return null;
    this.#record();
    const poi: Poi = { id: crypto.randomUUID(), lon, lat, type, name: "", description: "" };
    this.pois.push(poi);
    return poi.id;
  }

  /** Move a point of interest. Returns false (and warns) if the position is outside France. */
  movePoi(id: string, lon: number, lat: number): boolean {
    const poi = this.pois.find((p) => p.id === id);
    if (!poi || !this.#accept(lon, lat)) return false;
    this.#record();
    poi.lon = lon;
    poi.lat = lat;
    return true;
  }

  /** Change the type of a point of interest (and so its icon). */
  setPoiType(id: string, type: PinType): void {
    const poi = this.pois.find((p) => p.id === id);
    if (!poi || poi.type === type) return;
    this.#record();
    poi.type = type;
  }

  removePoi(id: string): void {
    if (!this.pois.some((p) => p.id === id)) return;
    this.#record();
    this.pois = this.pois.filter((p) => p.id !== id);
    if (this.commentOpenId === id) this.commentOpenId = null;
  }

  /** Remove every point de passage and every pin (the name, labels and other details are kept). Can be undone. */
  clearPoints(): void {
    if (this.points.length === 0 && this.pois.length === 0) return;
    this.#record();
    this.points = [];
    this.pois = [];
    this.commentOpenId = null;
    this.closed = false;
    this.#update();
  }

  undo(): void {
    const previous = this.#undoStack.pop();
    if (!previous) return;
    this.#redoStack.push(this.#snapshot());
    this.#restore(previous);
  }

  redo(): void {
    const next = this.#redoStack.pop();
    if (!next) return;
    this.#undoStack.push(this.#snapshot());
    this.#restore(next);
  }

  addLabel(name: string): void {
    const clean = name.trim();
    if (clean && !this.labels.includes(clean)) this.labels.push(clean);
  }

  removeLabel(name: string): void {
    this.labels = this.labels.filter((l) => l !== name);
  }

  /**
   * Drop a label that has just been deleted everywhere (including in the saved
   * file of this parcours), so the parcours does not look modified because of it.
   */
  forgetLabel(name: string): void {
    const wasClean = !this.dirty;
    this.labels = this.labels.filter((l) => l !== name);
    if (wasClean) this.#savedSignature = this.#signature();
  }

  /** Show a message to the user for a few seconds. */
  notify(text: string, kind: Notice["kind"] = "warning"): void {
    this.notice = { text, kind };
    clearTimeout(this.#noticeTimer);
    this.#noticeTimer = setTimeout(() => (this.notice = null), NOTICE_DURATION_MS);
  }

  dismissNotice(): void {
    clearTimeout(this.#noticeTimer);
    this.notice = null;
  }

  /** Check that a position is in France; warn the user if not. */
  #accept(lon: number, lat: number): boolean {
    if (isInFrance(lon, lat)) return true;
    this.notify(OUTSIDE_FRANCE_MESSAGE);
    return false;
  }

  #snapshot(): Snapshot {
    return {
      points: $state.snapshot(this.points) as HikePoint[],
      closed: this.closed,
      pois: $state.snapshot(this.pois) as Poi[],
    };
  }

  /** Remember the current state, before a change, so that it can be undone. */
  #record(): void {
    this.#undoStack.push(this.#snapshot());
    if (this.#undoStack.length > HISTORY_LIMIT) this.#undoStack.shift();
    this.#redoStack = [];
    this.#updateCounts();
  }

  #restore(snapshot: Snapshot): void {
    this.points = snapshot.points.map((p) => ({ ...p }));
    this.pois = snapshot.pois.map((p) => ({ ...p }));
    if (this.commentOpenId && !this.pois.some((p) => p.id === this.commentOpenId)) this.commentOpenId = null;
    this.closed = snapshot.closed;
    this.#updateCounts();
    this.#update();
  }

  #updateCounts(): void {
    this.undoCount = this.#undoStack.length;
    this.redoCount = this.#redoStack.length;
  }

  /** Rebuild the list of segments and start fetching the missing ones. */
  #update(): void {
    this.#syncSegments();
    this.points.slice(0, -1).forEach((a, i) => {
      const b = this.points[i + 1];
      const key = segmentKey(a, b);
      if (this.#ready.has(key) || this.#pending.has(key)) return;

      this.#pending.add(key);
      buildSegment([a.lon, a.lat], [b.lon, b.lat]).then((segment) => {
        this.#ready.set(key, segment);
        this.#pending.delete(key);
        this.#syncSegments();
      });
    });
  }

  /** Refresh ``segments`` (and the figures once everything is loaded) from the cache. */
  #syncSegments(): void {
    const segments = this.points
      .slice(0, -1)
      .map((a, i) => this.#ready.get(segmentKey(a, this.points[i + 1])) ?? null);
    this.segments = segments;
    if (segments.every((s) => s !== null)) {
      this.profile = buildProfile(segments as Segment[]);
      this.stats = this.profile ? buildStats(segments as Segment[], this.profile) : null;
    }
  }
}

/** The parcours being planned. Shared by all components. */
export const hike = new Hike();
