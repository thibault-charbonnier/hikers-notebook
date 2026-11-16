"""Build the "grey world, lit France" mask used by the home map.

The home map dims everything that is not metropolitan France. To do that we
need one polygon that covers the whole world and has a hole shaped like
France. This script downloads the outline of metropolitan France (derived
from IGN Admin Express, Licence Ouverte) and writes that polygon.

Run it from the project root (standard library only, no install needed)::

    python tools/build_france_mask.py

The result, ``public/data/france-mask.geojson``, is committed to the repo, so
the script only needs to be re-run if the outline should be refreshed.
"""

import json
import urllib.request
from pathlib import Path

SOURCE_URL = (
    "https://raw.githubusercontent.com/gregoiredavid/france-geojson/"
    "master/metropole.geojson"
)
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "public/data/france-mask.geojson"

# Web Mercator cannot display latitudes beyond +/- 85.06 degrees.
WORLD_RING = [[-180, -85.06], [180, -85.06], [180, 85.06], [-180, 85.06], [-180, -85.06]]
COORD_DECIMALS = 4  # about 10 m of precision, plenty for a country outline


def download_geojson(url):
    """Download and parse a GeoJSON file.

    Parameters
    ----------
    url : str
        Address of the GeoJSON file.

    Returns
    -------
    dict
        The parsed GeoJSON document.
    """
    with urllib.request.urlopen(url, timeout=60) as response:
        return json.load(response)


def exterior_rings(geojson):
    """Collect the outer ring of every polygon found in a GeoJSON document.

    Inner rings (holes inside France, e.g. enclaves) are ignored: they stay
    lit, which is the desired look.

    Parameters
    ----------
    geojson : dict
        A single ``Feature`` or a ``FeatureCollection`` whose geometries are
        ``Polygon`` or ``MultiPolygon``.

    Returns
    -------
    list of list of list of float
        One ring per polygon, each ring being a list of ``[lon, lat]``.
    """
    rings = []
    features = geojson["features"] if geojson["type"] == "FeatureCollection" else [geojson]
    for feature in features:
        geometry = feature["geometry"]
        if geometry["type"] == "Polygon":
            polygons = [geometry["coordinates"]]
        elif geometry["type"] == "MultiPolygon":
            polygons = geometry["coordinates"]
        else:
            continue
        rings.extend(polygon[0] for polygon in polygons)
    return rings


def round_ring(ring):
    """Round the coordinates of a ring to keep the output file small.

    Parameters
    ----------
    ring : list of list of float
        A list of ``[lon, lat]`` positions.

    Returns
    -------
    list of list of float
        The same ring with rounded coordinates.
    """
    return [[round(lon, COORD_DECIMALS), round(lat, COORD_DECIMALS)] for lon, lat, *_ in ring]


def build_mask(france_rings):
    """Build a world polygon with France cut out of it.

    In GeoJSON, the first ring of a polygon is its outline and the following
    rings are holes. MapLibre does not require a specific winding order.

    Parameters
    ----------
    france_rings : list of list of list of float
        Outer rings of metropolitan France (mainland, Corsica, islands).

    Returns
    -------
    dict
        A ``FeatureCollection`` with a single ``Polygon`` feature.
    """
    holes = [round_ring(ring) for ring in france_rings]
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "world-without-france"},
                "geometry": {"type": "Polygon", "coordinates": [WORLD_RING, *holes]},
            }
        ],
    }


def main():
    """Download the France outline and write the mask file."""
    france = download_geojson(SOURCE_URL)
    mask = build_mask(exterior_rings(france))
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(mask, separators=(",", ":")), encoding="utf-8")
    n_holes = len(mask["features"][0]["geometry"]["coordinates"]) - 1
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"Wrote {OUTPUT_PATH} ({n_holes} France rings, {size_kb:.0f} kB)")


if __name__ == "__main__":
    main()
