import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { BRAINS } from "@/lib/brains";

import { getMyProfile, acknowledgePremiumGift } from "@/lib/profile.functions";
import { sendWelcomeEmail } from "@/lib/welcome.functions";
import { sendLoginAlert } from "@/lib/login-alert.functions";
import { OnboardingTour } from "@/components/OnboardingTour";
import { parseReminder, reminderSummary } from "@/lib/reminder-parse";
import { parseEmailIntent, parseDocIntent } from "@/lib/chat-intents";
import { ChatActionCardView, type ChatAction } from "@/components/ChatActionCards";

import { createReminder } from "@/lib/reminders.functions";
import { DesktopCowork } from "@/components/DesktopCowork";
import { isDesktopApp } from "@/lib/desktop-bridge";
import { IsaSpacePanel } from "@/components/IsaSpacePanel";
import { AcademyPanel } from "@/components/AcademyPanel";

import { DailyPlanPanel } from "@/components/DailyPlanPanel";
import { InvitePanel } from "@/components/InvitePanel";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { TechNewsPanel } from "@/components/TechNewsPanel";

import { claimReferralCode, getMyReferralInfo } from "@/lib/referrals.functions";
import { ShareCardButton } from "@/components/ShareCard";
import { PrivacyPolicyModal } from "@/components/PrivacyPolicyModal";
import { heartbeat } from "@/lib/presence.functions";

import { ISABOT_MODEL_LABEL } from "@/lib/branding";
import { useLocalBrain, LOCAL_MODEL_SIZE_MB } from "@/lib/useLocalBrain";
import { loadQueue, saveQueue, clearQueue, offlineAnswer, type QueuedMessage } from "@/lib/offline-mode";
import { IbcProvider, useIbc } from "@/components/ibc/useIbc";
import { IbcHud, IbcOverlays } from "@/components/ibc/IbcHud";
import { InterstitialAd } from "@/components/InterstitialAd";
import { AgentPdfPanel } from "@/components/ibc/AgentPdfPanel";
import "../isabot.css";


// On the web build this hits the co-located server route.
// On the Capacitor build (file://) there is no server — set
// VITE_API_BASE_URL to your published web URL (e.g. https://tu-app.lovable.app)
// so the client calls `${VITE_API_BASE_URL}/api/chat` instead.
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const CHAT_URL = API_BASE ? `${API_BASE}/api/chat` : "/api/chat";

// Envía la petición al /api/chat adjuntando el token de sesión de Supabase.
// El backend rechaza cualquier llamada sin usuario autenticado (evita abuso de créditos).
// 🎨 Sinestesia de IA: el tema visual activo viaja con cada petición al modelo.
export type Vibe = "kawaii" | "cyberpunk" | "zen" | "custom";
export type CustomVibe = { name: string; bg: string; accent: string; text: string; tone: string };
export const DEFAULT_CUSTOM_VIBE: CustomVibe = {
  name: "Mi estilo",
  bg: "#f3e9ff",
  accent: "#c9a7ff",
  text: "#4a2e6b",
  tone: "",
};
let ACTIVE_VIBE: Vibe = "kawaii";
let ACTIVE_CUSTOM_VIBE = "";
export function setActiveVibe(v: Vibe) {
  ACTIVE_VIBE = v;
}
export function setActiveCustomVibe(tone: string) {
  ACTIVE_CUSTOM_VIBE = tone;
}

async function chatFetch(body: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const payload =
    body && typeof body === "object" && !Array.isArray(body)
      ? {
          ...(body as Record<string, unknown>),
          vibe: ACTIVE_VIBE,
          ...(ACTIVE_VIBE === "custom" && ACTIVE_CUSTOM_VIBE ? { customVibe: ACTIVE_CUSTOM_VIBE } : {}),
        }
      : body;
  return fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
}




const EMOJIS = ["🌸", "🌈", "⭐", "🔥", "🍀", "🐱", "🐶", "🎵", "💎", "⚡", "🦋", "🌻"];
const randomEmoji = () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

type Personality =
  | "kawaii" | "tutor" | "gamer" | "estudio" | "rapido" | "code" | "isabotcode"
  | "profesional" | "motivadora" | "sarcastica" | "poeta" | "coach" | "filosofa" | "gamer_pro"
  | "custom";

const FREE_PERSONALITIES: Personality[] = ["kawaii", "tutor", "gamer", "estudio", "rapido", "code", "isabotcode"];

// 🧠 Cerebros de IsaBot (motores de IA disponibles) — catálogo en src/lib/brains.ts
type BrainId = string;



type Note = { id: number; text: string; color: string; createdAt: number };

type Message = {
  sender: "user" | "bot";
  text: string;
  type?: "imagen" | "text";
  thinking?: boolean;
  error?: boolean;
  imageUrl?: string; // adjunto del usuario (foto)
  action?: ChatAction; // tarjeta de confirmación (recordatorio / correo)
};


type Chat = {
  id: string;
  owner: string;
  messages: Message[];
  pinned: boolean;
  createdAt: string;
  title?: string;
};

type TaskPriority = "low" | "med" | "high";
type Task = {
  id: number;
  text: string;
  done: boolean;
  priority: TaskPriority;
  due?: string | null; // ISO date (YYYY-MM-DD)
  createdAt: number;
};
type Pet = { name: string; hunger: number; happy: number; energy: number; xp: number; stage: number };

const DEFAULT_PET: Pet = { name: "Momo", hunger: 80, happy: 80, energy: 80, xp: 0, stage: 0 };
const PET_STAGE_NAMES = ["Bebé", "Peque", "Junior", "Teen", "Legendaria"];


type PetMood = "happy" | "sad" | "sleepy" | "hungry" | "love";

const KawaiiRobot = () => (
  <svg viewBox="0 0 100 100" width="35" height="35" style={{ flexShrink: 0 }}>
    <circle cx="50" cy="12" r="5" fill="#ff477e" />
    <line x1="50" y1="12" x2="50" y2="25" stroke="#ff477e" strokeWidth="4" />
    <rect x="20" y="25" width="60" height="50" rx="18" fill="#ffd6eb" stroke="#ff85a2" strokeWidth="3" />
    <rect x="13" y="42" width="8" height="15" rx="3" fill="#ff85a2" />
    <rect x="79" y="42" width="8" height="15" rx="3" fill="#ff85a2" />
    <rect x="28" y="34" width="44" height="24" rx="10" fill="#fff0f6" />
    <path d="M 36 48 Q 41 40 44 48" stroke="#ff477e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    <path d="M 56 48 Q 59 40 64 48" stroke="#ff477e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    <circle cx="32" cy="54" r="4" fill="#ffa3c4" opacity="0.8" />
    <circle cx="68" cy="54" r="4" fill="#ffa3c4" opacity="0.8" />
    <path d="M 47 52 Q 50 55 53 52" stroke="#ff477e" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

// ─────────── Mascota Virtual: IsaBot interactiva ───────────
import isabotMascot from "@/assets/isabot-mascot.png.asset.json";
import accGlasses from "@/assets/acc-glasses.png.asset.json";
import accCap from "@/assets/acc-cap.png.asset.json";
import accBrush from "@/assets/acc-brush.png.asset.json";
import WelcomeModal from "@/components/WelcomeModal";
import { LanguageToggle } from "@/components/LanguageToggle";

import { PromoCarousel } from "@/components/PromoCarousel";
import PdfGallery from "@/components/PdfGallery";
import { openPdfGallery } from "@/lib/pdf-gallery";
import { ISA_THEMES, activeTheme, applyCustomTheme, applyTheme, ownTheme, ownedThemes, restoreCustomTheme } from "@/lib/themes";
import { generateCustomTheme } from "@/lib/creative-ai.functions";
import { useI18n } from "@/lib/i18n";
import "@/lib/themes.css";



type AccessoryKey = "glasses" | "cap" | "brush";
const ACCESSORIES: Record<AccessoryKey, {
  label: string;
  emoji: string;
  url: string;
  style: React.CSSProperties;
}> = {
  cap:     { label: "Gorra",  emoji: "🧢", url: accCap.url,     style: { top: "-6%",  left: "18%", width: "64%", zIndex: 3 } },
  glasses: { label: "Lentes", emoji: "🕶️", url: accGlasses.url, style: { top: "26%",  left: "22%", width: "56%", zIndex: 4 } },
  brush:   { label: "Pincel", emoji: "🖌️", url: accBrush.url,   style: { top: "55%",  left: "58%", width: "42%", zIndex: 5, transform: "rotate(-15deg)" } },
};

type FloatingReact = { id: number; emoji: string; x: number; y: number };

function AnimatedMascot({ mood }: { mood: PetMood }) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    let alive = true;
    function loop() {
      if (!alive) return;
      const nextIn = 1800 + Math.random() * 2800;
      setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        setTimeout(() => {
          setBlink(false);
          if (Math.random() < 0.35) {
            setTimeout(() => {
              setBlink(true);
              setTimeout(() => setBlink(false), 120);
            }, 160);
          }
          loop();
        }, 140);
      }, nextIn);
    }
    loop();
    return () => {
      alive = false;
    };
  }, []);

  const eyesClosed = blink || mood === "sleepy";

  // Mouth path per mood
  const mouth =
    mood === "sad"     ? "M 188 172 Q 200 162 212 172"
    : mood === "hungry" ? "M 188 165 Q 200 180 212 165"
    : mood === "sleepy" ? "M 190 170 Q 200 174 210 170"
    :                     "M 188 165 Q 200 178 212 165"; // happy / love

  const heartColor = mood === "love" ? "#ff4d8a" : mood === "sad" ? "#c9a2c8" : "#f79ebb";
  const cheekOpacity = mood === "love" || mood === "happy" ? 1 : 0.6;

  return (
    <div className={`mascot-wrap mood-${mood}`}>
      <svg
        className="isabot-svg"
        viewBox="0 0 400 440"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Sombra */}
        <ellipse cx="200" cy="410" rx="90" ry="12" fill="#e2d4e7" opacity="0.6" />

        <g className="isabot-body-group">
          {/* PIERNAS */}
          <rect x="135" y="340" width="45" height="60" rx="22" fill="#fbc4db" stroke="#4a354f" strokeWidth="8" strokeLinejoin="round" />
          <ellipse cx="157.5" cy="395" rx="22.5" ry="10" fill="#f79ebb" stroke="#4a354f" strokeWidth="6" />
          <rect x="220" y="340" width="45" height="60" rx="22" fill="#fbc4db" stroke="#4a354f" strokeWidth="8" strokeLinejoin="round" />
          <ellipse cx="242.5" cy="395" rx="22.5" ry="10" fill="#f79ebb" stroke="#4a354f" strokeWidth="6" />

          {/* CUERPO */}
          <rect x="130" y="230" width="140" height="130" rx="45" fill="#fbc4db" stroke="#4a354f" strokeWidth="8" strokeLinejoin="round" />

          {/* Pantalla del Pecho */}
          <rect x="155" y="250" width="90" height="70" rx="20" fill="#ffebf1" stroke="#4a354f" strokeWidth="6" />

          {/* Corazón del Pecho */}
          <path
            className="isabot-heart"
            d="M 200 290 C 200 290 175 275 175 265 C 175 257 185 252 192 257 C 196 260 200 266 200 266 C 200 266 204 260 208 257 C 215 252 225 257 225 265 C 225 275 200 290 200 290 Z"
            fill={heartColor}
            stroke="#4a354f"
            strokeWidth="2"
          />

          {/* Brazo Izquierdo (saluda) */}
          <g className="isabot-arm-left">
            <path d="M 134 260 C 100 270 95 320 125 325" fill="none" stroke="#4a354f" strokeWidth="24" strokeLinecap="round" />
            <path d="M 134 260 C 100 270 95 320 125 325" fill="none" stroke="#fbc4db" strokeWidth="12" strokeLinecap="round" />
          </g>

          {/* Brazo Derecho */}
          <g className="isabot-arm-right">
            <path d="M 266 260 C 300 270 305 320 275 325" fill="none" stroke="#4a354f" strokeWidth="24" strokeLinecap="round" />
            <path d="M 266 260 C 300 270 305 320 275 325" fill="none" stroke="#fbc4db" strokeWidth="12" strokeLinecap="round" />
          </g>

          {/* TABLETA */}
          <rect x="120" y="300" width="160" height="55" rx="10" fill="#ded3f5" stroke="#4a354f" strokeWidth="7" strokeLinejoin="round" />
          <rect x="130" y="308" width="140" height="39" rx="6" fill="#ffffff" />
          <text x="200" y="332" fontFamily="sans-serif" fontWeight="bold" fontSize="14" fill="#4a354f" textAnchor="middle">IsaRoRo</text>

          {/* OREJAS */}
          <rect x="62" y="125" width="25" height="60" rx="12" fill="#f79ebb" stroke="#4a354f" strokeWidth="8" />
          <rect x="313" y="125" width="25" height="60" rx="12" fill="#f79ebb" stroke="#4a354f" strokeWidth="8" />

          {/* CABEZA */}
          <g className="isabot-head">
            <rect x="75" y="70" width="250" height="175" rx="75" fill="#fbc4db" stroke="#4a354f" strokeWidth="8" strokeLinejoin="round" />

            {/* Pantalla de la cara */}
            <rect x="100" y="90" width="200" height="130" rx="50" fill="#ffebf1" stroke="#4a354f" strokeWidth="7" />

            {/* OJOS */}
            <g className="isabot-eyes">
              {eyesClosed ? (
                <>
                  {/* Cerrados: arco hacia abajo */}
                  <path d="M 135 152 Q 150 162 165 152" fill="none" stroke="#4a354f" strokeWidth="7" strokeLinecap="round" />
                  <path d="M 235 152 Q 250 162 265 152" fill="none" stroke="#4a354f" strokeWidth="7" strokeLinecap="round" />
                </>
              ) : mood === "love" ? (
                <>
                  {/* Corazoncitos */}
                  <path d="M 150 158 C 150 158 138 150 138 142 C 138 136 145 133 150 137 C 150 137 155 133 162 136 C 168 139 168 148 150 158 Z" fill="#ff4d8a" />
                  <path d="M 250 158 C 250 158 238 150 238 142 C 238 136 245 133 250 137 C 250 137 255 133 262 136 C 268 139 268 148 250 158 Z" fill="#ff4d8a" />
                </>
              ) : mood === "sad" ? (
                <>
                  <path d="M 135 148 Q 150 158 165 148" fill="none" stroke="#4a354f" strokeWidth="7" strokeLinecap="round" />
                  <path d="M 235 148 Q 250 158 265 148" fill="none" stroke="#4a354f" strokeWidth="7" strokeLinecap="round" />
                  <circle cx="168" cy="160" r="4" fill="#a8d8ff" />
                  <circle cx="232" cy="160" r="4" fill="#a8d8ff" />
                </>
              ) : (
                <>
                  {/* Ojos abiertos redondos */}
                  <circle cx="150" cy="150" r="10" fill="#4a354f" />
                  <circle cx="153" cy="147" r="3" fill="#ffffff" />
                  <circle cx="250" cy="150" r="10" fill="#4a354f" />
                  <circle cx="253" cy="147" r="3" fill="#ffffff" />
                </>
              )}
            </g>

            {/* Mejillas */}
            <ellipse cx="130" cy="170" rx="14" ry="8" fill="#f79ebb" opacity={cheekOpacity} />
            <ellipse cx="270" cy="170" rx="14" ry="8" fill="#f79ebb" opacity={cheekOpacity} />

            {/* Sonrisa */}
            <path d={mouth} fill="none" stroke="#4a354f" strokeWidth="6" strokeLinecap="round" />
          </g>

          {/* ANTENA */}
          <g className="isabot-antenna">
            <rect x="194" y="30" width="12" height="45" fill="#f79ebb" stroke="#4a354f" strokeWidth="7" strokeLinejoin="round" />
            <circle className="isabot-antenna-ball" cx="200" cy="22" r="14" fill="#fbc4db" stroke="#4a354f" strokeWidth="7" />
            <circle cx="196" cy="18" r="4" fill="#ffffff" />
          </g>
        </g>
      </svg>
    </div>
  );
}



function AnimatedIsaBot({ mood }: { mood: PetMood }) {
  const [blink, setBlink] = useState(false);
  const [wave, setWave] = useState(false);

  useEffect(() => {
    let alive = true;

    function loop() {
      if (!alive) return;
      const nextIn = 1800 + Math.random() * 2600;
      setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        setTimeout(() => {
          setBlink(false);
          // Occasional double-blink
          if (Math.random() < 0.35) {
            setTimeout(() => {
              setBlink(true);
              setTimeout(() => setBlink(false), 130);
            }, 160);
          }
          loop();
        }, 140);
      }, nextIn);
    }
    loop();
    const waveInt = setInterval(() => setWave((w) => !w), 1200);
    return () => {
      alive = false;
      clearInterval(waveInt);
    };
  }, []);

  const eyesClosed = blink || mood === "sleepy";
  const mouth =
    mood === "sad" ? "M42 60 Q50 54 58 60" :
    mood === "hungry" ? "M42 58 Q50 66 58 58" :
    mood === "sleepy" ? "M44 60 Q50 62 56 60" :
    "M42 56 Q50 66 58 56"; // happy / love
  const cheekOpacity = mood === "love" || mood === "happy" ? 0.9 : 0.5;
  const heartColor = mood === "love" ? "#ff4d8a" : mood === "sad" ? "#c9a2c8" : "#ff6fa5";

  return (
    <svg
      className={`isabot-svg mood-${mood}`}
      viewBox="0 0 200 220"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="bodyGrad" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffe4ee" />
          <stop offset="60%" stopColor="#ffc4dc" />
          <stop offset="100%" stopColor="#f79ac0" />
        </radialGradient>
        <radialGradient id="cloudGrad" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e9d8ff" />
        </radialGradient>
        <linearGradient id="screenGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fff0f6" />
          <stop offset="100%" stopColor="#ffd0e4" />
        </linearGradient>
      </defs>

      {/* Cloud */}
      <g className="isabot-cloud">
        <ellipse cx="100" cy="190" rx="78" ry="18" fill="url(#cloudGrad)" />
        <circle cx="55" cy="182" r="18" fill="url(#cloudGrad)" />
        <circle cx="145" cy="182" r="18" fill="url(#cloudGrad)" />
        <circle cx="80" cy="176" r="14" fill="url(#cloudGrad)" />
        <circle cx="125" cy="176" r="14" fill="url(#cloudGrad)" />
      </g>

      {/* Body group with sway */}
      <g className="isabot-body">
        {/* Antenna */}
        <line x1="100" y1="22" x2="100" y2="8" stroke="#e17aa8" strokeWidth="3" strokeLinecap="round" />
        <circle className="isabot-antenna-ball" cx="100" cy="6" r="5" fill="#ff6fa5" />

        {/* Ears */}
        <circle cx="42" cy="52" r="10" fill="#f79ac0" />
        <circle cx="42" cy="52" r="4" fill="#ffe4ee" />
        <circle cx="158" cy="52" r="10" fill="#f79ac0" />
        <circle cx="158" cy="52" r="4" fill="#ffe4ee" />

        {/* Head */}
        <rect x="46" y="22" width="108" height="80" rx="30" fill="url(#bodyGrad)" stroke="#e17aa8" strokeWidth="2" />

        {/* Face screen */}
        <rect x="58" y="34" width="84" height="56" rx="22" fill="#fff5fa" stroke="#f2b5cf" strokeWidth="1.5" />

        {/* Cheeks */}
        <circle cx="70" cy="64" r="6" fill="#ff9dc2" opacity={cheekOpacity} />
        <circle cx="130" cy="64" r="6" fill="#ff9dc2" opacity={cheekOpacity} />

        {/* Eyes */}
        <g className="isabot-eyes">
          {eyesClosed ? (
            <>
              <path d="M78 56 Q84 62 90 56" stroke="#3a2233" strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M110 56 Q116 62 122 56" stroke="#3a2233" strokeWidth="3" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              <ellipse cx="84" cy="56" rx="5.5" ry="7" fill="#3a2233" />
              <circle cx="86" cy="54" r="1.6" fill="#fff" />
              <ellipse cx="116" cy="56" rx="5.5" ry="7" fill="#3a2233" />
              <circle cx="118" cy="54" r="1.6" fill="#fff" />
            </>
          )}
        </g>

        {/* Mouth */}
        <path d={mouth} stroke="#3a2233" strokeWidth="2.5" fill="none" strokeLinecap="round" />

        {/* Body / chest */}
        <rect x="60" y="102" width="80" height="62" rx="20" fill="url(#bodyGrad)" stroke="#e17aa8" strokeWidth="2" />
        {/* Chest screen */}
        <rect x="72" y="112" width="56" height="42" rx="12" fill="url(#screenGrad)" stroke="#f2b5cf" strokeWidth="1.5" />
        {/* Heart on chest */}
        <path
          className="isabot-heart"
          d="M100 146 C 84 134, 78 122, 90 118 C 96 116, 100 122, 100 122 C 100 122, 104 116, 110 118 C 122 122, 116 134, 100 146 Z"
          fill={heartColor}
        />

        {/* Left arm (waving) */}
        <g className={`isabot-arm-left ${wave ? "up" : ""}`} style={{ transformOrigin: "62px 112px" }}>
          <rect x="46" y="108" width="18" height="34" rx="9" fill="#f79ac0" stroke="#e17aa8" strokeWidth="1.5" />
          <circle cx="55" cy="146" r="9" fill="#ffc4dc" stroke="#e17aa8" strokeWidth="1.5" />
        </g>
        {/* Right arm */}
        <g className="isabot-arm-right" style={{ transformOrigin: "138px 112px" }}>
          <rect x="136" y="108" width="18" height="34" rx="9" fill="#f79ac0" stroke="#e17aa8" strokeWidth="1.5" />
          <circle cx="145" cy="146" r="9" fill="#ffc4dc" stroke="#e17aa8" strokeWidth="1.5" />
        </g>

        {/* Feet */}
        <ellipse cx="82" cy="172" rx="12" ry="6" fill="#e17aa8" />
        <ellipse cx="118" cy="172" rx="12" ry="6" fill="#e17aa8" />
      </g>
    </svg>
  );
}

function InteractivePet({
  stage,

  mood,
  onPet,
  onFeed,
  onPlay,
  onSleep,
}: {
  stage: number;
  mood: PetMood;
  onPet: () => void;
  onFeed: () => void;
  onPlay: () => void;
  onSleep: () => void;
}) {
  const [reacts, setReacts] = useState<FloatingReact[]>([]);
  const [bounce, setBounce] = useState(false);
  const [speech, setSpeech] = useState<string | null>(null);
  const idRef = useRef(0);
  const [accessories, setAccessories] = useState<Record<AccessoryKey, boolean>>({
    glasses: false,
    cap: false,
    brush: false,
  });
  const toggleAcc = (k: AccessoryKey) =>
    setAccessories((a) => ({ ...a, [k]: !a[k] }));



  const speechByMood: Record<PetMood, string[]> = {
    happy: ["¡Hola bebé! 💕", "¿Jugamos? 🌸", "Estoy súper feliz ✨", "¡Te quiero mucho! 💖"],
    love: ["¡Aww te amo! 💗", "Corazón lleno 💞", "Eres lo mejor 🌷"],
    sleepy: ["Estoy con sueñito... 💤", "Zzz... 🌙", "Un descansito porfa 😴"],
    hungry: ["Tengo hambritis 🥺", "¿Un snackecito? 🍎", "Mi pancita ruge 🍩"],
    sad: ["Necesito mimos 🥺", "¿Me acompañas? 💔", "Estoy tristecita 💧"],
  };

  function spawnReacts(emojis: string[], event?: React.MouseEvent) {
    const rect = (event?.currentTarget as HTMLElement | undefined)?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 100;
    const cy = rect ? rect.height / 2 : 100;
    const now = Date.now();
    const items = emojis.map((emoji, i) => ({
      id: idRef.current++,
      emoji,
      x: cx + (Math.random() - 0.5) * 90,
      y: cy + (Math.random() - 0.5) * 30,
    }));
    setReacts((prev) => [...prev, ...items]);
    setTimeout(() => {
      setReacts((prev) => prev.filter((r) => !items.find((it) => it.id === r.id)));
    }, 1400);
    void now;
  }

  function handleTap(e: React.MouseEvent) {
    setBounce(true);
    setTimeout(() => setBounce(false), 400);
    spawnReacts(["💖", "✨", "💕"].slice(0, 1 + Math.floor(Math.random() * 3)), e);
    const options = speechByMood[mood];
    setSpeech(options[Math.floor(Math.random() * options.length)]);
    setTimeout(() => setSpeech(null), 2200);
    onPet();
  }

  function actWithReacts(action: () => void, emojis: string[]) {
    action();
    setBounce(true);
    setTimeout(() => setBounce(false), 400);
    spawnReacts(emojis);
  }

  return (
    <div className={`pet-stage-wrap`} data-mood={mood} data-stage={stage}>
      <div className="pet-scene">
        {mood === "sleepy" && (
          <div className="pet-zzz-float"><span>z</span><span>Z</span><span>z</span></div>
        )}
        {speech && <div className="pet-speech-bubble">{speech}</div>}

        <button
          type="button"
          className={`pet-image-btn ${bounce ? "bounce" : ""}`}
          onClick={handleTap}
          aria-label="Acariciar a IsaBot"
        >
          <AnimatedMascot mood={mood} />
          {(Object.keys(ACCESSORIES) as AccessoryKey[]).map((k) =>
            accessories[k] ? (
              <img
                key={k}
                src={ACCESSORIES[k].url}
                alt={ACCESSORIES[k].label}
                className="pet-accessory"
                style={{ position: "absolute", pointerEvents: "none", ...ACCESSORIES[k].style }}
              />
            ) : null,
          )}
          {reacts.map((r) => (
            <span
              key={r.id}
              className="pet-float-emoji"
              style={{ left: r.x, top: r.y }}
            >
              {r.emoji}
            </span>
          ))}
        </button>


        <div className="pet-sparkles">
          <span>✨</span><span>💫</span><span>⭐</span><span>✨</span>
        </div>
      </div>

      <div className="pet-quick-actions">
        <button className="pet-quick" onClick={() => actWithReacts(onFeed, ["🍎", "🍰", "🍓"])}>🍎 Alimentar</button>
        <button className="pet-quick" onClick={() => actWithReacts(onPlay, ["🎾", "🎈", "🌸"])}>🎾 Jugar</button>
        <button className="pet-quick" onClick={() => actWithReacts(onSleep, ["💤", "🌙", "☁️"])}>💤 Dormir</button>
      </div>

      <div className="pet-accessory-actions">
        {(Object.keys(ACCESSORIES) as AccessoryKey[]).map((k) => (
          <button
            key={k}
            type="button"
            className={`pet-quick acc-toggle ${accessories[k] ? "active" : ""}`}
            onClick={() => toggleAcc(k)}
            aria-pressed={accessories[k]}
          >
            {ACCESSORIES[k].emoji} {ACCESSORIES[k].label}
          </button>
        ))}
      </div>
    </div>
  );
}



function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function renderInlineMd(s: string): string {
  let x = escapeHtml(s);
  // inline code
  x = x.replace(/`([^`\n]+)`/g, '<code class="md-ic">$1</code>');
  // bold
  x = x.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  x = x.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  // italic
  x = x.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  x = x.replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>");
  // links [text](url)
  x = x.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return x;
}
function renderMarkdownBlock(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let inUl = false, inOl = false;
  const closeLists = () => {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };
  for (const raw of lines) {
    const line = raw;
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (h) {
      closeLists();
      const lvl = h[1].length;
      out.push(`<h${lvl} class="md-h${lvl}">${renderInlineMd(h[2])}</h${lvl}>`);
    } else if (ul) {
      if (!inUl) { closeLists(); out.push('<ul class="md-ul">'); inUl = true; }
      out.push(`<li>${renderInlineMd(ul[1])}</li>`);
    } else if (ol) {
      if (!inOl) { closeLists(); out.push('<ol class="md-ol">'); inOl = true; }
      out.push(`<li>${renderInlineMd(ol[1])}</li>`);
    } else if (line.trim() === "") {
      closeLists();
      out.push("<br/>");
    } else {
      closeLists();
      out.push(`<p class="md-p">${renderInlineMd(line)}</p>`);
    }
  }
  closeLists();
  return out.join("");
}

function BotBubbleBody({ text }: { text: string }) {
  const parts = useMemo(() => {
    const regex = /```([\s\S]*?)```/g;
    const out: Array<{ type: "text" | "code"; content: string }> = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) out.push({ type: "text", content: text.slice(last, m.index) });
      out.push({ type: "code", content: m[1].trim() });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ type: "text", content: text.slice(last) });
    return out;
  }, [text]);

  return (
    <>
      {parts.map((p, i) =>
        p.type === "text" ? (
          <span key={i} className="md-body" dangerouslySetInnerHTML={{ __html: renderMarkdownBlock(p.content) }} />
        ) : (
          <CodeBlock key={i} code={p.content} />
        ),
      )}
    </>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-block">
      <button
        className="copy-btn"
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "📋 ¡Copiado!" : "📋 Copiar"}
      </button>
      <pre>{code}</pre>
    </div>
  );
}

function ChatListItem({
  chat,
  active,
  onOpen,
  onTogglePin,
  onRename,
  onDelete,
}: {
  chat: Chat;
  active: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(chat.title ?? "");
  const displayName = chat.title?.trim() || `Chat ${new Date(chat.createdAt).toLocaleTimeString()}`;
  return (
    <li
      className={`chat-item ${chat.pinned ? "pinned" : ""} ${active ? "active" : ""}`}
      onClick={() => !editing && onOpen()}
    >
      {editing ? (
        <input
          autoFocus
          className="chat-rename-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onRename(name.trim()); setEditing(false); }
            if (e.key === "Escape") { setEditing(false); setName(chat.title ?? ""); }
          }}
          onBlur={() => { onRename(name.trim()); setEditing(false); }}
        />
      ) : (
        <span className="chat-title">{chat.pinned ? "📌 " : ""}{displayName}</span>
      )}
      <span className="chat-actions" onClick={(e) => e.stopPropagation()}>
        <button title={chat.pinned ? "Desfijar" : "Fijar"} onClick={onTogglePin}>{chat.pinned ? "📍" : "📌"}</button>
        <button title="Renombrar" onClick={() => setEditing(true)}>✏️</button>
        <button title="Eliminar" onClick={onDelete}>🗑️</button>
      </span>
    </li>
  );
}

// ─────────── Paleta de colores ───────────
function randomHex() {
  // Genera colores pastel/estéticos
  const h = Math.floor(Math.random() * 360);
  const s = 55 + Math.floor(Math.random() * 25);
  const l = 65 + Math.floor(Math.random() * 20);
  // HSL -> HEX
  const a = (s * Math.min(l, 100 - l)) / 10000;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}
function generatePalette(): string[] {
  return Array.from({ length: 5 }, () => randomHex());
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IsaBot — Co-piloto de IA Creativa para Estudiantes y Emprendedores" },
      { name: "description", content: "IsaBot: tu co-piloto de IA creativa. Estudia mejor, emprende con foco y crea sin bloqueo. Hecho por IsaRoRo Studio." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "theme-color", content: "#e8d8ff" },
      { property: "og:title", content: "IsaBot — Co-piloto de IA Creativa" },
      { property: "og:description", content: "Tu co-piloto de IA para estudiantes y emprendedores. Hecho por IsaRoRo Studio." },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap",
      },
    ],
  }),
  component: IsaBotPage,
});

// Envuelve la app con la economía de IsaBot Coins.
function IsaBotPage() {
  const [ibcUserId, setIbcUserId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setIbcUserId(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIbcUserId(session?.user.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return (
    <IbcProvider userId={ibcUserId}>
      <IsaBot />
      <IbcOverlays />
      <OnboardingTour active={Boolean(ibcUserId)} />
      <PdfGallery />
    </IbcProvider>
  );
}

type PanelKey = null | "tasks" | "palette" | "outlines" | "habits" | "pomodoro" | "subscribe" | "weekly" | "planner" | "notes" | "cowork" | "isaspace" | "myday" | "invite" | "feedback" | "technews" | "academy" | "ibcagent";

function openApp(path: string, name: string) {
  const url = `${window.location.origin}${path}`;
  const win = window.open(url, name, "width=1280,height=900,noopener");
  if (!win) window.location.href = url;
}


const VIBES: Array<{ id: Vibe; label: string; hint: string }> = [
  { id: "kawaii", label: "🌸 Kawaii", hint: "Tierno, animado y motivador" },
  { id: "cyberpunk", label: "⚡ Cyberpunk", hint: "Directo, tech y disruptivo" },
  { id: "zen", label: "🍃 Zen", hint: "Calmado, claro y minimalista" },
  { id: "custom", label: "🎨 Personalizado", hint: "Tu propio estilo: colores y tono a tu gusto" },
];

const PERSONALITY_OPTIONS: Array<{ id: Personality; emoji: string; name: string }> = [
  { id: "kawaii", emoji: "💕", name: "Kawaii" },
  { id: "tutor", emoji: "🧠", name: "Tutor" },
  { id: "gamer", emoji: "🎮", name: "Gamer" },
  { id: "estudio", emoji: "🌸", name: "Estudio" },
  { id: "rapido", emoji: "⚡", name: "Rápido" },
  { id: "code", emoji: "💻", name: "Code" },
  { id: "isabotcode", emoji: "🧑‍💻", name: "IsaBotCode" },
  { id: "profesional", emoji: "💼", name: "Profesional" },
  { id: "motivadora", emoji: "💪", name: "Motivadora" },
  { id: "sarcastica", emoji: "😏", name: "Sarcástica" },
  { id: "poeta", emoji: "🌙", name: "Poeta" },
  { id: "coach", emoji: "🏋️‍♀️", name: "Coach Fit" },
  { id: "filosofa", emoji: "🦉", name: "Filósofa" },
  { id: "gamer_pro", emoji: "🏆", name: "Gamer Pro" },
  { id: "custom", emoji: "✍️", name: "Personalizada" },
];




type WeeklyType = "wallpaper" | "sticker" | "outline";
type WeeklyGift = { weekKey: string; type: WeeklyType; image: string | null; prompt: string };

// ─────────── Coach de Hábitos IA (premium) ───────────
type Habit = {
  id: string;
  name: string;
  emoji: string;
  streak: number;
  bestStreak: number;
  lastCompleted: string | null; // YYYY-MM-DD
  history: string[]; // completed dates
  createdAt: number;
};
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const yesterdayKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const MEDALS: Array<{ id: string; label: string; emoji: string; days: number }> = [
  { id: "bronze",   label: "Bronce Kawaii",   emoji: "🥉", days: 3 },
  { id: "silver",   label: "Plata Estelar",   emoji: "🥈", days: 7 },
  { id: "gold",     label: "Oro Real",        emoji: "🥇", days: 14 },
  { id: "diamond",  label: "Diamante Rosa",   emoji: "💎", days: 30 },
  { id: "legend",   label: "Leyenda Cósmica", emoji: "👑", days: 60 },
];
const WEEKLY_CHALLENGES: Array<{ title: string; emoji: string }> = [
  { title: "Bebe 8 vasos de agua cada día", emoji: "💧" },
  { title: "Camina 15 min al aire libre",  emoji: "🌿" },
  { title: "Lee 10 páginas antes de dormir", emoji: "📖" },
  { title: "Estira tu cuerpo 5 min al levantarte", emoji: "🧘‍♀️" },
  { title: "Escribe 3 cosas por las que agradeces", emoji: "🌸" },
  { title: "Duerme antes de las 11pm", emoji: "🌙" },
  { title: "Un boceto rápido diario", emoji: "🎨" },
  { title: "Sin redes sociales después de las 9pm", emoji: "🔕" },
];




function IsaBot() {
  const ibc = useIbc();
  const { lang, setLang } = useI18n();
  const homeCopy = lang === "en" ? {
    menu: "Menu",
    closeMenu: "Close menu",
    chats: "My Chats 💬",
    hubNav: "IsaBot main access",
    spaceDesc: "Creative network: publish projects, progress and find collaborators.",
    feed: "✨ View feed",
    post: "🚀 Post",
    academyDesc: "AI, 3D and tech classes with challenges that earn IsaBot Coins.",
    classes: "📚 Classes",
    news: "📰 News",
    studioDesc: "Canva-like suite: designs, documents, slides and instant export.",
    design: "🖼️ Design",
    pdfs: "📚 PDFs",
    planDay: "🚀 Plan my day",
    modelTitle: "IsaBot native model",
    askPlaceholder: "Ask IsaBot...",
    recording: "🎙️ Recording... release to send",
  } : {
    menu: "Menú",
    closeMenu: "Cerrar menú",
    chats: "Mis Chats 💬",
    hubNav: "Accesos principales de IsaBot",
    spaceDesc: "Red creativa: publica proyectos, avances y busca colaboradores.",
    feed: "✨ Ver feed",
    post: "🚀 Publicar",
    academyDesc: "Clases de IA, 3D y tech con retos que dan IsaBot Coins.",
    classes: "📚 Clases",
    news: "📰 Noticias",
    studioDesc: "Suite tipo Canva: diseños, documentos, slides y export instantáneo.",
    design: "🖼️ Diseño",
    pdfs: "📚 PDFs",
    planDay: "🚀 Planear mi día",
    modelTitle: "Modelo propio de IsaBot",
    askPlaceholder: "Pregúntale a IsaBot...",
    recording: "🎙️ Grabando... suelta para enviar",
  };
  const [hydrated, setHydrated] = useState(false);

  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const turnsRef = useRef(0);
  const [adIndex, setAdIndex] = useState<number | null>(null);
  const [personality, setPersonality] = useState<Personality>("kawaii");
  const [customPersonality, setCustomPersonality] = useState<string>("");
  // 🧠 Cerebro de IsaBot elegido por la persona
  const [brain, setBrain] = useState<BrainId>("isa-v1");
  // 📴 Modo sin señal + cerebro local (funciona sin WiFi ni datos)
  const localBrain = useLocalBrain();
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState<QueuedMessage[]>([]);

  // 🎨 Sinestesia de IA — el tema visual también cambia el tono del modelo
  const [vibe, setVibe] = useState<Vibe>("kawaii");
  const [customVibe, setCustomVibe] = useState<CustomVibe>(DEFAULT_CUSTOM_VIBE);
  const [interfaceTheme, setInterfaceTheme] = useState("default");
  const [ownedInterfaceThemes, setOwnedInterfaceThemes] = useState<string[]>(["default"]);
  const [showAiTheme, setShowAiTheme] = useState(false);
  const [aiThemePrompt, setAiThemePrompt] = useState("");
  const [aiThemeLoading, setAiThemeLoading] = useState(false);
  const [aiThemeError, setAiThemeError] = useState<string | null>(null);
  const createAiTheme = useServerFn(generateCustomTheme);

  // Notas rápidas (gratis)
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const NOTE_COLORS = ["#ffd6eb", "#e0d5ff", "#ffe5b4", "#c8f0e0", "#ffcfd5"];

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    document.body.classList.toggle("sidebar-open", sidebarOpen);
    return () => document.body.classList.remove("sidebar-open");
  }, [sidebarOpen]);

  // Cerrar el menú con la tecla Esc (el botón ✕ y el fondo también lo cierran)
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSidebarOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  const [authUser, setAuthUser] = useState<{ id: string; email: string | null } | null>(null);


  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setAuthUser(null);
        setIsAdmin(false);
        return;
      }
      setAuthUser({ id: data.user.id, email: data.user.email ?? null });
      try {
        const pending = window.localStorage.getItem("isabot_referral_code");
        if (pending) {
          window.localStorage.removeItem("isabot_referral_code");
          const res = await doClaimReferral({ data: { code: pending } });
          void res;
        }
      } catch {
        /* noop */
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      if (!cancelled) setIsAdmin((roles ?? []).some((r) => r.role === "admin"));
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [settingsExpanded, setSettingsExpanded] = useState(true);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // 🎨 Restaura el tema comprado con IBC
  useEffect(() => {
    const savedTheme = activeTheme();
    setInterfaceTheme(savedTheme);
    setOwnedInterfaceThemes(ownedThemes());
    if (savedTheme !== "ai-custom" || !restoreCustomTheme()) applyTheme(savedTheme);
  }, []);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const voiceRecRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceMimeRef = useRef<{ mime: string; ext: string }>({ mime: "", ext: "webm" });
  

  const [reminders, setReminders] = useState<Array<{ id: number; task: string; minutes: number }>>([]);
  const [reminderTask, setReminderTask] = useState("");
  const [reminderMin, setReminderMin] = useState("");

  // Premium
  const [isPremium, setIsPremium] = useState(false);
  const [premiumExpiresAt, setPremiumExpiresAt] = useState<string | null>(null);
  const [premiumGift, setPremiumGift] = useState<{ days: number | null; expiresAt: string | null } | null>(null);
  const [panel, setPanel] = useState<PanelKey>(null);

  // 🔒 Política de datos + ⚡ tema Cyberpunk Neón (se desbloquea con 2 invitadas)
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [neonUnlocked, setNeonUnlocked] = useState(false);
  const [neonOn, setNeonOn] = useState(false);
  const loadReferralInfo = useServerFn(getMyReferralInfo);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setNeonOn(localStorage.getItem("isabot_theme_neon") === "1");
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("theme-neon", neonOn && neonUnlocked);
    if (typeof window !== "undefined") {
      localStorage.setItem("isabot_theme_neon", neonOn ? "1" : "0");
    }
  }, [neonOn, neonUnlocked]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.auth.getSession();
        if (!data.session) return; // invitada sin sesión: se queda bloqueado
        const info = await loadReferralInfo();
        if (alive) setNeonUnlocked(Boolean(info.neonUnlocked));
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadReferralInfo]);


  // Mide la altura real del pie (acciones rápidas + caja de texto) para que en
  // el celular los mensajes nunca queden tapados por él.
  const footerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = footerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = () => {
      document.documentElement.style.setProperty("--footer-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  const [crackOpen, setCrackOpen] = useState(false);
  const [crackIdea, setCrackIdea] = useState("");
  const [crackLoading, setCrackLoading] = useState(false);
  const fetchProfile = useServerFn(getMyProfile);
  const ackGift = useServerFn(acknowledgePremiumGift);
  const saveReminder = useServerFn(createReminder);
  const doClaimReferral = useServerFn(claimReferralCode);

  // Tasks (free)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskInput, setTaskInput] = useState("");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("med");
  const [taskDue, setTaskDue] = useState("");
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "done">("all");

  // Palette (free)
  const [palette, setPalette] = useState<string[]>([]);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [paletteInput, setPaletteInput] = useState("");
  const [paletteLoading, setPaletteLoading] = useState(false);


  // Outlines (premium)
  const [outlineTopic, setOutlineTopic] = useState("");
  const [outlineImg, setOutlineImg] = useState<string | null>(null);
  const [outlineLoading, setOutlineLoading] = useState(false);

  // Regalo semanal (premium)
  const [weeklyGift, setWeeklyGift] = useState<WeeklyGift | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  // Planeador mensual (premium)
  const [plannerTheme, setPlannerTheme] = useState("kawaii pastel con gatitos");
  const [plannerNotes, setPlannerNotes] = useState<Record<string, string>>({});
  const [plannerMonth, setPlannerMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [plannerImg, setPlannerImg] = useState<string | null>(null);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerSelectedDay, setPlannerSelectedDay] = useState<string | null>(null);
  const [plannerTab, setPlannerTab] = useState<"digital" | "custom">("digital");
  const [plannerGenMonth, setPlannerGenMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });


  // Pet (premium) — legacy state kept for backwards-compat storage
  const [pet, setPet] = useState<Pet>(DEFAULT_PET);

  // Coach de Hábitos IA (premium)
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitName, setHabitName] = useState("");
  const [habitEmoji, setHabitEmoji] = useState("🌸");
  const [medals, setMedals] = useState<string[]>([]);
  const [coachLoading, setCoachLoading] = useState(false);


  // Pomodoro (premium) — ajustable
  const [pomoWorkMin, setPomoWorkMin] = useState(25);
  const [pomoBreakMin, setPomoBreakMin] = useState(5);
  const [pomoSeconds, setPomoSeconds] = useState(25 * 60);
  const [pomoRunning, setPomoRunning] = useState(false);
  const [pomoMode, setPomoMode] = useState<"work" | "break">("work");
  const [pomoCycles, setPomoCycles] = useState(0);

  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 🎨 Sinestesia: carga el vibe guardado y lo aplica al documento + al modelo
  useEffect(() => {
    const saved = (localStorage.getItem("isabot_vibe") as Vibe) || "kawaii";
    setVibe(saved);
    try {
      const rawCustom = localStorage.getItem("isabot_custom_vibe");
      if (rawCustom) setCustomVibe({ ...DEFAULT_CUSTOM_VIBE, ...JSON.parse(rawCustom) });
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    setActiveVibe(vibe);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.vibe = vibe;
      const root = document.documentElement.style;
      if (vibe === "custom") {
        root.setProperty("--vibe-bg", customVibe.bg);
        root.setProperty("--vibe-accent", customVibe.accent);
        root.setProperty("--vibe-text", customVibe.text);
      } else {
        root.removeProperty("--vibe-bg");
        root.removeProperty("--vibe-accent");
        root.removeProperty("--vibe-text");
      }
    }
    setActiveCustomVibe(vibe === "custom" ? customVibe.tone : "");
    if (hydrated) localStorage.setItem("isabot_vibe", vibe);
  }, [vibe, customVibe, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem("isabot_custom_vibe", JSON.stringify(customVibe));
  }, [customVibe, hydrated]);


  // 🟢 Presencia: latido cada 60s mientras la app está abierta
  const sendHeartbeat = useServerFn(heartbeat);
  useEffect(() => {
    if (!authUser) return;
    const ping = () => { void sendHeartbeat().catch(() => {}); };
    ping();
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, [authUser, sendHeartbeat]);

  // 💌 Correo de bienvenida (una sola vez por usuario)
  const doSendWelcome = useServerFn(sendWelcomeEmail);
  useEffect(() => {
    if (!authUser) return;
    void doSendWelcome().catch(() => {});
  }, [authUser?.id, doSendWelcome]);

  // 🔐 Aviso de seguridad por inicio de sesión (una vez por sesión del navegador)
  const doLoginAlert = useServerFn(sendLoginAlert);
  useEffect(() => {
    if (!authUser) return;
    const key = `isabot_login_alert_${authUser.id}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    void doLoginAlert({ data: { device: navigator.userAgent } }).catch(() => {});
  }, [authUser?.id, doLoginAlert]);

  // 📴 Detecta si hay señal y reenvía lo que quedó en cola
  useEffect(() => {
    setOnline(navigator.onLine);
    setQueued(loadQueue());
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Cuando vuelve el internet, los mensajes guardados se envían solitos
  useEffect(() => {
    if (!online || queued.length === 0 || !currentChatId) return;
    const pending = queued;
    setQueued([]);
    clearQueue();
    (async () => {
      for (const q of pending) {
        await sendMessage(q.text);
      }
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, queued.length, currentChatId]);

  // Hidratación

  useEffect(() => {

    setHydrated(true);
    try {
      const savedUser = localStorage.getItem("isabot_user");
      const savedChats = JSON.parse(localStorage.getItem("chats") || "[]") as Chat[];
      const savedPers = (localStorage.getItem("isabot_personality") as Personality) || "kawaii";
      const savedTasks = JSON.parse(localStorage.getItem("isabot_tasks") || "[]") as Task[];
      const savedPet = JSON.parse(localStorage.getItem("isabot_pet") || "null") as Pet | null;
      const savedPremium = localStorage.getItem("isabot_premium") === "1";
      const savedWeekly = JSON.parse(localStorage.getItem("isabot_weekly") || "null") as WeeklyGift | null;
      const savedPlannerTheme = localStorage.getItem("isabot_planner_theme");
      const savedPlannerNotes = JSON.parse(localStorage.getItem("isabot_planner_notes") || "{}") as Record<string, string>;
      const savedHabits = JSON.parse(localStorage.getItem("isabot_habits") || "[]") as Habit[];
      const savedMedals = JSON.parse(localStorage.getItem("isabot_medals") || "[]") as string[];
      const savedNotes = JSON.parse(localStorage.getItem("isabot_notes") || "[]") as Note[];
      const savedCustomPers = localStorage.getItem("isabot_personality_custom") || "";
      const savedBrain = localStorage.getItem("isabot_brain") as BrainId | null;
      if (savedBrain && BRAINS.some((b) => b.id === savedBrain)) setBrain(savedBrain);
      setPersonality(savedPers);
      setCustomPersonality(savedCustomPers);
      setNotes(savedNotes);
      setChats(savedChats);
      setTasks(savedTasks);
      if (savedPet) setPet(savedPet);
      setIsPremium(savedPremium);
      if (savedWeekly) setWeeklyGift(savedWeekly);
      if (savedPlannerTheme) setPlannerTheme(savedPlannerTheme);
      setPlannerNotes(savedPlannerNotes);
      setHabits(savedHabits);
      setMedals(savedMedals);
      // currentUser ahora se deriva de la sesión autenticada (ver useEffect abajo)
      void savedUser;
    } catch (e) {
      console.error("Error cargando estado:", e);
    }
  }, []);

  // Sincroniza Premium desde el servidor (fuente de verdad) y muestra aviso de regalo
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) return;
        const p = await fetchProfile();
        if (cancelled) return;
        setIsPremium(p.is_premium);
        setPremiumExpiresAt(p.premium_expires_at);
        if (p.is_premium && !p.premium_notice_seen && p.premium_gift_days !== null) {
          setPremiumGift({ days: p.premium_gift_days, expiresAt: p.premium_expires_at });
        }
      } catch {
        /* si falla (sesión perdida, offline) mantenemos el valor local */
      }
    })();
    return () => { cancelled = true; };
  }, [hydrated, fetchProfile]);

  const dismissPremiumGift = async () => {
    setPremiumGift(null);
    try { await ackGift(); } catch { /* ignore */ }
  };

  useEffect(() => { if (hydrated) localStorage.setItem("chats", JSON.stringify(chats)); }, [chats, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("isabot_personality", personality); }, [personality, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("isabot_personality_custom", customPersonality); }, [customPersonality, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("isabot_brain", brain); }, [brain, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("isabot_notes", JSON.stringify(notes)); }, [notes, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("isabot_tasks", JSON.stringify(tasks)); }, [tasks, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("isabot_pet", JSON.stringify(pet)); }, [pet, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("isabot_premium", isPremium ? "1" : "0"); }, [isPremium, hydrated]);
  useEffect(() => {
    if (!hydrated || !weeklyGift) return;
    try {
      localStorage.setItem("isabot_weekly", JSON.stringify(weeklyGift));
    } catch {
      try {
        localStorage.setItem("isabot_weekly", JSON.stringify({ ...weeklyGift, image: null }));
      } catch { /* ignore */ }
    }
  }, [weeklyGift, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("isabot_planner_theme", plannerTheme); }, [plannerTheme, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("isabot_planner_notes", JSON.stringify(plannerNotes)); }, [plannerNotes, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("isabot_habits", JSON.stringify(habits)); }, [habits, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("isabot_medals", JSON.stringify(medals)); }, [medals, hydrated]);


  // Pet decay
  useEffect(() => {
    if (!isPremium) return;
    const t = setInterval(() => {
      setPet((p) => ({
        ...p,
        hunger: Math.max(0, p.hunger - 2),
        happy: Math.max(0, p.happy - 1),
        energy: Math.max(0, p.energy - 1),
      }));
    }, 20000);
    return () => clearInterval(t);
  }, [isPremium]);

  // Pomodoro tick
  useEffect(() => {
    if (!pomoRunning) return;
    const t = setInterval(() => {
      setPomoSeconds((s) => {
        if (s > 0) return s - 1;
        const nextMode = pomoMode === "work" ? "break" : "work";
        setPomoMode(nextMode);
        if (pomoMode === "work") setPomoCycles((c) => c + 1);
        try {
          new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=").play().catch(() => {});
        } catch {}
        alert(pomoMode === "work" ? `🌸 ¡Descanso de ${pomoBreakMin} min!` : `✨ ¡A concentrarse ${pomoWorkMin} min!`);
        return (nextMode === "work" ? pomoWorkMin : pomoBreakMin) * 60;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [pomoRunning, pomoMode, pomoWorkMin, pomoBreakMin]);

  useEffect(() => {
    if (!hydrated || !currentUser) return;
    setChats((prev) => {
      const owned = prev.filter((c) => c.owner === currentUser);
      if (owned.length > 0) {
        setCurrentChatId(owned[owned.length - 1].id);
        return prev;
      }
      const id = "chat_" + Date.now();
      const welcome: Message = {
        sender: "bot",
        text: "¡Kyaa~ hola! 💕 Soy IsaBot, tu asistente ajustable ✨ ¿En qué puedo ayudarte hoy? 🌸",
      };
      const chat: Chat = { id, owner: currentUser, messages: [welcome], pinned: false, createdAt: new Date().toISOString() };
      setCurrentChatId(id);
      return [...prev, chat];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, hydrated]);

  const currentChat = chats.find((c) => c.id === currentChatId) || null;
  const currentMessages = currentChat?.messages ?? [];

  // 📄 Exportar la conversación actual a PDF (usa el diálogo de impresión del sistema)
  function exportChatToPdf() {
    if (currentMessages.length === 0) {
      alert("Este chat todavía está vacío 💕");
      return;
    }
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const title = currentChat?.title || "Chat con IsaBot";
    const rows = currentMessages
      .filter((m) => !m.thinking)
      .map((m) => {
        if (m.type === "imagen") {
          return `<div class="b"><b>IsaBot</b><br/><img src="${m.text}" /></div>`;
        }
        const who = m.sender === "user" ? "Tú" : "IsaBot";
        return `<div class="${m.sender === "user" ? "u" : "b"}"><b>${who}</b><br/>${esc(m.text).replace(/\n/g, "<br/>")}</div>`;
      })
      .join("");
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#3a2a4d;margin:32px;}
h1{color:#7a3fbf;font-size:22px;margin:0 0 4px;}
.meta{color:#a06b8a;font-size:12px;margin-bottom:20px;}
.u,.b{border-radius:14px;padding:10px 14px;margin:8px 0;page-break-inside:avoid;}
.u{background:#ffe6f2;margin-left:60px;}
.b{background:#f1e9ff;margin-right:60px;}
b{font-size:12px;color:#7a3fbf;}
img{max-width:100%;border-radius:12px;margin-top:6px;}
</style></head><body>
<h1>🌸 ${esc(title)}</h1>
<div class="meta">Exportado desde IsaBot · ${new Date().toLocaleString()}</div>
${rows}
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      alert("Permite las ventanas emergentes para exportar el PDF 💕");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }


  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [currentMessages.length, currentChatId]);

  const gallery = useMemo(() => {
    const items: string[] = [];
    chats.filter((c) => c.owner === currentUser).forEach((c) =>
      c.messages.forEach((m) => m.type === "imagen" && items.push(m.text)),
    );
    return items;
  }, [chats, currentUser]);

  // Sincroniza el "owner" del historial (chats, galería) con la cuenta autenticada.
  // Así cada usuario que inicia sesión en el mismo dispositivo ve solo su propio historial.
  useEffect(() => {
    if (!hydrated) return;
    if (authUser) {
      setCurrentUser(authUser.id);
      try { localStorage.setItem("isabot_user", authUser.id); } catch {}
    } else {
      setCurrentUser(null);
    }
  }, [authUser, hydrated]);

  function createNewChat() {
    if (!currentUser) return;
    const id = "chat_" + Date.now();
    setChats((prev) => [...prev, { id, owner: currentUser, messages: [], pinned: false, createdAt: new Date().toISOString() }]);
    setCurrentChatId(id);
    setSidebarOpen(false);
  }

  function updateCurrentChat(mutator: (msgs: Message[]) => Message[]) {
    setChats((prev) => prev.map((c) => (c.id === currentChatId ? { ...c, messages: mutator(c.messages) } : c)));
  }

  function addReminder() {
    const task = reminderTask.trim();
    const minutes = parseInt(reminderMin, 10);
    if (!task || isNaN(minutes) || minutes <= 0) return;
    const id = Date.now();
    setReminders((r) => [...r, { id, task, minutes }]);
    setReminderTask("");
    setReminderMin("");
    setTimeout(() => {
      alert(`🔔 ¡IsaBot te recuerda!: ${task} 💕`);
      setReminders((r) => r.filter((x) => x.id !== id));
    }, minutes * 60 * 1000);
  }

  // Detecta si el mensaje pide análisis estratégico → Modo Crack automático
  function detectCrackIntent(text: string): boolean {
    return /\b(modo\s+crack|analiza(?:me)?\s+(?:mi|esta|el)?\s*(?:idea|proyecto|negocio|startup|emprendimiento)|valida(?:me)?\s+(?:mi|esta)|valor\s+único|iterar\s+r[aá]pido|mvp|prop(?:uesta)?\s+de\s+valor)\b/i.test(text);
  }
  // Detecta si el mensaje pide búsqueda en la web → Modo Agente automático
  function detectAgentIntent(text: string): boolean {
    return /\b(busca(?:me)?\s+en\s+(?:la\s+)?(?:web|internet|google)|investiga(?:me)?|averigua(?:me)?|indaga|últim[ao]s?\s+noticias?|qué\s+pas[oó]\s+con|en\s+tiempo\s+real|precio\s+actual|noticias?\s+de|informaci[oó]n\s+actualizada)\b/i.test(text);
  }

  // Evita envíos duplicados (Enter repetido, doble clic) que hacían que IsaBot
  // respondiera varios mensajes seguidos muy rápido.
  async function sendMessage(overrideText?: string, overrideImage?: string | null) {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      await sendMessageInner(overrideText, overrideImage);
      // 🎬 Anuncio a pantalla completa cada 3 turnos de chat (estilo Duolingo).
      turnsRef.current += 1;
      if (turnsRef.current % 3 === 0) setAdIndex((n) => (n === null ? Math.floor(turnsRef.current / 3) - 1 : n));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function sendMessageInner(overrideText?: string, overrideImage?: string | null) {
    const text = (overrideText ?? input).trim();
    const image = overrideImage !== undefined ? overrideImage : attachedImage;
    if ((!text && !image) || !currentChatId) return;
    const userMsg: Message = { sender: "user", text: text || (image ? "📸 (foto)" : ""), imageUrl: image ?? undefined };
    const offlineNow = typeof navigator !== "undefined" && !navigator.onLine;
    const useLocal = brain === "isa-local" || (offlineNow && localBrain.cached);
    const useAgent = !offlineNow && !useLocal && !!text && !image && detectAgentIntent(text);
    const useCrack = !useAgent && !useLocal && !!text && detectCrackIntent(text);
    const thinkingMsg: Message = {
      sender: "bot",
      text: useLocal
        ? "📴 Pensando dentro de tu dispositivo…"
        : useAgent
        ? "🔎 Buscando en la web en vivo…"
        : useCrack
        ? "🚀 Modo Crack activado — analizando tu idea…"
        : "IsaBot está procesando... 🌸✨",
      thinking: true,
    };
    // 🪙 Cobro en IsaBot Coins (los mensajes locales/offline son gratis).
    if (!useLocal && !offlineNow) {
      const action = image ? "image" : useAgent ? "agent" : text.length > 400 ? "long_form" : "text_basic";
      const paid = await ibc.confirmCharge(action, "Mensaje a IsaBot");
      if (!paid) return;
    }

    updateCurrentChat((msgs) => [...msgs, userMsg, thinkingMsg]);
    setInput("");
    setAttachedImage(null);

    // ── 📴 IsaBot Local: el mini-cerebro responde dentro del dispositivo
    if (useLocal) {
      try {
        const chatNow = chats.find((c) => c.id === currentChatId);
        const hist = (chatNow?.messages ?? [])
          .filter((m) => !m.thinking && m.type !== "imagen" && m.text)
          .slice(-6)
          .map((m) => ({
            role: (m.sender === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.text,
          }));
        const answer = await localBrain.generate([
          {
            role: "system",
            content:
              "Eres IsaBot, una asistente cálida y kawaii creada por Isabella Rodríguez Roque (IsaRoRo Studio). Estás corriendo dentro del dispositivo de la persona, sin internet. Responde en español, claro y breve (máximo 5 frases), con algún emoji suave. Si no sabes algo, dilo con honestidad.",
          },
          ...hist,
          { role: "user", content: text || "Hola" },
        ]);
        updateCurrentChat((msgs) => [
          ...msgs.filter((m) => !m.thinking),
          {
            sender: "bot",
            text: answer || "No se me ocurrió nada 💔 ¿me lo preguntas de otra forma?",
          },
        ]);
      } catch (e) {
        console.error("local brain error:", e);
        updateCurrentChat((msgs) => [
          ...msgs.filter((m) => !m.thinking),
          {
            sender: "bot",
            text: "No pude usar el cerebro local 💔 Actívalo en ⚙️ Ajustes → 🧠 Cerebro de IA → 📴 IsaBot Local.",
            error: true,
          },
        ]);
      }
      return;
    }

    // ── 📴 Modo sin señal: guardo el mensaje y respondo con lo que tengo aquí
    if (offlineNow) {
      const q: QueuedMessage = { id: `${Date.now()}`, text, at: Date.now() };
      if (text) {
        const next = [...loadQueue(), q];
        saveQueue(next);
        setQueued(next);
      }
      updateCurrentChat((msgs) => [
        ...msgs.filter((m) => !m.thinking),
        { sender: "bot", text: offlineAnswer(text) },
      ]);
      return;
    }


    // ── Modo Agente: llama a /api/agent y renderiza los pasos como burbuja tipo Claude
    if (useAgent) {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const accessToken = sess.session?.access_token;
        const r = await fetch("/api/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ task: text, brain }),
        });
        if (!r.ok) {
          const err = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `Error ${r.status}`);
        }
        const data = (await r.json()) as {
          steps?: Array<{ kind: string; text?: string; tool?: string; input?: string; summary?: string }>;
          answer?: string;
        };
        const toolIcon = (t?: string) =>
          t === "web_search" ? "🔎" : t === "fetch_page" ? "📄" : t === "send_email" ? "📤" : t === "create_reminder" ? "⏰" : "🛠️";
        const stepsLines = (data.steps ?? [])
          .filter((s) => s.kind !== "final")
          .map((s) => {
            if (s.kind === "thought") return `> 💭 ${s.text}`;
            if (s.kind === "tool_call") return `> ${toolIcon(s.tool)} **${s.tool}** — ${s.input}`;
            if (s.kind === "tool_result") return `> ✅ ${s.tool} → ${s.summary}`;
            return "";
          })
          .filter(Boolean)
          .join("\n");
        const finalText = [stepsLines, "", data.answer ?? "No obtuve respuesta 💕"].filter(Boolean).join("\n");
        updateCurrentChat((msgs) => [...msgs.filter((m) => !m.thinking), { sender: "bot", text: finalText }]);
      } catch (e) {
        console.error("Agent error:", e);
        const detail = e instanceof Error ? e.message : "error inesperado";
        updateCurrentChat((msgs) => [...msgs.filter((m) => !m.thinking), { sender: "bot", text: `El modo agente no pudo completar la tarea 💔 — ${detail}`, error: true }]);
      }
      return;
    }

    // ── Detección de intención de documento PDF (+ correo) → agente nativo
    if (text) {
      const docIntent = parseDocIntent(text);
      if (docIntent) {
        updateCurrentChat((msgs) => [
          ...msgs.filter((m) => !m.thinking),
          {
            sender: "bot",
            text: "Puedo armarte ese documento 📄 Confirma y lo genero" + (docIntent.email ? " y lo envío por correo 💌" : "") + ":",
            action: { kind: "doc", prompt: docIntent.prompt, email: docIntent.email, ...(docIntent.to ? { to: docIntent.to } : {}) },
          },
        ]);
        return;
      }
    }

    // ── Detección de intención de correo → tarjeta de aprobación
    if (text) {
      const mail = parseEmailIntent(text);
      if (mail) {
        updateCurrentChat((msgs) => [
          ...msgs.filter((m) => !m.thinking),
          {
            sender: "bot",
            text: "Preparé este correo 💌 Revísalo y apruébalo cuando quieras:",
            action: { kind: "email", to: mail.to, subject: mail.subject, body: mail.body },
          },
        ]);
        return;
      }
    }

    // ── Detección de hábitos/tareas → recordatorio por correo
    if (text) {
      const parsed = parseReminder(text);
      if (parsed) {
        // Recordatorio puntual → tarjeta de confirmación en el chat
        if (parsed.frequency === "once") {
          updateCurrentChat((msgs) => [
            ...msgs.filter((m) => !m.thinking),
            {
              sender: "bot",
              text: "¡Anotado! Confirma y lo guardo 💕",
              action: {
                kind: "reminder",
                title: parsed.title,
                date: new Date().toISOString().slice(0, 10),
                hour: parsed.send_hour,
                minute: parsed.send_minute,
              },
            },
          ]);
          return;
        }
        try {
          await saveReminder({ data: {
            kind: parsed.kind,
            title: parsed.title,
            frequency: parsed.frequency,
            send_hour: parsed.send_hour,
            send_minute: parsed.send_minute,
            weekday: parsed.weekday,
            once_date: null,
          }});
          updateCurrentChat((msgs) => [
            ...msgs.filter((m) => !m.thinking),
            { sender: "bot", text: `¡Listo! Te lo recuerdo por correo 💌\n\n${reminderSummary(parsed)}\n\nPuedes verlo o pausarlo en **Ajustes y Preferencias**.` },
          ]);
          return;
        } catch (e) {
          console.error("reminder error", e);
        }
      }
    }


    const chat = chats.find((c) => c.id === currentChatId);
    const history = chat?.messages.map((m) => ({ role: m.sender === "user" ? "user" : "assistant", content: m.type === "imagen" ? "[Imagen]" : m.text })) ?? [];
    try {
      const response = await chatFetch({
        mensaje: text || (image ? "Mira esta foto 💕" : ""),
        personalidad: personality,
        modelo: brain,
        personalidadCustom: personality === "custom" ? customPersonality : undefined,
        historial: history,
        tareas: tasks.map((t) => ({ text: t.text, done: t.done, priority: t.priority, due: t.due ?? null })),
        imagen: image ?? undefined,
        crackMode: useCrack,
      } as Record<string, unknown>);
      const data = await response.json();
      updateCurrentChat((msgs) => {
        const cleaned = msgs.filter((m) => !m.thinking);
        if (data.tipo === "imagen") return [...cleaned, { sender: "bot", text: data.respuesta, type: "imagen" }];
        const botText = data.response || data.respuesta || data.text || "No obtuve respuesta 💕";
        return [...cleaned, { sender: "bot", text: botText }];
      });
    } catch (error) {
      console.error("Error de conexión:", error);
      updateCurrentChat((msgs) => [...msgs.filter((m) => !m.thinking), { sender: "bot", text: "Kyaa~ error de conexión 💔", error: true }]);
    }
  }

  // ─── Foto adjunta (analizar imagen)
  function onPickPhoto(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 6 * 1024 * 1024) {
      alert("La foto es muy grande (máx 6 MB) 💔");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      if (url) setAttachedImage(url);
    };
    reader.readAsDataURL(file);
  }

  // ─── Nota de voz (grabar → transcribir → poner en el input)
  async function startVoiceNote() {
    if (recordingVoice) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      voiceStreamRef.current = stream;
      const cands: Array<{ mime: string; ext: string }> = [
        { mime: "audio/webm;codecs=opus", ext: "webm" },
        { mime: "audio/webm", ext: "webm" },
        { mime: "audio/mp4", ext: "mp4" },
      ];
      let picked = { mime: "", ext: "webm" };
      for (const c of cands) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) { picked = c; break; }
      }
      voiceMimeRef.current = picked;
      const rec = new MediaRecorder(stream, picked.mime ? { mimeType: picked.mime } : undefined);
      voiceChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) voiceChunksRef.current.push(e.data); };
      rec.onstop = () => { void finishVoiceNote(); };
      voiceRecRef.current = rec;
      rec.start();
      setRecordingVoice(true);
    } catch (err) {
      console.error("mic error", err);
      alert("No pude acceder al micrófono 💔");
    }
  }

  async function stopVoiceNote() {
    const rec = voiceRecRef.current;
    if (rec && rec.state === "recording") { try { rec.stop(); } catch { /* ignore */ } }
    setRecordingVoice(false);
  }

  async function finishVoiceNote() {
    const chunks = voiceChunksRef.current;
    voiceChunksRef.current = [];
    voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
    voiceStreamRef.current = null;
    voiceRecRef.current = null;
    if (chunks.length === 0) return;
    const blob = new Blob(chunks, { type: voiceMimeRef.current.mime || "audio/webm" });
    if (blob.size < 1500) return;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { alert("Inicia sesión para usar la voz 💕"); return; }
      const fd = new FormData();
      fd.append("file", blob, `note.${voiceMimeRef.current.ext}`);
      const r = await fetch("/api/voice/transcribe", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = (await r.json()) as { text?: string };
      const txt = (j.text ?? "").trim();
      if (txt) {
        setInput((cur) => (cur ? `${cur} ${txt}` : txt));
      }
    } catch (err) {
      console.error("voice note err", err);
    }
  }



  // ─── Tareas
  function addTask() {
    const t = taskInput.trim();
    if (!t) return;
    setTasks((prev) => [
      ...prev,
      { id: Date.now(), text: t, done: false, priority: taskPriority, due: taskDue || null, createdAt: Date.now() },
    ]);
    setTaskInput("");
    setTaskDue("");
    setTaskPriority("med");
  }
  function toggleTask(id: number) { setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))); }
  function removeTask(id: number) { setTasks((prev) => prev.filter((t) => t.id !== id)); }
  function clearDoneTasks() { setTasks((prev) => prev.filter((t) => !t.done)); }
  const PRIO_META: Record<TaskPriority, { label: string; emoji: string; order: number }> = {
    high: { label: "Alta", emoji: "🔴", order: 0 },
    med: { label: "Media", emoji: "🟡", order: 1 },
    low: { label: "Baja", emoji: "🟢", order: 2 },
  };
  const filteredTasks = tasks
    .filter((t) => (taskFilter === "all" ? true : taskFilter === "done" ? t.done : !t.done))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const p = PRIO_META[a.priority].order - PRIO_META[b.priority].order;
      if (p !== 0) return p;
      const ad = a.due ? new Date(a.due).getTime() : Infinity;
      const bd = b.due ? new Date(b.due).getTime() : Infinity;
      return ad - bd;
    });
  const pendingCount = tasks.filter((t) => !t.done).length;
  const doneCount = tasks.length - pendingCount;
  const progressPct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;


  // ─── Outline
  async function generateOutline() {
    const topic = outlineTopic.trim();
    if (!topic) return;
    setOutlineLoading(true);
    setOutlineImg(null);
    try {
      const prompt = `Dibuja un outline en blanco y negro para colorear en Procreate de: ${topic}. Solo líneas negras nítidas sobre fondo blanco puro, sin colores, sin sombreado, sin relleno, estilo página de libro para colorear, líneas limpias y detalladas.`;
      const res = await chatFetch({ mensaje: prompt, personalidad: personality, historial: [] });
      const data = await res.json();
      if (data.tipo === "imagen") setOutlineImg(data.respuesta);
      else alert("No pude generar el outline 💔 intenta otro tema");
    } catch { alert("Error al generar outline 💔"); }
    setOutlineLoading(false);
  }

  // ─── Regalo semanal (rota entre wallpaper, sticker y outline)
  function hashCode(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return h; }
  function getWeekKey(d = new Date()): string {
    // ISO week — YYYY-Www
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }
  function rotateWeeklyType(weekKey: string): WeeklyType {
    const parts = weekKey.split("W");
    const n = parseInt(parts[1] || "0", 10);
    return (["wallpaper", "sticker", "outline"] as const)[n % 3];
  }
  const WEEKLY_META: Record<WeeklyType, { emoji: string; label: string; prompt: (theme: string) => string }> = {
    wallpaper: {
      emoji: "📱", label: "Wallpaper Kawaii",
      prompt: (t) => `Wallpaper vertical de celular estilo kawaii pastel, tema ${t}. Fondo suave con colores pasteles (rosa, morado, lavanda), estrellitas, corazones, nubecitas, muy estético y limpio, sin texto, formato retrato 9:16, alta calidad.`,
    },
    sticker: {
      emoji: "🌸", label: "Sticker Pack Kawaii",
      prompt: (t) => `Hoja de stickers digitales kawaii pastel sobre fondo blanco, tema ${t}. 6 stickers separados y coloridos con contorno blanco tipo pegatina, estilo kawaii adorable, muy tiernos, sin texto.`,
    },
    outline: {
      emoji: "✏️", label: "Outline para Colorear",
      prompt: (t) => `Página en blanco y negro para colorear en Procreate, tema ${t}. Solo líneas negras nítidas sobre fondo blanco puro, sin colores, sin sombreado, sin relleno, estilo página de libro para colorear kawaii.`,
    },
  };

  async function generateWeeklyGift(force = false) {
    const weekKey = getWeekKey();
    if (!force && weeklyGift && weeklyGift.weekKey === weekKey && weeklyGift.image) return;
    const type = rotateWeeklyType(weekKey);
    const prompt = WEEKLY_META[type].prompt("kawaii pastel sorpresa de la semana");
    setWeeklyLoading(true);
    try {
      const res = await chatFetch({ mensaje: `genera una imagen: ${prompt}`, personalidad: "kawaii", historial: [] });
      const data = await res.json();
      if (data.tipo === "imagen") {
        setWeeklyGift({ weekKey, type, image: data.respuesta, prompt });
      } else {
        setWeeklyGift({ weekKey, type, image: null, prompt });
      }
    } catch {
      setWeeklyGift({ weekKey, type, image: null, prompt });
    }
    setWeeklyLoading(false);
  }

  // ─── Planeador mensual
  function getMonthMatrix(ym: string): (number | null)[][] {
    const [y, m] = ym.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const startDay = (first.getDay() + 6) % 7; // lunes = 0
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: (number | null)[] = Array(startDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }
  function shiftPlannerMonth(delta: number) {
    const [y, m] = plannerMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setPlannerMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setPlannerImg(null);
  }
  function plannerDayKey(day: number) { return `${plannerMonth}-${String(day).padStart(2, "0")}`; }
  function setDayNote(dayKey: string, text: string) {
    setPlannerNotes((prev) => {
      const next = { ...prev };
      if (text.trim()) next[dayKey] = text;
      else delete next[dayKey];
      return next;
    });
  }
  async function generatePrintablePlanner() {
    const theme = plannerTheme.trim() || "kawaii pastel";
    const [y, m] = plannerGenMonth.split("-").map(Number);
    const monthName = new Date(y, m - 1, 1).toLocaleString("es", { month: "long" });
    setPlannerLoading(true);
    setPlannerImg(null);
    try {
      const prompt = `Planeador mensual imprimible para ${monthName} ${y} con tema "${theme}". Diseño kawaii pastel, grid del calendario con casillas grandes para cada día, encabezados de días de la semana, márgenes decorativos con elementos del tema, espacio para notas al lado, colores pasteles suaves, estético y limpio, formato A4 orientación vertical, alta calidad, listo para imprimir.`;
      const res = await chatFetch({ mensaje: `genera una imagen: ${prompt}`, personalidad: "kawaii", historial: [] });
      const data = await res.json();
      if (data.tipo === "imagen") setPlannerImg(data.respuesta);
      else alert("No pude generar el planeador imprimible 💔");
    } catch { alert("Error generando el planeador 💔"); }
    setPlannerLoading(false);
  }


  // ─── Pet (max 5 stages, evoluciona cada 20 XP)
  const MAX_PET_STAGE = 4;
  const stageFromXp = (xp: number) => Math.min(MAX_PET_STAGE, Math.floor(xp / 20));
  function feedPet() { setPet((p) => { const xp = p.xp + 3; return { ...p, hunger: Math.min(100, p.hunger + 25), xp, stage: stageFromXp(xp) }; }); }
  function playPet() { setPet((p) => { const xp = p.xp + 3; return { ...p, happy: Math.min(100, p.happy + 25), energy: Math.max(0, p.energy - 10), xp, stage: stageFromXp(xp) }; }); }
  function sleepPet() { setPet((p) => { const xp = p.xp + 2; return { ...p, energy: Math.min(100, p.energy + 30), xp, stage: stageFromXp(xp) }; }); }
  const petMood: PetMood =
    pet.hunger < 25 ? "hungry"
    : pet.happy < 25 ? "sad"
    : pet.energy < 25 ? "sleepy"
    : pet.happy > 70 ? "love"
    : "happy";

  // ─── Paleta con IA
  async function generatePaletteFromPrompt() {
    const p = paletteInput.trim();
    if (!p) { setPalette(generatePalette()); return; }
    setPaletteLoading(true);
    try {
      const prompt = `Genera EXACTAMENTE 5 códigos HEX de colores que formen una paleta estética coherente inspirada en: "${p}". Responde SOLO con los 5 hex en una línea separados por espacios, sin texto extra. Ejemplo: #FFB6C1 #FFD1DC #E8A5C7 #C9A0DC #B19CD9`;
      const res = await chatFetch({ mensaje: prompt, personalidad: "tutor", historial: [] });
      const data = await res.json();
      const text: string = data.respuesta || data.response || "";
      const hexes = (text.match(/#[0-9A-Fa-f]{6}/g) || []).slice(0, 5).map((h) => h.toUpperCase());
      if (hexes.length >= 3) {
        while (hexes.length < 5) hexes.push(randomHex());
        setPalette(hexes);
      } else {
        setPalette(generatePalette());
      }
    } catch {
      setPalette(generatePalette());
    }
    setPaletteLoading(false);
  }


  // ─── Pomodoro helpers
  function fmtTime(s: number) { const m = Math.floor(s / 60); const r = s % 60; return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`; }
  function resetPomo() { setPomoRunning(false); setPomoMode("work"); setPomoSeconds(pomoWorkMin * 60); }

  // ─── Premium gating
  const [checkoutPlan, setCheckoutPlan] = useState<null | "monthly" | "yearly">(null);
  const [payForm, setPayForm] = useState({ name: "", email: "", card: "", exp: "", cvv: "" });
  const [payError, setPayError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  function tryOpenPremium(key: PanelKey) {
    if (isPremium) setPanel(key);
    else setPanel("subscribe");
  }
  function startCheckout(plan: "monthly" | "yearly") {
    setPayForm({ name: "", email: "", card: "", exp: "", cvv: "" });
    setPayError(null);
    setCheckoutPlan(plan);
  }
  function submitCheckout(e: React.FormEvent) {
    e.preventDefault();
    const name = payForm.name.trim();
    const email = payForm.email.trim();
    const card = payForm.card.replace(/\s+/g, "");
    const exp = payForm.exp.trim();
    const cvv = payForm.cvv.trim();
    if (name.length < 3) return setPayError("Ingresa el nombre completo del titular 💕");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setPayError("Correo electrónico no válido ✨");
    if (!/^\d{16}$/.test(card)) return setPayError("El número de tarjeta debe tener 16 dígitos 💳");
    let sum = 0, alt = false;
    for (let i = card.length - 1; i >= 0; i--) {
      let n = parseInt(card[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    if (sum % 10 !== 0) return setPayError("Número de tarjeta inválido 💔");
    const m = exp.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return setPayError("Fecha de expiración con formato MM/AA 📅");
    const mm = parseInt(m[1], 10), yy = parseInt(m[2], 10);
    if (mm < 1 || mm > 12) return setPayError("Mes de expiración inválido");
    const expDate = new Date(2000 + yy, mm);
    if (expDate <= new Date()) return setPayError("La tarjeta está expirada 💔");
    if (!/^\d{3,4}$/.test(cvv)) return setPayError("CVV inválido 🔒");
    setPayError(null);
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setIsPremium(true);
      const plan = checkoutPlan;
      setCheckoutPlan(null);
      setPanel(null);
      alert(`👑 ¡Bienvenida a IsaRoRo Premium (${plan === "monthly" ? "Mensual" : "Anual"})! 💕✨`);
    }, 1600);
  }

  const userChats = chats.filter((c) => c.owner === currentUser);
  

  // 🎭 Modo de respuesta + 🎨 entorno (reutilizado en el popover y en el menú)
  function pickPersonality(val: Personality) {
    if (!FREE_PERSONALITIES.includes(val) && !isPremium) {
      setPanel("subscribe");
      setSidebarOpen(false);
      return;
    }
    setPersonality(val);
  }

  // 🧠 Cambiar el cerebro de IA (los Premium piden suscripción)
  function pickBrain(val: BrainId) {
    const b = BRAINS.find((x) => x.id === val);
    if (b?.premium && !isPremium) {
      setPanel("subscribe");
      setSidebarOpen(false);
      return;
    }
    setBrain(val);
  }

  async function pickInterfaceTheme(id: string) {
    const theme = ISA_THEMES.find((item) => item.id === id);
    if (!theme) return;
    const owned = ownedInterfaceThemes.includes(id) || theme.price === 0 || ibc.unlimited;
    if (!owned) {
      const paid = await ibc.confirmCharge("theme", `Tema de interfaz: ${id}`);
      if (!paid) return;
      ownTheme(id);
      setOwnedInterfaceThemes(ownedThemes());
    }
    applyTheme(id);
    setInterfaceTheme(id);
  }

  async function buildAiTheme() {
    const description = aiThemePrompt.trim();
    if (description.length < 3 || aiThemeLoading) return;
    setAiThemeLoading(true);
    setAiThemeError(null);
    try {
      const colors = await createAiTheme({ data: { description } });
      applyCustomTheme(colors);
      setInterfaceTheme("ai-custom");
    } catch (e) {
      setAiThemeError(e instanceof Error ? e.message : "No pude crear el tema ahora mismo.");
    } finally {
      setAiThemeLoading(false);
    }
  }

  const customVibeEditor = vibe === "custom" && (
    <div className="custom-vibe-editor">
      <label>✨ Nombre de tu estilo:</label>
      <input
        type="text"
        value={customVibe.name}
        maxLength={40}
        placeholder="Ej: Galaxia Suave"
        onChange={(e) => setCustomVibe({ ...customVibe, name: e.target.value })}
      />
      <div className="custom-vibe-colors">
        <label>
          <span>Fondo</span>
          <input type="color" value={customVibe.bg} onChange={(e) => setCustomVibe({ ...customVibe, bg: e.target.value })} />
        </label>
        <label>
          <span>Acento</span>
          <input type="color" value={customVibe.accent} onChange={(e) => setCustomVibe({ ...customVibe, accent: e.target.value })} />
        </label>
        <label>
          <span>Texto</span>
          <input type="color" value={customVibe.text} onChange={(e) => setCustomVibe({ ...customVibe, text: e.target.value })} />
        </label>
      </div>
      <label>💬 ¿Cómo quieres que se sienta IsaBot en este estilo?</label>
      <textarea
        className="custom-personality-input"
        rows={3}
        value={customVibe.tone}
        maxLength={600}
        placeholder="Ej: Habla suave y soñadora, con metáforas de estrellas y mucha calma 🌙"
        onChange={(e) => setCustomVibe({ ...customVibe, tone: e.target.value })}
      />
      <small className="vibe-hint">Tu estilo se guarda en este dispositivo y se aplica al instante 💜</small>
    </div>
  );

  const customPersonalityEditor = personality === "custom" && isPremium && (
    <>
      <label>✍️ Describe tu personalidad ideal:</label>
      <textarea
        className="custom-personality-input"
        value={customPersonality}
        onChange={(e) => setCustomPersonality(e.target.value.slice(0, 2000))}
        placeholder="Ej: Habla como una hermana mayor cariñosa que da consejos con humor y usa emojis de flores 🌷..."
        rows={4}
      />
      <small className="vibe-hint">{customPersonality.length}/2000 caracteres ✨</small>
    </>
  );

  // 📴 Tarjeta del cerebro local (descarga única, funciona sin internet)
  const localBrainBlock = (
    <div className={`local-brain-card ${brain === "isa-local" ? "active" : ""}`}>
      <div className="local-brain-head">
        <span>📴 IsaBot Local — sin internet</span>
        {localBrain.cached && <span className="local-brain-tag">Listo ✅</span>}
      </div>

      {localBrain.status === "unsupported" ? (
        <small>
          Este dispositivo no puede correr IA local 💔 Pero el <b>Modo sin señal</b> sigue
          funcionando: guardo tus mensajes y los envío cuando vuelva el internet.
        </small>
      ) : localBrain.status === "downloading" ? (
        <>
          <div className="local-brain-bar">
            <span style={{ width: `${Math.round(localBrain.progress * 100)}%` }} />
          </div>
          <small>
            Descargando el cerebro local… {Math.round(localBrain.progress * 100)}%
            {localBrain.progressText ? ` — ${localBrain.progressText}` : ""}
          </small>
        </>
      ) : localBrain.cached ? (
        <>
          <small>
            Ya vive en tu dispositivo 💜 Elige <b>📴 IsaBot Local</b> arriba para chatear en
            avión, en el metro o sin datos. Tus mensajes nunca salen del teléfono.
          </small>
          <button type="button" className="local-brain-remove" onClick={() => void localBrain.removeModel()}>
            🗑️ Borrar y liberar espacio
          </button>
        </>
      ) : (
        <>
          <small>
            Descarga <b>una sola vez</b> (~{LOCAL_MODEL_SIZE_MB} MB, mejor con WiFi) y después
            IsaBot te responde sin WiFi ni datos. Respuestas cortas y sencillas, 100% privadas.
          </small>
          <button
            type="button"
            className="local-brain-dl"
            disabled={localBrain.status === "checking"}
            onClick={() => {
              if (!online) {
                alert("Necesitas internet solo para esta descarga 💜 Conéctate y vuelve a intentar.");
                return;
              }
              void localBrain.ensureReady().catch(() => {});
            }}
          >
            ⬇️ Descargar cerebro local (~{LOCAL_MODEL_SIZE_MB} MB)
          </button>
          {localBrain.error && <small className="local-brain-err">💔 {localBrain.error}</small>}
        </>
      )}
    </div>
  );

  const modesBlock = (

    <>
      <label>🎨 Vibe de la interfaz (¡la IA también la siente!):</label>
      <div className="vibe-row">
        {VIBES.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`vibe-chip ${vibe === v.id ? "active" : ""}`}
            onClick={() => setVibe(v.id)}
            title={v.hint}
          >
            {v.label}
          </button>
        ))}
      </div>
      <small className="vibe-hint">
        {VIBES.find((v) => v.id === vibe)?.hint} — IsaBot adapta su tono a este tema ✨
      </small>

      {customVibeEditor}

      <label>🧠 Cerebro de IA:</label>
      <div className="brain-grid">
        {BRAINS.map((b) => {
          const locked = b.premium && !isPremium;
          return (
            <button
              key={b.id}
              type="button"
              className={`brain-chip ${brain === b.id ? "active" : ""} ${locked ? "locked" : ""}`}
              onClick={() => pickBrain(b.id)}
              title={locked ? "Requiere Premium" : b.hint}
            >
              <span className="brain-emoji">{locked ? "🔒" : b.emoji}</span>
              <span className="brain-name">{b.name}</span>
              <small>{b.hint}</small>
            </button>
          );
        })}
      </div>

      {localBrainBlock}




      <label>🎭 Personalidad del Bot:</label>
      <select value={personality} onChange={(e) => pickPersonality(e.target.value as Personality)}>
        <optgroup label="🆓 Gratis">
          <option value="kawaii">💕 Kawaii (Tierno y Dulce)</option>
          <option value="tutor">🧠 Tutor Sabio (Explicativo)</option>
          <option value="gamer">🎮 Gamer (Divertido)</option>
          <option value="estudio">🌸 Amigable / Estudio (Explicaciones sencillas)</option>
          <option value="rapido">⚡ Ultra-Rápido / Resumen (Bullets directos)</option>
          <option value="code">💻 Code / Productividad (Ideas, código y tareas)</option>
          <option value="isabotcode">🧑‍💻 IsaBotCode (Código completo + Markdown pro)</option>
        </optgroup>
        <optgroup label={isPremium ? "👑 Premium" : "🔒 Premium (Requiere suscripción)"}>
          <option value="profesional">{isPremium ? "💼" : "🔒"} Profesional (Ejecutiva)</option>
          <option value="motivadora">{isPremium ? "💪" : "🔒"} Motivadora (Coach de vida)</option>
          <option value="sarcastica">{isPremium ? "😏" : "🔒"} Sarcástica (Ingeniosa)</option>
          <option value="poeta">{isPremium ? "🌙" : "🔒"} Poeta (Lírica)</option>
          <option value="coach">{isPremium ? "🏋️‍♀️" : "🔒"} Coach Fitness</option>
          <option value="filosofa">{isPremium ? "🦉" : "🔒"} Filósofa (Reflexiva)</option>
          <option value="gamer_pro">{isPremium ? "🏆" : "🔒"} Gamer Pro / Streamer</option>
          <option value="custom">{isPremium ? "✍️" : "🔒"} Personalizada (tú la escribes)</option>
        </optgroup>
      </select>

      {customPersonalityEditor}

      {!isPremium && (
        <button
          className="premium-cta-btn"
          style={{ marginBottom: "12px" }}
          onClick={() => { setPanel("subscribe"); setSidebarOpen(false); }}
        >
          👑 Desbloquear 8 modos Premium
        </button>
      )}
    </>
  );

  const remindersBlock = (
    <>
      <label>⏰ Configurar Recordatorio Rápido:</label>
      <div className="reminder-row">
        <input type="text" placeholder="¿Qué recordar?" value={reminderTask} onChange={(e) => setReminderTask(e.target.value)} />
        <input type="number" min="1" placeholder="Min" value={reminderMin} onChange={(e) => setReminderMin(e.target.value)} />
      </div>
      <button className="reminder-btn" onClick={addReminder}>Activar Alarma 🔔</button>
      <div className="active-reminders">
        {reminders.map((r) => (<div key={r.id} className="reminder-item">⏳ {r.task} (en {r.minutes} min)</div>))}
      </div>
    </>
  );

  const settingsSection = (
    <div className="settings-section">
      <button
        type="button"
        className="settings-section-head"
        onClick={() => setSettingsExpanded((s) => !s)}
        aria-expanded={settingsExpanded}
      >
        <span>⚙️ Ajustes y Preferencias</span>
        <span className="settings-caret">{settingsExpanded ? "▲" : "▼"}</span>
      </button>

      {settingsExpanded && (
        <div className="settings-section-body">
          {modesBlock}
          {remindersBlock}
        </div>
      )}
    </div>
  );

  const chatToolbar = (
    <div className="chat-toolbar" role="toolbar" aria-label="Opciones del chat">
      <label className="chat-tool-field">
        <span>🎭 Personalidad</span>
        <select value={personality} onChange={(e) => pickPersonality(e.target.value as Personality)}>
          {PERSONALITY_OPTIONS.map((p) => {
            const locked = !FREE_PERSONALITIES.includes(p.id) && !isPremium;
            return (
              <option key={p.id} value={p.id}>
                {locked ? "🔒" : p.emoji} {p.name}
              </option>
            );
          })}
        </select>
      </label>
      <label className="chat-tool-field">
        <span>🧠 Cerebro IA</span>
        <select value={brain} onChange={(e) => pickBrain(e.target.value)}>
          {BRAINS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.premium && !isPremium ? "🔒" : b.emoji} {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="chat-tool-field chat-theme-field">
        <span>🎨 Tema</span>
        <select value={interfaceTheme} onChange={(e) => void pickInterfaceTheme(e.target.value)}>
          {ISA_THEMES.map((theme) => {
            const owned = ownedInterfaceThemes.includes(theme.id) || theme.price === 0 || ibc.unlimited;
            return (
              <option key={theme.id} value={theme.id}>
                {theme.emoji} {theme.name}{owned ? "" : ` · ${theme.price} IBC`}
              </option>
            );
          })}
          {interfaceTheme === "ai-custom" && <option value="ai-custom">✨ Mi tema IA</option>}
        </select>
      </label>
      <button type="button" className="ai-theme-toggle" onClick={() => setShowAiTheme((visible) => !visible)}>
        ✨ Crear Tema con IA
      </button>
      {showAiTheme && (
        <div className="ai-theme-builder">
          <input
            type="text"
            value={aiThemePrompt}
            maxLength={160}
            placeholder="Ej: Bosque místico neón"
            onChange={(event) => setAiThemePrompt(event.target.value)}
          />
          <button type="button" onClick={buildAiTheme} disabled={aiThemeLoading || aiThemePrompt.trim().length < 3}>
            {aiThemeLoading ? "Creando…" : "Generar"}
          </button>
          {aiThemeError && <span className="ai-theme-error">{aiThemeError}</span>}
        </div>
      )}
    </div>
  );




  return (
    <div className="chat-container">
      <button
        type="button"
        className="menu-btn text-gray-800"
        aria-label={homeCopy.menu}
        aria-expanded={sidebarOpen}
        onMouseEnter={() => setSidebarOpen(true)}
        onClick={() => setSidebarOpen((s) => !s)}
      >
        ☰
      </button>

      {sidebarOpen && <div className="sidebar-overlay active" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={`sidebar ${sidebarOpen ? "open" : ""}`}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start !== null && start - e.changedTouches[0].clientX > 60) setSidebarOpen(false);
        }}
      >
        <div className="sidebar-header">
          <h2>{homeCopy.chats}</h2>
          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label={homeCopy.closeMenu}
            type="button"
          >
            ✕
          </button>
        </div>
        <div className="sidebar-content">
          <ul>
            {[...userChats]
              .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.createdAt.localeCompare(b.createdAt))
              .map((c) => (
                <ChatListItem
                  key={c.id}
                  chat={c}
                  active={c.id === currentChatId}
                  onOpen={() => { setCurrentChatId(c.id); setSidebarOpen(false); }}
                  onTogglePin={() =>
                    setChats((prev) => prev.map((x) => (x.id === c.id ? { ...x, pinned: !x.pinned } : x)))
                  }
                  onRename={(name) =>
                    setChats((prev) => prev.map((x) => (x.id === c.id ? { ...x, title: name } : x)))
                  }
                  onDelete={() => {
                    if (!confirm("¿Eliminar este chat? 💔")) return;
                    setChats((prev) => {
                      const next = prev.filter((x) => x.id !== c.id);
                      if (currentChatId === c.id) {
                        const remaining = next.filter((x) => x.owner === currentUser);
                        setCurrentChatId(remaining[remaining.length - 1]?.id ?? null);
                      }
                      return next;
                    });
                  }}
                />
              ))}
          </ul>

          {settingsSection}


          {/* ── Herramientas ── */}
          <div className="tools-section">

            <h3>🛠️ Herramientas</h3>
            <button className="tool-btn free" onClick={() => setPanel("myday")}>🚀 Mi Día con IsaBot</button>
            <button className="tool-btn free" onClick={() => setPanel("tasks")}>📋 Gestor de Tareas</button>
            <button className="tool-btn free" onClick={() => { setPalette(generatePalette()); setPanel("palette"); }}>🎨 Paletas de Colores</button>
            <button className="tool-btn free" onClick={() => setPanel("notes")}>📝 Notas Rápidas</button>
            <button className="tool-btn free" onClick={() => setPanel("ibcagent")}>🤖 Agente autónomo (PDF)</button>
            <button className="tool-btn premium" onClick={() => tryOpenPremium("outlines")}>
              {isPremium ? "✏️" : "🔒"} Outlines para Procreate
            </button>
            <button className="tool-btn premium" onClick={() => tryOpenPremium("pomodoro")}>
              {isPremium ? "⏱️" : "🔒"} Pomodoro 25/5
            </button>
            <button className="tool-btn premium" onClick={() => { if (isPremium) { setPanel("weekly"); } else setPanel("subscribe"); }}>
              {isPremium ? "🎁" : "🔒"} Regalo Semanal
            </button>
            <button className="tool-btn premium" onClick={() => tryOpenPremium("planner")}>
              {isPremium ? "📅" : "🔒"} Planeador Mensual
            </button>

          </div>



          <div className="gallery-section">
            <h3>🖼️ Galería de Arte</h3>
            <div className="gallery-grid">
              {gallery.map((src, i) => (<img key={i} src={src} alt="arte" onClick={() => setPreviewImage(src)} />))}
              {gallery.length === 0 && <p className="gallery-empty">Aún no hay imágenes ✨</p>}
            </div>
          </div>
        </div>
        <div className="sidebar-actions-footer">
          <button className="kawaii-sidebar-btn sidebar-exit-btn" onClick={() => setSidebarOpen(false)}>✕ Cerrar menú</button>

          {!isPremium ? (
            <button className="premium-cta-btn" onClick={() => setPanel("subscribe")}>👑 Cambiar a Premium</button>
          ) : (
            <div className="premium-badge">👑 Premium activo ✨</div>
          )}
          <button className="kawaii-sidebar-btn" onClick={createNewChat}>✨ Nuevo chat ➕</button>
          <button className="kawaii-sidebar-btn" onClick={() => { exportChatToPdf(); setSidebarOpen(false); }}>📄 Exportar chat a PDF</button>

          {isDesktopApp() && (
            <button className="kawaii-sidebar-btn" onClick={() => { setPanel("cowork"); setSidebarOpen(false); }} style={{ background: "linear-gradient(90deg,#c9f2ff,#e0d5ff)", color: "#2b3f6b", fontWeight: 800 }}>🖥️ Modo Co-work (ver mi pantalla)</button>
          )}
          {authUser && (
            <>
              <button className="kawaii-sidebar-btn" onClick={() => { openApp("/academy", "IsaAcademy"); setSidebarOpen(false); }} style={{ background: "linear-gradient(90deg,#d8f0ff,#e0d5ff)", color: "#4a2b8a", fontWeight: 800 }}>🎓 IsaAcademy (clases de IA y Tech)</button>
              

              <button className="kawaii-sidebar-btn" onClick={() => { ibc.openVault(); setSidebarOpen(false); }} style={{ background: "linear-gradient(90deg,#ffd6ec,#e0d5ff)", color: "#6b3fa0", fontWeight: 800 }}>🪙 Mi bóveda de IsaBot Coins</button>
            <button className="kawaii-sidebar-btn" onClick={() => { setPanel("invite"); setSidebarOpen(false); }} style={{ background: "linear-gradient(90deg,#ffe6c7,#ffd6ec)", color: "#6b3fa0", fontWeight: 800 }}>💌 Invita y gana (puntos + Premium)</button>
              <button className="kawaii-sidebar-btn" onClick={() => { setPanel("technews"); setSidebarOpen(false); }} style={{ background: "linear-gradient(90deg,#e6e0ff,#d8f0ff)", color: "#5a3a9a", fontWeight: 800 }}>📰 Noticias Tech del Día</button>
              <button className="kawaii-sidebar-btn" onClick={() => { setPanel("feedback"); setSidebarOpen(false); }} style={{ background: "linear-gradient(90deg,#e0f0ff,#ffd6ec)", color: "#6b3fa0", fontWeight: 800 }}>💡 Danos tu feedback</button>

            </>
          )}
          {authUser ? (
            <>
              <Link to="/profile" className="kawaii-sidebar-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                💖 Mi perfil
              </Link>
              {isAdmin && (
                <Link to="/admin" className="kawaii-sidebar-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                  👑 Panel admin
                </Link>
              )}
              <Link to="/onboarding/org" className="kawaii-sidebar-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                🏢 Crear mi empresa
              </Link>
              <Link to="/empresas" className="kawaii-sidebar-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                💼 IsaBot para Empresas
              </Link>
              <button
                className="kawaii-sidebar-btn"
                onClick={async () => {
                  await supabase.auth.signOut();
                }}
              >
                🚪 Cerrar sesión
              </button>
              <a href="https://www.buymeacoffee.com/isabot" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2 px-4 mb-4 bg-[#FFDD00] hover:bg-[#e6c700] text-black font-semibold rounded-xl transition-all shadow-sm"><span>☕</span><span>Invítame un café</span></a>
              <footer className="sidebar-footer">👤 {authUser.email ?? currentUser ?? "Cuenta"}</footer>
            </>
          ) : (
            <>
              <Link to="/auth" className="kawaii-sidebar-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                🔐 Iniciar sesión
              </Link>
              <a href="https://www.buymeacoffee.com/isabot" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2 px-4 mb-4 bg-[#FFDD00] hover:bg-[#e6c700] text-black font-semibold rounded-xl transition-all shadow-sm"><span>☕</span><span>Invítame un café</span></a>
              <footer className="sidebar-footer">👤 {currentUser ?? "Invitado"}</footer>
            </>
          )}
        </div>
      </aside>


      {authUser && (
        <WelcomeModal userId={authUser.id} name={authUser.email?.split("@")[0] ?? null} />
      )}

      


      <header className="header">
        <h1 className="logo">IsaBot ✨</h1>
        <span className="motor-badge" title={homeCopy.modelTitle}>⚙️ {ISABOT_MODEL_LABEL}</span>
        <LanguageToggle compact lang={lang} onChange={setLang} />
        <IbcHud />
      </header>


      {!online && (
        <div className="offline-banner">
          📴 Sin señal — {localBrain.cached
            ? "IsaBot te responde desde tu dispositivo 💜"
            : queued.length > 0
            ? `guardé ${queued.length} mensaje(s) y los envío cuando vuelva el internet`
            : "guardo lo que escribas y lo envío cuando vuelva el internet"}
        </div>
      )}




      {adIndex !== null && (
        <InterstitialAd
          index={adIndex}
          onClose={() => setAdIndex(null)}
          onAction={(a) => {
            if (a.kind === "store") ibc.openStore();
            else if (a.kind === "panel") setPanel(a.panel);
            else if (a.kind === "href") {
              if (a.href.startsWith("http")) window.open(a.href, "_blank", "noopener");
              else window.location.href = a.href;
            }
          }}
        />
      )}
      <PromoCarousel
        onAction={(a) => {
          if (a.kind === "store") ibc.openStore();
          else if (a.kind === "panel") setPanel(a.panel);
          else if (a.kind === "href") {
            if (a.href.startsWith("http")) window.open(a.href, "_blank", "noopener");
            else window.location.href = a.href;
          }
        }}
      />

      <div className="main">
        {!currentMessages.some((m) => m.sender === "user") && (
          <div className="intro-hero">
            <div className="hub-grid" role="navigation" aria-label={homeCopy.hubNav}>
              <article className="hub-card hub-space">
                <button
                  className="hub-main"
                  onClick={() => {
                    const url = `${window.location.origin}/isaspace?popup=1`;
                    const win = window.open(url, "IsaSpace", "width=1280,height=860");
                    if (!win) window.location.href = url;
                  }}
                >
                  <span className="hub-preview" aria-hidden="true">
                    <i className="hub-dot a" /><i className="hub-dot b" /><i className="hub-dot c" />
                    <em>🪐</em>
                  </span>
                  <span className="hub-text">
                    <strong>IsaSpace</strong>
                    <small>{homeCopy.spaceDesc}</small>
                  </span>
                </button>
                <div className="hub-quick">
                  <button onClick={() => openApp("/isaspace", "IsaSpace")}>{homeCopy.feed}</button>
                  <button onClick={() => { openApp("/isaspace?compose=1", "IsaSpace"); }}>{homeCopy.post}</button>
                </div>
              </article>

              <article className="hub-card hub-academy">
                <button className="hub-main" onClick={() => openApp("/academy", "IsaAcademy")}>
                  <span className="hub-preview" aria-hidden="true">
                    <i className="hub-bar w1" /><i className="hub-bar w2" /><i className="hub-bar w3" />
                    <em>🎓</em>
                  </span>
                  <span className="hub-text">
                    <strong>IsaAcademy</strong>
                    <small>{homeCopy.academyDesc}</small>
                  </span>
                </button>
                <div className="hub-quick">
                  <button onClick={() => openApp("/academy", "IsaAcademy")}>{homeCopy.classes}</button>
                  <button onClick={() => setPanel("technews")}>{homeCopy.news}</button>
                </div>
              </article>

              <article className="hub-card hub-studio">
                <button className="hub-main" onClick={() => openApp("/studio", "IsaStudio")}>
                  <span className="hub-preview" aria-hidden="true">
                    <i className="hub-shape sq" /><i className="hub-shape ci" /><i className="hub-shape tx" />
                    <em>🎨</em>
                  </span>
                  <span className="hub-text">
                    <strong>IsaStudio</strong>
                    <small>{homeCopy.studioDesc}</small>
                  </span>
                </button>
                <div className="hub-quick">
                  <button onClick={() => openApp("/studio?new=design", "IsaStudio")}>{homeCopy.design}</button>
                  <button onClick={openPdfGallery}>{homeCopy.pdfs}</button>
                </div>
              </article>
            </div>

            <div className="intro-actions">
              <button className="intro-cta primary" onClick={() => setPanel("myday")}>
                {homeCopy.planDay}
              </button>
            </div>
          </div>
        )}

        <div className="messages" ref={messagesRef}>
          {currentMessages.map((m, i) => {
            if (m.sender === "user") return (
              <div key={i} className="user">
                {m.imageUrl && (
                  <img
                    className="user-image"
                    src={m.imageUrl}
                    alt="adjunto"
                    onClick={() => setPreviewImage(m.imageUrl!)}
                  />
                )}
                {m.text && <div>{m.text}</div>}
              </div>
            );
            const cls = `bot ${m.thinking ? "thinking" : ""} ${m.error ? "error" : ""}`;
            return (
              <div key={i} className="bot-row">
                <div className="bot-avatar"><KawaiiRobot /></div>
                <div className={cls}>
                  {m.type === "imagen" ? (
                    <>
                      <div>¡Mira lo que pinté para ti! 🎨✨</div>
                      <img className="bot-image" src={m.text} alt="arte" onClick={() => setPreviewImage(m.text)} />
                    </>
                  ) : (
                    <>
                      <BotBubbleBody text={m.text} />
                      {m.action && <ChatActionCardView action={m.action} />}

                      {!m.thinking && !m.error && m.text.trim().length > 40 && (
                        <ShareCardButton text={m.text} neon={neonOn && neonUnlocked} />
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <footer className="footer" ref={footerRef}>
        {attachedImage && (
          <div className="attach-preview">
            <img src={attachedImage} alt="adjunto" />
            <button onClick={() => setAttachedImage(null)} aria-label="Quitar foto">✕</button>
            <span>Foto lista — escribe algo o envía 💕</span>
          </div>
        )}
        <div className="quick-actions" role="toolbar" aria-label="Acciones rápidas">
          {neonUnlocked && (
            <button
              type="button"
              className={`qa-chip qa-neon ${neonOn ? "active" : ""}`}
              onClick={() => setNeonOn((v) => !v)}
              title="Tema exclusivo Cyberpunk Neón"
            >
              <span>⚡</span><span className="qa-txt">{neonOn ? "Neón ON" : "Cyberpunk Neón"}</span>
            </button>
          )}
        </div>
        {chatToolbar}
        {personality === "custom" && isPremium && <div className="chat-toolbar-custom">{customPersonalityEditor}</div>}
        <div className="input-area">
          <label htmlFor="fileInput" className="attach-btn" title="Adjuntar foto">📎</label>

          <input
            type="file"
            id="fileInput"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickPhoto(f);
              e.target.value = "";
            }}
          />
          <input
            ref={inputRef}
            type="text"
            placeholder={recordingVoice ? homeCopy.recording : homeCopy.askPlaceholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!sending) void sendMessage(); } }}
            disabled={recordingVoice || sending}
            className="flex-1 w-full"
          />
          <button
            className={`mic-btn ${recordingVoice ? "recording" : ""}`}
            aria-label="Nota de voz (mantén presionado)"
            title="Mantén presionado para grabar"
            onMouseDown={(e) => { e.preventDefault(); void startVoiceNote(); }}
            onMouseUp={(e) => { e.preventDefault(); void stopVoiceNote(); }}
            onMouseLeave={() => { if (recordingVoice) void stopVoiceNote(); }}
            onTouchStart={(e) => { e.preventDefault(); void startVoiceNote(); }}
            onTouchEnd={(e) => { e.preventDefault(); void stopVoiceNote(); }}
          >
            🎙️
          </button>
          <button onClick={() => void sendMessage()} aria-label="Enviar" disabled={sending}>{sending ? "⏳" : "➤"}</button>
        </div>
        <div className="legal-line">
          <button type="button" className="legal-link" onClick={() => setPrivacyOpen(true)}>
            Política de Tratamiento de Datos y Privacidad
          </button>
        </div>
      </footer>

      {privacyOpen && <PrivacyPolicyModal onClose={() => setPrivacyOpen(false)} />}

      {/* La presentación de IsaBot (LandingModal) ya cubre el estado sin sesión */}




      {/* Panel: Notas Rápidas (gratis) */}
      {panel === "notes" && (
        <div className="modal-overlay" onClick={() => setPanel(null)}>
          <div className="settings-card tasks-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setPanel(null)}>✕</button>
            <h3>📝 Notas Rápidas</h3>
            <p style={{ fontSize: "0.85rem", color: "#a06090", marginTop: "-6px", marginBottom: "10px" }}>
              Anota ideas, recordatorios o pensamientos kawaii ✨
            </p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && noteInput.trim()) {
                    setNotes((prev) => [
                      { id: Date.now(), text: noteInput.trim(), color: NOTE_COLORS[prev.length % NOTE_COLORS.length], createdAt: Date.now() },
                      ...prev,
                    ]);
                    setNoteInput("");
                  }
                }}
                placeholder="Escribe una nota..."
                style={{ flex: 1, padding: "10px 14px", borderRadius: "14px", border: "2px solid #ffcfd5", fontFamily: "inherit" }}
              />
              <button
                className="reminder-btn"
                onClick={() => {
                  if (!noteInput.trim()) return;
                  setNotes((prev) => [
                    { id: Date.now(), text: noteInput.trim(), color: NOTE_COLORS[prev.length % NOTE_COLORS.length], createdAt: Date.now() },
                    ...prev,
                  ]);
                  setNoteInput("");
                }}
              >
                ➕
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px", maxHeight: "50vh", overflowY: "auto" }}>
              {notes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    background: n.color,
                    borderRadius: "14px",
                    padding: "12px",
                    position: "relative",
                    boxShadow: "0 2px 8px rgba(255, 133, 162, 0.15)",
                    minHeight: "90px",
                    fontSize: "0.9rem",
                    color: "#5a2a4a",
                    wordBreak: "break-word",
                  }}
                >
                  <button
                    onClick={() => setNotes((prev) => prev.filter((x) => x.id !== n.id))}
                    style={{
                      position: "absolute", top: "4px", right: "6px",
                      background: "transparent", border: "none", cursor: "pointer",
                      fontSize: "0.85rem", color: "#a04070",
                    }}
                    aria-label="Eliminar nota"
                  >✕</button>
                  <div style={{ paddingRight: "14px", whiteSpace: "pre-wrap" }}>{n.text}</div>
                  <small style={{ display: "block", marginTop: "8px", opacity: 0.6, fontSize: "0.7rem" }}>
                    {new Date(n.createdAt).toLocaleDateString()}
                  </small>
                </div>
              ))}
              {notes.length === 0 && (
                <p style={{ gridColumn: "1/-1", textAlign: "center", color: "#c090b0", padding: "20px 0" }}>
                  Aún no hay notitas 🌸 ¡crea la primera!
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Panel: Tareas */}
      {panel === "tasks" && (
        <div className="modal-overlay" onClick={() => setPanel(null)}>
          <div className="settings-card tasks-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setPanel(null)}>✕</button>
            <h3>📋 Gestor de Tareas</h3>

            {/* Barra de progreso */}
            <div className="task-progress">
              <div className="task-progress-info">
                <span>✅ {doneCount} hechas</span>
                <span>⏳ {pendingCount} pendientes</span>
                <span>{progressPct}%</span>
              </div>
              <div className="task-progress-bar"><div style={{ width: `${progressPct}%` }} /></div>
            </div>

            {/* Formulario mejorado */}
            <div className="task-form">
              <input
                type="text"
                placeholder="Nueva tarea..."
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
              />
              <div className="task-form-row">
                <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}>
                  <option value="high">🔴 Alta</option>
                  <option value="med">🟡 Media</option>
                  <option value="low">🟢 Baja</option>
                </select>
                <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
                <button className="reminder-btn task-add-btn" onClick={addTask}>➕</button>
              </div>
            </div>

            {/* Filtros */}
            <div className="task-filters">
              <button className={taskFilter === "all" ? "active" : ""} onClick={() => setTaskFilter("all")}>Todas</button>
              <button className={taskFilter === "pending" ? "active" : ""} onClick={() => setTaskFilter("pending")}>Pendientes</button>
              <button className={taskFilter === "done" ? "active" : ""} onClick={() => setTaskFilter("done")}>Hechas</button>
              {doneCount > 0 && <button className="task-clear" onClick={clearDoneTasks}>🧹 Limpiar hechas</button>}
            </div>

            <div className="task-list">
              {filteredTasks.length === 0 && <p className="gallery-empty" style={{ textAlign: "center" }}>Sin tareas por aquí ✨</p>}
              {filteredTasks.map((t) => {
                const overdue = t.due && !t.done && new Date(t.due) < new Date(new Date().toDateString());
                return (
                  <div key={t.id} className={`task-item ${t.done ? "done" : ""} prio-${t.priority}`}>
                    <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} />
                    <div className="task-body" onClick={() => toggleTask(t.id)}>
                      <span className="task-text">
                        <span className="task-prio-dot">{PRIO_META[t.priority].emoji}</span>
                        {t.text}
                      </span>
                      {t.due && (
                        <span className={`task-due ${overdue ? "overdue" : ""}`}>📅 {t.due}{overdue ? " ¡vencida!" : ""}</span>
                      )}
                    </div>
                    <button className="task-del" onClick={() => removeTask(t.id)}>🗑️</button>
                  </div>
                );
              })}
            </div>
            <p className="task-hint">💡 IsaBot conoce tus tareas — pídele que te ayude a organizarlas 💕</p>
          </div>
        </div>
      )}

      {/* Panel: Paleta */}
      {panel === "palette" && (
        <div className="modal-overlay" onClick={() => setPanel(null)}>
          <div className="settings-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setPanel(null)}>✕</button>
            <h3>🎨 Paleta Estética</h3>
            <label>Describe tu paleta ideal</label>
            <div className="reminder-row">
              <input
                type="text"
                placeholder="Ej: atardecer en la playa, kawaii pastel, cyberpunk..."
                value={paletteInput}
                onChange={(e) => setPaletteInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") generatePaletteFromPrompt(); }}
              />
            </div>
            <button className="reminder-btn" disabled={paletteLoading} onClick={generatePaletteFromPrompt}>
              {paletteLoading ? "Mezclando colores... 🎨" : "✨ Generar con IA"}
            </button>
            <div className="palette-grid" style={{ marginTop: 14 }}>
              {palette.map((hex) => (
                <div key={hex} className="palette-swatch" style={{ background: hex }}
                  onClick={() => { navigator.clipboard.writeText(hex); setCopiedHex(hex); setTimeout(() => setCopiedHex(null), 1500); }}>
                  <span>{copiedHex === hex ? "¡Copiado!" : hex}</span>
                </div>
              ))}
            </div>
            <button className="reminder-btn" style={{ marginTop: 8 }} onClick={() => setPalette(generatePalette())}>🎲 Aleatoria</button>
          </div>
        </div>
      )}


      {/* Panel: Outlines */}
      {panel === "outlines" && isPremium && (
        <div className="modal-overlay" onClick={() => setPanel(null)}>
          <div className="settings-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setPanel(null)}>✕</button>
            <h3>✏️ Outlines para Colorear</h3>
            <label>¿Qué quieres colorear?</label>
            <div className="reminder-row">
              <input type="text" placeholder="Ej: un gatito con flores" value={outlineTopic}
                onChange={(e) => setOutlineTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") generateOutline(); }} />
            </div>
            <button className="reminder-btn" disabled={outlineLoading} onClick={generateOutline}>
              {outlineLoading ? "Dibujando... 🌸" : "🎨 Generar Outline"}
            </button>
            {outlineImg && (
              <div style={{ marginTop: 14, textAlign: "center" }}>
                <img src={outlineImg} alt="outline" style={{ width: "100%", borderRadius: 15, border: "1px solid #ffd6eb" }} onClick={() => setPreviewImage(outlineImg)} />
                <a className="download-btn" download="isabot_outline.png" href={outlineImg}>📥 Descargar</a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Panel: Coach de Hábitos IA (premium) */}
      {panel === "habits" && isPremium && (() => {
        const today = todayKey();
        const yest = yesterdayKey();
        const wk = getWeekKey();
        const challengeIdx = Math.abs(hashCode(wk)) % WEEKLY_CHALLENGES.length;
        const challenge = WEEKLY_CHALLENGES[challengeIdx];
        const totalToday = habits.length;
        const doneToday = habits.filter((h) => h.lastCompleted === today).length;
        const progress = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;
        const bestStreakOverall = habits.reduce((m, h) => Math.max(m, h.bestStreak), 0);

        const addHabit = () => {
          const name = habitName.trim();
          if (!name) return;
          const h: Habit = {
            id: crypto.randomUUID(),
            name,
            emoji: habitEmoji || "🌸",
            streak: 0,
            bestStreak: 0,
            lastCompleted: null,
            history: [],
            createdAt: Date.now(),
          };
          setHabits((hs) => [...hs, h]);
          setHabitName("");
        };
        const toggleHabit = (id: string) => {
          setHabits((hs) =>
            hs.map((h) => {
              if (h.id !== id) return h;
              if (h.lastCompleted === today) {
                // uncheck today
                return {
                  ...h,
                  lastCompleted: h.history.filter((d) => d !== today).slice(-1)[0] ?? null,
                  streak: Math.max(0, h.streak - 1),
                  history: h.history.filter((d) => d !== today),
                };
              }
              const newStreak = h.lastCompleted === yest ? h.streak + 1 : 1;
              const bestStreak = Math.max(h.bestStreak, newStreak);
              // unlock medals globally
              MEDALS.forEach((m) => {
                if (newStreak >= m.days) {
                  setMedals((mm) => (mm.includes(m.id) ? mm : [...mm, m.id]));
                }
              });
              return {
                ...h,
                lastCompleted: today,
                streak: newStreak,
                bestStreak,
                history: [...h.history, today],
              };
            }),
          );
        };
        const removeHabit = (id: string) => setHabits((hs) => hs.filter((h) => h.id !== id));

        const askCoach = async () => {
          if (coachLoading) return;
          setCoachLoading(true);
          const summary = habits.length
            ? habits.map((h) => `- ${h.emoji} ${h.name}: racha ${h.streak}🔥 (mejor ${h.bestStreak}), ${h.lastCompleted === today ? "hecho hoy ✅" : "pendiente hoy"}`).join("\n")
            : "(aún no tengo hábitos)";
          const msg = `Actúa como mi coach de hábitos kawaii ✨. Este es mi estado actual:\n\n${summary}\n\nReto semanal: ${challenge.emoji} ${challenge.title}\nProgreso de hoy: ${doneToday}/${totalToday} (${progress}%)\n\nDame un plan de 3 pasos concretos para hoy, una recomendación de nuevo hábito y una frase motivadora corta 💕.`;
          try {
            await sendMessage(msg);
            setPanel(null);
          } finally {
            setCoachLoading(false);
          }
        };

        return (
          <div className="modal-overlay" onClick={() => setPanel(null)}>
            <div className="settings-card habits-card" onClick={(e) => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setPanel(null)}>✕</button>
              <div className="habits-header">
                <div className="habits-crown">✨</div>
                <h3>Coach de Hábitos IA</h3>
                <p className="habits-sub">Rachas, retos semanales y medallas kawaii</p>
              </div>

              {/* Reto semanal */}
              <div className="habits-challenge">
                <div className="hc-tag">🌸 Reto semanal</div>
                <div className="hc-title"><span className="hc-emoji">{challenge.emoji}</span> {challenge.title}</div>
              </div>

              {/* Progreso hoy */}
              <div className="habits-progress-wrap">
                <div className="habits-progress-head">
                  <span>💖 Progreso de hoy</span>
                  <span>{doneToday}/{totalToday}</span>
                </div>
                <div className="habits-progress-bar">
                  <div className="habits-progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {/* Añadir hábito */}
              <div className="habits-add">
                <select
                  className="habits-emoji-select"
                  value={habitEmoji}
                  onChange={(e) => setHabitEmoji(e.target.value)}
                  aria-label="Emoji del hábito"
                >
                  {["🌸","💧","📖","🧘‍♀️","🎨","🏃‍♀️","🍎","🌙","🧠","💖","✍️","☕"].map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
                <input
                  className="habits-input"
                  placeholder="Nuevo hábito kawaii..."
                  value={habitName}
                  onChange={(e) => setHabitName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addHabit(); }}
                  maxLength={50}
                />
                <button className="habits-add-btn" onClick={addHabit}>Añadir</button>
              </div>

              {/* Lista de hábitos */}
              <div className="habits-list">
                {habits.length === 0 && (
                  <div className="habits-empty">
                    <span>🌷</span>
                    <p>Aún no tienes hábitos. Añade uno para empezar tu racha 💕</p>
                  </div>
                )}
                {habits.map((h) => {
                  const done = h.lastCompleted === today;
                  return (
                    <div key={h.id} className={`habit-row ${done ? "done" : ""}`}>
                      <button
                        className={`habit-check ${done ? "checked" : ""}`}
                        onClick={() => toggleHabit(h.id)}
                        aria-label={done ? "Desmarcar hábito" : "Marcar hábito"}
                      >
                        {done ? "✓" : ""}
                      </button>
                      <div className="habit-body">
                        <div className="habit-name">
                          <span className="habit-emoji">{h.emoji}</span> {h.name}
                        </div>
                        <div className="habit-meta">
                          <span className="habit-streak">🔥 {h.streak} días</span>
                          <span className="habit-best">🏆 mejor {h.bestStreak}</span>
                        </div>
                      </div>
                      <button className="habit-remove" onClick={() => removeHabit(h.id)} aria-label="Eliminar">✕</button>
                    </div>
                  );
                })}
              </div>

              {/* Medallas */}
              <div className="habits-medals">
                <div className="hm-title">🏅 Medallas</div>
                <div className="hm-grid">
                  {MEDALS.map((m) => {
                    const unlocked = medals.includes(m.id) || bestStreakOverall >= m.days;
                    return (
                      <div key={m.id} className={`hm-item ${unlocked ? "unlocked" : "locked"}`} title={`${m.label} · ${m.days} días`}>
                        <div className="hm-emoji">{unlocked ? m.emoji : "🔒"}</div>
                        <div className="hm-label">{m.label}</div>
                        <div className="hm-days">{m.days} días</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CTA IA */}
              <button className="habits-coach-btn" onClick={askCoach} disabled={coachLoading}>
                {coachLoading ? "IsaBot está pensando..." : "✨ Pídele coaching a IsaBot"}
              </button>
              <p className="habits-hint">IsaBot conoce tus rachas y te dará un plan personalizado 💕</p>
            </div>
          </div>
        );
      })()}


      {/* Panel: Pomodoro */}
      {panel === "pomodoro" && isPremium && (
        <div className="modal-overlay" onClick={() => setPanel(null)}>
          <div className="settings-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setPanel(null)}>✕</button>
            <h3>⏱️ Pomodoro {pomoMode === "work" ? "🌸 Estudio" : "🍵 Descanso"}</h3>
            <div className="pomo-timer">{fmtTime(pomoSeconds)}</div>
            <div className="pomo-actions">
              <button onClick={() => setPomoRunning((r) => !r)}>{pomoRunning ? "⏸️ Pausar" : "▶️ Iniciar"}</button>
              <button onClick={resetPomo}>🔄 Reiniciar</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6b4a80" }}>
                Estudio (min)
                <input
                  type="number" min={1} max={180} value={pomoWorkMin}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(180, Number(e.target.value) || 1));
                    setPomoWorkMin(v);
                    if (pomoMode === "work" && !pomoRunning) setPomoSeconds(v * 60);
                  }}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #e9d5ff", marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6b4a80" }}>
                Descanso (min)
                <input
                  type="number" min={1} max={120} value={pomoBreakMin}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(120, Number(e.target.value) || 1));
                    setPomoBreakMin(v);
                    if (pomoMode === "break" && !pomoRunning) setPomoSeconds(v * 60);
                  }}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #e9d5ff", marginTop: 4 }}
                />
              </label>
            </div>
            <div className="pomo-cycles" style={{ marginTop: 12 }}>✅ Ciclos completados: {pomoCycles}</div>
          </div>
        </div>
      )}

      {/* Panel: Regalo Semanal (premium) — lo envía la admin, es sorpresa 💕 */}
      {panel === "weekly" && isPremium && (() => {
        const wk = getWeekKey();
        const requestKey = `isabot_weekly_req_${wk}`;
        const alreadySent = typeof window !== "undefined" && localStorage.getItem(requestKey) === "1";
        return (
          <div className="modal-overlay" onClick={() => setPanel(null)}>
            <div className="settings-card weekly-card" onClick={(e) => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setPanel(null)}>✕</button>
              <h3>🎁 Regalo Sorpresa Semanal</h3>
              <div className="weekly-info">
                <span className="weekly-week">Semana {wk}</span>
                <span className="weekly-type">💝 Sorpresa</span>
              </div>
              <p className="weekly-status" style={{ textAlign: "center", lineHeight: 1.6 }}>
                Cada semana, Isabella te prepara un regalito sorpresa 💕<br/>
                Puede ser un 📱 wallpaper, 🌸 stickers o ✏️ outlines… ¡nunca sabes qué llegará!
              </p>
              {alreadySent ? (
                <div className="weekly-status" style={{ background: "#ffe0ec", color: "#c92a5a", padding: 14, borderRadius: 14, textAlign: "center", fontWeight: 700 }}>
                  ✅ ¡Ya se envió tu solicitud esta semana!<br/>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>Isabella la revisará y te enviará tu sorpresita muy pronto 💌</span>
                </div>
              ) : (
                <button
                  className="reminder-btn"
                  onClick={() => {
                    try { localStorage.setItem(requestKey, "1"); } catch {}
                    setPanel(null);
                    setTimeout(() => alert("💌 ¡Ya se envió la solicitud de tu regalito sorpresa!\n\nIsabella lo preparará con mucho cariño y te llegará pronto 💕"), 50);
                  }}
                >
                  💌 Solicitar mi regalito sorpresa
                </button>
              )}
              <p className="weekly-hint">Los regalitos los envía Isabella personalmente desde el panel de administración ✨</p>
            </div>
          </div>
        );
      })()}

      {/* Panel: Planeador Mensual (premium) */}
      {panel === "planner" && isPremium && (
        <div className="modal-overlay" onClick={() => setPanel(null)}>
          <div className="settings-card planner-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => { setPanel(null); setPlannerSelectedDay(null); }}>✕</button>
            <h3>📅 Planeador Mensual</h3>

            <div className="planner-tabs">
              <button
                className={`planner-tab ${plannerTab === "digital" ? "active" : ""}`}
                onClick={() => setPlannerTab("digital")}
              >
                🗓️ Digital
              </button>
              <button
                className={`planner-tab ${plannerTab === "custom" ? "active" : ""}`}
                onClick={() => setPlannerTab("custom")}
              >
                🎨 Personalizado
              </button>
            </div>

            {plannerTab === "digital" && (
              <>
                <div className="planner-nav">
                  <button onClick={() => shiftPlannerMonth(-1)}>‹</button>
                  <span>{new Date(plannerMonth + "-01").toLocaleString("es", { month: "long", year: "numeric" })}</span>
                  <button onClick={() => shiftPlannerMonth(1)}>›</button>
                </div>

                <div className="planner-grid">
                  {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                    <div key={i} className="planner-dow">{d}</div>
                  ))}
                  {getMonthMatrix(plannerMonth).flat().map((day, idx) => {
                    if (day === null) return <div key={idx} className="planner-cell empty" />;
                    const key = plannerDayKey(day);
                    const has = !!plannerNotes[key];
                    return (
                      <button
                        key={idx}
                        className={`planner-cell ${has ? "has-note" : ""} ${plannerSelectedDay === key ? "selected" : ""}`}
                        onClick={() => setPlannerSelectedDay(key)}
                      >
                        <span className="planner-day-num">{day}</span>
                        {has && <span className="planner-dot">•</span>}
                      </button>
                    );
                  })}
                </div>

                {plannerSelectedDay && (
                  <div className="planner-note">
                    <label>📝 Nota del {plannerSelectedDay}</label>
                    <textarea
                      rows={3}
                      placeholder="Escribe algo bonito para este día..."
                      value={plannerNotes[plannerSelectedDay] ?? ""}
                      onChange={(e) => setDayNote(plannerSelectedDay, e.target.value)}
                    />
                  </div>
                )}
              </>
            )}

            {plannerTab === "custom" && (
              <>
                <div className="planner-theme-row">
                  <label>🎨 Temática</label>
                  <input
                    type="text"
                    placeholder="Ej: gatitos pastel, cyber kawaii, flores..."
                    value={plannerTheme}
                    onChange={(e) => setPlannerTheme(e.target.value)}
                  />
                </div>

                <div className="planner-theme-row">
                  <label>📆 Mes a generar</label>
                  <div className="planner-month-picker">
                    <select
                      value={Number(plannerGenMonth.split("-")[1])}
                      onChange={(e) => {
                        const y = plannerGenMonth.split("-")[0];
                        setPlannerGenMonth(`${y}-${String(Number(e.target.value)).padStart(2, "0")}`);
                        setPlannerImg(null);
                      }}
                    >
                      {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((n, i) => (
                        <option key={i} value={i + 1}>{n}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={2020}
                      max={2100}
                      value={Number(plannerGenMonth.split("-")[0])}
                      onChange={(e) => {
                        const m = plannerGenMonth.split("-")[1];
                        setPlannerGenMonth(`${e.target.value}-${m}`);
                        setPlannerImg(null);
                      }}
                    />
                  </div>
                </div>

                <button className="reminder-btn" disabled={plannerLoading} onClick={generatePrintablePlanner}>
                  {plannerLoading ? "Diseñando... 🎨" : "🖨️ Generar planeador imprimible con IA"}
                </button>

                {plannerImg && (
                  <div className="planner-printable">
                    <img src={plannerImg} alt="Planeador imprimible" onClick={() => plannerImg && setPreviewImage(plannerImg)} />
                    <a className="download-btn" download={`planeador_${plannerGenMonth}.png`} href={plannerImg}>📥 Descargar</a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}


      {/* Aviso: regalo de Premium enviado por Isabella (admin) */}
      {premiumGift && (
        <div className="modal-overlay" onClick={dismissPremiumGift}>
          <div className="subscribe-card" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
            <button className="close-btn" onClick={dismissPremiumGift}>✕</button>
            <div style={{ fontSize: 64, lineHeight: 1 }}>🎁</div>
            <h2 style={{ color: "#ff477e", margin: "12px 0 6px" }}>¡Isabella te regaló Premium! 💕</h2>
            <p style={{ color: "#a06b8a", margin: "0 0 16px" }}>
              {premiumGift.days === null
                ? "Tienes Premium GRATIS de por vida ✨👑"
                : `Tienes ${premiumGift.days} día${premiumGift.days === 1 ? "" : "s"} de Premium GRATIS 🎉`}
            </p>
            {premiumGift.expiresAt && (
              <p style={{ color: "#c92a5a", fontWeight: 700, marginBottom: 16 }}>
                Válido hasta el {new Date(premiumGift.expiresAt).toLocaleDateString()}
              </p>
            )}
            <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
              Ya puedes usar Outlines, Coach de Hábitos, Pomodoro, Regalo Sorpresa, Planeador Mensual y todas las personalidades premium 🌸
            </p>
            <button className="premium-cta-btn" onClick={dismissPremiumGift}>
              ¡Gracias! 💖
            </button>
          </div>
        </div>
      )}

      {/* Panel: Suscripción */}
      {panel === "subscribe" && (
        <div className="modal-overlay" onClick={() => setPanel(null)}>
          <div className="subscribe-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setPanel(null)}>✕</button>
            <div className="subscribe-header">
              <div className="crown">👑</div>
              <h2>IsaRoRo Studio Premium</h2>
              <p>Desbloquea todo el poder kawaii ✨</p>
            </div>
            <ul className="feature-list">
              <li>✏️ Outlines para Procreate ilimitados</li>
              <li>🐣 Mascota Virtual evolutiva</li>
              <li>⏱️ Temporizador Pomodoro 25/5</li>
              <li>💕 Soporte prioritario kawaii</li>
            </ul>
            <div className="plans">
              <button className="plan monthly" onClick={() => startCheckout("monthly")}>
                <div className="plan-name">Mensual</div>
                <div className="plan-price">$4.99<span>/mes</span></div>
                <div className="plan-tag">Cancela cuando quieras</div>
              </button>
              <button className="plan yearly" onClick={() => startCheckout("yearly")}>
                <div className="plan-badge">🌸 Más popular</div>
                <div className="plan-name">Anual</div>
                <div className="plan-price">$39.99<span>/año</span></div>
                <div className="plan-tag">Ahorra 33% 💖</div>
              </button>
            </div>
            <p className="subscribe-foot">Hecho con 💕 por IsaRoRo Studio</p>
          </div>
        </div>
      )}

      {/* Checkout de pago */}
      {checkoutPlan && (
        <div className="modal-overlay" onClick={() => !processing && setCheckoutPlan(null)}>
          <div className="subscribe-card checkout-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => !processing && setCheckoutPlan(null)}>✕</button>
            <div className="subscribe-header">
              <div className="crown">💳</div>
              <h2>Confirmar pago</h2>
              <p>Plan {checkoutPlan === "monthly" ? "Mensual · $4.99" : "Anual · $39.99"} 💕</p>
            </div>
            <form className="checkout-form" onSubmit={submitCheckout}>
              <label>Nombre del titular
                <input type="text" value={payForm.name} onChange={(e) => setPayForm({ ...payForm, name: e.target.value })} placeholder="Isabella Rodríguez" disabled={processing} />
              </label>
              <label>Email
                <input type="email" value={payForm.email} onChange={(e) => setPayForm({ ...payForm, email: e.target.value })} placeholder="tu@email.com" disabled={processing} />
              </label>
              <label>Número de tarjeta
                <input type="text" inputMode="numeric" value={payForm.card}
                  onChange={(e) => setPayForm({ ...payForm, card: e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim() })}
                  placeholder="1234 5678 9012 3456" disabled={processing} />
              </label>
              <div className="row-2">
                <label>Expira (MM/AA)
                  <input type="text" inputMode="numeric" value={payForm.exp}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
                      setPayForm({ ...payForm, exp: v });
                    }}
                    placeholder="12/28" disabled={processing} />
                </label>
                <label>CVV
                  <input type="password" inputMode="numeric" value={payForm.cvv}
                    onChange={(e) => setPayForm({ ...payForm, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                    placeholder="123" disabled={processing} />
                </label>
              </div>
              {payError && <div className="pay-error">⚠️ {payError}</div>}
              <button type="submit" className="pay-submit" disabled={processing}>
                {processing ? "Procesando pago... 💕" : `Pagar ${checkoutPlan === "monthly" ? "$4.99" : "$39.99"} 👑`}
              </button>
              <p className="pay-secure">🔒 Pago seguro simulado · IsaRoRo Studio</p>
            </form>
          </div>
        </div>
      )}

      {/* Preview imagen */}
      {previewImage && (
        <div className="modal-overlay preview-overlay" onClick={() => setPreviewImage(null)}>
          <div className="preview-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setPreviewImage(null)}>✕</button>
            <h3>✨ Previsualización ✨</h3>
            <img src={previewImage} alt="preview" />
            <a className="download-btn" download="isabot_art.jpg" href={previewImage}>📥 Descargar Imagen</a>
          </div>
        </div>
      )}

      {/* Mobile Tools sheet */}
      {panel === ("tools-menu" as PanelKey) && (
        <div className="modal-overlay sheet-overlay" onClick={() => setPanel(null)}>
          <div className="mobile-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3>🛠️ Herramientas</h3>
            <button className="tool-btn free" onClick={() => setPanel("myday")}>🚀 Mi Día con IsaBot</button>
            <button className="tool-btn free" onClick={() => setPanel("tasks")}>📋 Gestor de Tareas</button>
            <button className="tool-btn free" onClick={() => { setPalette(generatePalette()); setPanel("palette"); }}>🎨 Paletas de Colores</button>
            <button className="tool-btn free" onClick={() => setPanel("notes")}>📝 Notas Rápidas</button>
            <button className="tool-btn premium" onClick={() => tryOpenPremium("outlines")}>{isPremium ? "✏️" : "🔒"} Outlines para Procreate</button>
            <button className="tool-btn premium" onClick={() => tryOpenPremium("habits")}>{isPremium ? "✨" : "🔒"} Coach de Hábitos IA</button>
            <button className="tool-btn premium" onClick={() => tryOpenPremium("pomodoro")}>{isPremium ? "⏱️" : "🔒"} Pomodoro 25/5</button>
            <button className="tool-btn premium" onClick={() => { if (isPremium) { setPanel("weekly"); } else setPanel("subscribe"); }}>{isPremium ? "🎁" : "🔒"} Regalo Semanal</button>
            <button className="tool-btn premium" onClick={() => tryOpenPremium("planner")}>{isPremium ? "📅" : "🔒"} Planeador Mensual</button>
          </div>
        </div>
      )}

      {/* Mobile Gallery sheet */}
      {panel === ("gallery" as PanelKey) && (
        <div className="modal-overlay sheet-overlay" onClick={() => setPanel(null)}>
          <div className="mobile-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3>🖼️ Galería de Arte</h3>
            <div className="gallery-grid" style={{ maxHeight: "60vh" }}>
              {gallery.map((src, i) => (<img key={i} src={src} alt="arte" onClick={() => { setPreviewImage(src); setPanel(null); }} />))}
              {gallery.length === 0 && <p className="gallery-empty">Aún no hay imágenes ✨</p>}
            </div>
          </div>
        </div>
      )}

      {crackOpen && (
        <div className="modal-overlay" onClick={() => !crackLoading && setCrackOpen(false)}>
          <div className="crack-modal" onClick={(e) => e.stopPropagation()}>
            <div className="crack-modal-header">
              <div className="crack-badge">🚀 MODO CRACK</div>
              <h3>Analicemos tu idea como un fundador</h3>
              <p>IsaBot te devolverá un análisis en 3 puntos: valor único, necesidad real e iteración rápida.</p>
            </div>
            <textarea
              className="crack-textarea"
              placeholder="Cuéntame tu idea, proyecto o tarea… ej: 'Una app para que estudiantes universitarios encuentren tutores por hora usando IA'"
              value={crackIdea}
              onChange={(e) => setCrackIdea(e.target.value)}
              disabled={crackLoading}
              rows={6}
              autoFocus
            />
            <div className="crack-modal-actions">
              <button className="crack-cancel-btn" onClick={() => setCrackOpen(false)} disabled={crackLoading}>Cancelar</button>
              <button
                className="crack-submit-btn"
                disabled={crackLoading || crackIdea.trim().length < 10}
                onClick={async () => {
                  const idea = crackIdea.trim();
                  if (idea.length < 10 || !currentChatId) return;
                  setCrackLoading(true);
                  const userMsg: Message = { sender: "user", text: `🚀 Modo Crack — ${idea}` };
                  const thinkingMsg: Message = { sender: "bot", text: "Analizando en modo crack… 🚀", thinking: true };
                  updateCurrentChat((msgs) => [...msgs, userMsg, thinkingMsg]);
                  setCrackOpen(false);
                  setCrackIdea("");
                  try {
                    const response = await chatFetch({
                      mensaje: idea,
                      personalidad: "profesional",
                      historial: [],
                      crackMode: true,
                    });
                    const data = await response.json();
                    const botText = data.response || data.respuesta || data.text || "No obtuve respuesta 💔";
                    updateCurrentChat((msgs) => [...msgs.filter((m) => !m.thinking), { sender: "bot", text: botText }]);
                  } catch {
                    updateCurrentChat((msgs) => [...msgs.filter((m) => !m.thinking), { sender: "bot", text: "Error de conexión en Modo Crack 💔", error: true }]);
                  } finally {
                    setCrackLoading(false);
                  }
                }}
              >
                {crackLoading ? "Analizando…" : "🚀 Analizar mi idea"}
              </button>
            </div>
          </div>
        </div>
      )}

      {panel === "myday" && <DailyPlanPanel onClose={() => setPanel(null)} />}

      {panel === "invite" && <InvitePanel onClose={() => setPanel(null)} />}

      {panel === "feedback" && <FeedbackPanel onClose={() => setPanel(null)} />}
      {panel === "technews" && (
        <TechNewsPanel key={lang} lang={lang} onClose={() => setPanel(null)} onAsk={(q) => { void sendMessage(q); }} />
      )}



      
      {panel === "isaspace" && (
        <IsaSpacePanel onClose={() => setPanel(null)} myUserId={authUser?.id ?? null} />
      )}

      {panel === "academy" && (
        <AcademyPanel
          onClose={() => setPanel(null)}
          onUpgrade={() => setPanel("subscribe")}
          displayName={authUser?.email?.split("@")[0] ?? undefined}
        />
      )}




      {panel === "cowork" && <DesktopCowork onClose={() => setPanel(null)} />}

      {panel === "ibcagent" && <AgentPdfPanel onClose={() => setPanel(null)} />}


    </div>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <div className="stat-bar"><div className="stat-fill" style={{ width: `${value}%` }} /></div>
    </div>
  );
}
