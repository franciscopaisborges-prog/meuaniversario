/**
 * Site público — ponto de entrada.
 * Programa (roteiro), mapa geral, navegação para as páginas de atividade
 * (router por hash, sem recarregar a página) e confirmação de presença.
 */
import { PROGRAM, ROUTES, EVENT, findBySlug } from "./program.js";
import { renderDetail } from "./detail.js";
import { createOverviewMap, createDetailMap } from "./map.js";
import { initRsvp } from "./rsvp.js";
import { $, $$, esc, icon, prefersReducedMotion } from "../shared/dom.js";

const ROUTE_RE = /^#\/atividade\/([a-z0-9-]+)\/?$/;
const BASE_TITLE = document.title;

const home = $("#home");
const detail = $("#detail");
const detailContent = $("#detailContent");
const detailCount = $("#detailCount");

/* ---------------- Roteiro ---------------- */
function renderProgram() {
  const list = $("#roteiro");
  list.innerHTML = PROGRAM.map(
    (a, i) => `
    <li class="step reveal" style="--delay:${Math.min(i * 0.05, 0.3)}s">
      <a class="step__link" href="#/atividade/${esc(a.slug)}" data-slug="${esc(a.slug)}" aria-label="${esc(a.id)} — ${esc(a.kicker)}: ${esc(a.title)}. Abrir detalhes.">
        <span class="step__node" aria-hidden="true"><span class="step__num">${esc(a.id)}</span></span>
        <span class="step__body">
          <span class="step__kicker eyebrow">${esc(a.kicker)}</span>
          <span class="step__title">${esc(a.title)}</span>
          <span class="step__meta">
            <span>${esc(a.place)}</span>
            <span>Horário: ${esc(a.schedule)}</span>
          </span>
        </span>
        <span class="step__go" aria-hidden="true">${icon("i-arrow-right")}</span>
      </a>
    </li>`
  ).join("");
}

/* ---------------- Contagem decrescente ---------------- */
function lisbonToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${parts}T00:00:00Z`);
}

function renderCountdown() {
  const el = $("#countdown");
  if (!el) return;
  const days = Math.round((new Date(`${EVENT.dateISO}T00:00:00Z`) - lisbonToday()) / 86400000);
  el.textContent =
    days > 1 ? `Faltam ${days} dias` : days === 1 ? "É amanhã" : days === 0 ? "É hoje!" : "Celebrado";
}

/* ---------------- Cabeçalho e animações ---------------- */
function initHeader() {
  const header = $("#siteHeader");
  const update = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

function initCurveLengths() {
  $$(".curves--draw path").forEach((path) => {
    try {
      path.style.setProperty("--len", Math.ceil(path.getTotalLength()));
    } catch {
      /* ignorar */
    }
  });
}

function initReveal() {
  const items = $$(".reveal");
  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  items.forEach((el) => io.observe(el));
}

/* ---------------- Mapa geral ---------------- */
let overview = null;

function ensureOverviewMap() {
  if (!overview) overview = createOverviewMap($("#overviewMap"));
  return overview;
}

function initOverviewMap() {
  const status = $("#routesStatus");
  const verified = ROUTES.filter((r) => r.verified === true);
  status.innerHTML = verified.length
    ? `${verified.map((r) => `<span class="route-line">${esc(r.label)}</span>`).join("")}<small>Traçados calculados a partir do OpenStreetMap. Sem trajeto: Quinta das Lágrimas → apresentação (local por confirmar).</small>`
    : "Nenhum trajeto está ainda confirmado. O mapa mostra apenas os pontos — os trajetos estão por definir.";

  const container = $("#overviewMap");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          ensureOverviewMap();
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(container);
  } else {
    ensureOverviewMap();
  }

  const chips = $("#mapChips");
  chips.innerHTML = PROGRAM.map((a) =>
    a.location
      ? `<li><button class="chip" type="button" data-focus="${esc(a.slug)}"><b>${esc(a.id)}</b>${esc(a.title)}</button></li>`
      : `<li><a class="chip" href="#/atividade/${esc(a.slug)}"><b>${esc(a.id)}</b>${esc(a.title)} · local a confirmar</a></li>`
  ).join("");

  chips.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-focus]");
    if (!btn) return;
    const instance = ensureOverviewMap();
    if (!instance) return;
    container.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    instance.focusActivity(btn.dataset.focus);
  });
}

/* ---------------- Página de atividade (router) ---------------- */
let currentIndex = -1;
let detailMap = null;
let openedFromHome = false;
let closeTimer = null;
let mapTimer = null;

function setOriginFromEvent(event) {
  const x = event?.clientX;
  const y = event?.clientY;
  if (typeof x === "number" && typeof y === "number" && (x || y)) {
    detail.style.setProperty("--ox", `${x}px`);
    detail.style.setProperty("--oy", `${y}px`);
  } else {
    detail.style.setProperty("--ox", "50%");
    detail.style.setProperty("--oy", "50%");
  }
}

function destroyDetailMap() {
  if (!detailMap) return;
  try {
    detailMap.stop();
    detailMap.off();
    detailMap.remove();
  } catch {
    /* mapa já removido */
  }
  detailMap = null;
}

function mountDetailMap(delay) {
  clearTimeout(mapTimer);
  destroyDetailMap();
  const build = () => {
    const el = $("#detailMap", detailContent);
    if (!el) return;
    detailMap = createDetailMap(el, PROGRAM[currentIndex]);
    // garantir dimensões corretas depois da transição
    const current = detailMap;
    setTimeout(() => current && current === detailMap && current.invalidateSize({ animate: false }), 300);
  };
  mapTimer = setTimeout(build, delay);
}

function openDetail(index) {
  const activity = PROGRAM[index];
  const wasOpen = detail.classList.contains("is-open");
  clearTimeout(closeTimer);
  currentIndex = index;

  detailContent.innerHTML = renderDetail(index);
  detailCount.textContent = `${activity.id} / ${String(PROGRAM.length).padStart(2, "0")}`;
  document.title = `${activity.id} · ${activity.title} — ${EVENT.name}`;

  if (wasOpen) {
    detailContent.classList.remove("is-swapping");
    void detailContent.offsetWidth;
    detailContent.classList.add("is-swapping");
    detail.scrollTo({ top: 0, behavior: "auto" });
    mountDetailMap(50);
  } else {
    detail.classList.remove("is-closing");
    detail.removeAttribute("inert");
    detail.setAttribute("aria-hidden", "false");
    detail.scrollTop = 0;
    home.inert = true;
    document.body.classList.add("detail-open");
    void detail.offsetWidth;
    detail.classList.add("is-open");
    mountDetailMap(prefersReducedMotion() ? 0 : 500);
  }
  detailContent.focus({ preventScroll: true });
}

function closeDetail() {
  if (!detail.classList.contains("is-open")) return;
  const slug = PROGRAM[currentIndex]?.slug;
  detail.classList.remove("is-open");
  detail.classList.add("is-closing");
  home.inert = false;
  document.body.classList.remove("detail-open");
  document.title = BASE_TITLE;
  detail.setAttribute("aria-hidden", "true");
  detail.setAttribute("inert", "");

  const link = slug ? $(`.step__link[data-slug="${slug}"]`) : null;
  if (link) {
    link.scrollIntoView({ block: "center", behavior: "auto" });
    link.focus({ preventScroll: true });
  }

  closeTimer = setTimeout(
    () => {
      detail.classList.remove("is-closing");
      destroyDetailMap();
      detailContent.innerHTML = "";
      currentIndex = -1;
    },
    prefersReducedMotion() ? 0 : 720
  );
}

function backToProgram() {
  if (openedFromHome) {
    history.back();
  } else {
    history.replaceState(null, "", `${location.pathname}${location.search}#programa`);
    closeDetail();
  }
}

function handleRoute() {
  const match = location.hash.match(ROUTE_RE);
  if (match) {
    const index = findBySlug(match[1]);
    if (index >= 0) {
      openDetail(index);
      return;
    }
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
  openedFromHome = false;
  closeDetail();
}

function initRouter() {
  // Guardar o ponto de clique para a transição circular.
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest('a[href^="#/atividade/"]');
      if (!link) return;
      setOriginFromEvent(event);
      if (link.dataset.nav === "replace") {
        event.preventDefault();
        location.replace(link.getAttribute("href"));
        return;
      }
      if (!detail.classList.contains("is-open")) openedFromHome = true;
    },
    true
  );

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-detail-back]")) {
      event.preventDefault();
      backToProgram();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if ($("#rsvpModal").open) return;
    if (detail.classList.contains("is-open")) {
      event.preventDefault();
      backToProgram();
    }
  });

  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}

/* ---------------- Arranque ---------------- */
renderProgram();
renderCountdown();
initHeader();
initCurveLengths();
initReveal();
initOverviewMap();
initRsvp();
initRouter();
