import { useEffect } from "react";
import { motion } from "framer-motion";
import { BookOpenCheck, CheckCircle2, Home, RotateCcw, Trophy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatArabicOption, LEVELS, type Level, type Missed } from "@/lib/quiz";
import { sound } from "@/lib/sound";

interface Props {
  level: Level;
  score: number;
  missed: Missed[];
  totalQuestions: number;
  onReplay: () => void;
  onHome: () => void;
}

function message(pct: number): string {
  if (pct >= 90) return "مذهل! أنت موسوعة معرفية متألقة 🏆";
  if (pct >= 70) return "أداء رائع جداً! معرفتك واسعة ودقيقة 👏";
  if (pct >= 60) return "نتيجة ممتازة! تجاوزت التحدي بنجاح 🌟";
  if (pct >= 40) return "محاولة جيدة، استمر في الاطلاع وستصل للقمة 💪";
  return "لا بأس، المعرفة رحلة مستمرة… أعد المحاولة واستمتع بالتعلم 🚀";
}

export function ResultsScreen({ level, score, missed, totalQuestions, onReplay, onHome }: Props) {
  const max = LEVELS[level].points * (totalQuestions || 10);
  const pct = Math.round((score / max) * 100);

  useEffect(() => {
    // Play sound based on result percentage
    if (pct >= 60) {
      sound.playFanfare();
    } else {
      sound.playTryAgain();
    }
  }, [pct]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="glass rounded-3xl p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.15 }}
          className="mx-auto inline-flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-inner"
        >
          <Trophy className="size-10" />
        </motion.div>
        <motion.h1
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="mt-4 text-4xl font-extrabold sm:text-5xl"
        >
          {pct}%
        </motion.h1>
        <p className="mt-2 text-lg font-bold text-muted-foreground">
          أحرزت {score} من {max} نقطة · مستوى {LEVELS[level].label} ({totalQuestions} أسئلة)
        </p>
        <p className="mt-3 text-base leading-relaxed text-foreground font-medium">{message(pct)}</p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            className="font-bold text-base shadow-sm"
            onClick={() => {
              sound.unlock();
              sound.playClick();
              onReplay();
            }}
          >
            <RotateCcw className="me-2 size-4" /> العب مرة أخرى
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="font-bold text-base"
            onClick={() => {
              sound.unlock();
              sound.playClick();
              onHome();
            }}
          >
            <Home className="me-2 size-4" /> الرئيسية
          </Button>
        </div>
      </motion.div>

      {missed.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="mt-8"
        >
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <BookOpenCheck className="size-5 text-primary" />
            راجع ما فاتك ({missed.length})
          </h2>
          <div className="space-y-3">
            {missed.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.05, duration: 0.25 }}
                className="glass rounded-2xl p-4 text-start"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                    {m.category}
                  </span>
                </div>
                <p className="mt-2 font-bold leading-relaxed">
                  {i + 1}. {m.question}
                </p>
                <p className="mt-2 flex items-start gap-2 text-sm text-easy font-semibold">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <span>
                    الإجابة الصحيحة:{" "}
                    <span className="underline">{formatArabicOption(m.correct)}</span>
                  </span>
                </p>
                {m.chosen && (
                  <p className="mt-1 flex items-start gap-2 text-sm text-hard">
                    <XCircle className="mt-0.5 size-4 shrink-0" />
                    <span>إجابتك: {formatArabicOption(m.chosen)}</span>
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}
