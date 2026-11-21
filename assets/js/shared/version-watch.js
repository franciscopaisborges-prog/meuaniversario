/**
 * Atualização forçada das páginas abertas.
 *
 * Todas as páginas (site e painel) escutam /meta/version na Realtime Database.
 * Quando esse valor muda (por exemplo, depois de `npm run deploy` ou de
 * `npm run force-refresh`), cada página aberta recarrega-se sozinha e passa a
 * usar a versão publicada mais recente.
 */
export function watchVersion(db, dbModule, { onBeforeReload } = {}) {
  let known;
  return dbModule.onValue(
    dbModule.ref(db, "meta/version"),
    (snapshot) => {
      const value = snapshot.val();
      if (known === undefined) {
        known = value; // primeira leitura: versão em uso
        return;
      }
      if (value !== known) {
        known = value;
        try {
          onBeforeReload?.();
        } finally {
          window.location.reload();
        }
      }
    },
    (error) => console.warn("[versão] leitura indisponível:", error?.message || error)
  );
}
