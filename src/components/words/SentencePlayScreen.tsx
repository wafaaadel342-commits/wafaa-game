import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Flame,
  Home,
  Lightbulb,
  Lock,
  RotateCcw,
  Shuffle,
  SkipForward,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { markItemSeen } from "@/lib/anti-repeat";
import { sound } from "@/lib/sound";
import {
  SENTENCE_LEVELS,
  type SentenceItem,
  type SentenceLevel,
  type SentenceResultItem,
} from "@/lib/words";

interface Props {
  level: SentenceLevel;
  sentences: SentenceItem[];
  onFinish: (score: number, results: SentenceResultItem[], bestStreak: number) => void;
  onHome: () => void;
}

interface SlotState {
  word: string | null;
  chipId: string | null;
  isLocked: boolean; // revealed by hint
}

interface TrayChip {
  id: string;
  word: string;
}

export function SentencePlayScreen({ level, sentences, onFinish, onHome }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [results, setResults] = useState<SentenceResultItem[]>([]);

  const currentSentence = sentences[currentIndex];
  const levelInfo = SENTENCE_LEVELS[level];

  // Sentence interactive state
  const [slots, setSlots] = useState<SlotState[]>([]);
  const [tray, setTray] = useState<TrayChip[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [status, setStatus] = useState<"playing" | "correct" | "wrong" | "revealed">("playing");
  const [floatingScore, setFloatingScore] = useState<number | null>(null);

  // Timer: 20 + 10 * wordCount
  const calculateTimer = useCallback((item?: SentenceItem) => {
    if (!item) return 60;
    return 20 + 10 * item.wordCount;
  }, []);

  const [timeLeft, setTimeLeft] = useState(() => calculateTimer(currentSentence));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize sentence state when currentIndex changes
  const initSentence = useCallback(
    (item: SentenceItem) => {
      const initialSlots: SlotState[] = item.words.map(() => ({
        word: null,
        chipId: null,
        isLocked: false,
      }));
      setSlots(initialSlots);

      const initialTray: TrayChip[] = item.scrambled.map((w, idx) => ({
        id: `chip-${idx}-${w}-${Math.random().toString(36).slice(2, 6)}`,
        word: w,
      }));
      setTray(initialTray);

      setRevealedCount(0);
      setWrongAttempts(0);
      setStatus("playing");
      setFloatingScore(null);
      setTimeLeft(calculateTimer(item));
    },
    [calculateTimer],
  );

  useEffect(() => {
    if (currentSentence) {
      initSentence(currentSentence);
      // Mark seen ONLY when displayed
      markItemSeen(`sent:${currentSentence.id}`);
    }
  }, [currentIndex, currentSentence, initSentence]);

  // Handle timeout or manual skip
  const handleTimeoutOrSkip = useCallback(
    (isSkip = false) => {
      if (!currentSentence || status !== "playing") return;

      if (timerRef.current) clearInterval(timerRef.current);
      sound.playTimeout();
      setStatus("revealed");
      setStreak(0);

      // Fill all slots with correct words
      setSlots(
        currentSentence.words.map((w) => ({
          word: w,
          chipId: null,
          isLocked: true,
        })),
      );
      setTray([]);

      setResults((prev) => [
        ...prev,
        {
          sentence: currentSentence.sentence,
          hint: currentSentence.hint,
          category: currentSentence.category,
          status: isSkip ? "skipped" : "timeout",
          pointsEarned: 0,
          revealsUsed: revealedCount,
        },
      ]);
    },
    [currentSentence, status, revealedCount],
  );

  // Timer countdown effect
  useEffect(() => {
    if (status !== "playing") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeoutOrSkip(false);
          return 0;
        }
        if (prev === 6) {
          sound.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, handleTimeoutOrSkip]);

  // Advance to next sentence
  const advanceToNext = useCallback(() => {
    if (currentIndex + 1 < sentences.length) {
      setCurrentIndex((idx) => idx + 1);
    } else {
      // Round completed
      const finalMaxStreak = Math.max(maxStreak, streak);
      onFinish(score, results, finalMaxStreak);
    }
  }, [currentIndex, sentences.length, maxStreak, streak, score, results, onFinish]);

  // Check sentence when all slots are filled
  useEffect(() => {
    if (status !== "playing" || !currentSentence) return;
    const allFilled = slots.length > 0 && slots.every((s) => s.word !== null);
    if (!allFilled) return;

    const constructed = slots.map((s) => s.word).join(" ");
    const expected = currentSentence.words.join(" ");

    if (constructed === expected) {
      // Correct!
      if (timerRef.current) clearInterval(timerRef.current);
      setStatus("correct");

      const basePts = levelInfo.points;
      const penalty = revealedCount * 3 + wrongAttempts * 2;
      const netBase = Math.max(5, basePts - penalty);
      const newStreak = streak + 1;
      const streakBonus = Math.min(15, newStreak * 3);
      const totalPoints = netBase + streakBonus;

      setScore((s) => s + totalPoints);
      setStreak(newStreak);
      setMaxStreak((m) => Math.max(m, newStreak));
      setFloatingScore(totalPoints);

      sound.playWordSolved();
      if (newStreak % 3 === 0) {
        setTimeout(() => sound.playStreakChime(), 350);
      }

      setResults((prev) => [
        ...prev,
        {
          sentence: currentSentence.sentence,
          hint: currentSentence.hint,
          category: currentSentence.category,
          status: "solved",
          pointsEarned: totalPoints,
          revealsUsed: revealedCount,
        },
      ]);

      // Auto-advance after 1.2s
      const t = setTimeout(() => {
        advanceToNext();
      }, 1200);

      return () => clearTimeout(t);
    } else {
      // Wrong arrangement
      setStatus("wrong");
      sound.playWrong();
      setWrongAttempts((w) => w + 1);

      // Keep slots editable, reset status to playing after a brief shake
      const t = setTimeout(() => {
        setStatus("playing");
      }, 800);

      return () => clearTimeout(t);
    }
  }, [
    slots,
    status,
    currentSentence,
    levelInfo.points,
    revealedCount,
    wrongAttempts,
    streak,
    advanceToNext,
  ]);

  // Click on tray chip -> places into first empty slot
  const handleChipClick = (chip: TrayChip) => {
    if (status !== "playing") return;

    const firstEmptyIndex = slots.findIndex((s) => s.word === null);
    if (firstEmptyIndex === -1) return;

    sound.unlock();
    sound.playLetterPlaced();

    setSlots((prev) => {
      const next = [...prev];
      next[firstEmptyIndex] = {
        word: chip.word,
        chipId: chip.id,
        isLocked: false,
      };
      return next;
    });

    setTray((prev) => prev.filter((c) => c.id !== chip.id));
  };

  // Click on slot -> return word to tray if not locked
  const handleSlotClick = (index: number) => {
    if (status !== "playing") return;
    const slot = slots[index];
    if (!slot || slot.word === null || slot.isLocked) return;

    sound.unlock();
    sound.playTileRemove();

    const returnedChip: TrayChip = {
      id: slot.chipId || `chip-return-${index}-${Math.random()}`,
      word: slot.word,
    };

    setTray((prev) => [...prev, returnedChip]);

    setSlots((prev) => {
      const next = [...prev];
      next[index] = { word: null, chipId: null, isLocked: false };
      return next;
    });
  };

  // Action: Reveal word (costs 3 pts, max 2 times)
  const handleRevealWord = () => {
    if (status !== "playing" || !currentSentence) return;
    if (revealedCount >= 2) return;

    // Find first slot that does not have the correct word locked
    const targetIndex = slots.findIndex(
      (s, idx) => s.word !== currentSentence.words[idx] || !s.isLocked,
    );
    if (targetIndex === -1) return;

    sound.unlock();
    sound.playHintUsed();

    const correctWord = currentSentence.words[targetIndex]!;

    // If target slot had a non-locked word, send it back to tray
    const existing = slots[targetIndex];
    if (existing && existing.word && !existing.isLocked) {
      setTray((prev) => [
        ...prev,
        {
          id: existing.chipId || `chip-${Math.random()}`,
          word: existing.word!,
        },
      ]);
    }

    // Remove the correctWord from tray (or from another slot if placed there)
    setTray((prev) => {
      const idx = prev.findIndex((c) => c.word === correctWord);
      if (idx !== -1) {
        const copy = [...prev];
        copy.splice(idx, 1);
        return copy;
      }
      return prev;
    });

    // If placed in another slot, clear that slot
    setSlots((prev) => {
      const next = prev.map((s, idx) => {
        if (idx !== targetIndex && s.word === correctWord && !s.isLocked) {
          return { word: null, chipId: null, isLocked: false };
        }
        return s;
      });

      // Lock correct word in target slot
      next[targetIndex] = {
        word: correctWord,
        chipId: null,
        isLocked: true,
      };
      return next;
    });

    setRevealedCount((r) => r + 1);
  };

  // Action: Clear unlocked slots
  const handleClearSlots = () => {
    if (status !== "playing") return;
    sound.unlock();
    sound.playTileRemove();

    const unlocked = slots.filter((s) => !s.isLocked && s.word !== null);
    const returned: TrayChip[] = unlocked.map((s) => ({
      id: s.chipId || `chip-${Math.random()}`,
      word: s.word!,
    }));

    setTray((prev) => [...prev, ...returned]);
    setSlots((prev) =>
      prev.map((s) => (s.isLocked ? s : { word: null, chipId: null, isLocked: false })),
    );
  };

  // Action: Shuffle tray
  const handleShuffle = () => {
    if (status !== "playing" || tray.length <= 1) return;
    sound.unlock();
    sound.playCardPress();

    setTray((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = copy[i]!;
        copy[i] = copy[j]!;
        copy[j] = temp;
      }
      return copy;
    });
  };

  if (!currentSentence) return null;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col justify-between px-4 py-4 sm:py-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onHome}
            className="text-muted-foreground hover:text-foreground gap-1.5 px-2.5 h-8 text-xs font-bold"
          >
            <Home className="size-4" />
            <span className="hidden sm:inline">الرئيسية</span>
          </Button>

          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
            {levelInfo.label}
          </span>
        </div>

        {/* Counter */}
        <span className="text-xs font-semibold text-muted-foreground">
          الجملة {currentIndex + 1} من {sentences.length}
        </span>

        {/* Score & Streak */}
        <div className="flex items-center gap-3">
          {streak > 1 && (
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 text-xs font-bold text-amber-500"
            >
              <Flame className="size-4 fill-amber-500 text-amber-500 animate-pulse" />
              <span>{streak} متتالية</span>
            </motion.div>
          )}

          <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
            <Trophy className="size-4 text-amber-500" />
            <span>{score}</span>
          </div>
        </div>
      </div>

      {/* Main Play Area */}
      <div className="my-auto flex flex-col items-center py-6 w-full max-w-2xl mx-auto">
        {/* Timer Bar & Countdown */}
        <div className="mb-4 flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Clock3 className={`size-4 ${timeLeft <= 10 ? "text-rose-500 animate-spin" : ""}`} />
            <span className={timeLeft <= 10 ? "text-rose-500 font-extrabold" : ""}>
              {timeLeft} ثانية
            </span>
          </div>

          {currentSentence.category && (
            <span className="rounded-full bg-secondary px-3 py-0.5 text-xs font-medium text-muted-foreground">
              {currentSentence.category}
            </span>
          )}
        </div>

        {/* Hint Card */}
        {currentSentence.hint && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass mb-6 flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center sm:text-start"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Lightbulb className="size-5" />
            </div>
            <p className="text-sm font-medium leading-relaxed text-foreground">
              {currentSentence.hint}
            </p>
          </motion.div>
        )}

        {/* Answer Slots Container */}
        <div className="relative mb-8 w-full">
          {/* Floating score celebration */}
          <AnimatePresence>
            {floatingScore !== null && (
              <motion.div
                initial={{ opacity: 0, y: 0, scale: 0.5 }}
                animate={{ opacity: 1, y: -35, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 font-extrabold text-2xl text-emerald-500 drop-shadow-md z-20"
              >
                +{floatingScore} نقطة!
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            animate={
              status === "wrong"
                ? { x: [-8, 8, -6, 6, -3, 3, 0] }
                : status === "correct"
                  ? { scale: [1, 1.02, 1] }
                  : {}
            }
            transition={{ duration: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-2.5 p-4 rounded-3xl border border-border/60 bg-background/50 min-h-24 shadow-inner"
            dir="rtl"
          >
            {slots.map((slot, idx) => {
              const isFilled = slot.word !== null;
              const isLocked = slot.isLocked;

              let slotStyle =
                "border-dashed border-2 border-border/80 bg-muted/20 text-muted-foreground/40";
              if (status === "correct") {
                slotStyle =
                  "border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold shadow-md shadow-emerald-500/10";
              } else if (status === "wrong") {
                slotStyle =
                  "border-rose-500 bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold";
              } else if (status === "revealed") {
                slotStyle =
                  "border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold";
              } else if (isLocked) {
                slotStyle =
                  "border-primary/60 bg-primary/10 text-primary font-bold shadow-sm shadow-primary/10";
              } else if (isFilled) {
                slotStyle =
                  "border-primary/80 bg-card text-foreground font-bold shadow-sm hover:border-destructive/60 hover:bg-destructive/5 cursor-pointer";
              }

              return (
                <motion.button
                  key={`slot-${idx}`}
                  type="button"
                  whileTap={isFilled && !isLocked && status === "playing" ? { scale: 0.95 } : {}}
                  onClick={() => handleSlotClick(idx)}
                  disabled={!isFilled || isLocked || status !== "playing"}
                  className={`relative flex items-center justify-center rounded-2xl px-4 py-2.5 min-w-16 min-h-12 text-sm sm:text-base transition-all duration-200 select-none ${slotStyle}`}
                >
                  {slot.word ? (
                    <span className="flex items-center gap-1.5">
                      {isLocked && <Lock className="size-3.5 text-primary shrink-0" />}
                      {slot.word}
                    </span>
                  ) : (
                    <span className="text-xs opacity-40 font-mono">{idx + 1}</span>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        </div>

        {/* Revealed/Timeout alert */}
        {status === "revealed" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center"
          >
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
              الجملة الصحيحة:
            </p>
            <p className="text-base font-bold text-foreground">{currentSentence.sentence}</p>
            <Button
              type="button"
              onClick={advanceToNext}
              className="mt-3 font-bold gap-2 px-6 shadow-md"
            >
              <span>الجملة التالية</span>
              <ArrowLeft className="size-4" />
            </Button>
          </motion.div>
        )}

        {/* Scrambled Word Chips Tray */}
        {status !== "revealed" && (
          <div className="w-full">
            <p className="mb-2 text-center text-xs font-semibold text-muted-foreground">
              انقر على الكلمات بالترتيب الصحيح لتكوين الجملة:
            </p>

            <div
              className="flex flex-wrap items-center justify-center gap-2.5 p-4 rounded-3xl border border-border/80 bg-secondary/30 min-h-20"
              dir="rtl"
            >
              <AnimatePresence>
                {tray.map((chip) => (
                  <motion.button
                    key={chip.id}
                    layout
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    className="glass cursor-pointer rounded-2xl border border-border/80 bg-card px-4 py-2.5 text-sm sm:text-base font-bold text-foreground shadow-sm hover:border-primary hover:text-primary transition-colors select-none"
                  >
                    {chip.word}
                  </motion.button>
                ))}
              </AnimatePresence>
              {tray.length === 0 && slots.every((s) => s.word !== null) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 font-medium">
                  <CheckCircle2 className="size-4 text-primary" />
                  تم وضع جميع الكلمات!
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls / Action Bar */}
      {status !== "revealed" && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRevealWord}
            disabled={revealedCount >= 2 || status !== "playing"}
            className="h-9 gap-1.5 text-xs font-bold"
          >
            <Lightbulb className="size-3.5 text-amber-500" />
            <span>كشف كلمة ({2 - revealedCount} متبقية)</span>
            <span className="text-[10px] text-muted-foreground">(-3 نقاط)</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShuffle}
            disabled={tray.length <= 1 || status !== "playing"}
            className="h-9 gap-1.5 text-xs font-bold"
          >
            <Shuffle className="size-3.5" />
            <span>خلط الكلمات</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearSlots}
            disabled={slots.every((s) => s.word === null || s.isLocked) || status !== "playing"}
            className="h-9 gap-1.5 text-xs font-bold"
          >
            <RotateCcw className="size-3.5" />
            <span>مسح الإجابة</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleTimeoutOrSkip(true)}
            disabled={status !== "playing"}
            className="h-9 gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            <SkipForward className="size-3.5" />
            <span>تخطّي</span>
          </Button>
        </div>
      )}
    </div>
  );
}
