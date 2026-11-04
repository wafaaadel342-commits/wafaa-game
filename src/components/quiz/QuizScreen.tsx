import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Home,
  Lightbulb,
  Maximize2,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { markItemSeen } from "@/lib/anti-repeat";
import { preloadImage } from "@/lib/images";
import { fetchInitialBatch, fetchRemainingBatch } from "@/lib/providers";
import {
  CATEGORIES,
  ERROR_MESSAGES,
  formatArabicOption,
  getQuestionDedupeKey,
  LEVELS,
  QuizError,
  type CategoryKey,
  type Level,
  type Missed,
  type Question,
  type QuizSetupOptions,
  type Settings,
} from "@/lib/quiz";
import { sound } from "@/lib/sound";

const TIMER = 20;

type Phase =
  "initial_loading" | "playing" | "answered" | "waiting_next" | "waiting_error" | "initial_error";

type BgStatus = "idle" | "loading" | "ready" | "error";

interface Props {
  level: Level;
  settings: Settings;
  setupOptions: QuizSetupOptions;
  onFinish: (score: number, missed: Missed[], totalCount: number) => void;
  onExit: () => void;
}

export function QuizScreen({ level, settings, setupOptions, onFinish, onExit }: Props) {
  const targetTotal = setupOptions.questionCount;
  const categories = setupOptions.categories;

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [phase, setPhase] = useState<Phase>("initial_loading");
  const [bgStatus, setBgStatus] = useState<BgStatus>("idle");
  const [error, setError] = useState<string>("SERVER");
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIMER);
  const [missed, setMissed] = useState<Missed[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const initialLoadingRef = useRef(false);
  const bgFetchTriggeredRef = useRef(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear auto-advance timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  // Background fetch for remaining questions
  const triggerBackgroundFetch = useCallback(
    async (currentQuestions: Question[]) => {
      const remainingNeeded = targetTotal - currentQuestions.length;
      if (remainingNeeded <= 0) {
        setBgStatus("ready");
        return;
      }

      setBgStatus("loading");
      try {
        const remainingBatch = await fetchRemainingBatch(
          level,
          settings,
          remainingNeeded,
          categories,
          currentQuestions,
        );
        if (remainingBatch.length > 0) {
          setQuestions((prev) => {
            if (!prev) return remainingBatch;
            const combined = [...prev, ...remainingBatch];
            return combined.slice(0, targetTotal);
          });
          setBgStatus("ready");
        } else {
          setBgStatus("error");
        }
      } catch {
        setBgStatus("error");
      }
    },
    [categories, level, settings, targetTotal],
  );

  // Step 1: Initial small batch load (fast start with 2 usable questions)
  const startInitialLoad = useCallback(async () => {
    if (initialLoadingRef.current) return;
    initialLoadingRef.current = true;
    bgFetchTriggeredRef.current = false;
    setPhase("initial_loading");
    setError("SERVER");
    setQuestions(null);
    setBgStatus("idle");

    try {
      const initial = await fetchInitialBatch(level, settings, categories);
      setQuestions(initial);
      setIndex(0);
      setScore(0);
      setMissed([]);
      setSelected(null);
      setTimeLeft(TIMER);
      setImageLoaded(false);
      setPhase("playing");
      sound.playStartJingle();

      // Step 2: Immediately kick off background request for remaining questions
      if (!bgFetchTriggeredRef.current) {
        bgFetchTriggeredRef.current = true;
        void triggerBackgroundFetch(initial);
      }
    } catch (e) {
      setError(e instanceof QuizError ? e.code : "SERVER");
      setPhase("initial_error");
    } finally {
      initialLoadingRef.current = false;
    }
  }, [categories, level, settings, triggerBackgroundFetch]);

  useEffect(() => {
    void startInitialLoad();
  }, [startInitialLoad]);

  // Preload upcoming 2-3 images
  useEffect(() => {
    if (questions) {
      for (let i = index + 1; i <= index + 3 && i < questions.length; i++) {
        const nextImg = questions[i]?.imageUrl;
        if (nextImg) {
          preloadImage(nextImg);
        }
      }
    }
  }, [index, questions]);

  // Handle image loading and cache detection for the active question
  useEffect(() => {
    setLightboxOpen(false);

    const imageUrl = questions?.[index]?.imageUrl;
    if (!imageUrl) {
      setImageLoaded(true);
      return;
    }

    let active = true;

    // Check if the image is already cached/complete in the browser
    const checkImg = new Image();
    checkImg.referrerPolicy = "no-referrer";
    checkImg.src = imageUrl;

    if (checkImg.complete && checkImg.naturalWidth > 0) {
      setImageLoaded(true);
      return;
    }

    setImageLoaded(false);

    checkImg.onload = () => {
      if (active) setImageLoaded(true);
    };
    checkImg.onerror = () => {
      if (active) setImageLoaded(true);
    };

    // Safety timeout: never leave the skeleton stuck if browser suppresses onLoad
    const timer = setTimeout(() => {
      if (active) setImageLoaded(true);
    }, 700);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [index, questions]);

  // Mark question seen ONLY when displayed to the player
  useEffect(() => {
    if ((phase === "playing" || phase === "answered") && questions && questions[index]) {
      const q = questions[index]!;
      markItemSeen(getQuestionDedupeKey(q));
    }
  }, [phase, index, questions]);

  // Close lightbox on Escape key
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen]);

  // Advance to next question or show waiting state
  const advanceToNext = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    if (!questions) return;

    const nextIndex = index + 1;
    const effectiveTotal =
      bgStatus === "ready" || bgStatus === "error" ? questions.length : targetTotal;

    if (nextIndex >= effectiveTotal) {
      onFinish(score, missed, questions.length);
      return;
    }

    if (nextIndex < questions.length) {
      setIndex(nextIndex);
      setSelected(null);
      setTimeLeft(TIMER);
      setImageLoaded(false);
      setPhase("playing");
    } else {
      // Question not loaded yet
      if (bgStatus === "error") {
        setPhase("waiting_error");
      } else {
        setPhase("waiting_next");
      }
    }
  }, [bgStatus, index, missed, onFinish, questions, score, targetTotal]);

  // Watch for questions arriving when user was waiting
  useEffect(() => {
    if (phase === "waiting_next" && questions && questions.length > index + 1) {
      setIndex(index + 1);
      setSelected(null);
      setTimeLeft(TIMER);
      setImageLoaded(false);
      setPhase("playing");
    } else if (phase === "waiting_next" && bgStatus === "error") {
      setPhase("waiting_error");
    }
  }, [bgStatus, index, phase, questions]);

  // Handle answering
  const answer = useCallback(
    (choice: number) => {
      if (phase !== "playing" || !questions) return;
      const q = questions[index];
      if (!q) return;

      setSelected(choice);
      setPhase("answered");

      if (choice === -1) {
        sound.playTimeout();
      } else {
        sound.playClick();
      }

      if (choice === q.correctIndex) {
        sound.playCorrect();
        setScore((s) => s + LEVELS[level].points);

        // Auto-advance on correct answers after ~1.2s
        if (autoAdvanceTimerRef.current) {
          clearTimeout(autoAdvanceTimerRef.current);
        }
        autoAdvanceTimerRef.current = setTimeout(() => {
          advanceToNext();
        }, 1200);
      } else {
        if (choice !== -1) {
          sound.playWrong();
        }
        const categoryLabel = CATEGORIES[q.category as CategoryKey]?.label || q.category;
        const entry: Missed = {
          question: q.question,
          correct: formatArabicOption(q.options[q.correctIndex] ?? ""),
          category: categoryLabel,
        };
        const chosen = choice >= 0 ? formatArabicOption(q.options[choice] ?? "") : undefined;
        if (chosen) entry.chosen = chosen;
        setMissed((m) => [...m, entry]);
      }
    },
    [advanceToNext, index, level, phase, questions],
  );

  // Timer countdown: starts ONLY when question and image are visible
  const currentQ = questions?.[index];
  const isQuestionVisible = Boolean(currentQ && (!currentQ.imageUrl || imageLoaded));

  useEffect(() => {
    if (phase !== "playing" || !isQuestionVisible) return;

    if (timeLeft <= 0) {
      if (lightboxOpen) {
        setLightboxOpen(false);
      }
      answer(-1);
      return;
    }

    if (timeLeft <= 5) {
      sound.playTick();
    }

    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [answer, isQuestionVisible, lightboxOpen, phase, timeLeft]);

  // Initial loading state
  if (phase === "initial_loading") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <p className="mb-6 text-center text-lg font-semibold text-muted-foreground animate-rise">
          جاري تجهيز الأسئلة وبدء التحدي...
        </p>
        <div className="glass rounded-3xl p-6">
          <Skeleton className="mx-auto h-6 w-3/4" />
          <Skeleton className="mt-6 h-48 w-full rounded-2xl" />
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Initial failure state
  if (phase === "initial_error") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <div className="glass rounded-3xl p-8 text-center animate-rise">
          <p className="text-lg font-semibold">
            ⚠️ {ERROR_MESSAGES[error] ?? ERROR_MESSAGES["SERVER"]}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button
              onClick={() => {
                sound.unlock();
                void startInitialLoad();
              }}
            >
              <RotateCcw className="me-2 size-4" /> إعادة المحاولة
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                sound.unlock();
                onExit();
              }}
            >
              <Home className="me-2 size-4" /> الرئيسية
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Mid-quiz waiting state (waiting for next background question)
  if (phase === "waiting_next") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <div className="glass rounded-3xl p-8 animate-rise">
          <div className="mx-auto size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <h3 className="mt-4 text-xl font-bold">جاري تحميل السؤال التالي...</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            يتم فحص الصور وتجهيز السؤال، سيبدأ التحدي تلقائياً فور جاهزيته.
          </p>
        </div>
      </div>
    );
  }

  // Mid-quiz background failure state
  if (phase === "waiting_error") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <div className="glass rounded-3xl p-8 animate-rise">
          <p className="text-lg font-bold">⚠️ تعذر تحميل بقية الأسئلة</p>
          <p className="mt-2 text-sm text-muted-foreground">
            حدث انقطاع أثناء جلب الدفعة التالية. يمكنك إعادة المحاولة أو إنهاء الجولة بالأسئلة
            المكتملة ({questions?.length || index} سؤال).
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              onClick={() => {
                sound.unlock();
                setPhase("waiting_next");
                if (questions) void triggerBackgroundFetch(questions);
              }}
            >
              <RotateCcw className="me-2 size-4" /> إعادة المحاولة
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                sound.unlock();
                onFinish(score, missed, questions?.length || index);
              }}
            >
              إنهاء الجولة وعرض النتيجة
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions?.[index];
  if (!q) return null;

  const answered = phase === "answered";
  const isCorrectAnswer = selected === q.correctIndex;
  const effectiveTotal =
    bgStatus === "ready" || bgStatus === "error" ? questions.length : targetTotal;
  const isLastQuestion = index + 1 >= effectiveTotal;
  const categoryLabel = CATEGORIES[q.category as CategoryKey]?.label || q.category;
  const isFlag = q.category === "flags";

  const optionClass = (i: number) => {
    if (!answered) {
      return "glass hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98] cursor-pointer";
    }
    if (i === q.correctIndex) {
      return "bg-easy text-easy-foreground border-easy animate-pop font-bold";
    }
    if (i === selected) {
      return "bg-hard text-hard-foreground border-hard animate-shake font-bold";
    }
    return "glass opacity-50";
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      {/* Top Status Bar */}
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Button
          variant="ghost"
          size="icon"
          aria-label="إنهاء الجولة"
          onClick={() => {
            sound.unlock();
            onExit();
          }}
          className="size-8 shrink-0 rounded-full"
        >
          <Home className="size-4" />
        </Button>
        <span>
          السؤال {index + 1} من {effectiveTotal}
        </span>
        <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 font-bold text-secondary-foreground">
          النقاط: {score}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-bold ${
            timeLeft <= 5 && !answered
              ? "animate-pulse bg-hard text-hard-foreground"
              : "bg-secondary text-secondary-foreground"
          }`}
        >
          <Clock3 className="size-3.5" />
          {answered ? "—" : !isQuestionVisible ? "..." : `${timeLeft} ث`}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${(index / effectiveTotal) * 100}%` }}
        />
      </div>

      {/* Question Card with Smooth Transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 24, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -24, scale: 0.98 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="glass mt-6 rounded-3xl p-6 sm:p-8"
        >
          <div className="flex items-center justify-between">
            <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
              {categoryLabel}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {LEVELS[level].label} ({LEVELS[level].points} نقاط)
            </span>
          </div>

          {/* Hotlinked Image with Lightbox Click */}
          {q.imageUrl && (
            <motion.div
              key={q.imageUrl}
              onClick={() => setLightboxOpen(true)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="group relative mt-4 flex aspect-[16/10] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-muted/40 transition-shadow hover:shadow-md"
              title="انقر لتكبير الصورة"
            >
              {!imageLoaded && <Skeleton className="absolute inset-0 z-0 size-full rounded-2xl" />}
              <img
                ref={(node) => {
                  if (node && node.complete && node.naturalWidth > 0 && !imageLoaded) {
                    setImageLoaded(true);
                  }
                }}
                src={q.imageUrl}
                alt="صورة السؤال"
                referrerPolicy="no-referrer"
                loading="eager"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(true)}
                className={`relative z-10 size-full transition-opacity duration-200 ${
                  isFlag ? "object-contain p-4" : "object-cover"
                } ${imageLoaded ? "opacity-100" : "opacity-0"}`}
              />
              <div
                className={`absolute bottom-3 end-3 z-20 flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-opacity ${
                  imageLoaded ? "opacity-80 group-hover:opacity-100" : "opacity-0"
                }`}
              >
                <Maximize2 className="size-4" />
              </div>
            </motion.div>
          )}

          <h2 className="mt-4 text-xl font-bold leading-relaxed sm:text-2xl">{q.question}</h2>

          {/* Options (Arabic Safety Net Applied with Motion) */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {q.options.map((opt, i) => {
              const formatted = formatArabicOption(opt);
              return (
                <motion.button
                  key={i}
                  disabled={answered}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                  whileHover={!answered ? { scale: 1.012 } : undefined}
                  whileTap={!answered ? { scale: 0.985 } : undefined}
                  onClick={() => {
                    sound.unlock();
                    answer(i);
                  }}
                  className={`flex min-h-16 items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-start text-base font-semibold transition-all duration-200 disabled:cursor-default ${optionClass(
                    i,
                  )}`}
                >
                  <span>{formatted}</span>
                  {answered && i === q.correctIndex && <CheckCircle2 className="size-5 shrink-0" />}
                  {answered && i === selected && i !== q.correctIndex && (
                    <XCircle className="size-5 shrink-0" />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Explanation & Feedback */}
          {answered && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-6 rounded-2xl border border-accent bg-accent/60 p-4"
            >
              <p className="flex items-start gap-2 text-sm leading-relaxed text-accent-foreground">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                {selected === -1 && <span className="font-bold">انتهى الوقت! </span>}
                <span>{q.explanation}</span>
              </p>
            </motion.div>
          )}

          {/* Next Button: Only shown on wrong answer or timeout. Hidden on correct auto-advance. */}
          {answered && !isCorrectAnswer && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Button
                size="lg"
                className="mt-6 w-full text-lg font-bold"
                onClick={() => {
                  sound.unlock();
                  sound.playClick();
                  advanceToNext();
                }}
              >
                {isLastQuestion ? "عرض النتيجة" : "السؤال التالي"}
                <ArrowLeft className="ms-2 size-5" />
              </Button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Image Lightbox Full-Screen Overlay with Smooth AnimatePresence */}
      <AnimatePresence>
        {lightboxOpen && q.imageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
            onClick={() => setLightboxOpen(false)}
          >
            {/* Running Timer Chip inside Lightbox */}
            <div className="absolute top-4 end-4 z-60 flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white shadow-md backdrop-blur-md">
              <Clock3 className="size-3.5" />
              <span>{answered ? "—" : `${timeLeft} ث`}</span>
            </div>

            {/* Close Button */}
            <button
              type="button"
              aria-label="إغلاق الصورة"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 start-4 z-60 flex size-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25 cursor-pointer"
            >
              <X className="size-6" />
            </button>

            {/* Centered Image with touch pinch-to-zoom support */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative flex max-h-[85vh] max-w-[90vw] items-center justify-center overflow-hidden rounded-2xl touch-pan-y"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={q.imageUrl}
                alt="صورة السؤال"
                referrerPolicy="no-referrer"
                className="max-h-[85vh] max-w-[90vw] select-none rounded-2xl object-contain shadow-2xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
