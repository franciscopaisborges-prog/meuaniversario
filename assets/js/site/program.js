/**
 * PROGRAMA DO ANIVERSÁRIO — fonte única de dados do site.
 *
 * Coordenadas:
 *  - precision: "verified"    → coordenada publicada por fonte oficial/independente
 *                               (indicada em `source`).
 *  - precision: "approximate" → posição de referência no mapa, ainda por verificar
 *                               (neste momento nenhuma; todas confirmadas no OSM).
 *                               É mostrada com marcador tracejado e o aviso
 *                               "posição aproximada". Corra `node tools/verify-coordinates.mjs`
 *                               para comparar com o OpenStreetMap e atualize aqui.
 *  - location: null           → localização não confirmada: não há marcador.
 *
 * Horários: NÃO estão aqui. São definidos no painel (admin.html → Horários),
 * guardados em /schedule na Realtime Database e mostrados automaticamente.
 */

export const EVENT = {
  name: "Francisco Rodrigues",
  initials: "FR",
  city: "Coimbra",
  dateISO: "2026-11-29",
  dateLabel: "29 de novembro de 2026",
  weekday: "Domingo",
  guests: 6,
};

export const COIMBRA_CENTER = { lat: 40.2075, lng: -8.428 };

export const PROGRAM = [
  {
    id: "01",
    slug: "ponto-de-encontro",
    kicker: "Ponto de encontro",
    title: "Largo da Portagem",
    place: "Largo da Portagem",
    address: "Largo da Portagem, Coimbra",
    summary: "O ponto de partida do dia, junto ao rio Mondego e à Ponte de Santa Clara.",
    description: [
      "Será o ponto inicial do aniversário e o local de encontro dos convidados.",
      "A antiga entrada nobre da cidade, com vista sobre o rio Mondego e a Ponte de Santa Clara. É também aqui que o passeio pela Baixa termina, antes de seguirmos para o resto do dia.",
    ],
    notes: [],
    location: {
      lat: 40.207449,
      lng: -8.429593,
      precision: "verified",
      source: "Câmara Municipal de Coimbra — roteiro turístico oficial (confirmado no OpenStreetMap)",
    },
    zoom: 17,
    mapsQuery: "Largo da Portagem, Coimbra",
  },
  {
    id: "02",
    slug: "metrobus",
    kicker: "Viagem de Metrobus",
    title: "Portagem → República",
    place: "Paragens Portagem e República",
    address: "Metrobus de Coimbra (Metro Mondego) · linha U2",
    summary: "Do rio à Alta da cidade: Portagem, Loja do Cidadão, Câmara, Mercado e República.",
    description: [
      "Uma curta viagem no Metrobus de Coimbra, desde a paragem Portagem até à Praça da República.",
      "Pelo caminho: Loja do Cidadão, Câmara e Mercado. Saímos na República, mesmo ao lado do almoço.",
    ],
    notes: [
      "Horários, frequência e funcionamento do serviço a confirmar junto da Metro Mondego.",
      "Títulos de transporte: traga o cartão Move C (ver AVISOS no formulário de presença).",
    ],
    location: {
      lat: 40.2075878,
      lng: -8.4307058,
      precision: "verified",
      source: "OpenStreetMap — paragem Portagem do Metrobus, linha MM U2",
    },
    zoom: 15,
    mapsQuery: "Metrobus Portagem, Coimbra",
    special: "metrobus",
    stops: ["Portagem", "Loja do Cidadão", "Câmara", "Mercado", "República"],
  },
  {
    id: "03",
    slug: "almoco",
    kicker: "Almoço",
    title: "Mr. Pizza",
    place: "Mr. Pizza · Praça da República",
    address: "Praça da República 38, Coimbra",
    summary: "Momento de almoço e convívio entre os convidados.",
    description: [
      "Momento de almoço e convívio entre os convidados.",
      "Uma mesa para seis, conversa sem pressa e o primeiro brinde do dia.",
    ],
    notes: [],
    location: {
      lat: 40.2090687,
      lng: -8.4201921,
      precision: "verified",
      source: "OpenStreetMap — Mr. Pizza, Praça da República 38",
    },
    zoom: 17,
    mapsQuery: "Mr. Pizza, Praça da República 38, Coimbra",
  },
  {
    id: "04",
    slug: "passeio-baixa",
    kicker: "Passeio a pé",
    title: "Passeio pela Baixa de Coimbra",
    place: "Praça 8 de Maio e Baixa histórica",
    address: "Praça 8 de Maio, Coimbra",
    summary: "Da Praça da República à Baixa, a pé, com passagem pela Praça 8 de Maio.",
    description: [
      "Passeio a pé pelas ruas históricas da cidade, desde a Praça da República até à Baixa.",
      "Descemos pela Avenida Sá da Bandeira e pela Rua da Fonte Nova até à Praça 8 de Maio, em frente ao Mosteiro de Santa Cruz, e seguimos pela Rua Visconde da Luz.",
    ],
    notes: ["Percurso a pé assinalado no mapa (cerca de 1,5 km até ao Largo da Portagem)."],
    location: {
      lat: 40.2110645,
      lng: -8.4291833,
      precision: "verified",
      source: "OpenStreetMap — Praça 8 de Maio",
    },
    zoom: 16,
    mapsQuery: "Praça 8 de Maio, Coimbra",
  },
  {
    id: "05",
    slug: "torre-de-almedina",
    kicker: "Paragem · regresso à Portagem",
    title: "Torre de Almedina",
    place: "Torre e Arco de Almedina",
    address: "Rua Ferreira Borges, Coimbra",
    summary: "Paragem num dos elementos históricos mais emblemáticos da cidade, antes de regressarmos ao Largo da Portagem.",
    description: [
      "Paragem para conhecer e apreciar um dos elementos históricos mais emblemáticos da cidade: a antiga porta da muralha medieval de Coimbra.",
      "A paragem é feita no exterior. Daqui descemos a Rua Ferreira Borges até ao Largo da Portagem, onde o passeio termina — no mesmo ponto onde o dia começou.",
    ],
    notes: ["Visita ao interior não incluída."],
    location: {
      lat: 40.2088402,
      lng: -8.4287341,
      precision: "verified",
      source: "OpenStreetMap — Torre e Arco de Almedina (Rua Ferreira Borges)",
    },
    zoom: 17,
    mapsQuery: "Torre de Almedina, Coimbra",
  },
  {
    id: "06",
    slug: "golfe",
    kicker: "Golfe · Driving Range",
    title: "Quinta das Lágrimas Clube de Golfe",
    place: "Quinta das Lágrimas Clube de Golfe",
    address: "Rua António Augusto Gonçalves, Santa Clara, Coimbra",
    summary: "Primeiras tacadas e princípios básicos do golfe, com foco no Driving Range.",
    description: [
      "Uma experiência recreativa de golfe, onde os convidados poderão experimentar algumas tacadas e aprender os princípios básicos da modalidade.",
      "A atividade privilegia o Driving Range. O clube tem posições de treino cobertas e descobertas; a disponibilidade de posições cobertas para seis pessoas tem de ser confirmada com o clube.",
    ],
    notes: [
      "Reserva ainda não confirmada.",
      "Disponibilidade de posições cobertas para 6 pessoas a confirmar com o clube.",
      "Preço e duração a confirmar.",
    ],
    location: {
      lat: 40.1987917,
      lng: -8.4336897,
      precision: "verified",
      source: "OpenStreetMap — campo de golfe da Quinta das Lágrimas",
    },
    zoom: 16,
    mapsQuery: "Quinta das Lágrimas Golfe, Rua António Augusto Gonçalves, Coimbra",
    special: "golf",
    contacts: {
      website: "https://www.quintadaslagrimasgolfe.pt/",
      websiteLabel: "quintadaslagrimasgolfe.pt",
      phone: "+351923312226",
      phoneLabel: "+351 923 312 226",
    },
  },
  {
    id: "07",
    slug: "apresentacao-privada",
    kicker: "Private Project Presentation",
    title: "Apresentação privada de projetos",
    place: "Sala Smart · Stay Hotel Coimbra Centro",
    address: "Avenida Fernão de Magalhães 199, 3000-176 Coimbra",
    summary: "Uma apresentação especial. Alguns projetos, algumas ideias e algumas surpresas.",
    description: ["Uma apresentação especial. Alguns projetos, algumas ideias e algumas surpresas."],
    notes: ["Local: Sala Smart do Stay Hotel Coimbra Centro."],
    location: {
      lat: 40.2117066,
      lng: -8.4328755,
      precision: "verified",
      source: "OpenStreetMap — Stay Hotel Coimbra Centro (stayhotels.pt/coimbra-centro)",
    },
    zoom: 17,
    mapsQuery: "Stay Hotel Coimbra Centro, Avenida Fernão de Magalhães 199, Coimbra",
    special: "private",
  },
  {
    id: "08",
    slug: "lanche",
    kicker: "Final do dia",
    title: "Lanche e momento de convívio",
    place: "Local a confirmar",
    address: "Preferencialmente junto ao espaço da apresentação (Stay Hotel Coimbra Centro)",
    summary: "Momento final para comer, conversar e celebrar o aniversário.",
    description: [
      "Momento final para comer, conversar e celebrar o aniversário.",
      "O local será, preferencialmente, junto ao espaço da apresentação, no Stay Hotel Coimbra Centro. Os detalhes serão partilhados assim que estiverem confirmados.",
    ],
    notes: ["Local exato a confirmar."],
    location: null,
    zoom: 14,
    mapsQuery: null,
  },
];

export { ROUTES, METRO_STOPS } from "./routes-data.js";

export function googleMapsUrl(activity) {
  if (!activity.mapsQuery) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.mapsQuery)}`;
}

export function findBySlug(slug) {
  return PROGRAM.find((a) => a.slug === slug) || null;
}

export function findIndexBySlug(slug) {
  return PROGRAM.findIndex((a) => a.slug === slug);
}
