"""Build the map of the French long-distance hiking trails (the "GR").

Source: OpenStreetMap (hiking route relations whose reference starts with
"GR": the classic GR, including those that are also European paths; the "GR de
Pays" are left out). The data is
under the ODbL licence, so the map must say "© OpenStreetMap contributors".
The PR (short local trails) are deliberately not included.

Run it from the project root (standard library only)::

    python tools/build_gr_trails.py            # uses the cache if there is one
    python tools/build_gr_trails.py --refresh  # downloads again (slow, ~10 min)

The trails come first in the file, followed by the points where their names are
written on the map (see ``label_points``).

Steps: ask the public Overpass server for the list of GR relations (the big GR
such as the GR 34 or GR 65 are "super-routes" that only list their sections, so
the sections are fetched too), download their geometry in small batches (the
server refuses big requests), join the pieces end to end, simplify to about
20 m, and write
``public/data/gr-trails.geojson`` (one feature per GR number, about 1 MB once
compressed by the web server).
"""

import math
import re
import time
from collections import defaultdict

from explore_common import (
    CACHE_DIR,
    DATA_DIR,
    cached_json,
    fetch,
    log,
    round_points,
    simplify_line,
    touches_france,
    write_geojson,
)
import json

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
FRANCE_AREA = 3602202162  # Overpass area id of metropolitan France (relation 2202162)
BATCH_SIZE = 25
TOLERANCE = 0.0002  # degrees, about 22 m
DECIMALS = 4  # about 11 m
NETWORK_RANK = {"iwn": 3, "nwn": 2, "rwn": 1}  # which network wins when a GR is in several
OUTPUT_PATH = DATA_DIR / "gr-trails.geojson"


def overpass(query):
    """Run an Overpass query and return the parsed answer."""
    return json.loads(fetch(OVERPASS_URL, data={"data": query}))


def list_relation_ids():
    """List the OpenStreetMap relations that are GR trails in France.

    Returns
    -------
    list of int
        Relation ids.
    """
    query = (
        "[out:json][timeout:250];"
        f"area({FRANCE_AREA})->.fr;"
        'relation["route"="hiking"]["network"~"^(iwn|nwn|rwn)$"]["ref"~"^GR"](area.fr);'
        "out ids;"
    )
    return [element["id"] for element in overpass(query)["elements"]]


def list_superroutes():
    """List the GR "super-routes" (relations that only group other relations).

    The GR 34, GR 65, GR 13... are described that way in OpenStreetMap: one
    relation per GR, whose members are its sections. They have no geometry of
    their own, and the "inside France" filter cannot see them, so they are
    looked for worldwide (a few hundred at most) and their sections are fetched
    afterwards (with the France filter).

    Returns
    -------
    list of dict
        For each super-route: ``ref``, ``name``, ``network`` and ``children``
        (the ids of its sections).
    """
    query = (
        "[out:json][timeout:250];"
        'relation["route"="hiking"]["type"="superroute"]["network"~"^(iwn|nwn|rwn)$"]["ref"~"^GR"];'
        "out body;"
    )
    routes = []
    for element in overpass(query)["elements"]:
        tags = element.get("tags", {})
        children = [m["ref"] for m in element.get("members", []) if m["type"] == "relation"]
        if children:
            routes.append(
                {"ref": tags["ref"], "name": tags.get("name", ""), "network": tags["network"], "children": children}
            )
    return routes


def keep_ids_in_france(ids):
    """Keep only the relation ids that are inside France (a light question: ids only).

    Parameters
    ----------
    ids : list of int
        Relation ids.

    Returns
    -------
    list of int
        The ones inside France, in the same order.
    """
    inside = set()
    for start in range(0, len(ids), 300):
        batch = ids[start : start + 300]
        query = f"[out:json][timeout:200];area({FRANCE_AREA})->.fr;relation(id:{','.join(map(str, batch))})(area.fr);out ids;"
        inside.update(element["id"] for element in overpass(query)["elements"])
        time.sleep(3)
    return [i for i in ids if i in inside]


def download_relations(ids, france_only=False, resume_name=None):
    """Download the geometry of the relations, a few at a time.

    Each batch is saved as soon as it arrives (in ``tools/.cache``), so a long
    download that fails halfway resumes where it stopped when started again.

    Parameters
    ----------
    ids : list of int
        Relation ids.
    france_only : bool
        Keep only the relations inside France (used for the sections of the
        super-routes, many of which are in other countries).
    resume_name : str, optional
        Name of the cache file that keeps the finished batches.

    Returns
    -------
    list of dict
        The relations, with the position of every point of their ways.
    """
    scope = f"area({FRANCE_AREA})->.fr;" if france_only else ""
    where = "(area.fr)" if france_only else ""
    path = CACHE_DIR / resume_name if resume_name else None
    done = json.loads(path.read_text(encoding="utf-8")) if path and path.exists() else {}
    for start in range(0, len(ids), BATCH_SIZE):
        batch = ids[start : start + BATCH_SIZE]
        key = str(start)
        if key in done:
            continue
        log(f"relations {start + 1}-{start + len(batch)} of {len(ids)}")
        query = f"[out:json][timeout:200];{scope}relation(id:{','.join(map(str, batch))}){where};out geom;"
        done[key] = overpass(query)["elements"]
        if path:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(done, separators=(",", ":")), encoding="utf-8")
        time.sleep(3)  # let the public server breathe
    return [element for key in sorted(done, key=int) for element in done[key]]


def join_ways(ways):
    """Chain ways end to end into longer lines.

    Two ways are joined when one ends exactly where the other starts (or ends).

    Parameters
    ----------
    ways : list of list of (float, float)
        Ways, each a list of (lon, lat) points.

    Returns
    -------
    list of list of (float, float)
        Fewer, longer lines.
    """
    by_end = defaultdict(list)  # a way end -> the ways that touch it
    for index, way in enumerate(ways):
        by_end[way[0]].append(index)
        by_end[way[-1]].append(index)
    used = [False] * len(ways)
    lines = []
    for first in range(len(ways)):
        if used[first]:
            continue
        used[first] = True
        line = list(ways[first])
        for backwards in (False, True):
            if backwards:
                line.reverse()
            while True:
                nxt = next((i for i in by_end[line[-1]] if not used[i]), None)
                if nxt is None:
                    break
                used[nxt] = True
                part = ways[nxt] if ways[nxt][0] == line[-1] else ways[nxt][::-1]
                line.extend(part[1:])
        lines.append(line)
    return lines


def rank_of(ref, network):
    """Tell the big GR (rank 1) from the variants, links and regional trails (rank 2).

    The big ones have a plain number of one or two digits (GR 5, GR 10, GR 20,
    GR 34, GR 65...); the map shows them first, from far away.

    Parameters
    ----------
    ref : str
        The reference, for example ``"GR 54A"``.
    network : str
        ``"iwn"``, ``"nwn"`` or ``"rwn"``.

    Returns
    -------
    int
        1 for a big GR, 2 for the others.
    """
    return 1 if network in ("nwn", "iwn") and re.fullmatch(r"GR ?\d{1,2}", ref) else 2


def label_points(feature, step_km=25.0, density=1):
    """Choose points along a trail where its name will be written on the map.

    MapLibre cannot write along lines as winding as these trails, so the name is
    written at points instead (like the shields of a road map): one every
    ``step_km`` along each part of the trail, and always at least one. The map
    draws only those that fit.

    Parameters
    ----------
    feature : dict
        A GeoJSON ``MultiLineString`` feature with ``ref`` and ``rank``.
    step_km : float
        Distance along the trail between two points.
    density : int
        Written on each point (``density``): 1 for the sparse set, seen from far
        away, 2 for the dense one (every few km), only used when zoomed in, so
        that a number is always in view.

    Returns
    -------
    list of dict
        ``Point`` features with the same ``ref`` and ``rank``.
    """
    points = []
    for line in feature["geometry"]["coordinates"]:
        travelled = step_km / 2  # the first one half a step in, so lines do not all start with a label
        for (lon0, lat0), (lon1, lat1) in zip(line, line[1:]):
            dx = (lon1 - lon0) * math.cos(math.radians(lat0)) * 111.3
            dy = (lat1 - lat0) * 111.3
            travelled += math.hypot(dx, dy)
            if travelled >= step_km:
                points.append([lon1, lat1])
                travelled = 0.0
    if not points:  # a short trail still gets its name, in the middle of its longest part
        longest = max(feature["geometry"]["coordinates"], key=len)
        points.append(longest[len(longest) // 2])
    properties = {"ref": feature["properties"]["ref"], "rank": feature["properties"]["rank"], "density": density}
    return [{"type": "Feature", "properties": properties, "geometry": {"type": "Point", "coordinates": p}} for p in points]


def build_features(relations, identities=None):
    """Make one GeoJSON feature per GR number.

    All the relations sharing a number (sections, variants) are merged, and a
    piece of path shared by several of them is kept once.

    Parameters
    ----------
    relations : list of dict
        As returned by ``download_relations``.
    identities : dict, optional
        For the sections of the super-routes: section id -> ``(ref, name, network)``
        of the super-route they belong to (used instead of their own tags).

    Returns
    -------
    list of dict
        GeoJSON features (``MultiLineString``) with ``ref``, ``name``, ``network`` and ``rank``.
    """
    groups = defaultdict(lambda: {"ways": {}, "name": "", "size": 0, "network": "rwn"})
    for relation in relations:
        tags = relation.get("tags", {})
        if identities and relation["id"] in identities:
            ref, parent_name, network = identities[relation["id"]]
            tags = {**tags, "ref": ref, "name": parent_name, "network": network}
        group = groups[tags.get("ref", "").strip()]
        network = tags.get("network", "rwn")
        if NETWORK_RANK.get(network, 0) > NETWORK_RANK[group["network"]]:
            group["network"] = network
        name = re.sub(r"\s*[-–]\s*(sec\.?|section|étape|etape)\s*\S*.*$", "", tags.get("name", ""), flags=re.I)
        size = len(relation.get("members", []))
        if name and size >= group["size"]:
            group["name"], group["size"] = name, size  # the name of the biggest relation
        for member in relation.get("members", []):
            if member["type"] == "way" and member.get("geometry"):
                points = tuple((p["lon"], p["lat"]) for p in member["geometry"])
                group["ways"][member["ref"]] = points

    features = []
    for ref, group in sorted(groups.items()):
        if group["network"] == "rwn":
            continue  # the "GR de Pays" (regional trails) are not wanted, only the classic GR
        ways = [w for w in group["ways"].values() if len(w) > 1]
        lines = []
        for line in join_ways(ways):
            if not touches_france(line):
                continue  # a piece of trail that never enters France (e.g. the Spanish GR 4)
            simple = round_points(simplify_line(line, TOLERANCE), DECIMALS)
            if len(simple) > 1:
                lines.append(simple)
        if lines:
            features.append(
                {
                    "type": "Feature",
                    "properties": {"ref": ref, "name": group["name"], "network": group["network"], "rank": rank_of(ref, group["network"])},
                    "geometry": {"type": "MultiLineString", "coordinates": lines},
                }
            )
    return features


def main():
    ids = cached_json("gr_relation_ids.json", list_relation_ids)
    relations = cached_json("gr_relations.json", lambda: download_relations(ids))

    superroutes = cached_json("gr_superroutes.json", list_superroutes)
    identities = {}
    for route in superroutes:
        for child in route["children"]:
            identities[child] = (route["ref"].strip(), route["name"], route["network"])
    french = cached_json("gr_sections_ids.json", lambda: keep_ids_in_france(sorted(identities)))
    sections = cached_json("gr_sections.json", lambda: download_relations(french, resume_name="gr_sections_partial.json"))
    log(f"{len(relations)} relations, {len(superroutes)} super-routes, {len(sections)} sections in France (of {len(identities)})")

    trails = build_features(relations + sections, identities)
    labels = [point for trail in trails for point in label_points(trail, 25.0, 1) + label_points(trail, 3.0, 2)]
    log(f"{len(trails)} trails, {len(labels)} label points")
    write_geojson(OUTPUT_PATH, trails + labels)


if __name__ == "__main__":
    main()
