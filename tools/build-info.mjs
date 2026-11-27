/**
 * Gera info.html — versão só de texto do convite, pensada para robôs de
 * recolha (ex.: base de conhecimento do assistente telefónico Famulor).
 * Usa os mesmos dados de assets/js/site/program.js, por isso nunca fica
 * desatualizada em relação ao site. É gerada automaticamente em `npm run deploy`.
 *
 * Uso:  node tools/build-info.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PROGRAM, EVENT } from "../assets/js/site/program.js";

const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const SITE = "https://aniversario-francisco.web.app";

const activities = PROGRAM.map((a) => {
  const lines = [];
  lines.push(`<li><b>Local:</b> ${esc(a.place)}</li>`);
  if (a.address && a.address !== a.place) lines.push(`<li><b>Morada:</b> ${esc(a.address)}</li>`);
  lines.push(`<li><b>Horário:</b> <span data-schedule="${esc(a.id)}">A confirmar</span></li>`);
  if (a.stops) lines.push(`<li><b>Paragens:</b> ${a.stops.map(esc).join(" → ")}</li>`);
  if (a.contacts) {
    lines.push(`<li><b>Telefone do clube:</b> ${esc(a.contacts.phoneLabel)}</li>`);
    lines.push(`<li><b>Site do clube:</b> ${esc(a.contacts.website)}</li>`);
  }
  for (const n of a.notes || []) lines.push(`<li>${esc(n)}</li>`);
  const desc = (a.special === "private" ? [a.summary] : a.description).map((p) => `<p>${esc(p)}</p>`).join("\n      ");
  return `
    <section id="atividade-${esc(a.id)}">
      <h3>${esc(a.id)}. ${esc(a.kicker)} — ${esc(a.title)}</h3>
      ${desc}
      <ul>
        ${lines.join("\n        ")}
      </ul>
      <p><a href="${SITE}/#/atividade/${esc(a.slug)}">Página desta atividade</a></p>
    </section>`;
}).join("\n");

const summary = PROGRAM.map((a) => `<li>${esc(a.id)}. ${esc(a.title)} — <span data-schedule="${esc(a.id)}">A confirmar</span></li>`).join("\n        ");

const html = `<!doctype html>
<html lang="pt-PT">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Aniversário de ${esc(EVENT.name)} — informação completa</title>
    <meta name="description" content="Informação completa e em texto simples sobre o aniversário de ${esc(EVENT.name)}, em ${esc(EVENT.city)}, a ${esc(EVENT.dateLabel)}: programa, locais, horários, avisos e confirmação de presença." />
    <meta name="robots" content="noindex" />
    <link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml" />
    <style>
      body { max-width: 46rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; font: 16px/1.6 system-ui, sans-serif; color: #1a1a1a; background: #fff; }
      h1 { font-size: 1.8rem; line-height: 1.2; } h2 { margin-top: 2.5rem; border-bottom: 1px solid #ddd; padding-bottom: .3rem; }
      h3 { margin-top: 1.8rem; } a { color: #1d3f9e; }
    </style>
  </head>
  <body>
    <!-- Página gerada automaticamente por tools/build-info.mjs a partir de program.js. Não editar à mão. -->
    <h1>Aniversário de ${esc(EVENT.name)}</h1>
    <p><b>Data:</b> ${esc(EVENT.weekday)}, ${esc(EVENT.dateLabel)}.<br />
       <b>Cidade:</b> ${esc(EVENT.city)}, Portugal.<br />
       <b>Convidados previstos:</b> ${esc(EVENT.guests)} pessoas.<br />
       <b>Ponto de encontro:</b> ${esc(PROGRAM[0].place)} (${esc(PROGRAM[0].address)}).<br />
       <b>Site do convite:</b> <a href="${SITE}">${SITE}</a></p>

    <h2>Resumo do programa</h2>
    <ol>
        ${summary}
    </ol>
    <p>Os horários que ainda não estão definidos aparecem como “A confirmar”. Quando o organizador os define, ficam visíveis no site do convite.</p>

    <h2>Programa em detalhe</h2>
    ${activities}

    <h2>Programa secundário (modo GAMES): minigames no Bowling City</h2>
    <p>No site, o switch Classic/Games mostra o programa secundário, um plano alternativo: comer e jogar minigames na zona de jogos do Bowling City (City Games), no Coimbra Shopping (Avenida Dr. Mendes Silva, 3030-193 Coimbra), com a comida comprada no Continente do Coimbra Shopping. Não se joga bowling. Data: sábado, 28 de novembro de 2026, das 18:00 às 21:45. Página: <a href="${SITE}/citygames.html">${SITE}/citygames.html</a></p>
    <ol>
      <li>18:00–18:30 · Encontro no Coimbra Shopping.</li>
      <li>18:30–19:00 · Missão Continente: compras de comida e bebida (pizzas, sandes e wraps, snacks, fruta, sumos e águas, doces e bolo de aniversário; lista final a confirmar, tendo em conta as alergias).</li>
      <li>19:00–19:30 · Refeição em grupo.</li>
      <li>19:30–20:45 · Minigames no Bowling City, o momento principal (1 h 15; não se joga bowling).</li>
      <li>20:45–21:15 · Torneio de minigames entre todos.</li>
      <li>21:15–21:45 · Bolo e parabéns ao Francisco.</li>
    </ol>

    <h2>Avisos para quem vai</h2>
    <ol>
      <li><b>Calçado:</b> traga calçado adequado para caminhadas (há um passeio a pé de cerca de 1,5 km pela Baixa).</li>
      <li><b>Transportes:</b> traga o cartão de transportes Move C. Quem não o tiver deve indicá-lo ao confirmar presença, para o organizador levar o valor do bilhete.</li>
      <li><b>Alergias:</b> ao confirmar presença, há um campo para indicar alergias, para serem tidas em conta no bolo.</li>
    </ol>

    <h2>Como confirmar presença</h2>
    <p>No site do convite (<a href="${SITE}">${SITE}</a>), carregar em <b>“Confirmar presença”</b>, escrever o nome e escolher “Sim, vou estar presente!” ou “Não vou conseguir ir”. Quem confirma presença tem de abrir os <b>AVISOS</b> antes de enviar. Não é preciso criar conta.</p>

    <h2>Perguntas frequentes</h2>
    <h3>Onde é o ponto de encontro?</h3>
    <p>No ${esc(PROGRAM[0].place)}, em Coimbra, junto ao rio Mondego e à Ponte de Santa Clara.</p>
    <h3>Como vamos do Largo da Portagem para o almoço?</h3>
    <p>De Metrobus (linha U2), da paragem Portagem até à paragem República, passando por Loja do Cidadão, Câmara e Mercado. O almoço é na Mr. Pizza, Praça da República 38.</p>
    <h3>Onde é a apresentação de projetos?</h3>
    <p>A localização é, por agora, indefinida entre o espaço e o tempo. Os projetos são surpresa.</p>
    <h3>Quais são os horários?</h3>
    <p>Os horários definidos aparecem no resumo acima e no site do convite. Os que ainda não estão definidos aparecem como “A confirmar”.</p>
    <h3>Tenho de levar alguma coisa?</h3>
    <p>Calçado confortável para caminhar e o cartão de transportes Move C.</p>

    <script type="module" src="assets/js/site/info-schedule.js"></script>
  </body>
</html>
`;

const out = fileURLToPath(new URL("../info.html", import.meta.url));
writeFileSync(out, html);
console.log(`info.html gerado (${PROGRAM.length} atividades).`);
