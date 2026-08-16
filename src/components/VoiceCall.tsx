import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IsaBotFace, type FaceExpression } from "@/components/IsaBotFace";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const url = (p: string) => (API_BASE ? `${API_BASE}${p}` : p);

type Turn = { role: "user" | "assistant"; content: string };
type Status = "connecting" | "listening" | "thinking" | "speaking" | "error";

type Props = {
  personality: string;
  customPersonality?: string;
  onClose: () => void;
  displayName?: string;
};

function pickMime(): { mime: string; ext: string } {
  const cands: Array<{ mime: string; ext: string }> = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4", ext: "mp4" },
    { mime: "audio/mpeg", ext: "mp3" },
  ];
  for (const c of cands) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: "", ext: "webm" };
}

const EMOTION_TO_EXPR: Record<string, FaceExpression> = {
  happy: "happy",
  sad: "sad",
  neutral: "neutral",
  worried: "worried",
  excited: "excited",
  sleepy: "sleepy",
  angry: "worried", // IsaBot no se enfada — se preocupa
  love: "love",
};
const EMOTION_LABEL: Record<string, string> = {
  happy: "contenta 💕",
  sad: "un poco triste 🥺",
  neutral: "tranquila 🌸",
  worried: "preocupada 💭",
  excited: "emocionada ✨",
  sleepy: "cansadita 😴",
  angry: "tensa 💢",
  love: "enamorada 💗",
};

export function VoiceCall({ personality, customPersonality, onClose, displayName }: Props) {
  const [status, setStatus] = useState<Status>("connecting");
  const [muted, setMuted] = useState(false);
  const [caption, setCaption] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [askCamera, setAskCamera] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [userEmotion, setUserEmotion] = useState<string>("");
  const [botExpression, setBotExpression] = useState<FaceExpression>("happy");

  const streamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const historyRef = useRef<Turn[]>([]);
  const activeRef = useRef(true);
  const mutedRef = useRef(false);
  const playingRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const speakingSinceRef = useRef<number>(0);
  const silenceSinceRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  const mimeRef = useRef<{ mime: string; ext: string }>({ mime: "", ext: "webm" });
  const visionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const emotionRef = useRef<string>("");
  const statusRef = useRef<Status>("connecting");
  const cameraOnRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    cameraOnRef.current = cameraOn;
  }, [cameraOn]);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function beginCall(withCamera: boolean) {
    setAskCamera(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;
      mimeRef.current = pickMime();

      if (withCamera) {
        await enableCamera();
      }

      await speakGreeting();
      if (!activeRef.current) return;
      startListenLoop();
    } catch (err) {
      console.error("VoiceCall start error", err);
      setErrorMsg("No pude acceder al micrófono 💔");
      setStatus("error");
    }
  }

  async function enableCamera() {
    try {
      const cam = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 640 } },
      });
      camStreamRef.current = cam;
      setCameraOn(true);
      // Reproducir en el <video> cuando el elemento exista
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = cam;
          videoRef.current.play().catch(() => {});
        }
      }, 30);
      startVisionLoop();
    } catch (err) {
      console.error("camera error", err);
      setCameraOn(false);
    }
  }

  function disableCamera() {
    if (visionTimerRef.current) {
      clearInterval(visionTimerRef.current);
      visionTimerRef.current = null;
    }
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setUserEmotion("");
    emotionRef.current = "";
  }

  function toggleCamera() {
    if (cameraOn) disableCamera();
    else void enableCamera();
  }

  function startVisionLoop() {
    if (visionTimerRef.current) clearInterval(visionTimerRef.current);
    visionTimerRef.current = setInterval(() => {
      void analyzeFrame();
    }, 8000);
    // Primer análisis rapidito
    setTimeout(() => void analyzeFrame(), 2500);
  }

  async function analyzeFrame() {
    if (!activeRef.current || !cameraOnRef.current) return;
    if (statusRef.current === "speaking" || statusRef.current === "thinking") return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    try {
      const w = 320;
      const h = Math.round((video.videoHeight / Math.max(1, video.videoWidth)) * w) || 240;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const r = await fetch(url("/api/voice/vision"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!r.ok) return;
      const j = (await r.json()) as { emotion?: string; confidence?: number };
      const emo = (j.emotion ?? "").toString();
      if (!emo) return;
      emotionRef.current = emo;
      setUserEmotion(emo);
      // Espeja emoción con delicadeza: IsaBot se pone empática, no calca la emoción negativa
      const expr =
        emo === "sad" || emo === "worried" || emo === "angry"
          ? "worried"
          : emo === "happy" || emo === "excited" || emo === "love"
            ? "happy"
            : "neutral";
      if ((statusRef.current as Status) !== "speaking") setBotExpression(expr);
    } catch (err) {
      console.error("vision err", err);
    }
  }

  async function speakGreeting() {
    const hello = displayName
      ? `¡Hola ${displayName}! Soy IsaBot 💕 cuéntame qué tal.`
      : "¡Hola! Soy IsaBot 💕 cuéntame qué tal.";
    historyRef.current.push({ role: "assistant", content: hello });
    await speak(hello);
  }

  function startListenLoop() {
    if (!activeRef.current) return;
    beginRecording();
    monitorSilence();
  }

  function beginRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    try {
      const opts = mimeRef.current.mime ? { mimeType: mimeRef.current.mime } : undefined;
      const rec = new MediaRecorder(stream, opts);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        void handleRecordingStopped();
      };
      recorderRef.current = rec;
      rec.start();
      startedAtRef.current = performance.now();
      speakingSinceRef.current = 0;
      silenceSinceRef.current = 0;
      setStatus("listening");
      setCaption("");
    } catch (err) {
      console.error("recorder start error", err);
      setErrorMsg("El micrófono no se pudo iniciar 💔");
      setStatus("error");
    }
  }

  function monitorSilence() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      if (!activeRef.current) return;
      const rec = recorderRef.current;
      if (!rec || rec.state !== "recording") {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const now = performance.now();
      const elapsed = now - startedAtRef.current;
      const SPEAK_THRESHOLD = 0.035;
      const SILENCE_MS = 700;
      const MIN_SPEAK_MS = 250;
      const MAX_REC_MS = 20000;

      if (!mutedRef.current && rms > SPEAK_THRESHOLD) {
        if (!speakingSinceRef.current) speakingSinceRef.current = now;
        silenceSinceRef.current = 0;
      } else {
        if (speakingSinceRef.current) {
          if (!silenceSinceRef.current) silenceSinceRef.current = now;
        }
      }

      const spokeEnough = speakingSinceRef.current && now - speakingSinceRef.current > MIN_SPEAK_MS;
      const silentLong = silenceSinceRef.current && now - silenceSinceRef.current > SILENCE_MS;

      if ((spokeEnough && silentLong) || elapsed > MAX_REC_MS) {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function handleRecordingStopped() {
    if (!activeRef.current) return;
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (!speakingSinceRef.current || chunks.length === 0) {
      if (activeRef.current) startListenLoop();
      return;
    }
    const blob = new Blob(chunks, { type: mimeRef.current.mime || "audio/webm" });
    if (blob.size < 1500) {
      if (activeRef.current) startListenLoop();
      return;
    }

    setStatus("thinking");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setErrorMsg("Sesión expirada 💔");
      setStatus("error");
      return;
    }

    let userText = "";
    try {
      const fd = new FormData();
      fd.append("file", blob, `recording.${mimeRef.current.ext}`);
      const r = await fetch(url("/api/voice/transcribe"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = (await r.json()) as { text?: string };
      userText = (j.text ?? "").trim();
    } catch (err) {
      console.error("transcribe err", err);
    }
    if (!activeRef.current) return;
    if (!userText) {
      startListenLoop();
      return;
    }
    setCaption(`Tú: ${userText}`);
    historyRef.current.push({ role: "user", content: userText });

    let botText = "";
    try {
      const r = await fetch(url("/api/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mensaje: userText,
          personalidad: personality,
          personalidadCustom: customPersonality,
          historial: historyRef.current.slice(-14),
          voiceMode: true,
          emocionDetectada: emotionRef.current || undefined,
        }),
      });
      const j = (await r.json()) as { respuesta?: string; tipo?: string };
      botText = (j.respuesta ?? "").toString();
      if (j.tipo === "imagen") botText = "Te mandé algo bonito, revisa el chat cuando cuelgues 💕";
    } catch (err) {
      console.error("chat err", err);
    }
    if (!activeRef.current) return;
    if (!botText) botText = "No te escuché bien, ¿me lo repites? 🥺";
    historyRef.current.push({ role: "assistant", content: botText });
    setCaption(`IsaBot: ${botText}`);

    await speak(botText);
    if (!activeRef.current) return;
    startListenLoop();
  }

  async function speak(text: string) {
    setStatus("speaking");
    // Al hablar, IsaBot ajusta expresión: empática si detectó tristeza reciente
    const emo = emotionRef.current;
    setBotExpression(
      emo === "sad" || emo === "worried" || emo === "angry"
        ? "love"
        : emo && EMOTION_TO_EXPR[emo]
          ? EMOTION_TO_EXPR[emo]
          : "happy",
    );
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const r = await fetch(url("/api/voice/speak"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text, voice: "shimmer" }),
      });
      if (!r.ok) return;
      const buf = await r.arrayBuffer();
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      playingRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        audio.play().catch(() => resolve());
      });
      playingRef.current = null;
    } catch (err) {
      console.error("speak err", err);
    }
  }

  function cleanup() {
    activeRef.current = false;
    try {
      recorderRef.current?.state === "recording" && recorderRef.current.stop();
    } catch {
      /* ignore */
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (visionTimerRef.current) {
      clearInterval(visionTimerRef.current);
      visionTimerRef.current = null;
    }
    if (playingRef.current) {
      try {
        playingRef.current.pause();
      } catch {
        /* ignore */
      }
      playingRef.current = null;
    }
    try {
      sourceRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      audioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    recorderRef.current = null;
  }

  function hangUp() {
    cleanup();
    onClose();
  }

  const statusText =
    status === "connecting"
      ? "Conectando..."
      : status === "listening"
        ? "Escuchando 🎧"
        : status === "thinking"
          ? "Pensando 💭"
          : status === "speaking"
            ? "Hablando 💕"
            : "Error";

  // Prompt inicial: cámara o solo audio
  if (askCamera) {
    return (
      <div className="voicecall-overlay" role="dialog" aria-modal="true">
        <div className="voicecall-inner">
          <div className="voicecall-avatar status-listening">
            <div className="voicecall-ring r1" />
            <div className="voicecall-ring r2" />
            <div className="voicecall-face-svg">
              <IsaBotFace expression="happy" size={320} />
            </div>
          </div>
          <h2 className="voicecall-name">IsaBot</h2>
          <p className="voicecall-status" style={{ maxWidth: 320, textAlign: "center" }}>
            ¿Quieres que te vea la carita? Ajustaré mi tono según cómo te sientas 💕
          </p>
          <p className="voicecall-hint" style={{ maxWidth: 320, textAlign: "center" }}>
            Las imágenes se analizan al vuelo y no se guardan.
          </p>
          <div className="voicecall-actions" style={{ flexWrap: "wrap", justifyContent: "center" }}>
            <button className="vc-btn vc-cam-yes" onClick={() => void beginCall(true)}>
              🎥 Sí, videollamada
            </button>
            <button className="vc-btn vc-cam-no" onClick={() => void beginCall(false)}>
              🎙️ Solo audio
            </button>
          </div>
          <button
            className="vc-btn vc-hangup"
            onClick={hangUp}
            aria-label="Cancelar"
            style={{ marginTop: 4 }}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="voicecall-overlay" role="dialog" aria-modal="true">
      <div className="voicecall-inner">
        <div className={`voicecall-avatar status-${status}`}>
          <div className="voicecall-ring r1" />
          <div className="voicecall-ring r2" />
          <div className="voicecall-ring r3" />
          <div className="voicecall-face-svg">
            <IsaBotFace expression={botExpression} speaking={status === "speaking"} size={340} />
          </div>
        </div>
        <h2 className="voicecall-name">IsaBot</h2>
        <p className="voicecall-status">{statusText}</p>
        {cameraOn && userEmotion && (
          <span className="voicecall-emochip">
            Te veo {EMOTION_LABEL[userEmotion] ?? userEmotion}
          </span>
        )}
        {caption && <p className="voicecall-caption">{caption}</p>}
        {errorMsg && <p className="voicecall-error">{errorMsg}</p>}
        <div className="voicecall-actions">
          <button
            className={`vc-btn vc-mute ${muted ? "on" : ""}`}
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Activar micrófono" : "Silenciar"}
          >
            {muted ? "🔇" : "🎙️"}
          </button>
          <button
            className={`vc-btn vc-cam ${cameraOn ? "on" : ""}`}
            onClick={toggleCamera}
            aria-label={cameraOn ? "Apagar cámara" : "Encender cámara"}
          >
            {cameraOn ? "🎥" : "📷"}
          </button>
          <button className="vc-btn vc-hangup" onClick={hangUp} aria-label="Colgar">
            📞
          </button>
        </div>
        <p className="voicecall-hint">Gratis 💕 · IsaBot te escucha y te ve</p>

        {cameraOn && (
          <div className="voicecall-pip">
            <video ref={videoRef} playsInline muted autoPlay />
          </div>
        )}
      </div>
    </div>
  );
}
