import { motion } from "framer-motion";
import { AlertCircle, Flame, KeyRound, Scale, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEVELS, type Best, type Level } from "@/lib/quiz";
import { sound } from "@/lib/sound";

const ICONS: Record<Level, typeof Sparkles> = { easy: Sparkles, medium: Scale, hard: Flame };
const TONE: Record<Level, { icon: string; card: string }> = {
  easy: {
    icon: "bg-easy/15 text-easy",
    card: "hover:border-easy/60 hover:shadow-easy/15",
  },
  medium: {
    icon: "bg-medium/15 text-medium",
    card: "hover:border-medium/60 hover:shadow-medium/15",
  },
  hard: {
    icon: "bg-hard/15 text-hard",
    card: "hover:border-hard/60 hover:shadow-hard/15",
  },
};

interface Props {
  best: Best;
  hasApiKey: boolean;
  onSelectLevel: (level: Level) => void;
  onOpenSettings: () => void;
}

export function HomeScreen({ best, hasApiKey, onSelectLevel, onOpenSettings }: Props) {
  const handleLevelClick = (level: Level) => {
    sound.unlock();
    sound.playClick();
    if (!hasApiKey) {
      onOpenSettings();
      return;
    }
    onSelectLevel(level);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center px-4 py-16">
      {/* Banner if no API key is saved */}
      {!hasApiKey && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8 w-full"
        >
          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-center sm:flex-row sm:text-start">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/20 text-destructive">
                <AlertCircle className="size-5" />
              </span>
              <div>
                <p className="font-bold text-foreground">أضف مفتاح API من الإعدادات للبدء</p>
                <p className="text-xs text-muted-foreground">
                  يتطلب التحدي مفتاح Google AI Studio مجاني أو مفتاح OpenRouter.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                sound.unlock();
                onOpenSettings();
              }}
              className="shrink-0 font-bold"
            >
              <KeyRound className="me-1.5 size-4" />
              فتح الإعدادات
            </Button>
          </div>
        </motion.div>
      )}

      <header className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="mb-4 inline-flex size-16 items-center justify-center rounded-3xl glass text-4xl shadow-sm"
        >
          🧠
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="text-4xl font-extrabold tracking-tight sm:text-5xl"
        >
          تحدّي المعرفة
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.3 }}
          className="mt-3 text-base text-muted-foreground sm:text-lg"
        >
          اختبر ثقافتك العامة… أسئلة وصور وتحديات جديدة في كل جولة!
        </motion.p>
      </header>

      <div className="mt-10 grid w-full gap-4 sm:grid-cols-3">
        {(Object.keys(LEVELS) as Level[]).map((level, idx) => {
          const meta = LEVELS[level];
          const Icon = ICONS[level];
          return (
            <motion.button
              key={level}
              type="button"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + idx * 0.08, duration: 0.3 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleLevelClick(level)}
              className={`glass group flex flex-col items-center gap-3 rounded-3xl p-6 text-center transition-colors cursor-pointer ${TONE[level].card}`}
            >
              <span
                className={`inline-flex size-14 items-center justify-center rounded-2xl ${TONE[level].icon}`}
              >
                <Icon className="size-7" />
              </span>
              <span className="text-2xl font-bold">{meta.label}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">
                {meta.description}
              </span>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                <Trophy className="size-3.5" />
                {best[level] > 0 ? `أفضل نتيجة: ${best[level]} نقطة` : "لم تلعب بعد"}
              </span>
            </motion.button>
          );
        })}
      </div>

      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.3 }}
        onClick={() => {
          sound.unlock();
          onOpenSettings();
        }}
        className="mt-8 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline cursor-pointer"
      >
        إعدادات مزود الأسئلة ومفاتيح الـ API والصوت
      </motion.button>
    </div>
  );
}
