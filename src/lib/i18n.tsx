import { useCallback, useSyncExternalStore } from "react";

export type Lang = "es" | "en";

const KEY = "isabot_lang";
let current: Lang = "es";
const listeners = new Set<() => void>();

function detect(): Lang {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "es" || saved === "en") return saved;
    return navigator.language?.toLowerCase().startsWith("en") ? "en" : "es";
  } catch {
    return "es";
  }
}

if (typeof window !== "undefined") {
  current = detect();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  current = lang;
  try {
    window.localStorage.setItem(KEY, lang);
    document.documentElement.lang = lang;
  } catch {
    /* almacenamiento bloqueado */
  }
  listeners.forEach((l) => l());
}

type Dict = Record<string, { es: string; en: string }>;

export const STRINGS: Dict = {
  // Auth
  "auth.welcomeBack": { es: "Bienvenido de nuevo", en: "Welcome back" },
  "auth.createAccount": { es: "Crea tu cuenta", en: "Create your account" },
  "auth.subSignin": {
    es: "Tu co-piloto de IA creativa para estudiar mejor, emprender con foco y crear sin bloqueo.",
    en: "Your creative AI co-pilot to study smarter, build with focus and create without blocks.",
  },
  "auth.subSignup": {
    es: "Únete a IsaBot — el co-piloto de IA para estudiantes y emprendedores.",
    en: "Join IsaBot — the AI co-pilot for students and creators.",
  },
  "auth.chip1": { es: "📚 Estudia mejor", en: "📚 Study smarter" },
  "auth.chip2": { es: "🚀 Emprende con foco", en: "🚀 Build with focus" },
  "auth.chip3": { es: "🎨 Crea sin bloqueo", en: "🎨 Create without blocks" },
  "auth.google": { es: "Continuar con Google", en: "Continue with Google" },
  "auth.orEmail": { es: "o con tu correo", en: "or with your email" },
  "auth.displayName": { es: "Nombre para mostrar", en: "Display name" },
  "auth.phone": { es: "Celular (opcional)", en: "Phone (optional)" },
  "auth.email": { es: "Correo", en: "Email" },
  "auth.password": { es: "Contraseña", en: "Password" },
  "auth.signin": { es: "Iniciar sesión", en: "Sign in" },
  "auth.signup": { es: "Crear cuenta", en: "Create account" },
  "auth.noAccount": { es: "¿No tienes cuenta?", en: "Don't have an account?" },
  "auth.hasAccount": { es: "¿Ya tienes cuenta?", en: "Already have an account?" },
  "auth.register": { es: "Regístrate", en: "Sign up" },
  "auth.back": { es: "← Volver al chat", en: "← Back to chat" },
  "auth.googleUnavailable": {
    es: "Google no está disponible ahora mismo. Entra con tu correo y contraseña 💜",
    en: "Google sign-in isn't available right now. Use your email and password 💜",
  },
  "auth.created": {
    es: "¡Cuenta creada! Revisa tu correo para confirmar y luego inicia sesión 💕",
    en: "Account created! Check your email to confirm, then sign in 💕",
  },
  "auth.badCreds": { es: "Correo o contraseña incorrectos 💔", en: "Wrong email or password 💔" },
  "auth.notConfirmed": {
    es: "Debes confirmar tu correo antes de entrar 💌",
    en: "You must confirm your email before signing in 💌",
  },
  "auth.storageBlocked": {
    es: "Safari está bloqueando el almacenamiento. Desactiva el modo privado o el bloqueo de cookies e inténtalo de nuevo.",
    en: "Safari is blocking storage. Turn off private mode or cookie blocking and try again.",
  },
  "auth.network": {
    es: "Sin conexión estable. Revisa tu internet e inténtalo otra vez.",
    en: "Unstable connection. Check your internet and try again.",
  },
  "auth.genericError": { es: "Ocurrió un error al iniciar sesión", en: "Something went wrong while signing in" },

  // Landing
  "landing.title": { es: "¡Hola! Soy IsaBot ✨", en: "Hi! I'm IsaBot ✨" },
  "landing.tagline": {
    es: "Tu copiloto de IA creativa para estudiar, emprender y crear sin bloqueos. Conmigo puedes generar PDFs profesionales, imágenes, consultar noticias tech, acumular IsaBot Coins 🪙 y mantener tu racha diaria 🔥.",
    en: "Your creative AI copilot to study, build and create without blocks. With me you can generate professional PDFs, images, read tech news, earn IsaBot Coins 🪙 and keep your daily streak 🔥.",
  },

  "landing.f1t": { es: "📄 PDFs agénticos", en: "📄 Agentic PDFs" },
  "landing.f1d": {
    es: "Pide un informe, una carta o un resumen y IsaBot lo escribe, lo maqueta y te lo entrega listo.",
    en: "Ask for a report, letter or summary and IsaBot writes, designs and delivers it ready to send.",
  },
  "landing.f2t": { es: "🔥 Rachas diarias", en: "🔥 Daily streaks" },
  "landing.f2d": {
    es: "Vuelve cada día, mantén tu racha y gana recompensas estilo Duolingo.",
    en: "Come back every day, keep your streak and earn Duolingo-style rewards.",
  },
  "landing.f3t": { es: "🪙 IsaBot Coins", en: "🪙 IsaBot Coins" },
  "landing.f3d": {
    es: "Una economía gamificada: gana monedas, desbloquea temas y funciones PRO.",
    en: "A gamified economy: earn coins, unlock themes and PRO features.",
  },
  "landing.f4t": { es: "📰 Noticias Tech", en: "📰 Tech News" },
  "landing.f4d": {
    es: "El resumen diario del mundo tech, en tu idioma y explicado por IsaBot.",
    en: "The daily tech digest, in your language and explained by IsaBot.",
  },
  "landing.cta": { es: "Iniciar sesión / Crear cuenta ✨", en: "Sign in / Create account ✨" },
  "landing.signup": { es: "Crear cuenta gratis", en: "Sign up free" },


  // News
  "news.title": { es: "📰 Noticias Tech del Día", en: "📰 Today's Tech News" },
  "news.sub": {
    es: "Lo más importante del mundo tech, resumido por IsaBot ✨",
    en: "The most important tech stories, summarized by IsaBot ✨",
  },
  "news.all": { es: "🌐 Todo", en: "🌐 All" },
  "news.ia": { es: "🤖 IA", en: "🤖 AI" },
  "news.startups": { es: "🚀 Startups", en: "🚀 Startups" },
  "news.dev": { es: "🧑‍💻 Desarrollo", en: "🧑‍💻 Dev" },
  "news.gadgets": { es: "📱 Gadgets", en: "📱 Gadgets" },
  "news.general": { es: "🌐 Tech", en: "🌐 Tech" },
  "news.loading": { es: "Buscando lo último del día… 🛰️", en: "Fetching today's headlines… 🛰️" },
  "news.empty": { es: "Todavía no hay noticias de este tema 🌸", en: "No stories for this topic yet 🌸" },
  "news.error": { es: "No pude traer las noticias", en: "I couldn't load the news" },
  "news.close": { es: "Cerrar", en: "Close" },

  // Common
  "common.close": { es: "Cerrar", en: "Close" },
  "common.language": { es: "Idioma", en: "Language" },
};

export function translate(key: string, lang: Lang = current): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[lang];
}

export function useI18n() {
  const lang = useSyncExternalStore(subscribe, getLang, () => "es" as Lang);
  const t = useCallback((key: string) => translate(key, lang), [lang]);
  return { lang, t, setLang };
}

export function timeAgo(iso: string, lang: Lang): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return lang === "en" ? `${mins} min ago` : `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return lang === "en" ? `${hours} h ago` : `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return lang === "en" ? `${days} d ago` : `hace ${days} d`;
}
