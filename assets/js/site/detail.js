/**
 * Página de detalhe de cada atividade (identidade branco & azul).
 * Devolve HTML a partir dos dados de program.js; o mapa é montado por app.js.
 */
import { PROGRAM, googleMapsUrl } from "./program.js";
import { esc, icon } from "../shared/dom.js";

const PENDING = /a confirmar/i;

function value(text) {
  return PENDING.test(text) ? `<span class="tag-pending">${esc(text)}</span>` : esc(text);
}

function curves() {
  return `
  <svg class="d-curves" viewBox="0 0 1440 780" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <path class="c1" d="M760 -20C820 160 1040 220 1180 200S1460 120 1520 260" />
    <path class="c2" d="M520 -40C640 220 980 360 1220 330S1500 420 1540 520" />
    <path class="c3" d="M1100 780C1160 640 1300 560 1460 580" />
  </svg>`;
}

function metrobusHorizontal() {
  const stops = [110, 340, 570];
  const names = ["Portagem", "Aeminium", "Arnado"];
  const chevronR = (x, y) => `<path d="M${x - 6} ${y - 8}l9 8-9 8" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  const chevronL = (x, y) => `<path d="M${x + 6} ${y - 8}l-9 8 9 8" fill="none" stroke="#0b1d47" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `
  <svg class="metro-h" viewBox="0 0 680 300" role="img" aria-labelledby="metroHTitle">
    <title id="metroHTitle">Esquema da viagem de Metrobus: ida de Portagem a Arnado, mudança de sentido em Arnado e regresso a Portagem.</title>
    <text x="40" y="115" font-size="11" font-weight="600" letter-spacing="2.5" fill="#1d3f9e" text-anchor="end" transform="rotate(-90 40 115)">IDA</text>
    <text x="40" y="205" font-size="11" font-weight="600" letter-spacing="2.5" fill="#0b1d47" text-anchor="end" transform="rotate(-90 40 205)">REGRESSO</text>

    <path d="M110 110H570" stroke="#1d3f9e" stroke-width="12" stroke-linecap="round"/>
    <path d="M570 200H110" stroke="#0b1d47" stroke-width="5" stroke-dasharray="12 9" stroke-linecap="round"/>
    <path d="M570 110C660 110 660 200 570 200" fill="none" stroke="#9cc0ea" stroke-width="3" stroke-dasharray="4 6" stroke-linecap="round"/>
    <path d="M637 150l-7 9-7-9" fill="none" stroke="#1d3f9e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>

    ${chevronR(225, 110)}${chevronR(455, 110)}
    <rect x="212" y="190" width="26" height="20" fill="#fff"/>${chevronL(225, 200)}
    <rect x="442" y="190" width="26" height="20" fill="#fff"/>${chevronL(455, 200)}

    ${stops
      .map(
        (x, i) => `
      <circle cx="${x}" cy="110" r="10" fill="#fff" stroke="#1d3f9e" stroke-width="3"/>
      <circle cx="${x}" cy="200" r="10" fill="#fff" stroke="#0b1d47" stroke-width="3"/>
      <text x="${x}" y="160" font-size="16" font-weight="600" fill="#0b1d47" text-anchor="middle">${names[i]}</text>
      <text x="${x}" y="178" font-size="10" letter-spacing="1.5" fill="#2a3a63" text-anchor="middle">PARAGEM</text>`
      )
      .join("")}

    <text x="110" y="78" font-size="11" font-weight="600" letter-spacing="1.8" fill="#1d3f9e" text-anchor="middle">PARTIDA</text>
    <path d="M110 84v12" stroke="#1d3f9e" stroke-width="1.5"/>
    <text x="110" y="244" font-size="11" font-weight="600" letter-spacing="1.8" fill="#0b1d47" text-anchor="middle">CHEGADA</text>
    <path d="M110 214v14" stroke="#0b1d47" stroke-width="1.5"/>

    <rect x="470" y="40" width="200" height="40" fill="#1d3f9e"/>
    <text x="570" y="58" font-size="11" font-weight="600" letter-spacing="1.6" fill="#fff" text-anchor="middle">EM ARNADO</text>
    <text x="570" y="73" font-size="11" fill="#dde9f7" text-anchor="middle">mudar de sentido</text>
    <path d="M570 80v16" stroke="#1d3f9e" stroke-width="1.5"/>
    <text x="570" y="244" font-size="11" fill="#2a3a63" text-anchor="middle">plataforma do sentido contrário</text>
  </svg>`;
}

function metrobusVertical() {
  const ys = [120, 270, 420];
  const names = ["Portagem", "Aeminium", "Arnado"];
  return `
  <svg class="metro-v" viewBox="0 0 340 560" role="img" aria-labelledby="metroVTitle">
    <title id="metroVTitle">Esquema da viagem de Metrobus: ida de Portagem a Arnado, mudança de sentido em Arnado e regresso a Portagem.</title>
    <text x="70" y="62" font-size="12" font-weight="600" letter-spacing="2" fill="#1d3f9e" text-anchor="middle">IDA</text>
    <text x="70" y="78" font-size="16" fill="#1d3f9e" text-anchor="middle">↓</text>
    <text x="160" y="62" font-size="12" font-weight="600" letter-spacing="2" fill="#0b1d47" text-anchor="middle">REGRESSO</text>
    <text x="160" y="78" font-size="16" fill="#0b1d47" text-anchor="middle">↑</text>

    <path d="M70 120V420" stroke="#1d3f9e" stroke-width="12" stroke-linecap="round"/>
    <path d="M160 420V120" stroke="#0b1d47" stroke-width="5" stroke-dasharray="12 9" stroke-linecap="round"/>
    <path d="M70 420C70 510 160 510 160 420" fill="none" stroke="#9cc0ea" stroke-width="3" stroke-dasharray="4 6" stroke-linecap="round"/>
    <path d="M106 486l9 -7-9 -7" fill="none" stroke="#1d3f9e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>

    ${[195, 345]
      .map(
        (y) => `
      <path d="M62 ${y - 5}l8 9 8-9" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="150" y="${y - 12}" width="20" height="24" fill="#fff"/>
      <path d="M152 ${y + 4}l8-9 8 9" fill="none" stroke="#0b1d47" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
      )
      .join("")}

    ${ys
      .map(
        (y, i) => `
      <circle cx="70" cy="${y}" r="10" fill="#fff" stroke="#1d3f9e" stroke-width="3"/>
      <circle cx="160" cy="${y}" r="10" fill="#fff" stroke="#0b1d47" stroke-width="3"/>
      <path d="M176 ${y}H192" stroke="#9cc0ea" stroke-width="1.5"/>
      <text x="200" y="${y + 5}" font-size="17" font-weight="600" fill="#0b1d47">${names[i]}</text>`
      )
      .join("")}

    <text x="200" y="${ys[0] + 24}" font-size="10" letter-spacing="1.4" fill="#2a3a63">PARTIDA E CHEGADA</text>
    <rect x="186" y="472" width="150" height="44" fill="#1d3f9e"/>
    <text x="261" y="491" font-size="11" font-weight="600" letter-spacing="1.4" fill="#fff" text-anchor="middle">EM ARNADO</text>
    <text x="261" y="507" font-size="11" fill="#dde9f7" text-anchor="middle">mudar de sentido</text>
  </svg>`;
}

function metrobusBlock() {
  return `
  <section class="d-block" aria-labelledby="metroTitle">
    <div class="d-block__head">
      <h2 class="d-block__title" id="metroTitle">O percurso</h2>
      <span class="d-block__meta">Esquema ilustrativo — não está à escala</span>
    </div>
    <div class="metro">
      <figure class="metro__figure">
        ${metrobusHorizontal()}
        ${metrobusVertical()}
        <figcaption>Linha cheia: ida. Linha tracejada: regresso. Em Arnado inverte-se o sentido da viagem.</figcaption>
      </figure>
      <ol class="metro__steps" aria-label="Passos da viagem">
        <li><span>Embarque na paragem <strong>Portagem</strong>, no sentido de Arnado.</span></li>
        <li><span>Passagem pela paragem <strong>Aeminium</strong>.</span></li>
        <li><span>Saída na paragem <strong>Arnado</strong>.</span></li>
        <li class="is-turn"><span><strong>Mudança de sentido:</strong> mudar para a plataforma do sentido contrário, em direção a Portagem.</span></li>
        <li><span>Regresso com passagem por <strong>Aeminium</strong>.</span></li>
        <li><span>Chegada a <strong>Portagem</strong>.</span></li>
      </ol>
    </div>
  </section>`;
}

function golfBlock(a) {
  const c = a.contacts;
  return `
  <section class="d-block" aria-labelledby="golfTitle">
    <div class="d-block__head">
      <h2 class="d-block__title" id="golfTitle">Driving Range</h2>
      <span class="d-block__meta">Reserva ainda não confirmada</span>
    </div>
    <div class="golf">
      <div class="golf__cell">
        <span class="golf__label">Formato</span>
        <span class="golf__value">Primeiras tacadas</span>
        <p>Experiência recreativa para aprender os princípios básicos da modalidade, com prioridade ao Driving Range.</p>
      </div>
      <div class="golf__cell">
        <span class="golf__label">Posições de treino</span>
        <span class="golf__value">Cobertas e descobertas</span>
        <p>A disponibilidade de posições cobertas para seis pessoas tem de ser confirmada com o clube.</p>
      </div>
      <div class="golf__cell">
        <span class="golf__label">Contactos do clube</span>
        <span class="golf__value"><a href="tel:${esc(c.phone)}">${esc(c.phoneLabel)}</a></span>
        <p><a href="${esc(c.website)}" target="_blank" rel="noopener" style="color:inherit">${esc(c.websiteLabel)}</a> · Preço e duração a confirmar.</p>
      </div>
    </div>
  </section>`;
}

function privateBlock() {
  return `
  <section class="private" aria-labelledby="privateTitle">
    <svg class="private__orbit" viewBox="0 0 600 600" aria-hidden="true" focusable="false">
      <g class="spin">
        <circle cx="300" cy="300" r="280" stroke-opacity=".18" stroke-dasharray="2 10"/>
        <path d="M300 60A240 240 0 0 1 540 300" stroke-opacity=".7"/>
      </g>
      <circle cx="300" cy="300" r="190" stroke-opacity=".22"/>
      <path d="M110 300A190 190 0 0 1 300 110" stroke-opacity=".6"/>
      <circle cx="300" cy="300" r="110" stroke-opacity=".14"/>
      <path d="M300 410A110 110 0 0 1 190 300" stroke-opacity=".45"/>
    </svg>
    <div class="private__inner">
      <p class="private__label eyebrow">08 — Acesso reservado</p>
      <h2 class="private__title" id="privateTitle" aria-label="Private Project Presentation">
        <span aria-hidden="true">Private Project</span>
        <span aria-hidden="true">Presentation</span>
      </h2>
      <p class="private__text">Uma apresentação especial. Alguns projetos, algumas ideias e algumas surpresas.</p>
      <ul class="redacted" aria-label="Conteúdo reservado até ao dia">
        <li><b aria-hidden="true">—</b><span></span></li>
        <li><b aria-hidden="true">—</b><span></span></li>
        <li><b aria-hidden="true">—</b><span></span></li>
      </ul>
    </div>
  </section>`;
}

function mapBlock(a) {
  const url = googleMapsUrl(a);
  const loc = a.location;
  let meta;
  let note;
  if (!loc) {
    meta = "Localização a confirmar";
    note =
      a.special === "private"
        ? "Local previsto: Fluxo Coworking, Coimbra. A utilização do espaço ainda depende de confirmação, por isso o mapa não assinala um ponto."
        : "O local ainda não está definido. O mapa mostra Coimbra e será atualizado quando houver confirmação.";
  } else if (loc.precision === "verified") {
    meta = "Localização assinalada";
    note = `Fonte da coordenada: ${esc(loc.source)}.`;
  } else {
    meta = "Posição aproximada";
    note = "O marcador tracejado indica uma posição aproximada, ainda por verificar. Usa o Google Maps para a morada exata.";
  }
  if (a.special === "metrobus") {
    note += " O mapa mostra o traçado real da linha (OpenStreetMap): ida em linha cheia, regresso a tracejado (afastados alguns metros para se distinguirem) e as paragens Portagem, Aeminium e Arnado.";
  } else if (a.id === "03" || a.id === "02" || a.id === "04" || a.id === "05") {
    note += " A linha verde mostra o percurso a pé pela Baixa.";
  }
  return `
  <section class="d-block" aria-labelledby="mapBlockTitle">
    <div class="d-block__head">
      <h2 class="d-block__title" id="mapBlockTitle">Localização</h2>
      <span class="d-block__meta">${meta}</span>
    </div>
    <div class="d-map-frame">
      <div class="d-map map--light" id="detailMap" role="region" aria-label="Mapa: ${esc(a.place)}"></div>
    </div>
    <div class="d-map-actions">
      <p class="d-map-note">${note}</p>
      ${
        url
          ? `<a class="btn-blue" href="${esc(url)}" target="_blank" rel="noopener">Abrir no Google Maps ${icon("i-external")}</a>`
          : ""
      }
    </div>
  </section>`;
}

function pager(index) {
  const prev = PROGRAM[index - 1];
  const next = PROGRAM[index + 1];
  const link = (a, dir) => `
    <a class="pager-link pager-link--${dir}" href="#/atividade/${esc(a.slug)}" data-nav="replace" rel="${dir}">
      <span class="pager-link__dir">${
        dir === "prev" ? `${icon("i-arrow-left", 14)} Anterior · ${esc(a.id)}` : `Seguinte · ${esc(a.id)} ${icon("i-arrow-right", 14)}`
      }</span>
      <span class="pager-link__title">${esc(a.title)}</span>
    </a>`;
  return `
  <nav class="d-pager" aria-label="Navegar entre atividades">
    ${prev ? link(prev, "prev") : '<span class="pager-link pager-link--empty">Início do programa</span>'}
    ${next ? link(next, "next") : '<span class="pager-link pager-link--empty">Fim do programa</span>'}
    <button class="btn-blue btn-blue--line d-pager__home" type="button" data-detail-back>${icon("i-arrow-left")} Voltar ao programa</button>
  </nav>`;
}

export function renderDetail(index) {
  const a = PROGRAM[index];
  const facts = [
    ["Etapa", `${a.id} de ${String(PROGRAM.length).padStart(2, "0")}`],
    ["Horário", value(a.schedule)],
    ["Local", value(a.place)],
    ["Morada", value(a.address)],
  ];
  if (a.special === "golf") {
    facts.push(["Telefone", `<a href="tel:${esc(a.contacts.phone)}">${esc(a.contacts.phoneLabel)}</a>`]);
    facts.push([
      "Site",
      `<a href="${esc(a.contacts.website)}" target="_blank" rel="noopener">${esc(a.contacts.websiteLabel)}</a>`,
    ]);
  }
  if (a.special === "metrobus") {
    facts.push(["Paragens", a.stops.map(esc).join(" · ")]);
  }

  const description = a.special === "private" ? [] : a.description;

  return `
    ${curves()}
    <header class="d-hero">
      <span class="d-num" aria-hidden="true">${esc(a.id)}</span>
      <div>
        <p class="d-kicker eyebrow">${esc(a.kicker)}</p>
        <h1 class="d-title" id="detailTitle">${esc(a.title)}</h1>
        ${a.special === "private" ? "" : `<p class="d-lead">${esc(a.summary)}</p>`}
      </div>
    </header>
    <div class="d-rule" aria-hidden="true"></div>
    ${a.special === "private" ? privateBlock() : ""}
    <div class="d-grid">
      <dl class="d-facts">
        ${facts.map(([k, v]) => `<div class="d-fact"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}
      </dl>
      <div>
        ${description.length ? `<div class="d-text">${description.map((p) => `<p>${esc(p)}</p>`).join("")}</div>` : ""}
        ${a.notes?.length ? `<ul class="d-notes" aria-label="Pontos a confirmar">${a.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      </div>
    </div>
    ${a.special === "metrobus" ? metrobusBlock() : ""}
    ${a.special === "golf" ? golfBlock(a) : ""}
    ${mapBlock(a)}
    ${pager(index)}
    <footer class="d-footer">Francisco Rodrigues · Coimbra · 29.11.2026</footer>
  `;
}
