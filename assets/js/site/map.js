/**
 * Mapas Leaflet + OpenStreetMap.
 *  - createOverviewMap: mapa geral (preto & dourado) na página principal.
 *  - createDetailMap:   mapa individual (branco & azul) em cada atividade.
 */
import { PROGRAM, ROUTES, METRO_STOPS, COIMBRA_CENTER } from "./program.js";
import { num, timeOf } from "./state.js";
import { esc } from "../shared/dom.js";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

export const ROUTE_STYLES = {
  walk: { color: "#4f9d69", weight: 4, opacity: 1 },
  "metro-out": { color: "#3d7be0", weight: 5, opacity: 1 },
  "metro-back": { color: "#6f8fd6", weight: 4, opacity: 1, dashArray: "7 7" },
  other: { color: "#c9a961", weight: 3.5, opacity: 1, dashArray: "1 7", lineCap: "round" },
};

/** Percursos verificados (só estes são desenhados). */
export const VERIFIED_ROUTES = ROUTES.filter(
  (r) => r.verified === true && Array.isArray(r.points) && r.points.length > 1
);

function leaflet() {
  return window.L || null;
}

function addTiles(L, map) {
  return L.tileLayer(TILE_URL, {
    maxZoom: 19,
    attribution: ATTRIBUTION,
    crossOrigin: true,
  }).addTo(map);
}

/** Agrupa atividades que partilham exatamente a mesma coordenada. */
function groupByLocation(activities) {
  const groups = new Map();
  for (const activity of activities) {
    if (!activity.location) continue;
    const key = `${activity.location.lat.toFixed(6)},${activity.location.lng.toFixed(6)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(activity);
  }
  return Array.from(groups.values());
}

function popupHtml(group) {
  return `<div class="popup">${group
    .map(
      (a) => `
      <div class="popup__item">
        <p class="popup__num">${esc(num(a))} · ${esc(a.kicker)} · ${esc(timeOf(a))}</p>
        <p class="popup__title">${esc(a.title)}</p>
        <p class="popup__text">${esc(a.summary)}</p>
        ${
          a.location.precision !== "verified"
            ? '<p class="popup__warn">Posição aproximada — a confirmar.</p>'
            : ""
        }
        <a class="popup__link" href="#/atividade/${esc(a.slug)}" data-activity-link="${esc(a.slug)}">Ver detalhes →</a>
      </div>`
    )
    .join('<hr style="border:0;border-top:1px solid rgba(201,169,97,.2);margin:.6rem 0">')}</div>`;
}

/** Bearing (graus) entre dois pontos, para orientar as setas dos percursos. */
function bearing([lat1, lng1], [lat2, lng2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Desenha percursos com contorno (legibilidade sobre o mapa) e setas de
 * direção espaçadas ao longo da linha.
 */
/**
 * Desloca uma linha `meters` para a direita do sentido de marcha.
 * Usado só para separar visualmente a ida e o regresso do Metrobus,
 * que no OpenStreetMap partilham a mesma via.
 */
function offsetLine(points, meters) {
  const R = 6378137;
  const n = points.length;
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    const cos = Math.cos((p[0] * Math.PI) / 180);
    const dx = (b[1] - a[1]) * cos; // leste
    const dy = b[0] - a[0]; // norte
    const len = Math.hypot(dx, dy) || 1;
    // normal à direita: (dy, -dx)
    const nx = dy / len;
    const ny = -dx / len;
    const dLat = ((ny * meters) / R) * (180 / Math.PI);
    const dLng = ((nx * meters) / (R * cos)) * (180 / Math.PI);
    return [p[0] + dLat, p[1] + dLng];
  });
}

const ARROW_PHASE = { walk: 0.5, "metro-out": 0.3, "metro-back": 0.8, other: 0.5 };

function drawRoutes(L, map, routes, { casing = "#050505", spacing = 160, arrowSize = 16, colors = {}, metroOffset = 0 } = {}) {
  const layers = [];
  for (const original of routes) {
    const route =
      metroOffset && original.type.startsWith("metro")
        ? { ...original, points: offsetLine(original.points, metroOffset) }
        : original;
    const base = ROUTE_STYLES[route.type] || ROUTE_STYLES.other;
    const style = colors[route.type] ? { ...base, color: colors[route.type] } : base;
    const label = esc(route.label || "");
    const under = L.polyline(route.points, {
      color: casing,
      weight: style.weight + 4,
      opacity: 0.75,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
    }).addTo(map);
    const line = L.polyline(route.points, { ...style, lineJoin: "round" })
      .addTo(map)
      .bindTooltip(label, { sticky: true, className: "route-tip" });
    layers.push(under, line);

    // Setas a cada `spacing` metros, orientadas pelo segmento.
    let carried = spacing * (ARROW_PHASE[route.type] ?? 0.5);
    for (let i = 0; i < route.points.length - 1; i += 1) {
      const a = route.points[i];
      const b = route.points[i + 1];
      const seg = map.distance(a, b);
      let at = carried;
      while (at < seg) {
        const t = at / seg;
        const pos = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const angle = bearing(a, b);
        const arrow = L.marker(pos, {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "route-arrow",
            iconSize: [arrowSize, arrowSize],
            iconAnchor: [arrowSize / 2, arrowSize / 2],
            html: `<svg viewBox="0 0 16 16" width="${arrowSize}" height="${arrowSize}" style="transform:rotate(${angle}deg)" aria-hidden="true"><path d="M3.5 11L8 4.5l4.5 6.5" fill="none" stroke="${casing}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 11L8 4.5l4.5 6.5" fill="none" stroke="${style.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
          }),
        }).addTo(map);
        layers.push(arrow);
        at += spacing;
      }
      carried = at - seg;
    }
  }
  return layers;
}

/** Paragens do Metrobus como pequenos marcadores. */
function drawMetroStops(L, map, { fill = "#3d7be0", stroke = "#050505", labels = false } = {}) {
  for (const stop of METRO_STOPS) {
    if (labels) {
      L.marker([stop.lat, stop.lng], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({ className: "stop-label", iconSize: [0, 0], html: `<span>${esc(stop.name)}</span>` }),
      }).addTo(map);
    }
    L.circleMarker([stop.lat, stop.lng], {
      radius: 6,
      color: stroke,
      weight: 2,
      fillColor: fill,
      fillOpacity: 1,
    })
      .addTo(map)
      .bindTooltip(`Metrobus · paragem ${esc(stop.name)}`, { direction: "top", offset: [0, -6] });
  }
}

/**
 * Mapa geral. Devolve { map, focusActivity(slug) } ou null se o Leaflet falhar.
 */
export function createOverviewMap(container) {
  const L = leaflet();
  if (!L) {
    container.innerHTML =
      '<div class="map-fallback">Não foi possível carregar o mapa. Verifica a ligação e recarrega a página.</div>';
    return null;
  }
  container.innerHTML = "";

  const map = L.map(container, {
    center: [COIMBRA_CENTER.lat, COIMBRA_CENTER.lng],
    zoom: 14,
    scrollWheelZoom: false,
    zoomSnap: 0.25,
  });
  addTiles(L, map);

  // Roda do rato só depois de o utilizador interagir com o mapa (evita prender o scroll da página).
  map.once("focus click", () => map.scrollWheelZoom.enable());

  const markersBySlug = new Map();
  const bounds = [];

  const groups = [];
  const pinIcon = (group) => {
    const approx = group.some((a) => a.location.precision !== "verified");
    const label = group.map((a) => num(a)).join("·");
    const width = label.length > 2 ? 46 : 28;
    return L.divIcon({
      className: "",
      iconSize: [width, 28],
      iconAnchor: [width / 2, 14],
      popupAnchor: [0, -14],
      html: `<span class="fr-pin${approx ? " fr-pin--approx" : ""}" style="width:${width}px;border-radius:${
        width > 28 ? "14px" : "50%"
      }">${esc(label)}</span>`,
    });
  };
  const pinTitle = (group) => group.map((a) => `${num(a)} — ${a.title}`).join(" / ");

  for (const group of groupByLocation(PROGRAM)) {
    const { lat, lng } = group[0].location;
    const marker = L.marker([lat, lng], {
      title: pinTitle(group),
      alt: pinTitle(group),
      riseOnHover: true,
      icon: pinIcon(group),
    })
      .addTo(map)
      .bindPopup(popupHtml(group), { maxWidth: 280, autoPanPadding: [24, 24] });

    groups.push({ group, marker });
    group.forEach((a) => markersBySlug.set(a.slug, marker));
    bounds.push([lat, lng]);
  }

  /** Atualiza números e horários dos marcadores quando os horários mudam. */
  function refresh() {
    for (const { group, marker } of groups) {
      marker.setIcon(pinIcon(group));
      marker.setPopupContent(popupHtml(group));
      const el = marker.getElement();
      if (el) {
        el.title = pinTitle(group);
        el.setAttribute("alt", pinTitle(group));
      }
    }
  }

  const BAIXA = PROGRAM.filter((a) => ["02", "03", "04", "05", "06"].includes(a.id) && a.location).map((a) => [
    a.location.lat,
    a.location.lng,
  ]);
  const fitAll = () => bounds.length > 1 && map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
  const fitBaixa = () => BAIXA.length > 1 && map.fitBounds(BAIXA, { padding: [60, 60], maxZoom: 17 });
  fitAll();

  // Botões de enquadramento: dia completo / Baixa
  const ViewControl = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const box = L.DomUtil.create("div", "map-views");
      box.innerHTML =
        '<button type="button" data-view="all" aria-pressed="true">Dia completo</button><button type="button" data-view="baixa" aria-pressed="false">Baixa</button>';
      L.DomEvent.disableClickPropagation(box);
      box.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-view]");
        if (!btn) return;
        box.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        if (btn.dataset.view === "baixa") fitBaixa();
        else fitAll();
      });
      return box;
    },
  });
  new ViewControl().addTo(map);

  drawRoutes(L, map, VERIFIED_ROUTES);
  drawMetroStops(L, map);
  const routeCount = VERIFIED_ROUTES.length;

  function focusActivity(slug) {
    const marker = markersBySlug.get(slug);
    if (!marker) return false;
    map.closePopup();
    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      marker.openPopup();
    };
    map.once("moveend", open);
    setTimeout(open, 1400); // salvaguarda caso o mapa já esteja nessa posição
    map.flyTo(marker.getLatLng(), 17, { duration: 0.9 });
    return true;
  }

  // Recalcula o tamanho quando o contentor muda (rotação do telemóvel, etc.).
  if ("ResizeObserver" in window) {
    new ResizeObserver(() => map.invalidateSize()).observe(container);
  }

  return { map, focusActivity, refresh, routeCount, markerCount: markersBySlug.size };
}

/** Mapa individual de uma atividade (tema claro/azul). */
export function createDetailMap(container, activity) {
  const L = leaflet();
  if (!L) {
    container.innerHTML =
      '<div class="map-fallback" style="color:#2a3a63">Não foi possível carregar o mapa. Verifica a ligação.</div>';
    return null;
  }
  const loc = activity.location;
  const center = loc ? [loc.lat, loc.lng] : [COIMBRA_CENTER.lat, COIMBRA_CENTER.lng];
  const map = L.map(container, {
    center,
    zoom: loc ? activity.zoom || 16 : 14,
    scrollWheelZoom: false,
    zoomAnimation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
  addTiles(L, map);
  map.once("focus click", () => map.scrollWheelZoom.enable());

  const own = VERIFIED_ROUTES.filter((r) => (r.activities || []).includes(activity.id));
  if (own.length) {
    drawRoutes(L, map, own, {
      casing: "#ffffff",
      spacing: 150,
      arrowSize: 18,
      metroOffset: 7,
      colors: { "metro-out": "#1d3f9e", "metro-back": "#0b1d47", walk: "#2f8a55", other: "#a8853f" },
    });
    if (activity.special === "metrobus") {
      drawMetroStops(L, map, { fill: "#ffffff", stroke: "#0b1d47", labels: true });
    }
  }

  if (loc) {
    const approx = loc.precision !== "verified";
    L.marker(center, {
      title: activity.title,
      alt: activity.title,
      icon: L.divIcon({
        className: "",
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -18],
        html: `<span class="pin-blue${approx ? " pin-blue--approx" : ""}">${esc(num(activity))}</span>`,
      }),
    })
      .addTo(map)
      .bindPopup(
        `<strong>${esc(activity.place)}</strong><br>${esc(activity.address)}${
          approx ? "<br><em>Posição aproximada — a confirmar.</em>" : ""
        }`
      );
  }

  // Mapas com percursos: enquadrar o percurso principal da atividade.
  const focus = own.find((r) => r.type !== "other");
  if (focus) {
    const pts = [...focus.points, ...(loc ? [[loc.lat, loc.lng]] : [])];
    map.fitBounds(pts, { padding: [36, 36], maxZoom: activity.zoom || 17, animate: false });
  }
  return map;
}
