# Mon carnet de rando

A small tool to plan your hikes in France on a computer, then check them on your phone while hiking, even without a network connection.

It is a personal, free, ad-free, independent project, still under construction.

## Features

- **Draw a hike on the IGN map**: place points and the route follows the trails automatically, with distance, elevation gain and an elevation profile.
- **Split it into stages**: day walk, hike or multi-day trek.
- **Add points of interest**: spring, bivouac, hut, viewpoint, plus comments.
- **See the weather and the sun** at the start of each day: temperature, rain, snow, wind, sunrise and sunset.
- **Keep your hikes**: name, description, rating, date completed, and an overview map of all your hikes with filters.
- **Use it on your phone too**: a layout designed for touch screens.

The interface is in French and the map covers mainland France.

## Project status

| | |
|---|---|
| Planning, profile, stages, weather | Done |
| Phone layout | Done |
| Hosting, user accounts, online saving | In progress |
| Install as an app and use offline, offline maps | Planned |
| GPX export | Planned |

## Try it at home

You need [Node.js](https://nodejs.org) (version 20 or newer).

```bash
npm install
npm run dev
```

The app then opens at `http://localhost:5173`. For now, hikes are saved in a local `data/` folder.

## Sources and credits

- Detailed map, walking routes and elevation: [IGN Géoplateforme](https://geoservices.ign.fr/) (Licence Ouverte)
- Overview map: [OpenFreeMap](https://openfreemap.org/), data © [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL)
- Relief and world base map: [Natural Earth](https://www.naturalearthdata.com/) (public domain)
- Outline of France: IGN Admin Express, via [france-geojson](https://github.com/gregoiredavid/france-geojson)
- Weather forecasts: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0)
- Sunrise and sunset: computed locally with [SunCalc](https://github.com/mourner/suncalc)
