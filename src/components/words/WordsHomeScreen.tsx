import { motion } from "framer-motion";
import { AlignLeft, Flame, Quote, Sparkles, SpellCheck, Trophy, Zap } from "lucide-react";
import { sound } from "@/lib/sound";
import {
  SENTENCE_LEVELS,
  WORD_LEVELS,
  type GameSubMode,
  type SentenceLevel,
  type SentencesBest,
  type WordLevel,
  type WordsBest,
} from "@/lib/words";

interface Props {
  mode: GameSubMode;
  onModeChange: (mode: GameSubMode) => void;
  wordsBest: WordsBest;
  sentencesBest: SentencesBest;
  onSelectWordLevel: (level: WordLevel) => void;
  onSelectSentenceLevel: (level: SentenceLevel) => void;
}

const LEVEL_ICONS: Record<string, typeof Sparkles> = {
  easy: Sparkles,
  medium: Zap,
  hard: Flame,
};

const LEVEL_STYLES: Record<string, { iconBg: string; badge: string; borderHover: string }> = {
  easy: {
    iconBg: "bg-emerald-500/15 text-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    borderHover: "hover:border-emerald-500/60 hover:shadow-emerald-500/10",
  },
  medium: {
    iconBg: "bg-amber-500/15 text-amber-500",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    borderHover: "hover:border-amber-500/60 hover:shadow-amber-500/10",
  },
  hard: {
    iconBg: "bg-rose-500/15 text-rose-500",
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    borderHover: "hover:border-rose-500/60 hover:shadow-rose-500/10",
  },
};

export function WordsHomeScreen({
  mode,
  onModeChange,
  wordsBest,
  sentencesBest,
  onSelectWordLevel,
  onSelectSentenceLevel,
}: Props) {
  const levels: ("easy" | "medium" | "hard")[] = ["easy", "medium", "hard"];

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col items-center justify-center px-4 py-8">
      {/* Game Hero */}
      <div className="mb-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-amber-500 text-white shadow-lg shadow-violet-500/25"
        >
          {mode === "words" ? <SpellCheck className="size-8" /> : <Quote className="size-8" />}
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground"
        >
          ركّب الكلمة والجملة
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="mt-2 text-base text-muted-foreground max-w-md mx-auto"
        >
          رتّب الحروف المبعثرة واجمع الكلمات والجمل العربية من خلال تلميحات ذكية وتحدي الوقت
        </motion.p>
      </div>

      {/* Segmented Switcher & Large Mode Cards */}
      <div className="w-full mb-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* Mode 1: جمع كلمة */}
          <button
            type="button"
            onClick={() => {
              sound.unlock();
              sound.playTabSwitch();
              onModeChange("words");
            }}
            className={`group relative flex flex-col items-center text-center p-4 sm:p-5 rounded-3xl border-2 transition-all cursor-pointer ${
              mode === "words"
                ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                : "border-border/60 bg-card hover:border-primary/40 opacity-75 hover:opacity-100"
            }`}
          >
            <div
              className={`mb-2.5 flex size-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 ${
                mode === "words"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <SpellCheck className="size-6" />
            </div>
            <h3 className="font-extrabold text-base sm:text-lg text-foreground">جمع كلمة</h3>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              رتّب الحروف المبعثرة لاكتشاف الكلمة
            </p>
            {/* Best score badge */}
            <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-amber-500">
              <Trophy className="size-3" />
              <span>
                أعلى مجموع:{" "}
                {Math.max(wordsBest.easy, wordsBest.medium, wordsBest.hard) > 0
                  ? Math.max(wordsBest.easy, wordsBest.medium, wordsBest.hard)
                  : "—"}
              </span>
            </div>
          </button>

          {/* Mode 2: جمع جملة */}
          <button
            type="button"
            onClick={() => {
              sound.unlock();
              sound.playTabSwitch();
              onModeChange("sentences");
            }}
            className={`group relative flex flex-col items-center text-center p-4 sm:p-5 rounded-3xl border-2 transition-all cursor-pointer ${
              mode === "sentences"
                ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                : "border-border/60 bg-card hover:border-primary/40 opacity-75 hover:opacity-100"
            }`}
          >
            <div
              className={`mb-2.5 flex size-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 ${
                mode === "sentences"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <AlignLeft className="size-6" />
            </div>
            <h3 className="font-extrabold text-base sm:text-lg text-foreground">جمع جملة</h3>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              رتّب الكلمات المبعثرة لتركيب الحكم والأمثال
            </p>
            {/* Best score badge */}
            <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-amber-500">
              <Trophy className="size-3" />
              <span>
                أعلى مجموع:{" "}
                {Math.max(sentencesBest.easy, sentencesBest.medium, sentencesBest.hard) > 0
                  ? Math.max(sentencesBest.easy, sentencesBest.medium, sentencesBest.hard)
                  : "—"}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Level Selection Title */}
      <div className="w-full text-center mb-3">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          اختر مستوى الصعوبة
        </span>
      </div>

      {/* Level Cards */}
      <div className="grid w-full gap-4 sm:grid-cols-3">
        {levels.map((lvl, idx) => {
          const isWord = mode === "words";
          const info = isWord ? WORD_LEVELS[lvl] : SENTENCE_LEVELS[lvl];
          const Icon = LEVEL_ICONS[lvl]!;
          const style = LEVEL_STYLES[lvl]!;
          const bestScore = isWord ? wordsBest[lvl] || 0 : sentencesBest[lvl] || 0;

          const rangeLabel = isWord
            ? info.letterRange[0] === info.letterRange[1]
              ? `${info.letterRange[0]} أحرف`
              : `${info.letterRange[0]} - ${info.letterRange[1]} أحرف`
            : `${(info as unknown as { wordRange: [number, number] }).wordRange[0]} - ${(info as unknown as { wordRange: [number, number] }).wordRange[1]} كلمات`;

          return (
            <motion.button
              key={`${mode}-${lvl}`}
              type="button"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 + idx * 0.08 }}
              onClick={() => {
                sound.unlock();
                sound.playCardPress();
                if (isWord) {
                  onSelectWordLevel(lvl);
                } else {
                  onSelectSentenceLevel(lvl);
                }
              }}
              className={`glass group relative flex flex-col items-center justify-between rounded-3xl p-6 text-center transition-all duration-200 cursor-pointer hover:-translate-y-1 ${style.borderHover}`}
            >
              <div className="flex flex-col items-center w-full">
                <div
                  className={`mb-4 flex size-14 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-110 ${style.iconBg}`}
                >
                  <Icon className="size-7" />
                </div>
                <h3 className="text-xl font-bold text-foreground">{info.label}</h3>
                <span
                  className={`mt-2 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}
                >
                  {rangeLabel}
                </span>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {info.description}
                </p>
              </div>

              {/* Score / Points footer */}
              <div className="mt-6 flex w-full items-center justify-between border-t border-border/40 pt-4 text-xs">
                <span className="text-muted-foreground font-medium">
                  {info.points} نقطة {isWord ? "للكلمة" : "للجملة"}
                </span>
                {bestScore > 0 ? (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-500">
                    <Trophy className="size-3.5" />
                    {bestScore}
                  </span>
                ) : (
                  <span className="text-muted-foreground/60">—</span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
