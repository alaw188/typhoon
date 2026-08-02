# Typhoon Dashboard (Hong Kong)

A single-page dashboard that aggregates typhoon / tropical-cyclone information for
Hong Kong from **different perspectives** — official signals, nowcast radar/wind,
model forecasts, satellite views, and airport impact.

## Sources
- **HKO (live)** — Hong Kong Observatory warning/signal (fetched live via Open Data API)
- **Windy / VentuSky / RainViewer** — nowcast (wind, rain, live HK radar)
- **Tropical Tidbits / Zoom Earth / NASA** — model & satellite perspectives (launch links)
- **HKIA ATIS** — airport operational/weather info (collapsible, below HKO)
- **CMA / JMA / JTWC** — official regional/international centres (bottom of grid / launch links)

## Run

The inline **HKIA ATIS** panel needs a local reverse proxy, because `atis.cad.gov.hk`
sends `Content-Security-Policy: frame-ancestors 'self'`, which blocks embedding it
from any other origin. `serve.py` proxies ATIS same-origin and strips that header.

```bash
cd this-folder
python serve.py
# open http://127.0.0.1:8765/
```

If you instead run `python -m http.server`, the ATIS panel will be blank and a
"Open in new tab" link is shown as a fallback (everything else still works).

## Notes
- The page auto-refreshes the HKO data every 10 minutes; the RainViewer radar every 5.
- Edit the `SOURCES` array in `app.js` to reorder / add / remove panels, or change the
  map centre via `LAT` / `LON` / `ZOOM` at the top.
