"""Small helpers shared by the scripts that build the "Explorer" map data.

The scripts (``build_gr_trails.py``, ``build_pnr.py``, ``build_peaks.py``) each
download open data once, simplify it, and write a light GeoJSON file in
``public/data``. Nothing here needs an install: standard library only.

Good manners towards the free servers we use:

- every download is **cached** in ``tools/.cache`` (ignored by git), so running a
  script again does not call the server again unless ``--refresh`` is given;
- requests are spaced out and retried with a growing wait when the server is busy;
- the user agent is generic.
"""

import http.client
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "tools" / ".cache"
DATA_DIR = ROOT / "public" / "data"
USER_AGENT = "open-data-build-script"

# Metropolitan France with a margin (used to drop overseas territories and far-away things).
FRANCE_BBOX = (-5.6, 41.2, 10.0, 51.3)  # min lon, min lat, max lon, max lat


def in_france(lon, lat):
    """Tell whether a position is inside the (loose) box around metropolitan France.

    Parameters
    ----------
    lon, lat : float
        Position in degrees.

    Returns
    -------
    bool
        ``True`` if the position is inside ``FRANCE_BBOX``.
    """
    min_lon, min_lat, max_lon, max_lat = FRANCE_BBOX
    return min_lon <= lon <= max_lon and min_lat <= lat <= max_lat


_FRANCE_RINGS = None


def france_rings():
    """Outline of metropolitan France (continent and islands), coarsely simplified.

    Read from the "lit France" mask (``public/data/france-mask.geojson``): its
    first ring is the whole world, every other ring is a piece of France.
    Simplified to about 500 m, which is plenty to tell France from its neighbours.

    Returns
    -------
    list of list of (float, float)
        One closed ring per piece of France.
    """
    global _FRANCE_RINGS
    if _FRANCE_RINGS is None:
        mask = json.loads((DATA_DIR / "france-mask.geojson").read_text(encoding="utf-8"))
        rings = mask["features"][0]["geometry"]["coordinates"][1:]
        _FRANCE_RINGS = [simplify_line([tuple(p) for p in ring], 0.005) for ring in rings]
    return _FRANCE_RINGS


def point_in_ring(lon, lat, ring):
    """Tell whether a position is inside a closed ring (ray casting).

    Parameters
    ----------
    lon, lat : float
        Position in degrees.
    ring : list of (float, float)
        The outline, as (lon, lat) pairs.

    Returns
    -------
    bool
        ``True`` if the position is inside the ring.
    """
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def inside_france(lon, lat):
    """Tell whether a position is inside the outline of metropolitan France.

    Parameters
    ----------
    lon, lat : float
        Position in degrees.

    Returns
    -------
    bool
        ``True`` if inside one of the pieces of France.
    """
    if not in_france(lon, lat):
        return False
    return any(point_in_ring(lon, lat, ring) for ring in france_rings())


def touches_france(line, samples=40, min_share=0.2):
    """Tell whether a line is (at least partly) a French line.

    A few points of the line are tested; the line counts as French when
    enough of them are inside France. This drops trails that merely touch the
    border from the other side (e.g. a Spanish trail ending at a French town).

    Parameters
    ----------
    line : list of (float, float)
        The line.
    samples : int
        About how many points of the line are tested.
    min_share : float
        Share of tested points that must be inside France (0 to 1).

    Returns
    -------
    bool
        ``True`` if the line is French enough.
    """
    step = max(1, len(line) // samples)
    tested = list(range(0, len(line), step))
    inside = sum(1 for i in tested if inside_france(*line[i]))
    return inside >= max(1, min_share * len(tested))


def log(message):
    """Print a progress line right away (even when the output is redirected)."""
    print(message, flush=True)


def wants_refresh():
    """Tell whether the script was started with ``--refresh`` (ignore the cache)."""
    return "--refresh" in sys.argv


def cached_json(name, producer):
    """Return a JSON document from the cache, or build it with ``producer`` and cache it.

    Parameters
    ----------
    name : str
        File name in ``tools/.cache``.
    producer : function
        Called with no argument when the cache has no such file (or with
        ``--refresh``); must return something JSON-serialisable.

    Returns
    -------
    object
        The parsed document.
    """
    path = CACHE_DIR / name
    if path.exists() and not wants_refresh():
        log(f"cache: {name}")
        return json.loads(path.read_text(encoding="utf-8"))
    value = producer()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return value


def fetch(url, data=None, tries=6, timeout=240, first_wait=10):
    """Download an address, waiting longer and longer if the server is busy.

    Parameters
    ----------
    url : str
        The address.
    data : dict, optional
        Form fields to send (a POST request); a plain GET otherwise.
    tries : int
        How many attempts before giving up.
    timeout : int
        Seconds to wait for one answer.
    first_wait : int
        Seconds to wait after the first failure (doubled each time).

    Returns
    -------
    bytes
        The body of the answer.

    Raises
    ------
    RuntimeError
        If every attempt failed.
    """
    body = urllib.parse.urlencode(data).encode() if data else None
    wait = first_wait
    last_error = None
    for attempt in range(tries):
        try:
            request = urllib.request.Request(url, data=body, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except (urllib.error.URLError, http.client.HTTPException, TimeoutError, OSError) as error:
            last_error = error
            log(f"  attempt {attempt + 1} failed ({error}); waiting {wait} s")
            time.sleep(wait)
            wait *= 2
    raise RuntimeError(f"Download failed: {url[:120]} ({last_error})")


def fetch_json(url, data=None, tries=6, timeout=240, first_wait=10):
    """Like ``fetch``, but also tries again when the answer is not valid JSON.

    Servers sometimes answer with an empty or truncated page when busy.

    Returns
    -------
    object
        The parsed JSON answer.
    """
    wait = first_wait
    for attempt in range(tries):
        body = fetch(url, data=data, tries=tries, timeout=timeout, first_wait=first_wait)
        try:
            return json.loads(body)
        except ValueError:
            log(f"  answer is not valid JSON (attempt {attempt + 1}); waiting {wait} s")
            time.sleep(wait)
            wait *= 2
    raise RuntimeError(f"No valid JSON answer from {url[:120]}")


def simplify_line(points, tolerance):
    """Reduce the number of points of a line (Douglas-Peucker).

    Parameters
    ----------
    points : list of (float, float)
        The line, as (lon, lat) pairs.
    tolerance : float
        Largest distance, in degrees, the simplified line may be from the
        original (0.0002 degrees is about 22 m).

    Returns
    -------
    list of (float, float)
        A subset of the points that always keeps the first and the last one.
    """
    if len(points) < 3:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    limit = tolerance * tolerance
    while stack:
        start, end = stack.pop()
        ax, ay = points[start]
        bx, by = points[end]
        dx, dy = bx - ax, by - ay
        length_sq = dx * dx + dy * dy
        worst, worst_index = -1.0, -1
        for i in range(start + 1, end):
            px, py = points[i]
            if length_sq == 0:
                dist = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
                dist = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if dist > worst:
                worst, worst_index = dist, i
        if worst > limit:
            keep[worst_index] = True
            stack.append((start, worst_index))
            stack.append((worst_index, end))
    return [p for p, k in zip(points, keep) if k]


def polygon_center(polygons):
    """The middle (centre of mass) of the biggest piece of an area.

    Used as "the" point of a massif or a park, for instance to work out the time
    by car to it. For a very curved area the point may fall outside it; it is
    only a rough middle.

    Parameters
    ----------
    polygons : list
        The polygons of the area, each a list of rings (the first is the outer ring) of
        ``[lon, lat]`` points.

    Returns
    -------
    tuple of float
        ``(lon, lat)``.
    """
    best = None
    for polygon in polygons:
        ring = polygon[0]
        area = 0.0
        cx = cy = 0.0
        for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
            cross = x0 * y1 - x1 * y0
            area += cross
            cx += (x0 + x1) * cross
            cy += (y0 + y1) * cross
        if area == 0:
            continue
        candidate = (abs(area), cx / (3 * area), cy / (3 * area))
        if best is None or candidate[0] > best[0]:
            best = candidate
    if best is None:
        ring = polygons[0][0]
        return (sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))
    return (best[1], best[2])


def round_points(points, decimals):
    """Round (lon, lat) pairs, dropping consecutive duplicates created by the rounding."""
    result = []
    for lon, lat in points:
        point = [round(lon, decimals), round(lat, decimals)]
        if not result or result[-1] != point:
            result.append(point)
    return result


def write_geojson(path, features):
    """Write a compact GeoJSON ``FeatureCollection``.

    Parameters
    ----------
    path : Path
        Where to write it.
    features : list of dict
        The GeoJSON features.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text, encoding="utf-8")
    log(f"wrote {path.relative_to(ROOT)}: {len(features)} features, {len(text.encode('utf-8')) / 1e6:.2f} MB")
