import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/common/AppHeader";
import { AppFooter } from "@/components/common/AppFooter";
import { BackgroundBlobs } from "@/components/common/BackgroundBlobs";
import { HomeScreen } from "@/components/quiz/HomeScreen";
import { QuizScreen } from "@/components/quiz/QuizScreen";
import { ResultsScreen } from "@/components/quiz/ResultsScreen";
import { SetupDialog } from "@/components/quiz/SetupDialog";
import { SettingsDialog } from "@/components/quiz/SettingsDialog";
import {
  hasActiveKey,
  loadBest,
  loadSettings,
  loadSetupOptions,
  saveBest,
  saveSettings,
  saveSetupOptions,
  type Best,
  type Level,
  type Missed,
  type QuizSetupOptions,
  type Settings,
} from "@/lib/quiz";

export const Route = createFileRoute("/quiz")({
  head: () => ({
    meta: [
      { title: "تحدّي المعرفة — ثقف نفسك" },
      {
        name: "description",
        content: "لعبة أسئلة ثقافية عامة باللغة العربية بثلاثة مستويات صعوبة وتصنيفات متنوعة",
      },
    ],
  }),
  component: QuizGamePage,
});

type View =
  | { name: "home" }
  | { name: "quiz"; level: Level; setup: QuizSetupOptions }
  | {
      name: "results";
      level: Level;
      score: number;
      missed: Missed[];
      totalQuestions: number;
      setup: QuizSetupOptions;
    };

function QuizGamePage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>({ name: "home" });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [setupOptions, setSetupOptions] = useState<QuizSetupOptions>(loadSetupOptions());
  const [best, setBest] = useState<Best>({ easy: 0, medium: 0, hard: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [setupLevel, setSetupLevel] = useState<Level | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
    setSetupOptions(loadSetupOptions());
    setBest(loadBest());
  }, []);

  const saveSettingsAndClose = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
    setSettingsOpen(false);
  };

  const handleSelectLevel = (level: Level) => {
    setSetupLevel(level);
  };

  const handleStartConfiguredQuiz = (options: QuizSetupOptions) => {
    if (!setupLevel) return;
    saveSetupOptions(options);
    setSetupOptions(options);
    const chosenLevel = setupLevel;
    setSetupLevel(null);
    setView({ name: "quiz", level: chosenLevel, setup: options });
  };

  const finishRound = (
    level: Level,
    score: number,
    missed: Missed[],
    totalQuestions: number,
    setup: QuizSetupOptions,
  ) => {
    setBest((prev) => {
      const next = { ...prev, [level]: Math.max(prev[level], score) };
      saveBest(next);
      return next;
    });
    setView({ name: "results", level, score, missed, totalQuestions, setup });
  };

  const hasKey = settings ? hasActiveKey(settings) : false;

  const viewKey =
    view.name === "home"
      ? "home"
      : view.name === "quiz"
        ? `quiz-${view.level}-${view.setup.questionCount}`
        : `results-${view.score}`;

  return (
    <main className="relative min-h-dvh flex flex-col">
      <BackgroundBlobs theme="quiz" />

      {/* Global Header */}
      <AppHeader
        showHomeButton={true}
        gameTitle="تحدّي المعرفة"
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={viewKey}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="flex-1 flex flex-col justify-center"
          >
            {view.name === "home" && (
              <HomeScreen
                best={best}
                hasApiKey={hasKey}
                onSelectLevel={handleSelectLevel}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            )}

            {view.name === "quiz" && settings && (
              <QuizScreen
                level={view.level}
                settings={settings}
                setupOptions={view.setup}
                onFinish={(score, missed, totalCount) =>
                  finishRound(view.level, score, missed, totalCount, view.setup)
                }
                onExit={() => navigate({ to: "/" })}
              />
            )}

            {view.name === "results" && (
              <ResultsScreen
                level={view.level}
                score={view.score}
                missed={view.missed}
                totalQuestions={view.totalQuestions}
                onReplay={() => setView({ name: "quiz", level: view.level, setup: view.setup })}
                onHome={() => navigate({ to: "/" })}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <AppFooter />

      {/* Level setup dialog */}
      {setupLevel && (
        <SetupDialog
          open={Boolean(setupLevel)}
          onOpenChange={(open) => {
            if (!open) setSetupLevel(null);
          }}
          level={setupLevel}
          setupOptions={setupOptions}
          onStartQuiz={handleStartConfiguredQuiz}
        />
      )}

      {/* Settings Dialog */}
      {settings && (
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          settings={settings}
          onSave={saveSettingsAndClose}
        />
      )}

      <Toaster position="bottom-center" />
    </main>
  );
}
