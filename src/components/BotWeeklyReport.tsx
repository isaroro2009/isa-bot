import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBotWeeklyReport } from "@/lib/botReport.functions";

const CARD: CSSProperties = {
  background: "rgba(255,255,255,0.85)",
  backdropFilter: "blur(12px)",
  borderRadius: 24,
  padding: 20,
  boxShadow: "0 10px 30px rgba(122,63,191,0.12)",
  marginBottom: 16,
};

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.7)",
        borderRadius: 16,
        padding: "10px 14px",
        border: `1px solid ${accent}33`,
        minWidth: 130,
      }}
    >
      <div style={{ fontSize: 11, color: "#8a7fa8", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent }}>{value}</div>
    </div>
  );
}

export function BotWeeklyReport() {
  const fetchReport = useServerFn(getBotWeeklyReport);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["bot-weekly-report"],
    queryFn: () => fetchReport(),
    staleTime: 5 * 60 * 1000,
  });

  const levelColor =
    data?.risk.level === "alto" ? "#e03131" : data?.risk.level === "medio" ? "#e8890c" : "#2f9e44";

  return (
    <div style={CARD}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, color: "#7a3fbf", fontSize: 18 }}>🧠 Informe semanal de IsaBot</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8a7fa8" }}>
            Cómo se comportó esta semana y señales de posible alucinación.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{
            border: "none",
            borderRadius: 999,
            padding: "8px 16px",
            background: "linear-gradient(135deg,#a58eff,#ff85a2)",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
            opacity: isFetching ? 0.6 : 1,
          }}
        >
          {isFetching ? "Analizando…" : "Actualizar"}
        </button>
      </div>

      {isLoading && <p style={{ fontSize: 13, color: "#8a7fa8" }}>Analizando la semana…</p>}
      {error && (
        <p style={{ fontSize: 13, color: "#e03131" }}>
          No se pudo generar el informe: {(error as Error).message}
        </p>
      )}

      {data && (
        <>
          <p style={{ fontSize: 12, color: "#8a7fa8", margin: "10px 0" }}>
            Periodo: {data.from} → {data.to}
          </p>

          {data.totals.messages === 0 ? (
            <p style={{ fontSize: 13, color: "#8a7fa8" }}>
              Todavía no hay conversaciones registradas esta semana. El informe se llena solo a medida que la gente
              chatea con IsaBot.
            </p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <Stat label="Mensajes" value={String(data.totals.messages)} accent="#7a3fbf" />
                <Stat label="Personas" value={String(data.totals.users)} accent="#ff477e" />
                <Stat label="Largo medio de respuesta" value={`${data.totals.avgReplyLen} car.`} accent="#a58eff" />
                <Stat label="Con contexto de IsaSpace" value={String(data.totals.withIsaspaceContext)} accent="#0c8599" />
                <Stat label="Modo Crack" value={String(data.totals.crackMode)} accent="#ff85a2" />
              </div>

              <div
                style={{
                  border: `1px solid ${levelColor}44`,
                  background: `${levelColor}0f`,
                  borderRadius: 18,
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <div style={{ fontWeight: 700, color: levelColor, marginBottom: 6 }}>
                  Riesgo de alucinación: {data.risk.hallucinationRisk}/100 ({data.risk.level})
                  {data.prevWeek.messages > 0 && (
                    <span style={{ fontWeight: 400, color: "#8a7fa8", fontSize: 12 }}>
                      {" "}
                      · semana anterior: {data.prevWeek.hallucinationRisk}/100
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "#5b4a75" }}>
                  <span>Afirmaciones absolutas: {data.risk.overclaimRate}%</span>
                  <span>Habla de “ahora mismo”: {data.risk.freshnessClaimRate}%</span>
                  <span>Admite dudas: {data.risk.uncertaintyRate}%</span>
                  <span>Con enlaces: {data.risk.linkRate}%</span>
                  <span>Respuestas vacías: {data.risk.emptyReplyRate}%</span>
                </div>
              </div>

              {data.summary && (
                <div
                  style={{
                    background: "rgba(165,142,255,0.10)",
                    border: "1px solid rgba(165,142,255,0.3)",
                    borderRadius: 18,
                    padding: 14,
                    fontSize: 13,
                    color: "#4a3a66",
                    whiteSpace: "pre-wrap",
                    marginBottom: 14,
                  }}
                >
                  {data.summary}
                </div>
              )}

              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div style={{ minWidth: 220, flex: 1 }}>
                  <h3 style={{ fontSize: 13, color: "#7a3fbf", margin: "0 0 6px" }}>Temas de la semana</h3>
                  {data.topTopics.map((t) => (
                    <div key={t.topic} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", color: "#5b4a75" }}>
                      <span>{t.topic}</span>
                      <strong>{t.count}</strong>
                    </div>
                  ))}
                </div>
                <div style={{ minWidth: 220, flex: 1 }}>
                  <h3 style={{ fontSize: 13, color: "#7a3fbf", margin: "0 0 6px" }}>Por personalidad</h3>
                  {data.byPersonality.map((p) => (
                    <div key={p.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", color: "#5b4a75" }}>
                      <span>{p.name}</span>
                      <strong>
                        {p.count} · {p.overclaimRate}% absolutas
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
