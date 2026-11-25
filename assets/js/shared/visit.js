/**
 * Registo de visitas (anónimo).
 * Guarda em /visits/{id}: { at (hora do servidor), page, visitor, device }.
 *  - visitor: código aleatório guardado neste navegador (para contar visitantes
 *    únicos); não identifica a pessoa.
 *  - Sem IP, nome, localização ou outros dados pessoais.
 *  - Conta uma vez por página e por sessão do navegador (recarregar não conta).
 *  - Navegadores marcados no painel com "Não contar este navegador" são ignorados.
 */
const DB_CDN = "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
export const NO_TRACK_KEY = "fr-aniversario:no-track";
const VISITOR_KEY = "fr-aniversario:visitor";

function storage(kind) {
  try {
    return window[kind];
  } catch {
    return null;
  }
}

export function isTrackingDisabled() {
  return storage("localStorage")?.getItem(NO_TRACK_KEY) === "1";
}

export function setTrackingDisabled(disabled) {
  const ls = storage("localStorage");
  if (!ls) return false;
  if (disabled) ls.setItem(NO_TRACK_KEY, "1");
  else ls.removeItem(NO_TRACK_KEY);
  return true;
}

function visitorId() {
  const ls = storage("localStorage");
  let id = ls?.getItem(VISITOR_KEY);
  if (!id || !/^[a-z0-9]{16}$/.test(id)) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    id = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    try {
      ls?.setItem(VISITOR_KEY, id);
    } catch {
      /* sem armazenamento: conta como visitante novo */
    }
  }
  return id;
}

function deviceType() {
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "telemovel";
  return "computador";
}

export async function logVisit(page) {
  try {
    if (isTrackingDisabled()) return;
    const ss = storage("sessionStorage");
    const sessionKey = `fr-aniversario:visited:${page}`;
    if (ss?.getItem(sessionKey)) return;

    const [{ getFirebase }, dbModule] = await Promise.all([import("./firebase.js"), import(DB_CDN)]);
    const { db } = await getFirebase();
    await dbModule.set(dbModule.push(dbModule.ref(db, "visits")), {
      at: dbModule.serverTimestamp(),
      page,
      visitor: visitorId(),
      device: deviceType(),
    });
    ss?.setItem(sessionKey, "1");
  } catch {
    /* o registo de visitas nunca pode afetar o site */
  }
}
