// popup.js — IsaBot Chrome Extension
const APP_URL = "https://isa-bot.lovable.app";

// ⚠️ Pon aquí tu API Key gratuita de Groq Cloud (https://console.groq.com)
const GROQ_API_KEY = "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";

document.getElementById("open-app").addEventListener("click", () => {
  chrome.tabs.create({ url: APP_URL });
});

document.getElementById("open-agent").addEventListener("click", () => {
  chrome.tabs.create({ url: APP_URL + "/?agent=1" });
});

document.getElementById("summarize").addEventListener("click", async () => {
  const btn = document.getElementById("summarize");
  const out = document.getElementById("summary-result");

  btn.disabled = true;
  btn.textContent = "🔎 Leyendo…";
  out.style.display = "block";
  out.textContent = "Extrayendo contenido de la pestaña…";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No hay pestaña activa");

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll("script,style,noscript,iframe").forEach((n) => n.remove());
        return (clone.innerText || "").slice(0, 6000);
      },
    });

    const pageText = String(result || "").trim();
    if (!pageText) throw new Error("No pude leer contenido de esta pestaña.");

    btn.textContent = "🧠 Pensando con IsaBot…";
    out.textContent = "Generando resumen súper rápido…";

    // 🚀 PETICIÓN DIRECTA A GROQ CLOUD (0 Créditos de Lovable)
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant", // Modelo gratis, rápido e inteligente
        messages: [
          {
            role: "system",
            content:
              "Eres IsaBot, la asistente de productividad e IA de IsaRoRo Studio. Tu trabajo es resumir contenidos web de forma clara, directa y estructurada en español.",
          },
          {
            role: "user",
            content: `Resume el siguiente contenido de una página web en español. Devuelve exactamente 5 bullets muy claros y una línea final de conclusión / cierre.

Título: ${tab.title ?? ""}
URL: ${tab.url ?? ""}

Contenido:
${pageText}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 800,
      }),
    });

    if (!res.ok) throw new Error("Error en API de Groq: " + res.status);

    const data = await res.json();
    const answer = data.choices[0]?.message?.content;

    out.textContent = answer || "IsaBot no devolvió texto.";
  } catch (e) {
    out.textContent = "💔 " + (e && e.message ? e.message : "Error inesperado");
  } finally {
    btn.disabled = false;
    btn.textContent = "Resumir pestaña actual";
  }
});
