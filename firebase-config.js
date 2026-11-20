/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CONFIGURAÇÃO DO FIREBASE — partilhada por index.html e admin.html
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Onde obter estes valores:
 *  Consola Firebase → ⚙ Definições do projeto → Geral → "As suas aplicações"
 *  → aplicação Web → "Configuração do SDK" → opção "Config".
 *
 *  Substitua cada valor "COLOCAR_..." pelo valor correspondente do seu projeto.
 *  Estes valores NÃO são segredos: identificam o projeto e são sempre visíveis
 *  no navegador. A segurança é garantida pelas regras da Realtime Database
 *  (firebase-rtdb-rules.json), pela autenticação e, opcionalmente, pelo App Check.
 *
 *  Enquanto existirem valores "COLOCAR_...", o site funciona em modo de
 *  consulta e o formulário de presença mostra um erro claro em vez de
 *  simular uma gravação.
 */
export const firebaseConfig = {
  apiKey: "COLOCAR_API_KEY",
  authDomain: "COLOCAR_PROJECT_ID.firebaseapp.com",
  // Exemplo: "https://o-meu-projeto-default-rtdb.europe-west1.firebasedatabase.app"
  databaseURL: "COLOCAR_DATABASE_URL",
  projectId: "COLOCAR_PROJECT_ID",
  appId: "COLOCAR_APP_ID",
};

/**
 *  App Check (opcional, recomendado em produção).
 *  Cole aqui a "chave do site" reCAPTCHA v3 registada no App Check.
 *  Deixe vazio ("") para não ativar. Ver README → "App Check e antiabuso".
 */
export const appCheckSiteKey = "";

/**
 *  Emuladores locais do Firebase (apenas para desenvolvimento e testes).
 *  Só são usados quando o site corre em localhost/127.0.0.1 E
 *  (enabled === true OU o endereço contém ?emulators=1).
 */
export const emulators = {
  enabled: false,
  host: "127.0.0.1",
  databasePort: 9000,
  authPort: 9099,
};
