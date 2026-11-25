/** info.html: preenche os horários atuais a partir de /schedule (leitura pública). */
import { formatSchedule } from "../shared/schedule.js";

try {
  const { getFirebase } = await import("../shared/firebase.js");
  const { ref, get } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js");
  const { db } = await getFirebase();
  const schedule = (await get(ref(db, "schedule"))).val() || {};
  document.querySelectorAll("[data-schedule]").forEach((el) => {
    el.textContent = formatSchedule(schedule[el.dataset.schedule]);
  });
} catch {
  /* sem ligação: mantém-se "A confirmar" */
}
