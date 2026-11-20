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
 * Horários: nenhum horário está confirmado. Quando estiver, preencha `schedule`.
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

export const COIMBRA_CENTER = { lat: 40.2115, lng: -8.4325 };

export const PROGRAM = [
  {
    id: "01",
    slug: "ponto-de-encontro",
    kicker: "Ponto de encontro",
    title: "Estação Coimbra-B",
    place: "Estação Coimbra-B",
    address: "Rua do Padrão, Eiras, Coimbra",
    schedule: "A confirmar",
    summary: "O ponto de partida do dia e o local de encontro de todos os convidados.",
    description: [
      "Será o ponto inicial do aniversário e o local de encontro dos convidados.",
      "É aqui que o dia começa. A hora exata de encontro será comunicada assim que estiver fechada.",
    ],
    notes: ["Hora de encontro a confirmar."],
    location: {
      lat: 40.2247283,
      lng: -8.4404774,
      precision: "verified",
      source: "OpenStreetMap — estação ferroviária Coimbra-B",
    },
    zoom: 16,
    mapsQuery: "Estação Coimbra-B, Coimbra",
  },
  {
    id: "02",
    slug: "almoco",
    kicker: "Almoço",
    title: "La Piccola Cucina Italiana",
    place: "La Piccola Cucina Italiana",
    address: "Terreiro da Erva 20, Coimbra",
    schedule: "A confirmar",
    summary: "Momento de almoço e convívio entre os convidados.",
    description: [
      "Momento de almoço e convívio entre os convidados.",
      "Uma mesa para seis, conversa sem pressa e o primeiro brinde do dia.",
    ],
    notes: ["Hora a confirmar."],
    location: {
      lat: 40.2123868,
      lng: -8.4309365,
      precision: "verified",
      source: "OpenStreetMap — restaurante La Piccola Cucina Italiana, Terreiro da Erva 20",
    },
    zoom: 17,
    mapsQuery: "La Piccola Cucina Italiana, Terreiro da Erva 20, Coimbra",
  },
  {
    id: "03",
    slug: "passeio-baixa",
    kicker: "Passeio a pé",
    title: "Passeio pela Baixa de Coimbra",
    place: "Praça 8 de Maio e Baixa histórica",
    address: "Praça 8 de Maio, Coimbra",
    schedule: "A confirmar",
    summary: "Passeio a pé pelas ruas históricas da cidade, com passagem pela Praça 8 de Maio.",
    description: [
      "Passeio a pé pelas ruas históricas da Baixa de Coimbra.",
      "O percurso inclui a Praça 8 de Maio, em frente ao Mosteiro de Santa Cruz, e segue pelas ruas comerciais da zona histórica.",
    ],
    notes: ["Percurso a pé assinalado no mapa (Rua da Sofia, Praça 8 de Maio, Rua Visconde da Luz).", "Hora a confirmar."],
    location: {
      lat: 40.2110645,
      lng: -8.4291833,
      precision: "verified",
      source: "OpenStreetMap — Praça 8 de Maio",
    },
    zoom: 17,
    mapsQuery: "Praça 8 de Maio, Coimbra",
  },
  {
    id: "04",
    slug: "torre-de-almedina",
    kicker: "Paragem",
    title: "Torre de Almedina",
    place: "Torre e Arco de Almedina",
    address: "Rua Ferreira Borges, Coimbra",
    schedule: "A confirmar",
    summary: "Paragem num dos elementos históricos mais emblemáticos da cidade.",
    description: [
      "Paragem para conhecer e apreciar um dos elementos históricos mais emblemáticos da cidade: a antiga porta da muralha medieval de Coimbra.",
      "A paragem é feita no exterior. A visita ao interior da torre não está incluída no programa.",
    ],
    notes: ["Visita ao interior não incluída.", "Hora a confirmar."],
    location: {
      lat: 40.2088402,
      lng: -8.4287341,
      precision: "verified",
      source: "OpenStreetMap — Torre e Arco de Almedina (Rua Ferreira Borges)",
    },
    zoom: 18,
    mapsQuery: "Torre de Almedina, Coimbra",
  },
  {
    id: "05",
    slug: "largo-da-portagem",
    kicker: "Vista sobre o rio",
    title: "Largo da Portagem",
    place: "Largo da Portagem",
    address: "Largo da Portagem, Coimbra",
    schedule: "A confirmar",
    summary: "Vista sobre o rio Mondego e a Ponte de Santa Clara.",
    description: [
      "Paragem para apreciar a vista sobre o rio Mondego e a Ponte de Santa Clara.",
      "A antiga entrada nobre da cidade, aberta para o rio — um bom momento para abrandar antes da viagem de Metrobus.",
    ],
    notes: ["Hora a confirmar."],
    location: {
      lat: 40.207449,
      lng: -8.429593,
      precision: "verified",
      source: "Câmara Municipal de Coimbra — roteiro turístico oficial",
    },
    zoom: 17,
    mapsQuery: "Largo da Portagem, Coimbra",
  },
  {
    id: "06",
    slug: "metrobus",
    kicker: "Viagem de Metrobus",
    title: "Portagem → Arnado → Portagem",
    place: "Paragens Portagem, Aeminium e Arnado",
    address: "Metrobus de Coimbra (Metro Mondego)",
    schedule: "A confirmar",
    summary: "Ida até Arnado, mudança de sentido e regresso à Portagem.",
    description: [
      "Uma curta viagem no Metrobus de Coimbra. Na ida: Portagem → Aeminium → Arnado.",
      "Em Arnado saímos e mudamos para a plataforma do sentido contrário. No regresso: Arnado → Aeminium → Portagem.",
    ],
    notes: [
      "Horários, frequência e funcionamento do serviço a confirmar junto da Metro Mondego.",
      "Títulos de transporte a confirmar.",
    ],
    location: {
      lat: 40.2075878,
      lng: -8.4307058,
      precision: "verified",
      source: "OpenStreetMap — paragem Portagem do Metrobus, linha MM U1",
    },
    zoom: 16,
    mapsQuery: "Metrobus Portagem, Coimbra",
    special: "metrobus",
    stops: ["Portagem", "Aeminium", "Arnado"],
  },
  {
    id: "07",
    slug: "golfe",
    kicker: "Golfe · Driving Range",
    title: "Quinta das Lágrimas Clube de Golfe",
    place: "Quinta das Lágrimas Clube de Golfe",
    address: "Rua António Augusto Gonçalves, Santa Clara, Coimbra",
    schedule: "A confirmar",
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
    id: "08",
    slug: "apresentacao-privada",
    kicker: "Private Project Presentation",
    title: "Apresentação privada de projetos",
    place: "Fluxo Coworking (previsto)",
    address: "Coimbra — morada a confirmar",
    schedule: "A confirmar",
    summary: "Uma apresentação especial. Alguns projetos, algumas ideias e algumas surpresas.",
    description: ["Uma apresentação especial. Alguns projetos, algumas ideias e algumas surpresas."],
    notes: [
      "Local previsto: Fluxo Coworking, Coimbra.",
      "A utilização do espaço ainda depende de confirmação.",
    ],
    location: null,
    zoom: 14,
    mapsQuery: "Fluxo Coworking, Coimbra",
    special: "private",
  },
  {
    id: "09",
    slug: "lanche",
    kicker: "Final do dia",
    title: "Lanche e momento de convívio",
    place: "Local a confirmar",
    address: "Preferencialmente associado ao espaço da apresentação",
    schedule: "A confirmar",
    summary: "Momento final para comer, conversar e celebrar o aniversário.",
    description: [
      "Momento final para comer, conversar e celebrar o aniversário.",
      "O local será, preferencialmente, associado ao espaço da apresentação. Os detalhes serão partilhados assim que estiverem confirmados.",
    ],
    notes: ["Local a confirmar.", "Hora a confirmar."],
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
  return PROGRAM.findIndex((a) => a.slug === slug);
}
