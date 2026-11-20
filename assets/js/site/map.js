/**
 * Mapas Leaflet + OpenStreetMap.
 *  - createOverviewMap: mapa geral (preto & dourado) na página principal.
 *  - createDetailMap:   mapa individual (branco & azul) em cada atividade.
 */
import { PROGRAM, ROUTES, COIMBRA_CENTER } from "./program.js";
import { esc } from "../shared/dom.js";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

export const ROUTE_STYLES = {
  walk: { color: "#4f9d69", weight: 4, opacity: 0.95 },
  "metro-out": { color: "#3d7be0", weight: 4, opacity: 0.95 },
  "metro-back": { color: "#6f8fd6", weight: 4, opacity: 0.95, dashArray: "8 8" },
  other: { color: "#c9a961", weight: 3, opacity: 0.9 },
};

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
        <p class="popup__num">${esc(a.id)} · ${esc(a.kicker)}</p>
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

/** Desenha apenas percursos verificados, com setas de direção. */
function drawRoutes(L, map) {
  const verified = ROUTES.filter((r) => r.verified === true && Array.isArray(r.points) && r.points.length > 1);
  for (const route of verified) {
    const style = ROUTE_STYLES[route.type] || ROUTE_STYLES.other;
    L.polyline(route.points, style).addTo(map).bindTooltip(esc(route.label || ""), { sticky: true });
    for (let i = 0; i < route.points.length - 1; i += 1) {
      const a = route.points[i];
      const b = route.points[i + 1];
      if (map.distance(a, b) < 60) continue;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const angle = bearing(a, b);
      L.marker(mid, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "",
          iconSize: [14, 14],
          html: `<svg viewBox="0 0 14 14" width="14" height="14" style="transform:rotate(${angle}deg)"><path d="M3 10l4-6 4 6" fill="none" stroke="${style.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        }),
      }).addTo(map);
    }
  }
  return verified.length;
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
    zoomSnap: 0.5,
  });
  addTiles(L, map);

  // Roda do rato só depois de o utilizador interagir com o mapa (evita prender o scroll da página).
  map.once("focus click", () => map.scrollWheelZoom.enable());

  const markersBySlug = new Map();
  const bounds = [];

  for (const group of groupByLocation(PROGRAM)) {
    const { lat, lng } = group[0].location;
    const approx = group.some((a) => a.location.precision !== "verified");
    const label = group.map((a) => a.id).join("·");
    const width = label.length > 2 ? 52 : 34;
    const marker = L.marker([lat, lng], {
      title: group.map((a) => `${a.id} — ${a.title}`).join(" / "),
      alt: group.map((a) => `${a.id} — ${a.title}`).join(" / "),
      riseOnHover: true,
      icon: L.divIcon({
        className: "",
        iconSize: [width, 34],
        iconAnchor: [width / 2, 17],
        popupAnchor: [0, -14],
        html: `<span class="fr-pin${approx ? " fr-pin--approx" : ""}" style="width:${width}px;border-radius:${
          width > 34 ? "17px" : "50%"
        }">${esc(label)}</span>`,
      }),
    })
      .addTo(map)
      .bindPopup(popupHtml(group), { maxWidth: 280, autoPanPadding: [24, 24] });

    group.forEach((a) => markersBySlug.set(a.slug, marker));
    bounds.push([lat, lng]);
  }

  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }

  const routeCount = drawRoutes(L, map);

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

  return { map, focusActivity, routeCount, markerCount: markersBySlug.size };
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
  });
  addTiles(L, map);
  map.once("focus click", () => map.scrollWheelZoom.enable());

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
        html: `<span class="pin-blue${approx ? " pin-blue--approx" : ""}">${esc(activity.id)}</span>`,
      }),
    })
      .addTo(map)
      .bindPopup(
        `<strong>${esc(activity.place)}</strong><br>${esc(activity.address)}${
          approx ? "<br><em>Posição aproximada — a confirmar.</em>" : ""
        }`
      );
  }
  return map;
}
