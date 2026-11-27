/**
 * Gera ia.html — explicação completa do site para qualquer IA (ChatGPT,
 * Claude, Gemini, assistentes de voz…). Basta dar à IA o link:
 *   https://aniversario-francisco.web.app/ia.html
 *
 * Usa os mesmos dados do site (program.js e games.js) e os horários atuais
 * da base de dados (/schedule, leitura pública), por isso fica sempre certo
 * depois de cada `npm run deploy`. Os prints vêm de assets/img/prints
 * (gerados com `node tools/capture-prints.mjs`).
 *
 * Uso:  node tools/build-ia.mjs
 */
import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PROGRAM, EVENT } from "../assets/js/site/program.js";
import { LEVELS, INVENTORY } from "../assets/js/site/games.js";

const SITE = "https://aniversario-francisco.web.app";
const DB = "https://aniversario-francisco-default-rtdb.europe-west1.firebasedatabase.app";
const ROOT = fileURLToPath(new URL("..", import.meta.url));

const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* Horários atuais (se não houver ligação, ficam "A confirmar"). */
let schedule = {};
let scheduleNote = "Horários lidos da base de dados no momento em que esta página foi gerada.";
try {
  const res = await fetch(`${DB}/schedule.json`, { signal: AbortSignal.timeout(10000) });
  if (res.ok) schedule = (await res.json()) || {};
  else throw new Error(String(res.status));
} catch {
  scheduleNote = "Não foi possível ler os horários ao gerar esta página; os horários atuais estão sempre no site do convite.";
}
const hora = (id) => {
  const e = schedule[id];
  if (!e || !e.start) return "A confirmar";
  return e.end ? `${e.start}–${e.end}` : e.start;
};

const generated = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  dateStyle: "long",
  timeStyle: "short",
}).format(new Date());

/* ---------------- Programa principal ---------------- */
const classic = PROGRAM.map((a) => {
  const li = [];
  li.push(`<li><b>Local:</b> ${esc(a.place)}</li>`);
  if (a.address && a.address !== a.place) li.push(`<li><b>Morada / referência:</b> ${esc(a.address)}</li>`);
  li.push(`<li><b>Horário:</b> ${esc(hora(a.id))}</li>`);
  if (a.stops) li.push(`<li><b>Paragens:</b> ${a.stops.map(esc).join(" → ")}</li>`);
  if (a.contacts) {
    li.push(`<li><b>Telefone do clube:</b> ${esc(a.contacts.phoneLabel)}</li>`);
    li.push(`<li><b>Site do clube:</b> ${esc(a.contacts.website)}</li>`);
  }
  if (a.location) li.push(`<li><b>Coordenadas:</b> ${a.location.lat}, ${a.location.lng} (${a.location.precision === "verified" ? "confirmadas" : "aproximadas"})</li>`);
  else li.push(`<li><b>Coordenadas:</b> sem localização definida</li>`);
  for (const n of a.notes || []) li.push(`<li>${esc(n)}</li>`);
  const desc = (a.special === "private" ? [a.summary] : a.description).map((p) => `<p>${esc(p)}</p>`).join("\n      ");
  return `
    <section id="p-${esc(a.id)}">
      <h4>${esc(a.id)}. ${esc(a.kicker)} — ${esc(a.title)}</h4>
      ${desc}
      <ul>
        ${li.join("\n        ")}
      </ul>
      <p>Página desta atividade: <a href="${SITE}/#/atividade/${esc(a.slug)}">${SITE}/#/atividade/${esc(a.slug)}</a></p>
    </section>`;
}).join("\n");

/* ---------------- Programa secundário ---------------- */
const games = LEVELS.map(
  (l, i) => `
      <li><b>${esc(l.tag)} — ${esc(l.title)}.</b> ${esc(l.text)}</li>`
).join("");
const menu = INVENTORY.map((it) => `<li><b>${esc(it.name)}</b> — ${esc(it.desc)}</li>`).join("\n        ");

/* ---------------- Prints ---------------- */
const PRINTS = [
  ["01-inicio-classic", "Página inicial no modo CLASSIC (preto e dourado)", "Topo do convite: monograma FR, nome Francisco Rodrigues, data e cidade, botões “Confirmar presença” e “Ver o programa”, e o switch grande Classic/Games por baixo."],
  ["02-programa-principal", "Programa principal (modo CLASSIC)", "Lista numerada “Nove momentos, um só dia”. Cada etapa mostra número, tipo, título, local e horário; tocar abre a página da atividade."],
  ["03-mapa", "Mapa interativo", "Mapa escuro de Coimbra com os marcadores numerados das atividades, o percurso a pé (verde) e o trajeto do Metrobus (azul)."],
  ["04-pagina-atividade", "Página de uma atividade (exemplo: Golfe)", "Cada atividade tem uma página própria em branco e azul (cores do azulejo), com descrição, local, horário, mapa e contactos."],
  ["05-confirmar-presenca", "Formulário de confirmação de presença", "Janela “Vais juntar-te a nós?”: nome, resposta (vou / não vou), mensagem opcional e o botão dourado AVISOS, que tem de ser aberto por quem confirma presença."],
  ["06-switch-classic", "Switch Classic ↔ Games", "Interruptor em vidro (estilo Apple): à esquerda vidro dourado com “Classic”, à direita vidro preto com “GAMES” em néon. Por baixo, a dica “desliza para jogar”, que só aparece após 5 segundos sem arrastar."],
  ["07-arrastar-games-on", "A arrastar o switch: comando /games_on", "Ao arrastar o switch aparece, em baixo à esquerda, uma caixa de chat estilo jogo com o comando /games_on a ser escrito."],
  ["08-inicio-games", "Página inicial no modo GAMES (preto e néon)", "O mesmo convite com outro estilo: títulos em letra de computador com brilho néon azul e rosa, botões em gradiente néon e chão em grelha néon ao fundo."],
  ["09-programa-secundario", "Programa secundário (modo GAMES)", "No lugar dos nove momentos aparece “Seis níveis, um só dia”, com o trailer animado do programa."],
  ["10-niveis-games", "Níveis do programa secundário", "Os seis níveis em cartões de jogo, com ícone, cor própria e barra de XP."],
  ["11-pagina-citygames", "Página do botão OU (citygames.html)", "Página própria do programa secundário, aberta pelo botão OU no fim do programa principal."],
  ["12-pagina-promax", "Página PROMAX 2.0", "Página surpresa azul e vermelha com lasers, aberta pelo botão “Código PROMAX2.0” na atividade 08; termina num diamante com “EM BREVE”."],
  ["13-telemovel-classic", "Telemóvel — modo CLASSIC", "Versão para telemóvel: o switch pequeno fica no topo, ao lado do botão Confirmar presença."],
  ["14-telemovel-games", "Telemóvel — modo GAMES", "A mesma página no telemóvel, em modo GAMES."],
].filter(([f]) => existsSync(`${ROOT}assets/img/prints/${f}.jpg`));

const prints = PRINTS.map(
  ([f, title, desc], i) => `
    <figure id="print-${i + 1}">
      <a href="${SITE}/assets/img/prints/${f}.jpg"><img src="assets/img/prints/${f}.jpg" alt="${esc(title)}: ${esc(desc)}" loading="lazy" /></a>
      <figcaption><b>Print ${i + 1} — ${esc(title)}.</b> ${esc(desc)}<br /><small>Imagem: <a href="${SITE}/assets/img/prints/${f}.jpg">${SITE}/assets/img/prints/${f}.jpg</a></small></figcaption>
    </figure>`
).join("\n");

const html = `<!doctype html>
<html lang="pt-PT">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Guia para IA — aniversário de ${esc(EVENT.name)}</title>
    <meta name="description" content="Explicação completa do site do aniversário de ${esc(EVENT.name)} (Coimbra, ${esc(EVENT.dateLabel)}), escrita para assistentes de IA: programas, funcionamento, confirmação de presença e prints." />
    <meta name="robots" content="noindex" />
    <link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml" />
    <style>
      body { max-width: 52rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; font: 16px/1.65 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1a1a1a; background: #fff; }
      h1 { font-size: 1.9rem; line-height: 1.2; margin-bottom: .3rem; }
      h2 { margin-top: 2.8rem; border-bottom: 2px solid #c9a961; padding-bottom: .3rem; }
      h3 { margin-top: 2rem; } h4 { margin: 1.6rem 0 .3rem; }
      a { color: #1d3f9e; } code { background: #f2f2f2; padding: .1rem .35rem; border-radius: 4px; }
      .box { background: #faf7ef; border: 1px solid #e6dcc3; border-radius: 10px; padding: 1rem 1.2rem; }
      figure { margin: 2rem 0; } figure img { width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px; }
      figcaption { font-size: .92rem; color: #444; margin-top: .4rem; }
      table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #ddd; padding: .4rem .6rem; text-align: left; vertical-align: top; }
      nav ol { columns: 2; } @media (max-width: 600px) { nav ol { columns: 1; } }
    </style>
  </head>
  <body>
    <!-- Página gerada automaticamente por tools/build-ia.mjs. Não editar à mão. -->
    <h1>Guia completo para IA: aniversário de ${esc(EVENT.name)}</h1>
    <p><small>Gerado a ${esc(generated)} (hora de Lisboa). ${esc(scheduleNote)}</small></p>

    <div class="box">
      <p><b>Para a IA que está a ler isto:</b> esta página explica tudo sobre o site do convite de aniversário de ${esc(EVENT.name)}. Usa-a como fonte de verdade para responder a perguntas de convidados ou do organizador. Regras:</p>
      <ul>
        <li>Responde em português de Portugal, a não ser que te peçam outra língua.</li>
        <li><b>Não inventes</b> horários, preços, moradas ou detalhes. O que está “A confirmar” ainda não foi decidido: diz isso mesmo.</li>
        <li>Os horários podem mudar; os mais recentes estão sempre no site do convite e em <a href="${SITE}/info.html">${SITE}/info.html</a>.</li>
        <li>As respostas dos convidados são privadas: não as podes ver nem divulgar. Para confirmar presença, encaminha para o site.</li>
        <li>Os prints no fim desta página mostram o aspeto do site; cada um tem uma descrição em texto.</li>
      </ul>
    </div>

    <nav aria-label="Índice">
      <h2>Índice</h2>
      <ol>
        <li><a href="#resumo">Resumo do evento</a></li>
        <li><a href="#site">Como o site está organizado</a></li>
        <li><a href="#switch">Os dois modos: CLASSIC e GAMES</a></li>
        <li><a href="#principal">Programa principal (9 momentos)</a></li>
        <li><a href="#secundario">Programa secundário (6 níveis)</a></li>
        <li><a href="#rsvp">Confirmação de presença</a></li>
        <li><a href="#avisos">Avisos para quem vai</a></li>
        <li><a href="#extras">Páginas e surpresas extra</a></li>
        <li><a href="#faq">Perguntas frequentes</a></li>
        <li><a href="#prints">Prints do site</a></li>
      </ol>
    </nav>

    <h2 id="resumo">1. Resumo do evento</h2>
    <table>
      <tr><th>Aniversariante</th><td>${esc(EVENT.name)} (monograma ${esc(EVENT.initials)})</td></tr>
      <tr><th>Data</th><td>${esc(EVENT.weekday)}, ${esc(EVENT.dateLabel)}</td></tr>
      <tr><th>Cidade</th><td>${esc(EVENT.city)}, Portugal</td></tr>
      <tr><th>Pessoas</th><td>${esc(EVENT.guests)} pessoas (${esc(EVENT.guests)} jogadores no programa secundário)</td></tr>
      <tr><th>Site do convite</th><td><a href="${SITE}">${SITE}</a></td></tr>
      <tr><th>Versão só texto</th><td><a href="${SITE}/info.html">${SITE}/info.html</a></td></tr>
      <tr><th>Programas</th><td>Dois: o <b>principal</b> (passeio por Coimbra, 9 momentos) e o <b>secundário</b> (minigames no Bowling City, no Coimbra Shopping, 6 níveis).</td></tr>
    </table>

    <h2 id="site">2. Como o site está organizado</h2>
    <ul>
      <li><b>Página inicial</b> (<a href="${SITE}">${SITE}</a>): topo com o nome e a data, botões “Confirmar presença” e “Ver o programa”, o switch grande Classic/Games, factos rápidos (data, cidade, ${esc(EVENT.guests)} pessoas, contagem decrescente), o programa, o mapa e a confirmação de presença.</li>
      <li><b>Menu do topo:</b> Programa, Mapa, o switch pequeno Classic/Games e o botão Confirmar presença. No telemóvel ficam só o monograma, o switch e o botão.</li>
      <li><b>Página de cada atividade:</b> endereço <code>${SITE}/#/atividade/&lt;nome&gt;</code>, em branco e azul (cores do azulejo), com descrição, local, horário, mapa e, quando existe, contactos.</li>
      <li><b>Mapa interativo:</b> mapa de Coimbra (OpenStreetMap) com marcadores numerados, percurso a pé pela Baixa e trajeto do Metrobus.</li>
      <li><b>Botão OU</b> no fim do programa principal: abre <a href="${SITE}/citygames.html">${SITE}/citygames.html</a>, a página própria do programa secundário.</li>
      <li><b>Atualizações em direto:</b> quando o organizador muda um horário, o site atualiza-se sozinho, sem recarregar.</li>
    </ul>

    <h2 id="switch">3. Os dois modos: CLASSIC e GAMES</h2>
    <p>O site tem um interruptor (switch) inspirado no da Apple, feito em “vidro líquido”. Existe em dois tamanhos: um pequeno no menu do topo e um grande por baixo dos botões iniciais. Os dois estão sempre sincronizados.</p>
    <ul>
      <li><b>Lado esquerdo — CLASSIC:</b> vidro com dourado clássico e a palavra “Classic” em itálico dourado.</li>
      <li><b>Lado direito — GAMES:</b> vidro preto com “GAMES” escrito em néon.</li>
      <li>A parte que desliza é uma <b>lente de vidro</b> que amplia a palavra que está por baixo.</li>
      <li>Em CLASSIC o switch <b>vibra</b> de poucos em poucos segundos e espreita para a direita, para convidar a pessoa a arrastar.</li>
      <li>Se ninguém arrastar durante <b>5 segundos</b>, aparece por baixo do switch grande a dica “desliza para jogar”, com um brilho a passar (como o “deslizar para desbloquear” do iPhone). Desaparece ao tocar no switch.</li>
      <li>Ao <b>arrastar</b>, aparece em baixo à esquerda uma caixa de chat estilo jogo com o comando <code>/games_on</code> a ser escrito. Ao largar, aparece “Modo GAMES ativado: programa secundário.” a verde. Ao voltar: <code>/games_off</code> e “Modo CLASSIC ativado: programa principal.” a laranja.</li>
      <li>Também muda com um clique ou com as setas ← → do teclado. Em telemóveis Android o aparelho vibra ao mudar.</li>
      <li><b>O switch não muda de página:</b> muda só o <b>estilo</b> e o <b>programa</b>.
        <ul>
          <li>CLASSIC: preto e dourado, letra serifada elegante, programa principal (9 momentos) e mapa.</li>
          <li>GAMES: preto e néon (azul, rosa e verde-lima), letra de computador com brilho, chão em grelha néon; o programa principal e o mapa dão lugar ao programa secundário (trailer, 6 níveis, menu Continente e ponto de partida).</li>
        </ul>
      </li>
      <li>O modo escolhido fica guardado no navegador da pessoa.</li>
    </ul>

    <h2 id="principal">4. Programa principal — 9 momentos (modo CLASSIC)</h2>
    <p>Um dia a pé e de Metrobus por Coimbra. Ordem prevista:</p>
    <ol>
      ${PROGRAM.map((a) => `<li>${esc(a.title)} — ${esc(hora(a.id))}</li>`).join("\n      ")}
    </ol>
    <h3>Em detalhe</h3>
    ${classic}

    <h2 id="secundario">5. Programa secundário — 6 níveis (modo GAMES)</h2>
    <p>Alternativa ao programa principal: comer e jogar <b>minigames</b> na zona de jogos do <b>Bowling City</b> (City Games), no <b>Coimbra Shopping</b>, com a comida toda comprada no <b>Continente</b> do Coimbra Shopping. <b>Não se joga bowling</b>, só minigames. Horários a confirmar. São ${esc(EVENT.guests)} jogadores.</p>
    <p><b>Ponto de partida:</b> Coimbra Shopping, Avenida Dr. Mendes Silva, 3030-193 Coimbra (não confundir com o Fórum Coimbra, que é outro centro comercial).</p>
    <h3>Níveis</h3>
    <ol>${games}
    </ol>
    <h3>Menu (inventário) — produtos do Continente</h3>
    <ul>
        ${menu}
    </ul>
    <p>A lista final ainda está por confirmar e tem em conta as alergias indicadas na confirmação de presença.</p>
    <h3>Trailer animado</h3>
    <p>O programa secundário tem um “vídeo” animado de 30 segundos (desenhado no próprio site, estilo jogo de arcada), com botão de pausa, barra de posição e 6 capítulos, um por nível: encontro no Coimbra Shopping (os ${esc(EVENT.guests)} jogadores chegam), missão Continente (os produtos caem no carrinho), recarregar energia (a pizza desaparece fatia a fatia), minigames no Bowling City (três máquinas de arcada), torneio de minigames (duelo P1 contra P2 e placar dos ${esc(EVENT.guests)} jogadores) e parabéns com bolo e confetes.</p>

    <h2 id="rsvp">6. Confirmação de presença</h2>
    <ol>
      <li>No site, carregar em <b>“Confirmar presença”</b> (há botões no topo, no menu e no fim da página).</li>
      <li>Escrever o <b>nome</b> (obrigatório, 2 a 80 caracteres).</li>
      <li>Escolher <b>“Sim, vou estar presente!”</b> ou <b>“Não vou conseguir ir”</b>.</li>
      <li>Opcional: uma <b>mensagem</b> para o Francisco (até 500 caracteres).</li>
      <li>Quem vai tem de abrir o botão dourado <b>AVISOS</b> antes de enviar (ver secção seguinte). Aí pode também marcar que não tem cartão Move C e escrever alergias.</li>
      <li>Enviar. Não é preciso criar conta. A resposta fica guardada de forma privada e o organizador recebe-a.</li>
    </ol>
    <p>Algumas respostas podem ser recusadas pelo sistema; nesse caso aparece uma mensagem a pedir para falar diretamente com o organizador.</p>

    <h2 id="avisos">7. Avisos para quem vai</h2>
    <ol>
      <li><b>Calçado:</b> trazer calçado adequado para caminhadas (há um passeio a pé de cerca de 1,5 km pela Baixa).</li>
      <li><b>Cartão de transportes:</b> trazer o cartão Move C. Quem não tiver marca a caixa no formulário, para o organizador levar o valor do bilhete.</li>
      <li><b>Alergias:</b> escrever no formulário, para serem tidas em conta no bolo e na comida.</li>
    </ol>

    <h2 id="extras">8. Páginas e surpresas extra</h2>
    <ul>
      <li><b>Atividade 08 — Apresentação privada de projetos:</b> a localização é “indefinida entre o espaço e o tempo”; no mapa o marcador muda de lugar sozinho a cada segundo. Tem um botão <b>“Código PROMAX2.0”</b> que abre <a href="${SITE}/promax.html">${SITE}/promax.html</a>: página azul e vermelha com lasers que termina num pedestal com um diamante e a frase “EM BREVE”. Os projetos são surpresa.</li>
      <li><b>citygames.html:</b> página própria do programa secundário (a mesma informação do modo GAMES).</li>
      <li><b>info.html:</b> versão só de texto do convite, com horários atualizados.</li>
      <li>Existe também um painel privado do organizador (só com login autorizado); não tem informação para convidados.</li>
    </ul>

    <h2 id="faq">9. Perguntas frequentes</h2>
    <h4>Quando e onde é?</h4>
    <p>${esc(EVENT.weekday)}, ${esc(EVENT.dateLabel)}, em ${esc(EVENT.city)}. Programa principal: começa no ${esc(PROGRAM[0].place)}. Programa secundário: começa no Coimbra Shopping.</p>
    <h4>Quantas pessoas vão?</h4>
    <p>Estão previstas ${esc(EVENT.guests)} pessoas.</p>
    <h4>A que horas?</h4>
    <p>Os horários ainda por definir aparecem como “A confirmar”. Quando o organizador os define, aparecem no site.</p>
    <h4>Qual é a diferença entre os dois programas?</h4>
    <p>O principal é um passeio por Coimbra (Largo da Portagem, Metrobus, almoço na Mr. Pizza, Baixa, Torre de Almedina, golfe, apresentação e lanche). O secundário é comer e jogar minigames no Bowling City, no Coimbra Shopping, com comida do Continente. No site troca-se entre eles com o switch Classic/Games.</p>
    <h4>Vamos jogar bowling?</h4>
    <p>Não. No programa secundário só se jogam minigames na zona de jogos do Bowling City.</p>
    <h4>O que levar?</h4>
    <p>Calçado confortável e o cartão Move C.</p>
    <h4>Como confirmo presença?</h4>
    <p>No site, em “Confirmar presença”. Ver a secção 6.</p>

    <h2 id="prints">10. Prints do site</h2>
    <p>Imagens reais do site, tiradas automaticamente. Cada uma tem uma descrição para quem não consegue ver imagens.</p>
    ${prints}

    <p><small>Fim do guia. Fonte: ${SITE}</small></p>
  </body>
</html>
`;

writeFileSync(`${ROOT}ia.html`, html);
console.log(`ia.html gerado (${PROGRAM.length} atividades, ${LEVELS.length} níveis, ${PRINTS.length} prints).`);
