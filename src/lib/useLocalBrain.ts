// 📴 IsaBot Local — mini-cerebro que vive dentro del dispositivo.
// Usa WebLLM (WebGPU) para responder sin WiFi ni datos móviles.
// Todo el import es dinámico: nada de esto se ejecuta en el servidor (SSR).

import { useCallback, useEffect, useRef, useState } from "react";

export const LOCAL_MODEL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
export const LOCAL_MODEL_SIZE_MB = 350;

export type LocalBrainStatus =
  | "checking"
  | "unsupported"
  | "idle"
  | "downloading"
  | "ready"
  | "error";

export type LocalChatMessage = { role: "system" | "user" | "assistant"; content: string };

type MLCEngine = {
  chat: {
    completions: {
      create: (opts: Record<string, unknown>) => Promise<{
        choices?: Array<{ message?: { content?: string | null } }>;
      }>;
    };
  };
  unload?: () => Promise<void>;
};

function webGpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function useLocalBrain() {
  const [status, setStatus] = useState<LocalBrainStatus>("checking");
  const [cached, setCached] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<MLCEngine | null>(null);
  const loadingRef = useRef<Promise<MLCEngine> | null>(null);

  // ¿El dispositivo soporta correr IA local? ¿Ya está descargado el cerebro?
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!webGpuAvailable()) {
        if (alive) setStatus("unsupported");
        return;
      }
      try {
        const webllm = await import("@mlc-ai/web-llm");
        const isCached = await webllm.hasModelInCache(LOCAL_MODEL_ID).catch(() => false);
        if (!alive) return;
        setCached(!!isCached);
        setStatus("idle");
      } catch {
        if (alive) setStatus("idle");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Descarga (una sola vez) y prepara el cerebro local. */
  const ensureReady = useCallback(async (): Promise<MLCEngine> => {
    if (engineRef.current) return engineRef.current;
    if (loadingRef.current) return loadingRef.current;
    if (!webGpuAvailable()) {
      setStatus("unsupported");
      throw new Error("unsupported");
    }

    const task = (async () => {
      setError(null);
      setStatus("downloading");
      setProgress(0);
      setProgressText("Preparando la descarga…");
      try {
        const webllm = await import("@mlc-ai/web-llm");
        const engine = (await webllm.CreateMLCEngine(LOCAL_MODEL_ID, {
          initProgressCallback: (report: { progress?: number; text?: string }) => {
            if (typeof report.progress === "number") {
              setProgress(Math.max(0, Math.min(1, report.progress)));
            }
            if (report.text) setProgressText(report.text);
          },
        })) as unknown as MLCEngine;
        engineRef.current = engine;
        setCached(true);
        setProgress(1);
        setStatus("ready");
        return engine;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No pude preparar el cerebro local";
        setError(msg);
        setStatus("error");
        throw e;
      } finally {
        loadingRef.current = null;
      }
    })();

    loadingRef.current = task;
    return task;
  }, []);

  /** Genera una respuesta 100% dentro del dispositivo. */
  const generate = useCallback(
    async (messages: LocalChatMessage[]): Promise<string> => {
      const engine = await ensureReady();
      const res = await engine.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: 512,
      });
      return (res.choices?.[0]?.message?.content ?? "").trim();
    },
    [ensureReady],
  );

  /** Borra el cerebro local del dispositivo para liberar espacio. */
  const removeModel = useCallback(async () => {
    try {
      await engineRef.current?.unload?.();
    } catch {
      /* ignore */
    }
    engineRef.current = null;
    try {
      const webllm = await import("@mlc-ai/web-llm");
      await webllm.deleteModelAllInfoInCache(LOCAL_MODEL_ID);
    } catch {
      /* ignore */
    }
    setCached(false);
    setProgress(0);
    setProgressText("");
    setStatus(webGpuAvailable() ? "idle" : "unsupported");
  }, []);

  return {
    status,
    cached,
    progress,
    progressText,
    error,
    ensureReady,
    generate,
    removeModel,
    supported: status !== "unsupported" && status !== "checking",
  };
}
