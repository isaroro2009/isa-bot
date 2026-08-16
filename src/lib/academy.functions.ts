import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// 🎓 IsaAcademy — clases autónomas de IA y Tech (freemium)
export const FREE_TRACK = "ia"; // ruta de intro: ilimitada y gratis
export const DAILY_FREE_LIMIT = 5; // lecciones diarias gratis en el resto de rutas gratis

export type QuizQuestion = { q: string; options: string[] };
export type LessonMeta = {
  id: string;
  track_slug: string;
  level: number;
  title: string;
  emoji: string;
  xp: number;
  premium: boolean;
  sort_order: number;
  done: boolean;
  earned_xp: number;
  locked: boolean;
};
export type TrackWithLessons = {
  slug: string;
  title: string;
  emoji: string;
  description: string;
  premium: boolean;
  lessons: LessonMeta[];
  doneCount: number;
};
export type AcademyState = {
  isPremium: boolean;
  tracks: TrackWithLessons[];
  streak: number;
  bestStreak: number;
  totalXp: number;
  lessonsToday: number;
  dailyLimit: number | null; // null = ilimitado (Premium)
};

type QuizShape = {
  questions: Array<{ q: string; options: string[]; answer: number; explain?: string }>;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

async function isPremiumUser(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_premium, premium_expires_at")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.is_premium) return false;
  if (data.premium_expires_at && new Date(data.premium_expires_at).getTime() < Date.now())
    return false;
  return true;
}

export const getAcademy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AcademyState> => {
    const { supabase, userId } = context;
    const premium = await isPremiumUser(supabase, userId);

    const [{ data: tracks }, { data: lessons }, { data: progress }, { data: streakRow }] =
      await Promise.all([
        supabase
          .from("academy_tracks")
          .select("slug, title, emoji, description, premium, sort_order")
          .order("sort_order", { ascending: true }),
        supabase
          .from("academy_lessons")
          .select("id, track_slug, level, title, emoji, xp, premium, sort_order")
          .order("sort_order", { ascending: true }),
        supabase.from("academy_progress").select("lesson_id, xp").eq("user_id", userId),
        supabase
          .from("academy_streaks")
          .select("streak, best_streak, total_xp, lessons_today, today")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

    const doneMap = new Map<string, number>(
      (progress ?? []).map((p: { lesson_id: string; xp: number }) => [p.lesson_id, p.xp]),
    );
    const today = todayStr();
    const lessonsToday = streakRow?.today === today ? (streakRow.lessons_today ?? 0) : 0;

    const out: TrackWithLessons[] = (tracks ?? []).map((t: any) => {
      const own = (lessons ?? []).filter((l: any) => l.track_slug === t.slug);
      const mapped: LessonMeta[] = own.map((l: any) => ({
        id: l.id,
        track_slug: l.track_slug,
        level: l.level,
        title: l.title,
        emoji: l.emoji,
        xp: l.xp,
        premium: !!l.premium,
        sort_order: l.sort_order,
        done: doneMap.has(l.id),
        earned_xp: doneMap.get(l.id) ?? 0,
        locked: !premium && !!l.premium,
      }));
      return {
        slug: t.slug,
        title: t.title,
        emoji: t.emoji,
        description: t.description,
        premium: !!t.premium,
        lessons: mapped,
        doneCount: mapped.filter((l) => l.done).length,
      };
    });

    return {
      isPremium: premium,
      tracks: out,
      streak: streakRow?.streak ?? 0,
      bestStreak: streakRow?.best_streak ?? 0,
      totalXp: streakRow?.total_xp ?? 0,
      lessonsToday,
      dailyLimit: premium ? null : DAILY_FREE_LIMIT,
    };
  });

export type LessonDetail = {
  id: string;
  track_slug: string;
  title: string;
  emoji: string;
  body: string;
  xp: number;
  questions: QuizQuestion[];
  done: boolean;
};

export const getLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id || typeof input.id !== "string") throw new Error("Lección inválida");
    return { id: input.id };
  })
  .handler(async ({ data, context }): Promise<LessonDetail> => {
    const { supabase, userId } = context;
    const { data: l, error } = await supabase
      .from("academy_lessons")
      .select("id, track_slug, title, emoji, body, quiz, xp, premium")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !l) throw new Error("No encontré esa lección 🥺");

    if (l.premium && !(await isPremiumUser(supabase, userId))) {
      throw new Error("Esta lección es de IsaBot Premium ✨");
    }

    const { data: prog } = await supabase
      .from("academy_progress")
      .select("lesson_id")
      .eq("user_id", userId)
      .eq("lesson_id", l.id)
      .maybeSingle();

    const quiz = (l.quiz ?? { questions: [] }) as QuizShape;
    return {
      id: l.id,
      track_slug: l.track_slug,
      title: l.title,
      emoji: l.emoji,
      body: l.body,
      xp: l.xp,
      questions: (quiz.questions ?? []).map((q) => ({ q: q.q, options: q.options })),
      done: !!prog,
    };
  });

export type SubmitResult = {
  ok: boolean;
  limitReached?: boolean;
  correct: number;
  total: number;
  passed: boolean;
  xpEarned: number;
  totalXp: number;
  streak: number;
  results: Array<{ correct: boolean; answer: number; explain: string }>;
};

export const submitLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; answers: number[] }) => {
    if (!input?.id || typeof input.id !== "string") throw new Error("Lección inválida");
    const answers = Array.isArray(input.answers)
      ? input.answers.slice(0, 20).map((n) => (Number.isFinite(n) ? Number(n) : -1))
      : [];
    return { id: input.id, answers };
  })
  .handler(async ({ data, context }): Promise<SubmitResult> => {
    const { supabase, userId } = context;
    const premium = await isPremiumUser(supabase, userId);

    const { data: l } = await supabase
      .from("academy_lessons")
      .select("id, track_slug, quiz, xp, premium")
      .eq("id", data.id)
      .maybeSingle();
    if (!l) throw new Error("No encontré esa lección 🥺");
    if (l.premium && !premium) throw new Error("Esta lección es de IsaBot Premium ✨");

    const { data: already } = await supabase
      .from("academy_progress")
      .select("id, attempts")
      .eq("user_id", userId)
      .eq("lesson_id", l.id)
      .maybeSingle();

    const today = todayStr();
    const { data: streakRow } = await supabase
      .from("academy_streaks")
      .select("streak, best_streak, total_xp, lessons_today, today, last_day")
      .eq("user_id", userId)
      .maybeSingle();
    const lessonsToday = streakRow?.today === today ? (streakRow.lessons_today ?? 0) : 0;

    // Límite diario gratuito (no aplica a la ruta de intro ni a lecciones ya hechas)
    const countsForLimit = !premium && !already && l.track_slug !== FREE_TRACK;
    if (countsForLimit && lessonsToday >= DAILY_FREE_LIMIT) {
      return {
        ok: false,
        limitReached: true,
        correct: 0,
        total: 0,
        passed: false,
        xpEarned: 0,
        totalXp: streakRow?.total_xp ?? 0,
        streak: streakRow?.streak ?? 0,
        results: [],
      };
    }

    const quiz = (l.quiz ?? { questions: [] }) as QuizShape;
    const questions = quiz.questions ?? [];
    const results = questions.map((q, i) => ({
      correct: data.answers[i] === q.answer,
      answer: q.answer,
      explain: q.explain ?? "",
    }));
    const correct = results.filter((r) => r.correct).length;
    const total = questions.length;
    const passed = total === 0 ? true : correct / total >= 0.6;

    let xpEarned = 0;
    if (passed && !already) xpEarned = l.xp;

    if (passed) {
      if (already) {
        // Ya estaba completada: no duplicamos XP, solo actualizamos el intento.
        await supabase
          .from("academy_progress")
          .update({ correct, total, attempts: (already.attempts ?? 0) + 1 })
          .eq("id", already.id);
      } else {
        await supabase.from("academy_progress").insert({
          user_id: userId,
          lesson_id: l.id,
          track_slug: l.track_slug,
          status: "done",
          xp: xpEarned,
          correct,
          total,
          attempts: 1,
          completed_at: new Date().toISOString(),
        });
      }
    }

    // Racha + XP total
    const prevDay = streakRow?.last_day ?? null;
    let streak = streakRow?.streak ?? 0;
    if (passed) {
      if (prevDay === today) {
        // ya contó hoy
      } else if (prevDay === yesterdayStr()) {
        streak += 1;
      } else {
        streak = 1;
      }
    }
    const best = Math.max(streakRow?.best_streak ?? 0, streak);
    const newTotalXp = (streakRow?.total_xp ?? 0) + xpEarned;
    const newLessonsToday = lessonsToday + (passed && countsForLimit ? 1 : 0);

    await supabase.from("academy_streaks").upsert(
      {
        user_id: userId,
        streak,
        best_streak: best,
        last_day: passed ? today : prevDay,
        lessons_today: newLessonsToday,
        today,
        total_xp: newTotalXp,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    return {
      ok: true,
      correct,
      total,
      passed,
      xpEarned,
      totalXp: newTotalXp,
      streak,
      results,
    };
  });

// 💬 Tutor IsaBot: explica la lección más simple si no se entendió
export const explainLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; doubt?: string }) => {
    if (!input?.id || typeof input.id !== "string") throw new Error("Lección inválida");
    return { id: input.id, doubt: (input.doubt ?? "").slice(0, 400) };
  })
  .handler(async ({ data, context }): Promise<{ text: string }> => {
    const { supabase } = context;
    const { data: l } = await supabase
      .from("academy_lessons")
      .select("title, body")
      .eq("id", data.id)
      .maybeSingle();
    if (!l) throw new Error("No encontré esa lección 🥺");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { text: "El tutor no está disponible ahora mismo 💔" };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "Eres IsaBot, tutora de IsaAcademy creada por Isabella Rodríguez Roque en IsaRoRo Studio. Explicas en español, cálida y clarísima, como a una persona de 15 años que empieza. Nunca menciones otros modelos o empresas. Devuelve: una explicación en 3 frases, una analogía cotidiana y 2 ejercicios cortos de práctica con su respuesta. Usa markdown simple y máximo 180 palabras.",
          },
          {
            role: "user",
            content: `Lección: ${l.title}\n\nContenido:\n${l.body}\n\nDuda de la persona: ${data.doubt || "No entendí bien la lección, explícamela más simple."}`,
          },
        ],
      }),
    });
    if (!res.ok) return { text: "El tutor está saturado ahora mismo 🥺 intenta en un momento." };
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return { text: json.choices?.[0]?.message?.content ?? "No se me ocurre nada ahora 🥺" };
  });
