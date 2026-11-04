import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
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
import { markItemSeen, normalizeArabic } from "@/lib/anti-repeat";
import { sound } from "@/lib/sound";
import { WORD_LEVELS, type WordItem, type WordLevel, type WordResultItem } from "@/lib/words";

interface Props {
  level: WordLevel;
  words: WordItem[];
  onFinish: (score: number, results: WordResultItem[], bestStreak: number) => void;
  onHome: () => void;
}

interface SlotState {
  letter: string | null;
  tileId: string | null;
  isLocked: boolean;
}

interface TrayTile {
  id: string;
  letter: string;
}

export function WordsPlayScreen({ level, words, onFinish, onHome }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [results, setResults] = useState<WordResultItem[]>([]);

  const currentWord = words[currentIndex];
  const levelInfo = WORD_LEVELS[level];

  // Current word interactive state
  const [slots, setSlots] = useState<SlotState[]>([]);
  const [tray, setTray] = useState<TrayTile[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [status, setStatus] = useState<"playing" | "correct" | "wrong" | "revealed">("playing");
  const [floatingScore, setFloatingScore] = useState<number | null>(null);

  // 60-second timer
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize word state whenever currentIndex changes
  const initWord = useCallback((item: WordItem) => {
    const letters = item.word.split("");
    const initialSlots: SlotState[] = letters.map(() => ({
      letter: null,
      tileId: null,
      isLocked: false,
    }));
    setSlots(initialSlots);

    const initialTray: TrayTile[] = item.scrambled.map((l, idx) => ({
      id: `tile-${idx}-${l}-${Math.random().toString(36).slice(2, 6)}`,
      letter: l,
    }));
    setTray(initialTray);

    setRevealedCount(0);
    setWrongAttempts(0);
    setStatus("playing");
    setFloatingScore(null);
    setTimeLeft(60);
  }, []);

  useEffect(() => {
    if (currentWord) {
      initWord(currentWord);
      markItemSeen(`word:${normalizeArabic(currentWord.word)}`);
    }
  }, [currentIndex, currentWord, initWord]);

  // Handle timeout
  const handleTimeoutOrSkip = useCallback(
    (isSkip = false) => {
      if (!currentWord || status !== "playing") return;

      if (timerRef.current) clearInterval(timerRef.current);
      sound.playTimeout();
      setStatus("revealed");
      setStreak(0);

      // Reveal correct word in amber
      const letters = currentWord.word.split("");
      setSlots(
        letters.map((l) => ({
          letter: l,
          tileId: null,
          isLocked: true,
        })),
      );
      setTray([]);

      setResults((prev) => [
        ...prev,
        {
          word: currentWord.word,
          hint: currentWord.hint,
          category: currentWord.category,
          status: isSkip ? "skipped" : "timeout",
          pointsEarned: 0,
        },
      ]);
    },
    [currentWord, status],
  );

  // Timer countdown effect
  useEffect(() => {
    if (status !== "playing") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeoutOrSkip(false);
          return 0;
        }
        if (prev <= 6 && prev > 1) {
          sound.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, handleTimeoutOrSkip]);

  // Advance to next word or finish
  const advanceToNext = useCallback(() => {
    if (currentIndex + 1 < words.length) {
      sound.playSwoosh();
      setCurrentIndex((i) => i + 1);
    } else {
      // Finished
      const finalMaxStreak = Math.max(maxStreak, streak);
      onFinish(score, results, finalMaxStreak);
    }
  }, [currentIndex, words.length, maxStreak, streak, score, results, onFinish]);

  // Check word when all slots are filled
  useEffect(() => {
    if (status !== "playing" || !currentWord) return;
    const allFilled = slots.length > 0 && slots.every((s) => s.letter !== null);
    if (!allFilled) return;

    const isMatch =
      constructed === currentWord.word ||
      Boolean(currentWord.alternatives && currentWord.alternatives.includes(constructed));

    if (isMatch) {
      // Correct!
      if (timerRef.current) clearInterval(timerRef.current);
      setStatus("correct");

      const basePts = levelInfo.points;
      const penalty = revealedCount * 3 + wrongAttempts * 2;
      const netBase = Math.max(2, basePts - penalty);
      const newStreak = streak + 1;
      const streakBonus = Math.min(10, newStreak * 2);
      const totalWordPoints = netBase + streakBonus;

      setScore((s) => s + totalWordPoints);
      setStreak(newStreak);
      setMaxStreak((m) => Math.max(m, newStreak));
      setFloatingScore(totalWordPoints);

      sound.playWordSolved();
      if (newStreak % 3 === 0) {
        setTimeout(() => sound.playStreakChime(), 350);
      }

      setResults((prev) => [
        ...prev,
        {
          word: currentWord.word,
          hint: currentWord.hint,
          category: currentWord.category,
          status: "solved",
          pointsEarned: totalWordPoints,
        },
      ]);

      // Auto-advance after ~1.2s
      const t = setTimeout(() => {
        advanceToNext();
      }, 1200);

      return () => clearTimeout(t);
    } else {
      // Wrong!
      setStatus("wrong");
      sound.playWrong();
      setWrongAttempts((w) => w + 1);

      // Return unlocked letters to tray after ~0.8s
      const t = setTimeout(() => {
        setSlots((prevSlots) => {
          const unlocked = prevSlots.filter((s) => !s.isLocked && s.letter !== null);
          const returnedTiles: TrayTile[] = unlocked.map((s) => ({
            id: s.tileId || `tile-${Math.random()}`,
            letter: s.letter!,
          }));

          setTray((prevTray) => [...prevTray, ...returnedTiles]);

          return prevSlots.map((s) =>
            s.isLocked ? s : { letter: null, tileId: null, isLocked: false },
          );
        });
        setStatus("playing");
      }, 800);

      return () => clearTimeout(t);
    }
  }, [
    slots,
    status,
    currentWord,
    levelInfo.points,
    revealedCount,
    wrongAttempts,
    streak,
    advanceToNext,
  ]);

  // Tap tray tile -> flies to first empty slot (RTL order: slot 0 is rightmost)
  const handleTileClick = (tile: TrayTile) => {
    if (status !== "playing") return;

    const firstEmptyIndex = slots.findIndex((s) => s.letter === null);
    if (firstEmptyIndex === -1) return;

    sound.unlock();
    sound.playLetterPlaced();

    // Place in slot
    setSlots((prev) => {
      const next = [...prev];
      next[firstEmptyIndex] = {
        letter: tile.letter,
        tileId: tile.id,
        isLocked: false,
      };
      return next;
    });

    // Remove from tray
    setTray((prev) => prev.filter((t) => t.id !== tile.id));
  };

  // Tap slot -> letter flies back to tray (if unlocked)
  const handleSlotClick = (index: number) => {
    if (status !== "playing") return;
    const target = slots[index];
    if (!target || !target.letter || target.isLocked) return;

    sound.unlock();
    sound.playLetterReturned();

    const returnedTile: TrayTile = {
      id: target.tileId || `tile-${Math.random()}`,
      letter: target.letter,
    };

    setSlots((prev) => {
      const next = [...prev];
      next[index] = { letter: null, tileId: null, isLocked: false };
      return next;
    });

    setTray((prev) => [...prev, returnedTile]);
  };

  // Action: كشف حرف (Hint lightbulb - max 2 per word)
  const handleRevealLetter = () => {
    if (status !== "playing" || revealedCount >= 2 || !currentWord) return;

    const letters = currentWord.word.split("");
    // Find first slot from right that is not locked with the correct letter
    const targetIndex = slots.findIndex((slot, i) => !slot.isLocked || slot.letter !== letters[i]);

    if (targetIndex === -1) return;

    sound.unlock();
    sound.playHintReveal();
    const correctLetter = letters[targetIndex]!;

    // If there is already an unlocked letter in target slot, return it to tray
    const existing = slots[targetIndex];
    const newTray = [...tray];
    if (existing && existing.letter && !existing.isLocked) {
      newTray.push({
        id: existing.tileId || `tile-${Math.random()}`,
        letter: existing.letter,
      });
    }

    // Remove one instance of correctLetter from tray if present
    const trayMatchIdx = newTray.findIndex((t) => t.letter === correctLetter);
    if (trayMatchIdx !== -1) {
      newTray.splice(trayMatchIdx, 1);
    } else {
      // If correct letter was placed in another unlocked slot, remove it from that slot
      const otherSlotIdx = slots.findIndex(
        (s, i) => i !== targetIndex && !s.isLocked && s.letter === correctLetter,
      );
      if (otherSlotIdx !== -1) {
        setSlots((prev) => {
          const next = [...prev];
          next[otherSlotIdx] = { letter: null, tileId: null, isLocked: false };
          return next;
        });
      }
    }

    setTray(newTray);
    setSlots((prev) => {
      const next = [...prev];
      next[targetIndex] = {
        letter: correctLetter,
        tileId: `hint-${targetIndex}`,
        isLocked: true,
      };
      return next;
    });

    setRevealedCount((r) => r + 1);
  };

  // Action: خلط (Reshuffle tray)
  const handleShuffleTray = () => {
    if (status !== "playing" || tray.length <= 1) return;
    sound.unlock();
    sound.playShuffle();
    setTray((prev) => [...prev].sort(() => Math.random() - 0.5));
  };

  // Action: مسح (Clear all unlocked slots back to tray)
  const handleClearSlots = () => {
    if (status !== "playing") return;
    const filledUnlocked = slots.filter((s) => !s.isLocked && s.letter !== null);
    if (filledUnlocked.length === 0) return;

    sound.unlock();
    sound.playLetterReturned();

    const returned: TrayTile[] = filledUnlocked.map((s) => ({
      id: s.tileId || `tile-${Math.random()}`,
      letter: s.letter!,
    }));

    setTray((prev) => [...prev, ...returned]);
    setSlots((prev) =>
      prev.map((s) => (s.isLocked ? s : { letter: null, tileId: null, isLocked: false })),
    );
  };

  // Action: تخطي (Skip)
  const handleSkip = () => {
    sound.unlock();
    handleTimeoutOrSkip(true);
  };

  if (!currentWord) return null;

  // SVG circular timer calculation
  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference - (timeLeft / 60) * circumference;
  const isTimeUrgent = timeLeft <= 10;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-2xl flex-col justify-between px-4 py-4 sm:py-6">
      {/* Top Bar */}
      <div className="glass rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              sound.unlock();
              sound.playClick();
              onHome();
            }}
            aria-label="الرئيسية"
            className="size-9 rounded-xl hover:bg-muted cursor-pointer"
          >
            <Home className="size-4" />
          </Button>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-semibold">
              الكلمة {currentIndex + 1} من {words.length}
            </span>
            <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
              {levelInfo.label}
            </span>
          </div>
        </div>

        {/* Streak & Score */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs">
            <Flame
              className={`size-4 ${streak > 0 ? "fill-amber-500 text-amber-500 animate-pulse" : "text-amber-500/60"}`}
            />
            <span>{streak}</span>
          </div>

          <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
            <Trophy className="size-4 text-primary" />
            <span>{score}</span>
          </div>

          {/* Circular 60s Timer */}
          <div className="relative size-10 flex items-center justify-center">
            <svg className="size-10 -rotate-90" viewBox="0 0 44 44">
              <circle
                cx="22"
                cy="22"
                r="18"
                className="stroke-muted"
                strokeWidth="3.5"
                fill="none"
              />
              <circle
                cx="22"
                cy="22"
                r="18"
                className={
                  isTimeUrgent
                    ? "stroke-destructive transition-all"
                    : "stroke-violet-500 transition-all"
                }
                strokeWidth="3.5"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <span
              className={`absolute text-xs font-bold ${
                isTimeUrgent ? "text-destructive animate-pulse" : "text-foreground"
              }`}
            >
              {timeLeft}
            </span>
          </div>
        </div>
      </div>

      {/* Main Play Area */}
      <div className="my-auto flex flex-col items-center w-full py-4 space-y-6 sm:space-y-8">
        {/* Floating +score popup */}
        <AnimatePresence>
          {floatingScore !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: -24, scale: 1.25 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.8 }}
              className="absolute z-30 font-black text-2xl text-emerald-500 drop-shadow-md select-none pointer-events-none"
            >
              +{floatingScore}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Clue / Hint Card */}
        <motion.div
          key={currentWord.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="glass rounded-3xl p-5 sm:p-6 w-full text-center relative border border-border/60 shadow-lg"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-500/15 text-violet-600 dark:text-violet-400 mb-3 border border-violet-500/20">
            <span>{currentWord.category}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground leading-relaxed">
            "{currentWord.hint}"
          </h2>
        </motion.div>

        {/* Answer Slots (RTL order: slot 0 is rightmost in standard RTL layout) */}
        <div
          dir="rtl"
          className={`flex flex-wrap justify-center gap-2 sm:gap-3 py-2 ${
            status === "wrong" ? "animate-shake" : ""
          }`}
        >
          {slots.map((slot, idx) => {
            const hasLetter = slot.letter !== null;
            let slotClass = "slot-empty";

            if (status === "correct") {
              slotClass = "slot-correct";
            } else if (status === "revealed") {
              slotClass =
                "bg-amber-500/20 border-2 border-amber-500 text-amber-600 dark:text-amber-400";
            } else if (status === "wrong") {
              slotClass = "bg-destructive/20 border-2 border-destructive text-destructive";
            } else if (slot.isLocked) {
              slotClass = "slot-locked text-medium-foreground";
            } else if (hasLetter) {
              slotClass = "slot-filled text-foreground";
            }

            return (
              <motion.button
                key={`slot-${idx}`}
                type="button"
                whileTap={!slot.isLocked && hasLetter ? { scale: 0.94 } : {}}
                onClick={() => handleSlotClick(idx)}
                disabled={status !== "playing" || slot.isLocked || !hasLetter}
                className={`relative flex size-13 sm:size-15 items-center justify-center rounded-2xl text-2xl font-black transition-all duration-150 select-none ${slotClass} ${
                  !slot.isLocked && hasLetter ? "cursor-pointer hover:border-primary/80" : ""
                }`}
              >
                {slot.letter}
                {slot.isLocked && status === "playing" && (
                  <span className="absolute top-1 left-1 text-[10px] text-amber-500">
                    <Lock className="size-2.5" />
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Action Controls Bar */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 w-full">
          {/* Hint Lightbulb */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={status !== "playing" || revealedCount >= 2}
            onClick={handleRevealLetter}
            className="rounded-xl border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer text-xs gap-1.5 px-3 py-2"
          >
            <Lightbulb className="size-3.5" />
            <span>كشف حرف ({2 - revealedCount})</span>
          </Button>

          {/* Reshuffle */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={status !== "playing" || tray.length <= 1}
            onClick={handleShuffleTray}
            className="rounded-xl border-border/60 hover:bg-muted cursor-pointer text-xs gap-1.5 px-3 py-2"
          >
            <Shuffle className="size-3.5" />
            <span>خلط</span>
          </Button>

          {/* Clear */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={status !== "playing" || !slots.some((s) => !s.isLocked && s.letter !== null)}
            onClick={handleClearSlots}
            className="rounded-xl border-border/60 hover:bg-muted cursor-pointer text-xs gap-1.5 px-3 py-2"
          >
            <RotateCcw className="size-3.5" />
            <span>مسح</span>
          </Button>

          {/* Skip */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={status !== "playing"}
            onClick={handleSkip}
            className="rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer text-xs gap-1.5 px-3 py-2"
          >
            <SkipForward className="size-3.5" />
            <span>تخطّي</span>
          </Button>
        </div>

        {/* Scrambled Letter Tiles in Tray */}
        <div className="w-full flex flex-col items-center">
          <div
            dir="rtl"
            className="flex flex-wrap justify-center gap-2.5 sm:gap-3.5 max-w-md min-h-[4rem] items-center p-2"
          >
            <AnimatePresence>
              {tray.map((tile) => (
                <motion.button
                  key={tile.id}
                  layout
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleTileClick(tile)}
                  disabled={status !== "playing"}
                  className="tile-3d flex size-13 sm:size-15 items-center justify-center rounded-2xl text-2xl font-black text-foreground border border-border/60 cursor-pointer select-none"
                >
                  {tile.letter}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Revealed state manual advance button */}
        {status === "revealed" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xs pt-2"
          >
            <Button
              type="button"
              onClick={advanceToNext}
              className="w-full py-6 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-base gap-2 shadow-lg shadow-amber-500/25 cursor-pointer"
            >
              <span>التالي</span>
              <ArrowLeft className="size-5" />
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
