"""Build the list of French summits, passes and other mountain landmarks.

Source: IGN "BD TOPO" layer ``detail_orographique`` (Géoplateforme WFS
service, Licence Ouverte Etalab). Each landmark has a nature (summit, pass,
peak...), a name and an *importance* from 1 (the greatest: Mont Blanc...) to 6.
The layer has no altitude, so it is added here from the IGN altimetry service
(the same free service the app uses for the profile of a parcours).

Run it from the project root (standard library only)::

    python tools/build_peaks.py            # uses the cache if there is one
    python tools/build_peaks.py --refresh  # downloads again

Writes ``public/data/peaks.geojson``: one point per landmark, with
``name``, ``type`` (sommet, pic, col, montagne, volcan, crete, cirque, gorge,
escarpement), ``importance`` (1-6) and ``ele`` (meters, or null if unknown).

About the altitude: the position of a summit in BD TOPO is only precise to
about 30 m, which on a steep summit can be 10-20 m of altitude. So for summits
five points are measured (the position and four points 25 m around it) and the
highest is kept. For passes, crests... the altitude of the position is used.
It is a good value for exploring, not a surveyed height.
"""

import json
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

from explore_common import CACHE_DIR, DATA_DIR, cached_json, fetch_json, in_france, log, write_geojson

WFS_URL = "https://data.geopf.fr/wfs/ows"
ELEVATION_URL = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json"
PAGE_SIZE = 2000
CHUNK_SIZE = 150  # positions per altimetry request
WORKERS = 4  # requests at the same time (the service allows 30 per second)
NO_DATA_BELOW = -1000  # the service answers -99999 where it has no data
OUTPUT_PATH = DATA_DIR / "peaks.geojson"

# BD TOPO nature -> short code used in the file. Valleys, rocks, caves, islands... are left out.
NATURES = {
    "Sommet": "sommet",
    "Pic": "pic",
    "Col": "col",
    "Montagne": "montagne",
    "Volcan": "volcan",
    "Crête": "crete",
    "Cirque": "cirque",
    "Gorge": "gorge",
    "Escarpement": "escarpement",
}
SUMMIT_TYPES = {"sommet", "pic", "montagne", "volcan"}  # the highest point nearby is wanted

# Offsets of the four extra measure points, in degrees (about 25 m).
OFFSETS = [(0.00032, 0.0), (-0.00032, 0.0), (0.0, 0.00022), (0.0, -0.00022)]


def download_landmarks():
    """Download the raw landmark features from the IGN WFS service, by pages.

    Returns
    -------
    list of dict
        GeoJSON point features (``nature``, ``toponyme``, ``importance``).
    """
    natures = ",".join("'" + n + "'" for n in NATURES)
    features = []
    start = 0
    while True:
        params = {
            "SERVICE": "WFS",
            "VERSION": "2.0.0",
            "REQUEST": "GetFeature",
            "TYPENAMES": "BDTOPO_V3:detail_orographique",
            "OUTPUTFORMAT": "application/json",
            "PROPERTYNAME": "nature,toponyme,importance,geometrie",
            "CQL_FILTER": f"nature IN ({natures})",
            "SORTBY": "cleabs",
            "COUNT": str(PAGE_SIZE),
            "STARTINDEX": str(start),
        }
        page = fetch_json(f"{WFS_URL}?{urllib.parse.urlencode(params)}", first_wait=5)
        for feature in page["features"]:
            properties = feature["properties"]
            features.append(
                {
                    "nature": properties["nature"],
                    "name": properties["toponyme"],
                    "importance": properties["importance"],
                    "lon": feature["geometry"]["coordinates"][0],
                    "lat": feature["geometry"]["coordinates"][1],
                }
            )
        log(f"landmarks {len(features)} of {page['numberMatched']}")
        if len(page["features"]) < PAGE_SIZE:
            return features
        start += PAGE_SIZE
        time.sleep(1)


def measure_points(landmark):
    """List the positions at which the altitude of a landmark is measured.

    Parameters
    ----------
    landmark : dict
        With ``lon``, ``lat`` and ``nature``.

    Returns
    -------
    list of (float, float)
        The position itself, plus four around it for summits.
    """
    lon, lat = landmark["lon"], landmark["lat"]
    points = [(lon, lat)]
    if NATURES[landmark["nature"]] in SUMMIT_TYPES:
        points += [(lon + dlon, lat + dlat) for dlon, dlat in OFFSETS]
    return points


def fetch_chunk(positions):
    """Ask the altimetry service for the altitude of up to ``CHUNK_SIZE`` positions."""
    params = {
        "lon": "|".join(f"{lon:.5f}" for lon, _ in positions),
        "lat": "|".join(f"{lat:.5f}" for _, lat in positions),
        "resource": "ign_rge_alti_wld",
        "zonly": "true",
    }
    answer = fetch_json(f"{ELEVATION_URL}?{urllib.parse.urlencode(params)}", tries=5, timeout=60, first_wait=3)
    elevations = answer["elevations"]
    if len(elevations) != len(positions):
        raise RuntimeError("Unexpected altimetry answer")
    return elevations


def measure_all(positions):
    """Measure the altitude of many positions, resuming from a partial cache.

    Parameters
    ----------
    positions : list of (float, float)
        All the positions to measure.

    Returns
    -------
    list of float
        One altitude per position (very negative where there is no data).
    """
    chunks = [positions[i : i + CHUNK_SIZE] for i in range(0, len(positions), CHUNK_SIZE)]
    path = CACHE_DIR / "peaks_elevations.json"
    done = json.loads(path.read_text()) if path.exists() else {}
    todo = [i for i in range(len(chunks)) if str(i) not in done]
    log(f"altitudes: {len(chunks)} requests, {len(todo)} to do")

    def work(index):
        time.sleep(0.05)
        return index, fetch_chunk(chunks[index])

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for count, (index, elevations) in enumerate(pool.map(work, todo), start=1):
            done[str(index)] = elevations
            if count % 100 == 0:
                log(f"  {count} of {len(todo)}")
                path.write_text(json.dumps(done))
    path.write_text(json.dumps(done))
    return [value for i in range(len(chunks)) for value in done[str(i)]]


def build_features(landmarks):
    """Add the altitudes and make the GeoJSON features.

    Parameters
    ----------
    landmarks : list of dict
        As returned by ``download_landmarks``.

    Returns
    -------
    list of dict
        Point features, the most important (then the highest) first. Landmarks
        without a name or outside metropolitan France are left out.
    """
    kept = [m for m in landmarks if m["name"] and in_france(m["lon"], m["lat"])]
    log(f"{len(kept)} named landmarks in France (of {len(landmarks)})")

    positions = []
    spans = []  # for each landmark, where its measures are in ``positions``
    for landmark in kept:
        points = measure_points(landmark)
        spans.append((len(positions), len(positions) + len(points)))
        positions.extend(points)
    elevations = measure_all(positions)

    features = []
    for landmark, (start, end) in zip(kept, spans):
        valid = [e for e in elevations[start:end] if e > NO_DATA_BELOW]
        ele = round(max(valid)) if valid else None
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "name": landmark["name"],
                    "type": NATURES[landmark["nature"]],
                    "importance": int(landmark["importance"] or 6),
                    "ele": ele,
                },
                "geometry": {"type": "Point", "coordinates": [round(landmark["lon"], 5), round(landmark["lat"], 5)]},
            }
        )
    features.sort(key=lambda f: (f["properties"]["importance"], -(f["properties"]["ele"] or 0)))
    return features


def main():
    landmarks = cached_json("peaks_raw.json", download_landmarks)
    write_geojson(OUTPUT_PATH, build_features(landmarks))


if __name__ == "__main__":
    main()
