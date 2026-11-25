/**
 * ============================================================================
 *  ASSISTENTE POR EMAIL — Aniversário FR (para usar no Apple Watch / iCloud Mail)
 * ============================================================================
 *
 *  Corre no Google Apps Script, na conta Google dona do projeto Firebase.
 *  De minuto a minuto:
 *    1. lê os emails novos enviados do teu iCloud para esta conta Gmail;
 *    2. percebe o pedido (com IA via OpenRouter, se tiver chave; senão, comandos simples);
 *    3. responde no mesmo email (curto, para ler no relógio);
 *    4. avisa-te por email de cada nova confirmação de presença.
 *
 *  Nada é alterado sem responderes "sim" à pergunta de confirmação.
 *  Respostas de convidados nunca são apagadas por aqui.
 *
 *  Instalação: ver tools/assistente-email/LEIA-ME.md
 */

/* ----------------------------- CONFIGURAÇÃO ------------------------------ */
const CONFIG = {
  // ← O TEU ENDEREÇO iCLOUD (só emails deste endereço são aceites).
  //   Melhor ainda: guarde-o em Propriedades do script → ICLOUD_EMAIL
  //   (assim não se perde quando atualizar o código).
  ICLOUD_EMAIL: "COLOCAR_O_TEU_EMAIL@icloud.com",
  DATABASE_URL: "https://aniversario-francisco-default-rtdb.europe-west1.firebasedatabase.app",
  SITE_URL: "https://aniversario-francisco.web.app",
  SUBJECT: "Aniversário FR",
  // Modelo do OpenRouter (tem de suportar "tools"). "openrouter/free" escolhe
  // automaticamente um modelo gratuito disponível. Para fixar outro, defina
  // Propriedades do script → OPENROUTER_MODEL (ex.: um modelo terminado em ":free").
  OPENROUTER_MODEL: "openrouter/free",
  PENDING_MINUTES: 30, // tempo para responder "sim" a uma alteração
  // "Modo conversa": depois de tratar uma mensagem, verifica de N em N segundos
  // durante alguns minutos (respostas em ~10–20 s). Fora disso, 1 vez por minuto.
  CONVERSA_MINUTOS: 3,
  CONVERSA_INTERVALO_S: 10,
  TIMEZONE: "Europe/Lisbon",
};

/** Atividades do programa (iguais às do site). */
const ACTIVITIES = [
  { id: "01", nome: "Largo da Portagem (ponto de encontro)" },
  { id: "02", nome: "Metrobus Portagem → República" },
  { id: "03", nome: "Almoço na Mr. Pizza" },
  { id: "04", nome: "Passeio pela Baixa de Coimbra" },
  { id: "05", nome: "Torre de Almedina" },
  { id: "06", nome: "Regresso à Portagem" },
  { id: "07", nome: "Golfe na Quinta das Lágrimas" },
  { id: "08", nome: "Apresentação privada de projetos" },
  { id: "09", nome: "Lanche e convívio" },
];

const BANNED_SALT = "fr-aniversario:nome:"; // igual a assets/js/shared/banned.js
const DEFAULT_BANNED_MESSAGE =
  "Não foi possível registar a resposta com este nome. Fala diretamente com o organizador.";

/** Endereço iCloud: Propriedades do script (ICLOUD_EMAIL) ou CONFIG. */
function icloud_() {
  return (PropertiesService.getScriptProperties().getProperty("ICLOUD_EMAIL") || CONFIG.ICLOUD_EMAIL).trim();
}

/* ============================ PONTOS DE ENTRADA ============================ */

/** Corre UMA vez: ativa a verificação de minuto a minuto e envia a ajuda. */
function instalar() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "verificar")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("verificar").timeBased().everyMinutes(1).create();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("ULTIMA_RESPOSTA")) props.setProperty("ULTIMA_RESPOSTA", String(Date.now()));
  enviar_(`${CONFIG.SUBJECT} — assistente ligado`, "Olá! Já estou a funcionar.\n\n" + ajuda_());
  return "Instalado.";
}

/** Para desligar o assistente. */
function desinstalar() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "verificar")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  return "Desligado.";
}

/** Teste rápido da ligação ao Firebase (correr no editor e ver o registo). */
function testarLigacao() {
  const r = resumoRespostas_();
  Logger.log(r);
  return r;
}

/** Corre de minuto a minuto (acionador criado por instalar()). */
function verificar() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const inicio = Date.now();
    processarEmails_();
    notificarNovidades_();
    // Modo conversa: se houve uma mensagem há pouco, continua atento até ~50 s
    // (o próximo acionador entra a seguir). Respeita a quota diária do Google.
    while (emConversa_() && Date.now() - inicio < 50000) {
      Utilities.sleep(CONFIG.CONVERSA_INTERVALO_S * 1000);
      processarEmails_();
    }
  } finally {
    lock.releaseLock();
  }
}

function emConversa_() {
  const ultima = Number(PropertiesService.getScriptProperties().getProperty("ULTIMA_ATIVIDADE") || 0);
  return Date.now() - ultima < CONFIG.CONVERSA_MINUTOS * 60000;
}

/* ================================ EMAILS ================================== */

function processarEmails_() {
  const query = `from:${icloud_()} is:unread newer_than:2d`;
  const threads = GmailApp.search(query, 0, 20);
  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      if (!msg.isUnread()) continue;
      msg.markRead();
      if (!remetenteValido_(msg)) continue; // ignora em silêncio (pode ser falsificado)
      const texto = extrairTexto_(msg.getPlainBody());
      if (!texto) continue;
      let resposta;
      try {
        resposta = tratarMensagem_(texto);
      } catch (e) {
        resposta = "Ocorreu um erro: " + (e && e.message ? e.message : e);
      }
      msg.reply(resposta);
      PropertiesService.getScriptProperties().setProperty("ULTIMA_ATIVIDADE", String(Date.now()));
    }
  }
}

/** Só aceita mensagens do teu iCloud com assinatura DKIM válida. */
function remetenteValido_(msg) {
  const from = String(msg.getFrom() || "").toLowerCase();
  if (!from.includes(icloud_().toLowerCase())) return false;
  const auth = String(msg.getHeader("Authentication-Results") || "").toLowerCase();
  return /dkim=pass/.test(auth) && /(icloud\.com|me\.com|mac\.com)/.test(auth);
}

/** Tira citações, assinaturas e espaços a mais. */
function extrairTexto_(body) {
  const linhas = String(body || "").replace(/\r/g, "").split("\n");
  const out = [];
  for (const l of linhas) {
    const s = l.trim();
    if (/^>/.test(s)) break;
    if (/^(on|em|a|no dia)\b.*(wrote|escreveu)\s*:?\s*$/i.test(s)) break;
    if (/^-{2,}\s*(original|mensagem)/i.test(s)) break;
    if (/^(enviado do meu|sent from my)\b/i.test(s)) break;
    out.push(l);
  }
  return out.join("\n").trim().slice(0, 1000);
}

function enviar_(assunto, corpo) {
  GmailApp.sendEmail(icloud_(), assunto, corpo);
}

/* ============================== NOTIFICAÇÕES ============================== */

/** Envia um email por cada nova resposta ao convite. */
function notificarNovidades_() {
  const props = PropertiesService.getScriptProperties();
  const desde = Number(props.getProperty("ULTIMA_RESPOSTA") || Date.now());
  const novos = dbQuery_("rsvps", { orderBy: '"createdAt"', startAt: String(desde + 1) });
  const lista = Object.values(novos || {}).filter((r) => typeof r.createdAt === "number" && r.createdAt > desde);
  lista.sort((a, b) => a.createdAt - b.createdAt);
  for (const r of lista) {
    const sim = r.attending === "yes";
    const partes = [`${r.name} — ${sim ? "VAI ✅" : "NÃO VAI ❌"}`];
    if (r.message) partes.push(`Mensagem: ${r.message}`);
    if (sim) {
      partes.push(r.noTransportCard ? "Sem cartão Move C (levar bilhete)" : "Tem cartão Move C");
      if (r.allergies) partes.push(`Alergias: ${r.allergies}`);
    }
    partes.push("", resumoCurto_());
    enviar_(`${CONFIG.SUBJECT} — ${r.name}: ${sim ? "SIM" : "NÃO"}`, partes.join("\n"));
  }
  if (lista.length) props.setProperty("ULTIMA_RESPOSTA", String(lista[lista.length - 1].createdAt));
}

/* ============================ PEDIDOS / AÇÕES ============================= */

function tratarMensagem_(texto) {
  const t = normalizar_(texto);
  const pend = getPendente_();
  if (pend) {
    if (/^(sim|s|yes|ok|confirmo|confirmar|confirma|claro)\b/.test(t)) return executarPendente_(pend);
    if (/^(nao|n|no|cancela|cancelar|esquece)\b/.test(t)) {
      limparPendente_();
      return "Cancelado. Nada foi alterado.";
    }
  }
  if (t === "ajuda" || t === "?" || t === "help") return ajuda_();
  const simples = comandosSimples_(texto);
  if (simples) return simples;
  const key = PropertiesService.getScriptProperties().getProperty("OPENROUTER_API_KEY");
  if (key) {
    try {
      return conversarIA_(texto, key);
    } catch (e) {
      return "A IA não conseguiu responder agora (" + (e.message || e) + ").\n\n" + ajuda_();
    }
  }
  return "Não percebi.\n\n" + ajuda_();
}

function ajuda_() {
  return [
    "Comandos (ou escreve à tua maneira, se a IA estiver ligada):",
    "• respostas — resumo",
    "• nomes — quem respondeu",
    "• horarios — horários atuais",
    "• hora 7 16:00 (ou 16:00-18:00)",
    "• sem hora 7",
    "• proibir Joana / permitir Joana",
    "• proibidos — lista",
    "• visitas",
    "• emails ligar / emails desligar",
    "• atualizar — recarrega o site aberto",
    "Alterações pedem sempre: sim / não.",
  ].join("\n");
}

/** Comandos curtos. Devolve texto, ou null se não reconhecer. */
function comandosSimples_(texto) {
  const t = normalizar_(texto);
  let m;
  if (/^respostas?$|^resumo$/.test(t)) return ACOES.ver_resumo.run({});
  if (/^nomes$|^quem( respondeu)?$/.test(t)) return ACOES.ver_respostas.run({});
  if (/^horarios?$/.test(t)) return ACOES.ver_horarios.run({});
  if (/^visitas$/.test(t)) return ACOES.ver_visitas.run({});
  if (/^proibidos$/.test(t)) return ACOES.ver_nomes_proibidos.run({});
  if (/^atualizar$/.test(t)) return pedirConfirmacao_("forcar_atualizacao", {});
  if ((m = t.match(/^emails? (ligar|desligar)$/))) return pedirConfirmacao_("emails", { ligar: m[1] === "ligar" });
  if ((m = t.match(/^(?:hora|horario)\s+(\d{1,2})\s+(\d{1,2}[:h]\d{2})(?:\s*(?:-|a|ate)\s*(\d{1,2}[:h]\d{2}))?$/)))
    return pedirConfirmacao_("definir_horario", { atividade: m[1], inicio: m[2], fim: m[3] || "" });
  if ((m = t.match(/^(?:sem hora|remover hora|apagar hora)\s+(\d{1,2})$/))) return pedirConfirmacao_("remover_horario", { atividade: m[1] });
  if ((m = String(texto).trim().match(/^proibir\s+(.+)$/i))) return pedirConfirmacao_("proibir_nome", { nome: m[1].trim() });
  if ((m = String(texto).trim().match(/^permitir\s+(.+)$/i))) return pedirConfirmacao_("permitir_nome", { nome: m[1].trim() });
  return null;
}

/* ---- Registo de ações (usado pelos comandos simples e pela IA) ---- */

const ACOES = {
  ver_resumo: {
    escrita: false,
    descricao: "Resumo das respostas ao convite: quantos vão, quantos não vão, alergias e quem não tem cartão de transportes.",
    params: {},
    run: () => resumoRespostas_(),
  },
  ver_respostas: {
    escrita: false,
    descricao: "Lista de todas as respostas (nome, se vai, mensagem, data).",
    params: {},
    run: () => {
      const l = listaRespostas_();
      if (!l.length) return "Ainda não há respostas.";
      return l
        .map((r) => `• ${r.name} — ${r.attending === "yes" ? "SIM" : "NÃO"}${r.message ? ` ("${r.message}")` : ""} · ${data_(r.createdAt)}`)
        .join("\n");
    },
  },
  ver_horarios: {
    escrita: false,
    descricao: "Horários atuais de todas as atividades do programa.",
    params: {},
    run: () => {
      const s = dbGet_("schedule") || {};
      return ACTIVITIES.map((a) => `${a.id} ${a.nome}: ${formatHora_(s[a.id])}`).join("\n");
    },
  },
  ver_visitas: {
    escrita: false,
    descricao: "Estatísticas de visitas ao site: total, hoje, visitantes únicos e hora com mais visitas.",
    params: {},
    run: () => resumoVisitas_(),
  },
  ver_nomes_proibidos: {
    escrita: false,
    descricao: "Lista de nomes proibidos e a mensagem mostrada a quem os usa.",
    params: {},
    run: () => {
      const n = Object.values(dbGet_("bannedNames") || {}).map((x) => x.term);
      const msg = dbGet_("settings/bannedMessage") || DEFAULT_BANNED_MESSAGE;
      return (n.length ? "Proibidos: " + n.join(", ") : "Não há nomes proibidos.") + `\nMensagem: "${msg}"`;
    },
  },
  definir_horario: {
    escrita: true,
    descricao: "Define o horário de uma atividade (hora de início obrigatória, fim opcional).",
    params: {
      atividade: { type: "string", description: "Número da atividade, de 01 a 09." },
      inicio: { type: "string", description: "Hora de início, HH:MM (24h)." },
      fim: { type: "string", description: "Hora de fim, HH:MM (24h), ou vazio." },
    },
    obrigatorios: ["atividade", "inicio"],
    validar: (a) => {
      const id = idAtividade_(a.atividade);
      const inicio = hora_(a.inicio);
      const fim = a.fim ? hora_(a.fim) : "";
      if (!id) return { erro: "Atividade inválida (01 a 09)." };
      if (!inicio) return { erro: "Hora de início inválida." };
      if (a.fim && !fim) return { erro: "Hora de fim inválida." };
      if (fim && fim <= inicio) return { erro: "A hora de fim tem de ser depois do início." };
      return { args: { atividade: id, inicio, fim } };
    },
    resumo: (a) => `${nomeAtividade_(a.atividade)}: ${a.inicio}${a.fim ? " – " + a.fim : ""}`,
    run: (a) => {
      const v = { start: a.inicio, updatedAt: { ".sv": "timestamp" } };
      if (a.fim) v.end = a.fim;
      dbWrite_("PUT", "schedule/" + a.atividade, v);
      return `Feito. ${nomeAtividade_(a.atividade)} às ${a.inicio}${a.fim ? "–" + a.fim : ""}. Já está no site.`;
    },
  },
  remover_horario: {
    escrita: true,
    descricao: "Tira o horário de uma atividade (passa a 'A confirmar').",
    params: { atividade: { type: "string", description: "Número da atividade, de 01 a 09." } },
    obrigatorios: ["atividade"],
    validar: (a) => (idAtividade_(a.atividade) ? { args: { atividade: idAtividade_(a.atividade) } } : { erro: "Atividade inválida." }),
    resumo: (a) => `${nomeAtividade_(a.atividade)} passa a "A confirmar"`,
    run: (a) => {
      dbWrite_("DELETE", "schedule/" + a.atividade);
      return `Feito. ${nomeAtividade_(a.atividade)} está agora "A confirmar".`;
    },
  },
  proibir_nome: {
    escrita: true,
    descricao: "Proíbe um nome: quem confirmar presença com este nome não fica registado.",
    params: { nome: { type: "string", description: "Nome ou palavra a proibir." } },
    obrigatorios: ["nome"],
    validar: (a) => {
      const nome = String(a.nome || "").replace(/\s+/g, " ").trim().slice(0, 60);
      if (!normalizarNome_(nome)) return { erro: "Nome vazio." };
      return { args: { nome } };
    },
    resumo: (a) => `Proibir o nome "${a.nome}"`,
    run: (a) => {
      const norm = normalizarNome_(a.nome);
      const lista = dbGet_("bannedNames") || {};
      if (Object.values(lista).some((x) => normalizarNome_(x.term) === norm)) return `"${a.nome}" já estava proibido.`;
      const hash = hashNome_(norm);
      const id = "email-" + Utilities.getUuid().replace(/-/g, "").slice(0, 12);
      const upd = {};
      upd["bannedNames/" + id] = { term: a.nome, hash, createdAt: { ".sv": "timestamp" } };
      upd["bannedHashes/" + hash] = true;
      dbWrite_("PATCH", "", upd);
      return `Feito. "${a.nome}" está proibido.`;
    },
  },
  permitir_nome: {
    escrita: true,
    descricao: "Retira um nome da lista de nomes proibidos.",
    params: { nome: { type: "string", description: "Nome a voltar a permitir." } },
    obrigatorios: ["nome"],
    validar: (a) => (normalizarNome_(a.nome) ? { args: { nome: String(a.nome).trim() } } : { erro: "Nome vazio." }),
    resumo: (a) => `Voltar a permitir o nome "${a.nome}"`,
    run: (a) => {
      const norm = normalizarNome_(a.nome);
      const lista = dbGet_("bannedNames") || {};
      const alvo = Object.entries(lista).filter(([, x]) => normalizarNome_(x.term) === norm);
      if (!alvo.length) return `"${a.nome}" não estava na lista.`;
      const upd = {};
      alvo.forEach(([id, x]) => {
        upd["bannedNames/" + id] = null;
        const outros = Object.entries(lista).some(([oid, o]) => oid !== id && o.hash === x.hash && !alvo.some(([aid]) => aid === oid));
        if (!outros) upd["bannedHashes/" + x.hash] = null;
      });
      dbWrite_("PATCH", "", upd);
      return `Feito. "${a.nome}" já pode confirmar.`;
    },
  },
  mensagem_proibidos: {
    escrita: true,
    descricao: "Muda a mensagem mostrada a quem tenta confirmar com um nome proibido. Usar texto 'padrão' para repor.",
    params: { texto: { type: "string", description: "Nova mensagem (até 300 caracteres) ou 'padrão'." } },
    obrigatorios: ["texto"],
    validar: (a) => {
      const t = String(a.texto || "").replace(/\s+/g, " ").trim();
      if (!t) return { erro: "Mensagem vazia." };
      if (t.length > 300) return { erro: "Mensagem com mais de 300 caracteres." };
      return { args: { texto: /^padr[aã]o$/i.test(t) ? "" : t } };
    },
    resumo: (a) => (a.texto ? `Nova mensagem para nomes proibidos: "${a.texto}"` : "Repor a mensagem padrão para nomes proibidos"),
    run: (a) => {
      if (a.texto) dbWrite_("PUT", "settings/bannedMessage", a.texto);
      else dbWrite_("DELETE", "settings/bannedMessage");
      return "Feito. Mensagem atualizada.";
    },
  },
  emails: {
    escrita: true,
    descricao: "Liga ou desliga os emails automáticos do EmailJS a cada resposta.",
    params: { ligar: { type: "boolean", description: "true para ligar, false para desligar." } },
    obrigatorios: ["ligar"],
    validar: (a) => ({ args: { ligar: a.ligar === true || a.ligar === "true" } }),
    resumo: (a) => (a.ligar ? "Ligar os emails EmailJS" : "Desligar os emails EmailJS"),
    run: (a) => {
      const cfg = dbGet_("settings/emailjs");
      if (!cfg) return "O EmailJS ainda não está configurado no painel.";
      dbWrite_("PATCH", "settings/emailjs", { enabled: a.ligar });
      return a.ligar ? "Feito. Emails ligados." : "Feito. Emails desligados.";
    },
  },
  forcar_atualizacao: {
    escrita: true,
    descricao: "Obriga todas as páginas do site abertas a recarregar.",
    params: {},
    validar: () => ({ args: {} }),
    resumo: () => "Recarregar todas as páginas do site que estão abertas",
    run: () => {
      dbWrite_("PUT", "meta/version", String(Date.now()));
      return "Feito. As páginas abertas vão recarregar.";
    },
  },
};

function pedirConfirmacao_(acao, args) {
  const def = ACOES[acao];
  const v = def.validar ? def.validar(args || {}) : { args };
  if (v.erro) return v.erro;
  const pend = { acao, args: v.args, expira: Date.now() + CONFIG.PENDING_MINUTES * 60000 };
  PropertiesService.getScriptProperties().setProperty("PENDENTE", JSON.stringify(pend));
  return `${def.resumo(v.args)}.\nConfirmas? Responde sim ou não.`;
}

function getPendente_() {
  const raw = PropertiesService.getScriptProperties().getProperty("PENDENTE");
  if (!raw) return null;
  const p = JSON.parse(raw);
  if (!p || p.expira < Date.now()) {
    limparPendente_();
    return null;
  }
  return p;
}

function limparPendente_() {
  PropertiesService.getScriptProperties().deleteProperty("PENDENTE");
}

function executarPendente_(pend) {
  limparPendente_();
  return ACOES[pend.acao].run(pend.args);
}

/* ============================== IA (OPENROUTER) =========================== */

function conversarIA_(texto, key) {
  const model = PropertiesService.getScriptProperties().getProperty("OPENROUTER_MODEL") || CONFIG.OPENROUTER_MODEL;
  const tools = Object.entries(ACOES).map(([nome, a]) => ({
    type: "function",
    function: {
      name: nome,
      description: a.descricao,
      parameters: { type: "object", properties: a.params || {}, required: a.obrigatorios || [] },
    },
  }));
  const agora = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm");
  const sistema = [
    "És o assistente do organizador do aniversário de Francisco Rodrigues (Coimbra, 29/11/2026).",
    "Falas português de Portugal e respondes MUITO curto (vai ser lido num Apple Watch): 1 a 4 linhas.",
    `Agora são ${agora} (Lisboa).`,
    "Atividades do programa (número e nome): " + ACTIVITIES.map((a) => `${a.id}=${a.nome}`).join("; ") + ".",
    "Usa as ferramentas para consultar ou alterar dados. Nunca inventes dados: consulta primeiro.",
    "Para alterar, chama a ferramenta de alteração com os valores certos (horas em HH:MM, 24h);",
    "o sistema vai pedir confirmação ao organizador, por isso não digas que já está feito.",
    "Não podes apagar respostas de convidados. Se o pedido não for sobre o aniversário, diz que só tratas do aniversário.",
  ].join("\n");

  const messages = [
    { role: "system", content: sistema },
    { role: "user", content: texto },
  ];
  for (let i = 0; i < 4; i += 1) {
    const res = UrlFetchApp.fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + key,
        "HTTP-Referer": CONFIG.SITE_URL,
        "X-Title": "Assistente Aniversario FR",
      },
      muteHttpExceptions: true,
      payload: JSON.stringify({ model, messages, tools, tool_choice: "auto", temperature: 0.2, max_tokens: 400 }),
    });
    const code = res.getResponseCode();
    if (code !== 200) {
      let detalhe = "";
      try {
        detalhe = JSON.parse(res.getContentText()).error.message;
      } catch (e) {
        detalhe = "";
      }
      throw new Error("OpenRouter HTTP " + code + (detalhe ? ": " + String(detalhe).slice(0, 120) : ""));
    }
    const data = JSON.parse(res.getContentText());
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    if (!msg) throw new Error("resposta vazia");
    const calls = msg.tool_calls || [];
    if (!calls.length) {
      const txt = String(msg.content || "").trim();
      return txt || "Não percebi. Escreve 'ajuda' para ver os comandos.";
    }
    messages.push({ role: "assistant", content: msg.content || "", tool_calls: calls });
    for (const c of calls) {
      const nome = c.function && c.function.name;
      let args = {};
      try {
        args = c.function.arguments ? JSON.parse(c.function.arguments) : {};
      } catch (e) {
        args = {};
      }
      const def = ACOES[nome];
      if (!def) {
        messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify({ erro: "Ferramenta desconhecida." }) });
        continue;
      }
      if (def.escrita) return pedirConfirmacao_(nome, args); // nunca altera sem "sim"
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify({ resultado: def.run(args) }) });
    }
  }
  return "Não consegui concluir. Tenta dizer de outra forma, ou escreve 'ajuda'.";
}

/* =============================== FIREBASE ================================= */

function dbUrl_(path, query) {
  const q = Object.entries(query || {})
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return `${CONFIG.DATABASE_URL}/${path}.json${q ? "?" + q : ""}`;
}

function dbFetch_(method, path, body, query) {
  const opts = {
    method: method.toLowerCase(),
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  };
  if (body !== undefined) {
    opts.contentType = "application/json";
    opts.payload = JSON.stringify(body);
  }
  const res = UrlFetchApp.fetch(dbUrl_(path, query), opts);
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error(`Firebase ${method} ${path || "/"} → ${code}`);
  const txt = res.getContentText();
  return txt ? JSON.parse(txt) : null;
}

const dbGet_ = (path) => dbFetch_("GET", path);
const dbQuery_ = (path, query) => dbFetch_("GET", path, undefined, query);
const dbWrite_ = (method, path, body) => dbFetch_(method, path, body);

/* ============================ RESUMOS E UTILITÁRIOS ======================= */

function listaRespostas_() {
  return Object.values(dbGet_("rsvps") || {})
    .filter((r) => r && r.name)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function resumoRespostas_() {
  const l = listaRespostas_();
  if (!l.length) return "Ainda não há respostas.";
  const sim = l.filter((r) => r.attending === "yes");
  const nao = l.filter((r) => r.attending === "no");
  const linhas = [`${sim.length} vão · ${nao.length} não vão (de 6 previstos)`];
  if (sim.length) linhas.push("Vão: " + sim.map((r) => r.name).join(", "));
  const alerg = sim.filter((r) => r.allergies);
  if (alerg.length) linhas.push("Alergias: " + alerg.map((r) => `${r.name} (${r.allergies})`).join("; "));
  const semCartao = sim.filter((r) => r.noTransportCard);
  if (semCartao.length) linhas.push("Sem cartão Move C: " + semCartao.map((r) => r.name).join(", "));
  return linhas.join("\n");
}

function resumoCurto_() {
  const l = listaRespostas_();
  const sim = l.filter((r) => r.attending === "yes").length;
  return `Total: ${sim} vão, ${l.length - sim} não vão.`;
}

function resumoVisitas_() {
  const v = Object.values(dbQuery_("visits", { orderBy: '"at"', limitToLast: "2000" }) || {}).filter((x) => x && x.at);
  if (!v.length) return "Ainda não há visitas registadas.";
  const hoje = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");
  const horas = {};
  let nHoje = 0;
  v.forEach((x) => {
    const d = new Date(x.at);
    if (Utilities.formatDate(d, CONFIG.TIMEZONE, "yyyy-MM-dd") === hoje) nHoje += 1;
    const h = Utilities.formatDate(d, CONFIG.TIMEZONE, "HH");
    horas[h] = (horas[h] || 0) + 1;
  });
  const pico = Object.entries(horas).sort((a, b) => b[1] - a[1])[0];
  const unicos = new Set(v.map((x) => x.visitor)).size;
  const ultima = Math.max(...v.map((x) => x.at));
  return `${v.length} visitas · ${unicos} visitantes · hoje ${nHoje}\nMais visitas às ${pico[0]}h (${pico[1]})\nÚltima: ${data_(ultima)}`;
}

function formatHora_(e) {
  if (!e || !e.start) return "A confirmar";
  return e.end ? `${e.start}–${e.end}` : e.start;
}

function data_(ms) {
  return ms ? Utilities.formatDate(new Date(ms), CONFIG.TIMEZONE, "dd/MM HH:mm") : "—";
}

function idAtividade_(v) {
  const n = parseInt(String(v || "").replace(/\D/g, ""), 10);
  return n >= 1 && n <= ACTIVITIES.length ? String(n).padStart(2, "0") : "";
}

function nomeAtividade_(id) {
  const a = ACTIVITIES.find((x) => x.id === id);
  return a ? `${a.id} ${a.nome}` : id;
}

/** "16h", "16:00", "4:30" → "HH:MM" (ou "" se inválido). */
function hora_(v) {
  const m = String(v || "").trim().toLowerCase().match(/^(\d{1,2})(?:[:h.](\d{2}))?h?$/);
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (h > 23 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Minúsculas e sem acentos (para comandos). */
function normalizar_(t) {
  return String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Igual a normalizeTerm() de assets/js/shared/banned.js. */
function normalizarNome_(t) {
  return String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Igual a hashTerm() de assets/js/shared/banned.js (SHA-256, hex). */
function hashNome_(normalizado) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, BANNED_SALT + normalizado, Utilities.Charset.UTF_8);
  return bytes.map((b) => ((b + 256) % 256).toString(16).padStart(2, "0")).join("");
}
