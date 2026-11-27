/**
 * Página de detalhe de cada atividade (identidade branco & azul).
 * Devolve HTML a partir dos dados de program.js; o mapa é montado por app.js.
 */
import { googleMapsUrl } from "./program.js";
import { state, num, timeOf, total } from "./state.js";
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

const METRO_LINE = ["Portagem", "Loja do Cidadão", "Câmara", "Mercado", "República"];

function metrobusHorizontal() {
  const x0 = 70;
  const x1 = 640;
  const step = (x1 - x0) / (METRO_LINE.length - 1);
  const xs = METRO_LINE.map((_, i) => x0 + i * step);
  const chevron = (x) => `<path d="M${x - 5} 102l8 8-8 8" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `
  <svg class="metro-h" viewBox="0 0 710 230" role="img" aria-labelledby="metroHTitle">
    <title id="metroHTitle">Esquema da viagem de Metrobus: de Portagem a República, passando por Loja do Cidadão, Câmara e Mercado.</title>
    <path d="M${x0} 110H${x1}" stroke="#1d3f9e" stroke-width="12" stroke-linecap="round"/>
    ${xs.slice(0, -1).map((x) => chevron(x + step / 2)).join("")}
    ${xs
      .map((x, i) => {
        const end = i === 0 || i === xs.length - 1;
        return `
      <circle cx="${x}" cy="110" r="${end ? 13 : 10}" fill="#fff" stroke="#1d3f9e" stroke-width="${end ? 4 : 3}"/>
      <text x="${x}" y="${i % 2 ? 158 : 160}" font-size="${end ? 17 : 14}" font-weight="${end ? 700 : 600}" fill="#0b1d47" text-anchor="middle">${METRO_LINE[i]}</text>`;
      })
      .join("")}
    <text x="${x0}" y="72" font-size="11" font-weight="600" letter-spacing="1.8" fill="#1d3f9e" text-anchor="middle">PARTIDA</text>
    <path d="M${x0} 78v14" stroke="#1d3f9e" stroke-width="1.5"/>
    <text x="${x1}" y="72" font-size="11" font-weight="600" letter-spacing="1.8" fill="#1d3f9e" text-anchor="middle">CHEGADA</text>
    <path d="M${x1} 78v14" stroke="#1d3f9e" stroke-width="1.5"/>
    <text x="${x0}" y="182" font-size="10" letter-spacing="1.4" fill="#2a3a63" text-anchor="middle">LARGO DA PORTAGEM</text>
    <text x="${x1}" y="182" font-size="10" letter-spacing="1.4" fill="#2a3a63" text-anchor="middle">ALMOÇO · MR. PIZZA</text>
  </svg>`;
}

function metrobusVertical() {
  const y0 = 70;
  const step = 95;
  return `
  <svg class="metro-v" viewBox="0 0 320 ${y0 + step * (METRO_LINE.length - 1) + 60}" role="img" aria-labelledby="metroVTitle">
    <title id="metroVTitle">Esquema da viagem de Metrobus: de Portagem a República, passando por Loja do Cidadão, Câmara e Mercado.</title>
    <path d="M70 ${y0}V${y0 + step * (METRO_LINE.length - 1)}" stroke="#1d3f9e" stroke-width="12" stroke-linecap="round"/>
    ${METRO_LINE.slice(0, -1)
      .map((_, i) => {
        const y = y0 + i * step + step / 2;
        return `<path d="M62 ${y - 5}l8 9 8-9" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      })
      .join("")}
    ${METRO_LINE.map((name, i) => {
      const y = y0 + i * step;
      const end = i === 0 || i === METRO_LINE.length - 1;
      return `
      <circle cx="70" cy="${y}" r="${end ? 13 : 10}" fill="#fff" stroke="#1d3f9e" stroke-width="${end ? 4 : 3}"/>
      <path d="M90 ${y}H106" stroke="#9cc0ea" stroke-width="1.5"/>
      <text x="114" y="${y + 6}" font-size="${end ? 19 : 16}" font-weight="${end ? 700 : 600}" fill="#0b1d47">${name}</text>
      ${i === 0 ? `<text x="114" y="${y + 26}" font-size="10" letter-spacing="1.4" fill="#2a3a63">PARTIDA</text>` : ""}
      ${end && i > 0 ? `<text x="114" y="${y + 26}" font-size="10" letter-spacing="1.4" fill="#2a3a63">CHEGADA · ALMOÇO</text>` : ""}`;
    }).join("")}
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
        <figcaption>Linha U2 do Metrobus, no sentido República. A viagem é só de ida: o regresso ao Largo da Portagem é feito a pé, pelo passeio na Baixa.</figcaption>
      </figure>
      <ol class="metro__steps" aria-label="Passos da viagem">
        <li><span>Do Largo da Portagem até à paragem <strong>Portagem</strong> (cerca de 120 m a pé).</span></li>
        <li><span>Embarque no Metrobus, no sentido <strong>República</strong>.</span></li>
        <li><span>Passagem por <strong>Loja do Cidadão</strong>, <strong>Câmara</strong> e <strong>Mercado</strong>.</span></li>
        <li class="is-turn"><span>Saída na paragem <strong>República</strong> — o almoço é na Mr. Pizza, na própria praça.</span></li>
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
        <p>A disponibilidade de posições cobertas para oito pessoas tem de ser confirmada com o clube.</p>
      </div>
      <div class="golf__cell">
        <span class="golf__label">Contactos do clube</span>
        <span class="golf__value"><a href="tel:${esc(c.phone)}">${esc(c.phoneLabel)}</a></span>
        <p><a href="${esc(c.website)}" target="_blank" rel="noopener" style="color:inherit">${esc(c.websiteLabel)}</a> · Preço e duração a confirmar.</p>
      </div>
    </div>
  </section>`;
}

function privateBlock(a) {
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
      <p class="private__label eyebrow">${esc(num(a))} — Acesso reservado</p>
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

function promaxBlock() {
  return `
  <section class="promax-cta" aria-label="Acesso especial">
    <a class="promax-btn" href="promax.html">
      <span class="promax-btn__label">Código</span>
      <span class="promax-btn__code">PROMAX2.0</span>
    </a>
  </section>`;
}

function mapBlock(a) {
  const url = googleMapsUrl(a);
  const loc = a.location;
  let meta;
  let note;
  if (!loc && a.special === "private") {
    meta = "Indefinida";
    note = "Localização: indefinida entre o espaço e o tempo.";
  } else if (!loc) {
    meta = "Localização a confirmar";
    note =
      "O local ainda não está definido. O mapa mostra Coimbra e será atualizado quando houver confirmação.";
  } else if (loc.precision === "verified") {
    meta = "Localização assinalada";
    note = `Fonte da coordenada: ${esc(loc.source)}.`;
  } else {
    meta = "Posição aproximada";
    note = "O marcador tracejado indica uma posição aproximada, ainda por verificar. Usa o Google Maps para a morada exata.";
  }
  if (a.special === "metrobus") {
    note += " O mapa mostra o traçado real da linha U2 (OpenStreetMap) e as paragens Portagem, Loja do Cidadão, Câmara, Mercado e República.";
  } else if (["03", "04", "05", "06"].includes(a.id)) {
    note += " A linha verde mostra o percurso a pé pela Baixa, que termina no Largo da Portagem.";
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

function pager(a) {
  const index = state.order.indexOf(a);
  const prev = state.order[index - 1];
  const next = state.order[index + 1];
  const link = (a, dir) => `
    <a class="pager-link pager-link--${dir}" href="#/atividade/${esc(a.slug)}" data-nav="replace" rel="${dir}">
      <span class="pager-link__dir">${
        dir === "prev" ? `${icon("i-arrow-left", 14)} Anterior · ${esc(num(a))}` : `Seguinte · ${esc(num(a))} ${icon("i-arrow-right", 14)}`
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

export function renderDetail(a) {
  const facts = [
    ["Etapa", `${num(a)} de ${total()}`],
    ["Horário", `<span data-schedule="${esc(a.id)}">${value(timeOf(a))}</span>`],
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
      <span class="d-num" aria-hidden="true">${esc(num(a))}</span>
      <div>
        <p class="d-kicker eyebrow">${esc(a.kicker)}</p>
        <h1 class="d-title" id="detailTitle">${esc(a.title)}</h1>
        ${a.special === "private" ? "" : `<p class="d-lead">${esc(a.summary)}</p>`}
      </div>
    </header>
    <div class="d-rule" aria-hidden="true"></div>
    ${a.special === "private" ? privateBlock(a) : ""}
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
    ${pager(a)}
    ${a.special === "private" ? promaxBlock() : ""}
    <footer class="d-footer">Francisco Rodrigues · Coimbra · 29.11.2026</footer>
  `;
}
