"""Build the outlines of the French regional natural parks (PNR).

Source: IGN "BD TOPO" layer ``parc_ou_reserve`` (nature "Parc naturel
régional"), served for free by the Géoplateforme WFS service. Licence Ouverte
(Etalab): the map should credit "IGN".

Run it from the project root (standard library only)::

    python tools/build_pnr.py            # uses the cache if there is one
    python tools/build_pnr.py --refresh  # downloads again

Writes ``public/data/pnr.geojson``: one feature per park, with its ``name``
(for example "Parc naturel régional de Chartreuse") and its ``short`` name
("Chartreuse"), its middle (``cx``, ``cy``), outlines simplified to about 20 m. Overseas parks are dropped.
"""

import json
import re
import urllib.parse

from explore_common import DATA_DIR, cached_json, fetch_json, in_france, log, polygon_center, round_points, simplify_line, write_geojson

WFS_URL = "https://data.geopf.fr/wfs/ows"
PAGE_SIZE = 10  # the outlines are heavy: a few parks per request
TOLERANCE = 0.0002  # degrees, about 22 m
DECIMALS = 4  # about 11 m
OUTPUT_PATH = DATA_DIR / "pnr.geojson"


def download_parks():
    """Download the raw park features from the IGN WFS service, a page at a time.

    Returns
    -------
    list of dict
        GeoJSON features, as served (full precision).
    """
    features = []
    start = 0
    while True:
        params = {
            "SERVICE": "WFS",
            "VERSION": "2.0.0",
            "REQUEST": "GetFeature",
            "TYPENAMES": "BDTOPO_V3:parc_ou_reserve",
            "OUTPUTFORMAT": "application/json",
            "PROPERTYNAME": "nature,toponyme,geometrie",
            "CQL_FILTER": "nature='Parc naturel régional'",
            "SORTBY": "cleabs",
            "COUNT": str(PAGE_SIZE),
            "STARTINDEX": str(start),
        }
        page = fetch_json(f"{WFS_URL}?{urllib.parse.urlencode(params)}", first_wait=5)
        features.extend(page["features"])
        log(f"parks {len(features)} of {page['numberMatched']}")
        if len(page["features"]) < PAGE_SIZE or len(features) >= page["numberMatched"]:
            return features
        start += PAGE_SIZE


def clean_name(raw):
    """Turn an IGN park name into a tidy full name and a short name.

    Parameters
    ----------
    raw : str
        For example ``"Parc Naturel Régional des Volcans d'Auvergne"``.

    Returns
    -------
    tuple of str
        ``("Parc naturel régional des Volcans d'Auvergne", "Volcans d'Auvergne")``.
    """
    short = re.sub(r"^parc naturel r[ée]gional\s*", "", raw.strip(), flags=re.I)
    short = re.sub(r"^(de la |de l'|de |du |des |d')", "", short, flags=re.I).strip()
    short = short[:1].upper() + short[1:]
    rest = re.sub(r"^parc naturel r[ée]gional\s*", "", raw.strip(), flags=re.I)
    full = f"Parc naturel régional {rest}".strip() if rest != raw.strip() else f"Parc naturel régional - {raw.strip()}"
    return full, short


def simplify_polygons(geometry):
    """Simplify every ring of a polygon or multipolygon.

    Parameters
    ----------
    geometry : dict
        GeoJSON ``Polygon`` or ``MultiPolygon``.

    Returns
    -------
    list
        The polygons (each a list of rings) of a ``MultiPolygon``, rings with
        fewer than 4 points left out.
    """
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
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


def centre_properties(polygons):
    """The middle of a park as ``cx`` and ``cy`` properties (for the time by car to it)."""
    lon, lat = polygon_center(polygons)
    return {"cx": round(lon, 4), "cy": round(lat, 4)}


def build_features(raw_features):
    """Make one GeoJSON feature per park.

    Parameters
    ----------
    raw_features : list of dict
        As returned by ``download_parks``.

    Returns
    -------
    list of dict
        Features with ``name`` and ``short``; parks outside metropolitan France
        and parks without a name are left out; pieces of the same park are merged.
    """
    parks = {}
    for feature in raw_features:
        geometry = feature.get("geometry")
        raw_name = feature["properties"].get("toponyme")
        if not geometry or not raw_name:
            log(f"  skipped (no {'name' if geometry else 'outline'}): {feature['id']}")
            continue
        polygons = simplify_polygons(geometry)
        first = polygons[0][0][0] if polygons else None
        if first is None or not in_france(*first):
            log(f"  skipped (outside metropolitan France): {raw_name}")
            continue
        full, short = clean_name(raw_name)
        park = parks.setdefault(full, {"short": short, "polygons": []})
        park["polygons"].extend(polygons)
    return [
        {
            "type": "Feature",
            "properties": {"name": full, "short": park["short"], **centre_properties(park["polygons"])},
            "geometry": {"type": "MultiPolygon", "coordinates": park["polygons"]},
        }
        for full, park in sorted(parks.items())
    ]


def main():
    raw = cached_json("pnr_raw.json", download_parks)
    write_geojson(OUTPUT_PATH, build_features(raw))


if __name__ == "__main__":
    main()
