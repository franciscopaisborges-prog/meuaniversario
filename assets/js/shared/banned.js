/**
 * Nomes proibidos — normalização e "impressões digitais" (SHA-256).
 *
 * - /bannedNames/{id}   → { term, hash, createdAt }   (só administradores)
 * - /bannedHashes/{hash}: true                          (leitura de UMA entrada
 *   de cada vez; a lista não pode ser listada por ninguém do público)
 *
 * O site público calcula as impressões digitais das palavras do nome escrito
 * e verifica se alguma existe em /bannedHashes. Assim a lista de nomes nunca
 * é exposta a quem visita o site.
 */

const SALT = "fr-aniversario:nome:";

/** Minúsculas, sem acentos, só letras/dígitos e espaços simples. */
export function normalizeTerm(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Termos a verificar para um nome: cada palavra, cada par de palavras
 * seguidas (com e sem espaço, para apanhar "Mary Ana" / "Maryana")
 * e o nome completo.
 */
export function candidateTerms(name) {
  const words = normalizeTerm(name).split(" ").filter(Boolean);
  const out = new Set(words);
  for (let i = 0; i < words.length - 1; i += 1) {
    out.add(`${words[i]} ${words[i + 1]}`);
    out.add(`${words[i]}${words[i + 1]}`);
  }
  if (words.length) out.add(words.join(" "));
  return [...out];
}

/** Impressão digital (hex) de um termo já normalizado. */
export async function hashTerm(normalized) {
  const data = new TextEncoder().encode(SALT + normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verdadeiro se o nome contiver algum termo proibido (lista local, para o painel). */
export function matchesBanned(name, bannedNormalized) {
  if (!bannedNormalized.size) return false;
  return candidateTerms(name).some((t) => bannedNormalized.has(t));
}
