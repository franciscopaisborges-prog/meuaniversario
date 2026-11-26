/**
 * Painel → Visitas: resumo, visitas por hora do dia, últimos 14 dias e lista.
 * Lê as últimas 2000 visitas de /visits em tempo real (só administradores).
 */
import { $, esc } from "../shared/dom.js";
import { isTrackingDisabled, setTrackingDisabled } from "../shared/visit.js";

const TZ = "Europe/Lisbon";
const LIMIT = 2000;
const PAGE_LABEL = { convite: "Convite", promax: "PROMAX 2.0", citygames: "OU · City Games" };
const DEVICE_LABEL = { telemovel: "Telemóvel", tablet: "Tablet", computador: "Computador" };

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" });
const dateFmt = new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });
const shortDayFmt = new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, day: "2-digit", month: "2-digit" });

export const dayKey = (ms) => dayKeyFmt.format(new Date(ms));
export const hourOf = (ms) => Number(hourFmt.format(new Date(ms)));

/** Agregados (exportado para testes). */
export function summarize(visits, now = Date.now()) {
  const hours = Array(24).fill(0);
  const days = new Map();
  const today = dayKey(now);
  for (let i = 13; i >= 0; i -= 1) days.set(dayKey(now - i * 86400000), 0);
  let todayCount = 0;
  for (const v of visits) {
    hours[hourOf(v.at)] += 1;
    const k = dayKey(v.at);
    if (days.has(k)) days.set(k, days.get(k) + 1);
    if (k === today) todayCount += 1;
  }
  return {
    total: visits.length,
    unique: new Set(visits.map((v) => v.visitor)).size,
    today: todayCount,
    last: visits.length ? Math.max(...visits.map((v) => v.at)) : null,
    hours,
    days: [...days.entries()],
  };
}

function bars(container, items, labelOf, titleOf) {
  const max = Math.max(1, ...items.map((i) => i.count));
  container.innerHTML = items
    .map((item) => {
      const pct = (item.count / max) * 100;
      const peak = item.count > 0 && item.count === max;
      return `<div class="a-bar${peak ? " a-bar--peak" : ""}" title="${esc(titleOf(item))}">
        <span class="a-bar__fill" style="height:${pct}%"></span>
        ${item.count ? `<span class="a-bar__count" style="bottom:${pct}%">${item.count}</span>` : ""}
        <span class="a-bar__label">${esc(labelOf(item))}</span>
      </div>`;
    })
    .join("");
}

export function createVisitsAdmin({ db, dbModule }) {
  let unsubscribe = null;
  let visits = [];

  const status = $("#vStatus");
  const noTrackBtn = $("#vNoTrack");
  const setStatus = (text, kind) => {
    status.textContent = text || "";
    status.className = `a-banned-status${kind ? ` is-${kind}` : ""}`;
  };

  function syncNoTrack() {
    const off = isTrackingDisabled();
    noTrackBtn.setAttribute("aria-pressed", String(off));
    noTrackBtn.textContent = off ? "Este navegador não é contado ✓" : "Não contar este navegador";
  }

  function setLive(mode, text) {
    const el = $("#visitsLive");
    el.classList.toggle("is-live", mode === "live");
    el.classList.toggle("is-error", mode === "error");
    $("#visitsLiveText").textContent = text;
  }

  function render() {
    const s = summarize(visits);
    $("#vTotal").textContent = s.total;
    $("#vUnique").textContent = s.unique;
    $("#vToday").textContent = s.today;
    $("#vLast").textContent = s.last ? `${dateFmt.format(new Date(s.last))} ${timeFmt.format(new Date(s.last)).slice(0, 5)}` : "—";

    bars(
      $("#vHours"),
      s.hours.map((count, h) => ({ h, count })),
      (i) => String(i.h).padStart(2, "0"),
      (i) => `${String(i.h).padStart(2, "0")}h: ${i.count} visita(s)`
    );
    bars(
      $("#vDays"),
      s.days.map(([k, count]) => ({ k, count })),
      (i) => shortDayFmt.format(new Date(`${i.k}T12:00:00Z`)),
      (i) => `${shortDayFmt.format(new Date(`${i.k}T12:00:00Z`))}: ${i.count} visita(s)`
    );

    const recent = visits.slice().sort((a, b) => b.at - a.at).slice(0, 100);
    $("#vRows").innerHTML = recent
      .map(
        (v) => `<tr>
          <td>${esc(dateFmt.format(new Date(v.at)))}</td>
          <td class="a-date">${esc(timeFmt.format(new Date(v.at)))}</td>
          <td>${esc(PAGE_LABEL[v.page] || v.page)}</td>
          <td>${esc(DEVICE_LABEL[v.device] || v.device)}</td>
          <td class="a-muted">#${esc(v.visitor.slice(0, 6))}</td>
        </tr>`
      )
      .join("");
    $("#vEmpty").hidden = visits.length > 0;
  }

  noTrackBtn.addEventListener("click", () => {
    const ok = setTrackingDisabled(!isTrackingDisabled());
    syncNoTrack();
    setStatus(
      ok
        ? isTrackingDisabled()
          ? "As visitas deste navegador deixam de ser contadas."
          : "As visitas deste navegador voltam a ser contadas."
        : "Não foi possível guardar a preferência neste navegador.",
      ok ? "ok" : "error"
    );
  });

  $("#vClear").addEventListener("click", async () => {
    if (!window.confirm("Apagar todo o histórico de visitas? Esta ação não pode ser desfeita.")) return;
    try {
      await dbModule.remove(dbModule.ref(db, "visits"));
      setStatus("Histórico de visitas apagado.", "ok");
    } catch (error) {
      console.error("[visitas]", error);
      setStatus("Não foi possível apagar o histórico.", "error");
    }
  });

  return {
    start() {
      this.stop();
      syncNoTrack();
      setLive("idle", "A ligar…");
      const q = dbModule.query(dbModule.ref(db, "visits"), dbModule.orderByChild("at"), dbModule.limitToLast(LIMIT));
      unsubscribe = dbModule.onValue(
        q,
        (snap) => {
          visits = [];
          snap.forEach((child) => {
            const v = child.val() || {};
            if (typeof v.at === "number" && typeof v.visitor === "string") visits.push(v);
          });
          setLive("live", "Em tempo real");
          render();
        },
        (error) => {
          console.error("[visitas] onValue", error);
          setLive("error", "Ligação interrompida");
        }
      );
    },
    stop() {
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      visits = [];
      $("#vRows").innerHTML = "";
      setStatus("");
    },
  };
}
