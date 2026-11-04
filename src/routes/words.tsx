import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/common/AppHeader";
import { AppFooter } from "@/components/common/AppFooter";
import { BackgroundBlobs } from "@/components/common/BackgroundBlobs";
import { WordsHomeScreen } from "@/components/words/WordsHomeScreen";
import { WordsSetupDialog } from "@/components/words/WordsSetupDialog";
import { WordsPlayScreen } from "@/components/words/WordsPlayScreen";
import { SentencePlayScreen } from "@/components/words/SentencePlayScreen";
import { WordsResultsScreen } from "@/components/words/WordsResultsScreen";
import { SettingsDialog } from "@/components/quiz/SettingsDialog";
import { sound } from "@/lib/sound";
import { loadSettings, saveSettings, type Settings } from "@/lib/quiz";
import {
  loadRoundSentences,
  loadRoundWords,
  loadSentencesBest,
  loadWordsBest,
  loadWordsSetup,
  saveSentencesBest,
  saveWordsBest,
  saveWordsSetup,
  type GameSubMode,
  type SentenceItem,
  type SentenceLevel,
  type SentenceResultItem,
  type SentencesBest,
  type WordItem,
  type WordLevel,
  type WordResultItem,
  type WordsBest,
  type WordsSetupOptions,
} from "@/lib/words";

export const Route = createFileRoute("/words")({
  head: () => ({
    meta: [
      { title: "ركّب الكلمة والجملة — ثقف نفسك" },
      {
        name: "description",
        content: "رتّب الحروف المبعثرة واجمع الكلمات والجمل العربية من خلال التلميحات وتحدي الوقت",
      },
    ],
  }),
  component: WordsGamePage,
});

type WordsView =
  | { name: "home" }
  | { name: "loading"; mode: GameSubMode; level: WordLevel | SentenceLevel; count: number }
  | { name: "play-words"; level: WordLevel; words: WordItem[] }
  | { name: "play-sentences"; level: SentenceLevel; sentences: SentenceItem[] }
  | {
      name: "results";
      mode: GameSubMode;
      level: WordLevel | SentenceLevel;
      score: number;
      wordResults?: WordResultItem[];
      sentenceResults?: SentenceResultItem[];
      bestStreak: number;
      totalCount: number;
    };

function WordsGamePage() {
  const [view, setView] = useState<WordsView>({ name: "home" });
  const [mode, setMode] = useState<GameSubMode>("words");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wordsBest, setWordsBest] = useState<WordsBest>({ easy: 0, medium: 0, hard: 0 });
  const [sentencesBest, setSentencesBest] = useState<SentencesBest>({
    easy: 0,
    medium: 0,
    hard: 0,
  });
  const [setupOptions, setSetupOptions] = useState<WordsSetupOptions>(loadWordsSetup());
  const [setupLevel, setSetupLevel] = useState<WordLevel | SentenceLevel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
    setWordsBest(loadWordsBest());
    setSentencesBest(loadSentencesBest());
    setSetupOptions(loadWordsSetup());
  }, []);

  const saveSettingsAndClose = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
    setSettingsOpen(false);
  };

  const handleStartGame = async (
    targetMode: GameSubMode,
    level: WordLevel | SentenceLevel,
    options: WordsSetupOptions,
  ) => {
    saveWordsSetup(options);
    setSetupOptions(options);
    setSetupLevel(null);
    setLoadError(null);
    setView({ name: "loading", mode: targetMode, level, count: options.wordCount });

    try {
      const currentSettings = settings || loadSettings();

      if (targetMode === "words") {
        const roundWords = await loadRoundWords(
          currentSettings,
          level as WordLevel,
          options.wordCount,
        );
        sound.playStartJingle();
        setView({ name: "play-words", level: level as WordLevel, words: roundWords });
      } else {
        const roundSentences = await loadRoundSentences(
          currentSettings,
          level as SentenceLevel,
          options.wordCount,
        );
        sound.playStartJingle();
        setView({
          name: "play-sentences",
          level: level as SentenceLevel,
          sentences: roundSentences,
        });
      }
    } catch (err) {
      console.error("Error loading round content:", err);
      setLoadError("تعذّر تجهيز الجولة، يرجى التحقق من الاتصال وإعادة المحاولة.");
    }
  };

  const handleFinishWordsRound = (score: number, results: WordResultItem[], bestStreak: number) => {
    if (view.name !== "play-words") return;
    const level = view.level;
    const totalCount = view.words.length;

    setWordsBest((prev) => {
      const updated = { ...prev, [level]: Math.max(prev[level] || 0, score) };
      saveWordsBest(updated);
      return updated;
    });

    setView({
      name: "results",
      mode: "words",
      level,
      score,
      wordResults: results,
      bestStreak,
      totalCount,
    });
  };

  const handleFinishSentencesRound = (
    score: number,
    results: SentenceResultItem[],
    bestStreak: number,
  ) => {
    if (view.name !== "play-sentences") return;
    const level = view.level;
    const totalCount = view.sentences.length;

    setSentencesBest((prev) => {
      const updated = { ...prev, [level]: Math.max(prev[level] || 0, score) };
      saveSentencesBest(updated);
      return updated;
    });

    setView({
      name: "results",
      mode: "sentences",
      level,
      score,
      sentenceResults: results,
      bestStreak,
      totalCount,
    });
  };

  return (
    <main className="relative min-h-dvh flex flex-col">
      <BackgroundBlobs theme="words" />

      {/* Global Header */}
      <AppHeader
        showHomeButton={true}
        gameTitle="ركّب الكلمة والجملة"
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {view.name === "home" && (
            <motion.div
              key="words-home"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col justify-center"
            >
              <WordsHomeScreen
                mode={mode}
                onModeChange={setMode}
                wordsBest={wordsBest}
                sentencesBest={sentencesBest}
                onSelectWordLevel={(lvl) => setSetupLevel(lvl)}
                onSelectSentenceLevel={(lvl) => setSetupLevel(lvl)}
              />
            </motion.div>
          )}

          {view.name === "loading" && (
            <motion.div
              key="words-loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center p-6 text-center my-auto"
            >
              <div className="glass rounded-3xl p-8 border border-border/60 shadow-xl flex flex-col items-center">
                {loadError ? (
                  <>
                    <span className="size-14 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center mb-4">
                      <AlertCircle className="size-8" />
                    </span>
                    <h3 className="text-lg font-bold text-foreground">حدث خطأ</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
                    <div className="mt-6 flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setView({ name: "home" })}
                        className="rounded-xl cursor-pointer"
                      >
                        العودة
                      </Button>
                      <Button
                        onClick={() => handleStartGame(view.mode, view.level, setupOptions)}
                        className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                      >
                        إعادة المحاولة
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Loader2 className="size-12 animate-spin text-violet-500 mb-4" />
                    <h3 className="text-lg font-bold text-foreground">
                      {view.mode === "words"
                        ? "جاري تجهيز الكلمات وتحديات الحروف..."
                        : "جاري تجهيز الجمل والأمثال البليغة..."}
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {view.mode === "words"
                        ? "نختار كلمات ذكية وفريدة تلائم مستواك"
                        : "نختار حكماً وعبارات مأثورة لاختبار مهاراتك اللغوية"}
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {view.name === "play-words" && (
            <motion.div
              key={`words-play-${view.words.length}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col"
            >
              <WordsPlayScreen
                level={view.level}
                words={view.words}
                onFinish={handleFinishWordsRound}
                onHome={() => setView({ name: "home" })}
              />
            </motion.div>
          )}

          {view.name === "play-sentences" && (
            <motion.div
              key={`sentences-play-${view.sentences.length}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col"
            >
              <SentencePlayScreen
                level={view.level}
                sentences={view.sentences}
                onFinish={handleFinishSentencesRound}
                onHome={() => setView({ name: "home" })}
              />
            </motion.div>
          )}

          {view.name === "results" && (
            <motion.div
              key={`words-results-${view.score}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col justify-center"
            >
              <WordsResultsScreen
                mode={view.mode}
                level={view.level}
                score={view.score}
                wordResults={view.wordResults}
                sentenceResults={view.sentenceResults}
                bestStreak={view.bestStreak}
                totalCount={view.totalCount}
                onReplay={() => handleStartGame(view.mode, view.level, setupOptions)}
                onHome={() => setView({ name: "home" })}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <AppFooter />

      {/* Setup Dialog */}
      {setupLevel && (
        <WordsSetupDialog
          open={Boolean(setupLevel)}
          onOpenChange={(open) => {
            if (!open) setSetupLevel(null);
          }}
          mode={mode}
          level={setupLevel}
          setupOptions={setupOptions}
          onStartGame={(opts) => handleStartGame(mode, setupLevel, opts)}
        />
      )}

      {/* AI Settings Dialog */}
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
