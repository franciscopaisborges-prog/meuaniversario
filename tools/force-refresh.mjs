/**
 * Obriga todas as páginas abertas (site e painel) a recarregar.
 * Grava um novo valor em /meta/version; cada página aberta escuta esse
 * valor e recarrega-se quando muda (assets/js/shared/version-watch.js).
 *
 * Uso:  npm run force-refresh      (requer `firebase login` com acesso ao projeto)
 */
import { execFileSync } from "node:child_process";

const version = String(Date.now());
execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["firebase", "database:set", "/meta/version", "--data", JSON.stringify(version), "--force"],
  { stdio: "inherit" }
);
console.log(`\nVersão ${version} publicada: as páginas abertas vão recarregar.`);
