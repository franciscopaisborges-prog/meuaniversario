/* Aplica o modo guardado (CLASSIC/GAMES) antes de a página aparecer, sem "piscar". */
(function () {
  try {
    if (localStorage.getItem("fr-aniversario:mode") === "games") document.documentElement.dataset.mode = "games";
  } catch (e) {
    /* sem armazenamento: fica em CLASSIC */
  }
})();
