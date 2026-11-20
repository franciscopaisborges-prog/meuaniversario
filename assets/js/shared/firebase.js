/**
 * Inicialização partilhada do Firebase (site público + administração).
 * Usa o SDK modular oficial servido pelo CDN da Google (sem passo de build).
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getDatabase,
  connectDatabaseEmulator,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { firebaseConfig, appCheckSiteKey, emulators } from "../../../firebase-config.js";

export const FIREBASE_VERSION = "12.19.0";
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const REQUIRED_KEYS = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];

/** true quando todos os campos obrigatórios foram preenchidos. */
export function isFirebaseConfigured() {
  return REQUIRED_KEYS.every((key) => {
    const value = firebaseConfig[key];
    return typeof value === "string" && value.trim() !== "" && !value.includes("COLOCAR_");
  });
}

function shouldUseEmulators() {
  const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (!local) return false;
  const flag = new URLSearchParams(window.location.search).get("emulators") === "1";
  return Boolean(emulators?.enabled) || flag;
}

let cached = null;

/**
 * Devolve { app, db, usingEmulators } ou lança um erro com code "not-configured".
 */
export async function getFirebase() {
  if (cached) return cached;
  if (!isFirebaseConfigured()) {
    const error = new Error("Firebase ainda não está configurado (firebase-config.js).");
    error.code = "not-configured";
    throw error;
  }

  const app = initializeApp(firebaseConfig);
  const usingEmulators = shouldUseEmulators();

  if (appCheckSiteKey && !usingEmulators) {
    const { initializeAppCheck, ReCaptchaV3Provider } = await import(`${CDN}/firebase-app-check.js`);
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  const db = getDatabase(app);
  if (usingEmulators) {
    connectDatabaseEmulator(db, emulators.host, emulators.databasePort);
  }

  cached = { app, db, usingEmulators };
  return cached;
}

/** Carrega o módulo de Authentication apenas onde é necessário (admin). */
export async function getFirebaseAuth() {
  const { app, usingEmulators } = await getFirebase();
  const authModule = await import(`${CDN}/firebase-auth.js`);
  const auth = authModule.getAuth(app);
  if (usingEmulators && !auth.emulatorConfig) {
    authModule.connectAuthEmulator(auth, `http://${emulators.host}:${emulators.authPort}`, {
      disableWarnings: true,
    });
  }
  return { auth, authModule };
}
