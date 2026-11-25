/**
 * Envio de emails através do EmailJS (https://www.emailjs.com), sem SDK:
 * chamada direta à API REST pública. A configuração (Service ID, Template ID,
 * Public Key) é definida no painel e guardada em /settings/emailjs.
 * Estes três valores são públicos por natureza (o EmailJS foi feito para ser
 * chamado a partir do navegador); o email de destino fica definido no modelo
 * do EmailJS e nunca aparece no site.
 */
export const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isEmailConfigComplete(cfg) {
  return Boolean(
    cfg &&
      cfg.enabled === true &&
      ID_RE.test(cfg.serviceId || "") &&
      ID_RE.test(cfg.templateId || "") &&
      ID_RE.test(cfg.publicKey || "")
  );
}

/** Envia; devolve { ok, status, text }. Nunca lança exceções. */
export async function sendEmail(cfg, templateParams, { timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(EMAILJS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: cfg.serviceId,
        template_id: cfg.templateId,
        user_id: cfg.publicKey,
        template_params: templateParams,
      }),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status, text: await res.text().catch(() => "") };
  } catch (error) {
    return { ok: false, status: 0, text: String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

const dateFmt = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Variáveis disponíveis no modelo do EmailJS. */
export function rsvpTemplateParams(data, when = new Date()) {
  const yes = data.attending === "yes";
  return {
    guest_name: data.name,
    attending: yes ? "Sim, vai estar presente" : "Não vai conseguir ir",
    attending_short: yes ? "SIM" : "NÃO",
    message: data.message || "—",
    transport_card: yes ? (data.noTransportCard ? "NÃO tem cartão Move C — levar o valor do bilhete" : "Tem cartão Move C") : "—",
    allergies: yes ? data.allergies || "Nenhuma indicada" : "—",
    submitted_at: dateFmt.format(when),
    event_date: "29/11/2026",
    site_url: "https://aniversario-francisco.web.app",
  };
}
