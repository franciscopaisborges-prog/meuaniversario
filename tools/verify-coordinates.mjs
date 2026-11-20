/**
 * Verificação de coordenadas com o OpenStreetMap (Nominatim).
 *
 * Uso:  node tools/verify-coordinates.mjs
 *
 * Para cada atividade com localização, pesquisa a morada no Nominatim e
 * mostra a distância entre a coordenada usada no site e o resultado do OSM.
 * Respeita a política de utilização do Nominatim (1 pedido por segundo).
 * Depois de confirmar, atualize assets/js/site/program.js
 * (lat, lng e precision: "verified" + source).
 */
import { PROGRAM } from "../assets/js/site/program.js";

const EXTRA = [
  { id: "06a", title: "Metrobus — paragem Aeminium", query: "Aeminium, Coimbra" },
  { id: "06b", title: "Metrobus — paragem Arnado", query: "Arnado, Coimbra" },
  { id: "08", title: "Fluxo Coworking", query: "Fluxo Coworking, Coimbra" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function geocode(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q: query, format: "jsonv2", limit: "3", countrycodes: "pt" });
  const res = await fetch(url, { headers: { "User-Agent": "fr-aniversario-coordinate-check/1.0", "Accept-Language": "pt-PT" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const rows = [
  ...PROGRAM.filter((a) => a.location).map((a) => ({
    id: a.id,
    title: a.title,
    query: a.mapsQuery || a.address,
    current: a.location,
  })),
  ...EXTRA,
];

for (const row of rows) {
  try {
    const results = await geocode(row.query);
    if (!results.length) {
      console.log(`\n${row.id} ${row.title}\n   OSM: sem resultados para "${row.query}"`);
    } else {
      const best = results[0];
      const osm = { lat: Number(best.lat), lng: Number(best.lon) };
      console.log(`\n${row.id} ${row.title}`);
      console.log(`   OSM:   ${osm.lat.toFixed(6)}, ${osm.lng.toFixed(6)}  (${best.display_name})`);
      if (row.current) {
        const d = haversine(row.current, osm);
        const flag = d <= 150 ? "OK" : "VERIFICAR";
        console.log(`   Site:  ${row.current.lat}, ${row.current.lng}  [${row.current.precision}]  → ${Math.round(d)} m  ${flag}`);
      }
    }
  } catch (error) {
    console.log(`\n${row.id} ${row.title}\n   Erro: ${error.message}`);
  }
  await sleep(1100);
}
console.log("\nNota: o resultado do OSM é uma ajuda — confirme sempre visualmente no mapa antes de alterar.");
