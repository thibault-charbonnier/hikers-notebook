# Map data

Static files used by the "Explorer" map. They are built once by the scripts in
`tools/` (run `python tools/<script>.py`; see each script for details) and
committed, so the site needs no server for them.

| File | What | Source and licence | Script |
| --- | --- | --- | --- |
| `france-mask.geojson` | Outline of metropolitan France (dims the rest of the world) | IGN Admin Express through [france-geojson](https://github.com/gregoiredavid/france-geojson), Licence Ouverte | `build_france_mask.py` |
| `gr-trails.geojson` | Long-distance hiking trails (GR), one feature per GR number | © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL | `build_gr_trails.py` |
| `pnr.geojson` | Regional natural parks (name and outline) | IGN BD TOPO, Licence Ouverte 2.0 (Etalab) | `build_pnr.py` |
| `peaks.geojson` | Summits, passes, peaks... with name, type, importance (1-6) and altitude | IGN BD TOPO and IGN RGE ALTI (altitudes), Licence Ouverte 2.0 (Etalab) | `build_peaks.py` |
| `massifs.geojson` | The massifs (Chartreuse, Vercors, Écrins, Aubrac…), with the big region each belongs to | © [refuges.info](https://www.refuges.info/) contributors, CC BY-SA 2.0 | `build_massifs.py` |

The maps that show these data must credit their sources (OpenStreetMap, IGN,
refuges.info). `massifs.geojson` stays under CC BY-SA 2.0: anyone reusing it
must credit refuges.info and share their changes under the same licence.

All outlines and trails are simplified to about 20-50 m: good for exploring,
not for navigation.
