"""Build the map of the French massifs (Chartreuse, Vercors, Écrins, Aubrac...).

Source: the free polygons of refuges.info (a mountain community website),
licence CC BY-SA 2.0. The map must therefore say "© refuges.info" and this data
file stays under the same licence (see ``public/data/README.md``).

Only the real massifs are kept. refuges.info also has big regions ("zones":
Alpes, Pyrénées, Massif Central...); they are only used to tell, for each
massif, which big region it belongs to (the ``zone`` property), and are not in
the file.

Run it from the project root (standard library only)::

    python tools/build_massifs.py            # uses the cache if there is one
    python tools/build_massifs.py --refresh  # downloads again

Writes ``public/data/massifs.geojson``: one polygon per massif, with ``id``
(the refuges.info id), ``name``, ``zone`` (the name of the big region it belongs
to, or null) and its middle (``cx``, ``cy``). Massifs of neighbouring countries
that do not enter France are left out; the ones on the border are kept whole.
"""

import json
import re

from explore_common import (
    DATA_DIR,
    cached_json,
    fetch_json,
    inside_france,
    log,
    point_in_ring,
    polygon_center,
    round_points,
    simplify_line,
    write_geojson,
)

API_URL = "https://www.refuges.info/api/polygones?type_polygon=1,11,20&bbox=-5.6,41.2,10.0,51.3"
ZONE_TYPE, MASSIF_TYPE, NATURAL_REGION_TYPE = 11, 1, 20
TOLERANCE = 0.0005  # degrees, about 55 m: these outlines are rough anyway
DECIMALS = 4
MIN_SHARE_IN_FRANCE = 0.15  # a massif is kept if this share of its points is in France

# The level 1 regions wanted (the others of refuges.info are foreign: Apennins, Iberian peninsula...).
ZONES_KEPT = {"Alpes", "Pyrénées", "Massif Central", "Jura élargi", "Corse", "Massif Armoricain"}
# Massifs that touch France only by their border: left out.
MASSIFS_LEFT_OUT = {"Aragon", "Girona", "Andorre", "Val d'Aran", "Vall d'Èneu", "Forêt du Palatinat", "Alpes ligures"}
OUTPUT_PATH = DATA_DIR / "massifs.geojson"

# Zones of refuges.info that are not in France (or not mountains) are dropped by the rule above.


def download():
    """Download the zones and massifs around France."""
    return fetch_json(API_URL, first_wait=5)["features"]


def polygons_of(geometry):
    """List the polygons of a geometry, each as a list of rings.

    Parameters
    ----------
    geometry : dict
        GeoJSON ``Polygon``, ``MultiPolygon`` or ``MultiLineString`` (closed lines).

    Returns
    -------
    list
        Polygons, each a list of rings (the first is the outer one).
    """
    kind, coords = geometry["type"], geometry["coordinates"]
    if kind == "Polygon":
        return [coords]
    if kind == "MultiPolygon":
        return coords
    if kind == "MultiLineString":
        return [[line] for line in coords if len(line) >= 4]
    return []


def outer_points(polygons):
    """All the points of the outer rings (used to sample where a region is)."""
    return [tuple(p) for polygon in polygons for p in polygon[0]]


def share_in_france(points):
    """Share (0 to 1) of the points that are inside France."""
    step = max(1, len(points) // 60)
    sample = points[::step]
    return sum(1 for lon, lat in sample if inside_france(lon, lat)) / len(sample)


def clean_polygons(polygons):
    """Simplify the rings; rings with fewer than 4 points are left out."""
    result = []
    for polygon in polygons:
        rings = []
        for ring in polygon:
            simple = round_points(simplify_line([tuple(p) for p in ring], TOLERANCE), DECIMALS)
            if len(simple) >= 4:
                rings.append(simple)
        if rings:
            result.append(rings)
    return result


def zone_of(massif_points, zones):
    """Find the level 1 region a massif belongs to.

    Parameters
    ----------
    massif_points : list of (float, float)
        Points of the massif.
    zones : list of (str, list of polygons)
        The level 1 regions.

    Returns
    -------
    str or None
        The name of the region holding most of the massif's points.
    """
    step = max(1, len(massif_points) // 40)
    sample = massif_points[::step]
    best, best_count = None, 0
    for name, polygons in zones:
        count = sum(1 for lon, lat in sample if any(point_in_ring(lon, lat, polygon[0]) for polygon in polygons))
        if count > best_count:
            best, best_count = name, count
    return best


def build_features(raw):
    """Make the GeoJSON features of the massifs.

    Parameters
    ----------
    raw : list of dict
        Features as served by refuges.info.

    Returns
    -------
    list of dict
        The massifs, sorted by name.
    """
    regions = []  # (id, name, level, polygons)
    for feature in raw:
        properties = feature["properties"]
        type_id = properties["type"]["id"]
        name = re.sub(r"\s+", " ", properties["nom"]).strip()
        polygons = polygons_of(feature["geometry"])
        points = outer_points(polygons)
        if type_id == ZONE_TYPE:
            if name not in ZONES_KEPT:
                continue
            level = 1
        elif type_id == MASSIF_TYPE:
            if name in MASSIFS_LEFT_OUT or not points or share_in_france(points) < MIN_SHARE_IN_FRANCE:
                continue
            level = 2
        else:
            continue  # the small natural regions (Matheysine, Trièves) are not wanted
        regions.append((properties["id"], name, level, polygons))

    zones = [(name, polygons) for _, name, level, polygons in regions if level == 1]
    features = []
    for region_id, name, level, polygons in sorted(regions, key=lambda r: (r[2], r[1])):
        if level == 1:
            continue  # the big regions only serve to name the zone of each massif
        zone = zone_of(outer_points(polygons), zones)
        shapes = clean_polygons(polygons)
        lon, lat = polygon_center(shapes)
        features.append(
            {
                "type": "Feature",
                "properties": {"id": region_id, "name": name, "zone": zone, "cx": round(lon, 4), "cy": round(lat, 4)},
                "geometry": {"type": "MultiPolygon", "coordinates": shapes},
            }
        )
    return features


def main():
    raw = cached_json("massifs_raw.json", download)
    features = build_features(raw)
    log(f"{len(features)} massifs")
    write_geojson(OUTPUT_PATH, features)


if __name__ == "__main__":
    main()
