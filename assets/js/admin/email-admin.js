/**
 * Painel → Email: configuração do EmailJS em /settings/emailjs e envio de teste.
 */
import { $ } from "../shared/dom.js";
import { sendEmail, rsvpTemplateParams } from "../shared/emailjs.js";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function createEmailAdmin({ db, dbModule }) {
  const form = $("#emailForm");
  const fields = {
    enabled: $("#emailEnabled"),
    serviceId: $("#emailService"),
    templateId: $("#emailTemplate"),
    publicKey: $("#emailKey"),
  };
  const status = $("#emailStatus");
  const ref = () => dbModule.ref(db, "settings/emailjs");
  let unsubscribe = null;
  let dirty = false;

  const setStatus = (text, kind) => {
    status.textContent = text || "";
    status.className = `a-banned-status${kind ? ` is-${kind}` : ""}`;
  };
  function setLive(mode, text) {
    const el = $("#emailLive");
    el.classList.toggle("is-live", mode === "live");
    el.classList.toggle("is-error", mode === "error");
    $("#emailLiveText").textContent = text;
  }

  function read() {
    return {
      enabled: fields.enabled.checked,
      serviceId: fields.serviceId.value.trim(),
      templateId: fields.templateId.value.trim(),
      publicKey: fields.publicKey.value.trim(),
    };
  }

  function validate(cfg) {
    const missing = [
      ["Service ID", cfg.serviceId],
      ["Template ID", cfg.templateId],
      ["Public Key", cfg.publicKey],
    ].filter(([, v]) => !ID_RE.test(v));
    return missing.length ? `Preencha corretamente: ${missing.map(([n]) => n).join(", ")}.` : "";
  }

  form.addEventListener("input", () => {
    dirty = true;
    setStatus("");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const cfg = read();
    const error = validate(cfg);
    if (error) {
      setStatus(error, "error");
      return;
    }
    const btn = $("#emailSave");
    btn.disabled = true;
    try {
      await dbModule.set(ref(), cfg);
      dirty = false;
      setStatus(cfg.enabled ? "Guardado. Os emails estão ativos." : "Guardado. Os emails estão desligados.", "ok");
    } catch (e) {
      console.error("[email]", e);
      setStatus("Não foi possível guardar. Verifique a ligação e as permissões.", "error");
    } finally {
      btn.disabled = false;
    }
  });

  $("#emailTest").addEventListener("click", async () => {
    const cfg = read();
    const error = validate(cfg);
    if (error) {
      setStatus(error, "error");
      return;
    }
    const btn = $("#emailTest");
    btn.disabled = true;
    setStatus("A enviar email de teste…");
    const result = await sendEmail(
      cfg,
      rsvpTemplateParams({
        name: "Convidado de teste",
        attending: "yes",
        message: "Isto é um email de teste enviado a partir do painel.",
        noTransportCard: true,
        allergies: "Nenhuma (teste)",
      })
    );
    btn.disabled = false;
    if (result.ok) setStatus("Email de teste enviado. Verifique a sua caixa de correio.", "ok");
    else
      setStatus(
        `O EmailJS recusou o envio (${result.status || "sem ligação"}): ${result.text.slice(0, 160) || "verifique os códigos e o modelo."}`,
        "error"
      );
  });

  return {
    start() {
      this.stop();
      setLive("idle", "A ligar…");
      unsubscribe = dbModule.onValue(
        ref(),
        (snap) => {
          const v = snap.val() || {};
          if (!dirty) {
            fields.enabled.checked = v.enabled === true;
            fields.serviceId.value = v.serviceId || "";
            fields.templateId.value = v.templateId || "";
            fields.publicKey.value = v.publicKey || "";
          }
          setLive(v.enabled ? "live" : "idle", v.enabled ? "Envio ativo" : "Envio desligado");
        },
        (e) => {
          console.error("[email] onValue", e);
          setLive("error", "Ligação interrompida");
        }
      );
    },
    stop() {
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      dirty = false;
      Object.values(fields).forEach((f) => (f.type === "checkbox" ? (f.checked = false) : (f.value = "")));
      setStatus("");
    },
  };
}
