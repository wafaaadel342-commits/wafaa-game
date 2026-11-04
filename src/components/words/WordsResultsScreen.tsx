import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Flame,
  Home,
  RotateCcw,
  SpellCheck,
  Trophy,
  XCircle,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { sound } from "@/lib/sound";
import {
  SENTENCE_LEVELS,
  WORD_LEVELS,
  type GameSubMode,
  type SentenceLevel,
  type SentenceResultItem,
  type WordLevel,
  type WordResultItem,
} from "@/lib/words";

interface Props {
  mode: GameSubMode;
  level: WordLevel | SentenceLevel;
  score: number;
  wordResults?: WordResultItem[] | undefined;
  sentenceResults?: SentenceResultItem[] | undefined;
  bestStreak: number;
  totalCount: number;
  onReplay: () => void;
  onHome: () => void;
}

function getFeedbackMessage(pct: number, isSentence = false): string {
  if (pct >= 90)
    return isSentence
      ? "حكيم الكلمات والأمثال! سرعة بديهة وبلاغة لغوية استثنائية 🏆"
      : "عبقري الكلمات! سرعة بديهة وحصيلة لغوية استثنائية 🏆";
  if (pct >= 70) return "أداء رائع جداً! مهارة فائقة في فك الشفرات والتركيب 👏";
  if (pct >= 50) return "نتيجة جيدة جداً! تجاوزت التحدي بنجاح ملحوظ 🌟";
  return "محاولة طيبة، التمرن المستمر يصنع الأبطال… أعد التحدي لتتألق أكثر 💪";
}

export function WordsResultsScreen({
  mode,
  level,
  score,
  wordResults = [],
  sentenceResults = [],
  bestStreak,
  totalCount,
  onReplay,
  onHome,
}: Props) {
  const isSentence = mode === "sentences";
  const items = isSentence
    ? sentenceResults.map((s) => ({
        text: s.sentence,
        hint: s.hint,
        category: s.category,
        status: s.status,
        pointsEarned: s.pointsEarned,
      }))
    : wordResults.map((w) => ({
        text: w.word,
        hint: w.hint,
        category: w.category,
        status: w.status,
        pointsEarned: w.pointsEarned,
      }));

  const solvedCount = items.filter((r) => r.status === "solved").length;
  const pct = Math.round((solvedCount / (totalCount || 1)) * 100);
  const isCelebration = pct >= 60;

  useEffect(() => {
    if (isCelebration) {
      sound.playFanfare();
    } else {
      sound.playTryAgain();
    }
  }, [isCelebration]);

  const levelLabel = isSentence
    ? SENTENCE_LEVELS[level as SentenceLevel]?.label
    : WORD_LEVELS[level as WordLevel]?.label;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12 relative">
      {/* Celebratory Glow effect */}
      {isCelebration && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-8 flex justify-center -z-10"
        >
          <div className="size-72 rounded-full bg-violet-500/20 blur-3xl animate-pulse" />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass rounded-3xl p-6 sm:p-8 text-center border border-border/60 shadow-xl"
      >
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.1 }}
          className="mx-auto inline-flex size-20 items-center justify-center rounded-3xl bg-violet-500/15 text-violet-500 shadow-inner"
        >
          <Trophy className="size-10" />
        </motion.div>

        <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-foreground">
          {score} <span className="text-xl font-bold text-muted-foreground">نقطة</span>
        </h1>
        <p className="mt-1 font-semibold text-violet-600 dark:text-violet-400">
          {isSentence ? "تحدي جمع الجملة" : "تحدي جمع الكلمة"} • المستوى: {levelLabel}
        </p>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          {getFeedbackMessage(pct, isSentence)}
        </p>

        {/* Stats Grid */}
        <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl bg-muted/30 p-4 border border-border/40">
          <div className="flex flex-col items-center">
            <span className="text-xs text-muted-foreground font-medium">
              {isSentence ? "الجمل المحلولة" : "الكلمات المحلولة"}
            </span>
            <span className="text-lg font-bold text-foreground mt-0.5">
              {solvedCount} / {totalCount}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xs text-muted-foreground font-medium">أفضل تتابع</span>
            <span className="text-lg font-bold text-amber-500 mt-0.5 inline-flex items-center gap-1">
              <Flame className="size-4 fill-amber-500 text-amber-500" />
              {bestStreak}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xs text-muted-foreground font-medium">نسبة الإنجاز</span>
            <span className="text-lg font-bold text-primary mt-0.5">{pct}%</span>
          </div>
        </div>

        {/* Items Breakdown List */}
        <div className="mt-8 text-right">
          <h2 className="mb-3 text-sm font-bold text-foreground flex items-center gap-2">
            {isSentence ? (
              <Quote className="size-4 text-violet-500" />
            ) : (
              <SpellCheck className="size-4 text-violet-500" />
            )}
            <span>
              سجل {isSentence ? "الجمل" : "الكلمات"} في هذه الجولة ({items.length})
            </span>
          </h2>
          <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
            {items.map((r, i) => {
              const isSolved = r.status === "solved";
              return (
                <div
                  key={`${r.text}-${i}`}
                  className={`flex items-center justify-between rounded-2xl border p-3.5 transition-colors ${
                    isSolved
                      ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                      : "border-amber-500/30 bg-amber-500/5 text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-xl ${
                        isSolved
                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {isSolved ? (
                        <CheckCircle2 className="size-4.5" />
                      ) : (
                        <XCircle className="size-4.5" />
                      )}
                    </span>
                    <div className="text-right min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm sm:text-base tracking-wide truncate">
                          {r.text}
                        </span>
                        {r.category && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted font-medium text-muted-foreground shrink-0">
                            {r.category}
                          </span>
                        )}
                      </div>
                      {r.hint && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {r.hint}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-left shrink-0 pe-1">
                    {isSolved ? (
                      <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        +{r.pointsEarned} نقطة
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {r.status === "skipped" ? "تم التخطي" : "نفد الوقت"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            onClick={() => {
              sound.unlock();
              sound.playClick();
              onHome();
            }}
            className="rounded-2xl py-6 sm:w-44 text-sm font-bold gap-2 cursor-pointer border-border/60 hover:bg-muted"
          >
            <Home className="size-4" />
            الرئيسية
          </Button>

          <Button
            onClick={() => {
              sound.unlock();
              sound.playClick();
              onReplay();
            }}
            className="rounded-2xl py-6 sm:w-44 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold gap-2 shadow-lg shadow-violet-500/25 cursor-pointer"
          >
            <RotateCcw className="size-4" />
            العب مرة أخرى
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
