// ============================================================================
//  Hong Kong Typhoon Dashboard
//  - HKO live warning data is fetched from the official Open Data API (CORS:*).
//  - Other sources are embedded inline when they allow framing, otherwise
//    launched in a new tab (they set X-Frame-Options).
//  Edit SOURCES below to add / remove / relabel perspectives.
// ============================================================================

const HKO_WARN = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warningInfo&lang=en";
const HKO_TC = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=tropicalcyclone&lang=en";

// HK-centred coordinates for maps
const LAT = 20.3, LON = 114.2, ZOOM = 5;

const SOURCES = [
  {
    id: "jma",
    name: "JMA — Japan Meteorological Agency",
    type: "Official",
    perspective: "Official RSMC Tokyo Best Track & forecast for the NW Pacific — the region's designated warning centre.",
    embed: "https://www.jma.go.jp/bosai/map.html#contents=typhoon&lang=en",
    link: { label: "JMA Typhoon", url: "https://www.jma.go.jp/bosai/map.html#contents=typhoon&lang=en" },
  },
  {
    id: "cma",
    name: "CMA — China Meteorological Administration (nmc.cn)",
    type: "Official",
    perspective: "Official China TC centre track & intensity — a useful cross-check on JMA / HKO.",
    embed: "https://typhoon.nmc.cn/",
    link: { label: "CMA Typhoon", url: "https://typhoon.nmc.cn/" },
  },
  {
    id: "jtwc",
    name: "JTWC — Joint Typhoon Warning Center",
    type: "Official",
    perspective: "US Navy/Air Force warnings + Prognostic Reasoning — widely used internationally for intensity & track guidance.",
    embed: null,
    links: [{ label: "JTWC Home", url: "https://www.metoc.navy.mil/jtwc/jtwc.html" }],
  },
  {
    id: "tt",
    name: "Tropical Tidbits",
    type: "Model",
    perspective: "Numerical model output (GFS/ECMWF/ICON). The spread between models shows forecast uncertainty.",
    embed: null,
    links: [{ label: "Tropical Tidbits Models", url: "https://www.tropicaltidbits.com/analysis/models/" }],
  },
  {
    id: "windy",
    name: "Windy",
    type: "Nowcast",
    perspective: "Real-time blended wind / rain / radar / satellite nowcast. Switch layers with the buttons below.",
    embed: windyUrl("wind"),
    overlays: {
      Wind: windyUrl("wind"),
      Rain: windyUrl("rain"),
      Radar: windyUrl("radar"),
      Satellite: windyUrl("satellite"),
      Clouds: windyUrl("clouds"),
    },
    link: { label: "Windy", url: `https://www.windy.com/?${LAT},${LON},${ZOOM}` },
  },
  {
    id: "ventusky",
    name: "VentuSky",
    type: "Nowcast",
    perspective: "Alternative real-time weather map (wind / rain / pressure) — a second nowcast perspective.",
    embed: `https://www.ventusky.com/?lat=${LAT}&lon=${LON}&z=${ZOOM}&layers=wind`,
    link: { label: "VentuSky", url: `https://www.ventusky.com/?lat=${LAT}&lon=${LON}&z=${ZOOM}&layers=wind` },
  },
  {
    id: "zoom",
    name: "Zoom Earth",
    type: "Satellite",
    perspective: "Live satellite imagery + storm tracking timeline. See the eye and cloud structure from space.",
    embed: null,
    links: [{ label: "Zoom Earth Storms", url: "https://zoom.earth/storms/" }],
  },
  {
    id: "nasa",
    name: "NASA Worldview",
    type: "Satellite",
    perspective: "NASA EOSDIS satellite layers (true-colour, infrared, lightning) over the South China Sea.",
    embed: null,
    links: [
      {
        label: "Worldview (HK view)",
        url: "https://worldview.earthdata.nasa.gov/?v=104,8,126,32&l=Reference_Features,Reference_Labels,CorrectedReflectance_Bands721",
      },
    ],
  },
  {
    id: "hkia",
    name: "HKIA — Flight Status",
    type: "Impact",
    perspective: "How the storm disrupts travel — flight cancellations / delays at Hong Kong International Airport.",
    embed: null,
    links: [
      { label: "Flight status", url: "https://www.hongkongairport.com/flightstatus/" },
      { label: "HKO airport weather", url: "https://www.hko.gov.hk/en/wxinfo/awfg.htm" },
    ],
  },
];

function windyUrl(overlay) {
  return `https://embed.windy.com/embed2.html?lat=${LAT}&lon=${LON}&detailLat=${LAT}&detailLon=${LON}&zoom=${ZOOM}` +
    `&level=surface&overlay=${overlay}&product=ecmwf&menu=&message=&marker=`;
}

// ---------------------------------------------------------------------------
//  HKO live panel (warningInfo)
// ---------------------------------------------------------------------------
async function loadHKO() {
  const body = document.getElementById("hko-body");
  body.innerHTML = '<p class="loading">Loading HKO data…</p>';
  try {
    const warnRes = await fetch(HKO_WARN).then((r) => (r.ok ? r.json() : null));
    const cards = [];

    // --- Current typhoon signal (present only when a TC signal is in force) ---
    const ts = warnRes && warnRes.typhoonSignal;
    if (ts && ts.code && ts.code !== "TCNR") {
      cards.push(`
        <div class="hko-card">
          <h3>Typhoon Signal</h3>
          <span class="signal-tag">${esc(ts.name || ts.code)}</span>
          <div class="row"><span>Issued</span><span>${fmt(ts.issueTime)}</span></div>
          <div class="row"><span>Updated</span><span>${fmt(ts.updateTime)}</span></div>
          ${ts.desc ? `<p style="font-size:12px;color:var(--muted)">${esc(ts.desc)}</p>` : ""}
        </div>`);
    } else {
      // Try the dedicated tropical-cyclone endpoint (may be unavailable).
      let tcLive = null;
      try {
        const txt = await fetch(HKO_TC).then((r) => r.text());
        const j = JSON.parse(txt);
        if (j && j.tcInfoList && j.tcInfoList.length) tcLive = j;
      } catch (e) {
        /* endpoint unavailable — ignore */
      }

      if (tcLive) {
        tcLive.tcInfoList.forEach((tc) => {
          const track = tc.track || {};
          const rows = (track.observedTrack || [])
            .concat(track.forecastTrack || [])
            .map(
              (p) =>
                `<div>${p.forecastDate || ""} ${p.forecastTime || ""} — ${num(p.latitude)}°, ${num(
                  p.longitude
                )}° · ${num(p.windSpeed)} km/h</div>`
            )
            .join("");
          cards.push(`
            <div class="hko-card">
              <h3>Tropical Cyclone</h3>
              <div class="big">${esc(tc.name || "—")}</div>
              <div class="row"><span>Intensity</span><span>${esc(tc.intensity || "—")}</span></div>
              <div class="row"><span>Signal</span><span>${esc(tc.signal || "—")}</span></div>
              <div class="row"><span>Movement</span><span>${esc(tc.movement || "—")}</span></div>
              <div class="row"><span>Position</span><span>${esc(tc.position || "—")}</span></div>
              <div class="track-list">${rows || "<div>No track data</div>"}</div>
            </div>`);
        });
      } else {
        cards.push(`
          <div class="hko-card">
            <h3>Tropical Cyclone</h3>
            <p>No tropical cyclone currently affecting Hong Kong.</p>
            <p style="font-size:12px;color:var(--muted)">HKO's live track JSON API is presently unavailable;
              see the JMA / CMA panels and the HKO link above for track graphics.</p>
          </div>`);
      }
    }

    // --- Other active warnings (rainstorm / thunderstorm / etc.) ---
    const details = warnRes && warnRes.details ? warnRes.details : [];
    if (details.length) {
      const items = details
        .map(
          (d) =>
            `<div class="row"><span>${esc(d.warningStatementCode || "")}</span><span>${fmt(d.updateTime)}</span></div>`
        )
        .join("");
      cards.push(`
        <div class="hko-card">
          <h3>Other Active Warnings</h3>
          ${items}
        </div>`);
    }

    body.innerHTML = cards.join("");
  } catch (e) {
    body.innerHTML = `<p class="error">Could not load HKO data: ${esc(e.message)}.<br/>
      Tip: serve this page over http (e.g. <code>python -m http.server</code>) so the browser allows the cross-origin request.</p>`;
  }
}

// ---------------------------------------------------------------------------
//  Perspective grid
// ---------------------------------------------------------------------------
function renderSources() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  SOURCES.forEach((s) => {
    const card = document.createElement("section");
    card.className = "card";

    const head = `
      <div class="card-head">
        <span class="badge badge-${s.type.toLowerCase()}">${s.type}</span>
        <div class="name">${esc(s.name)}</div>
        <div class="pp">${esc(s.perspective)}</div>
      </div>`;

    let tools = "";
    let main = "";
    let open = "";

    if (s.embed) {
      const sw = s.overlays || s.models;
      if (sw) {
        const btns = Object.keys(sw)
          .map((k, i) => `<button class="mini-btn ${i === 0 ? "active" : ""}" data-url="${esc(sw[k])}">${esc(k)}</button>`)
          .join("");
        tools = `<div class="card-tools">${btns}</div>`;
      }
      main = `<div class="frame-wrap"><iframe src="${esc(s.embed)}" loading="lazy" referrerpolicy="no-referrer"></iframe></div>`;
      const lk = s.link || (s.links && s.links[0]);
      if (lk) open = `<div class="open-row"><a href="${esc(lk.url)}" target="_blank" rel="noopener">Open ${esc(lk.label)} ↗</a></div>`;
    } else {
      const links = (s.links || [s.link])
        .filter(Boolean)
        .map((l, i) => `<a class="${i === 0 ? "" : "alt"}" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`)
        .join("");
      main = `<div class="launch"><p style="color:var(--muted);font-size:13px;margin:0">This source blocks inline embedding. Open it directly:</p><div class="links">${links}</div></div>`;
    }

    card.innerHTML = head + tools + main + open;

    if (s.embed && (s.overlays || s.models)) {
      const btns = card.querySelectorAll(".mini-btn");
      const frame = card.querySelector("iframe");
      btns.forEach((b) =>
        b.addEventListener("click", () => {
          btns.forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
          frame.src = b.dataset.url;
        })
      );
    }

    grid.appendChild(card);
  });
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------
function fmt(s) {
  if (!s) return "—";
  return String(s).replace("T", " ").slice(0, 16);
}
function num(v) {
  return v === undefined || v === null ? "—" : v;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function stamp() {
  document.getElementById("updated").textContent = "Updated " + new Date().toLocaleString();
}

async function refreshAll() {
  stamp();
  await loadHKO();
}

document.getElementById("refresh").addEventListener("click", refreshAll);
renderSources();
refreshAll();
setInterval(refreshAll, 10 * 60 * 1000); // auto-refresh every 10 min
