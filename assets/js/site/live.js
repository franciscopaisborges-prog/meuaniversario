/**
 * Horários em tempo real: lê /schedule da Realtime Database (leitura pública)
 * e atualiza o site sem recarregar. Guarda a última versão no navegador para
 * mostrar os horários de imediato na visita seguinte.
 * Se o Firebase não estiver disponível, o site continua a funcionar e mostra
 * "A confirmar".
 */
import { setSchedule } from "./state.js";

const DB_CDN = "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
const CACHE_KEY = "fr-aniversario:schedule";

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
  } catch {
    return null;
  }
}

function writeCache(value) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível */
  }
}

export async function startLiveSchedule() {
  const cached = readCache();
  if (cached) setSchedule(cached);
  try {
    const [{ getFirebase }, dbModule, { watchVersion }] = await Promise.all([
      import("../shared/firebase.js"),
      import(DB_CDN),
      import("../shared/version-watch.js"),
    ]);
    const { db } = await getFirebase();
    watchVersion(db, dbModule);
    dbModule.onValue(
      dbModule.ref(db, "schedule"),
      (snapshot) => {
        const value = snapshot.val() || {};
        writeCache(value);
        setSchedule(value);
      },
      (error) => console.warn("[horários] leitura indisponível:", error?.message || error)
    );
  } catch (error) {
    if (error?.code !== "not-configured") console.warn("[horários] Firebase indisponível:", error?.message || error);
  }
}
