import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Gamepad2, Lock, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/common/AppHeader";
import { AppFooter } from "@/components/common/AppFooter";
import { BackgroundBlobs } from "@/components/common/BackgroundBlobs";
import { SettingsDialog } from "@/components/quiz/SettingsDialog";
import { GAMES_REGISTRY, getGameBestScore, type GameDefinition } from "@/lib/games";
import { loadSettings, saveSettings, type Settings } from "@/lib/quiz";
import { sound } from "@/lib/sound";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ثقف نفسك — منصة ألعاب الذكاء والمعرفة" },
      {
        name: "description",
        content:
          "اختر لعبتك المفضلة من تحدّي المعرفة وركّب الكلمة وألغاز العقل التفاعلية باللغة العربية",
      },
    ],
  }),
  component: HubHomePage,
});

function HubHomePage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bestScores, setBestScores] = useState<Record<string, number | null>>({});

  useEffect(() => {
    setSettings(loadSettings());

    // Load best scores for registered games
    const scores: Record<string, number | null> = {};
    for (const game of GAMES_REGISTRY) {
      if (game.storageBestKey) {
        scores[game.id] = getGameBestScore(game.storageBestKey);
      }
    }
    setBestScores(scores);
  }, []);

  const saveSettingsAndClose = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
    setSettingsOpen(false);
  };

  return (
    <main className="relative min-h-dvh flex flex-col">
      <BackgroundBlobs theme="default" />

      {/* Header */}
      <AppHeader onOpenSettings={() => setSettingsOpen(true)} />

      {/* Main Hub Content */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col justify-center">
        {/* Hero Section */}
        <div className="text-center mb-10 sm:mb-14">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass border-primary/20 text-xs sm:text-sm font-semibold text-primary mb-4"
          >
            <Sparkles className="size-4" />
            <span>عالم التحديات والألغاز العربية</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground"
          >
            اختر لعبتك وابدأ التحدي
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="mt-3 text-base sm:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed"
          >
            منصة متكاملة للألعاب الفكرية والثقافية وألغاز الكلمات المصممة لإنعاش عقلك
          </motion.p>
        </div>

        {/* Responsive Games Grid (1 col on mobile, 2-3 on desktop) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {GAMES_REGISTRY.map((game: GameDefinition, idx: number) => {
            const isReady = game.status === "ready";
            const bestScore = bestScores[game.id];
            const Icon = game.icon;

            return (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.18 + idx * 0.06 }}
                className="h-full"
              >
                {isReady ? (
                  <div
                    className={`glass relative flex flex-col justify-between rounded-3xl p-6 h-full border transition-all duration-200 hover:-translate-y-1.5 shadow-sm hover:shadow-xl ${game.accentBorder} group`}
                  >
                    {/* Top card info */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div
                          className={`size-12 rounded-2xl flex items-center justify-center border transition-transform duration-200 group-hover:scale-110 ${game.accentBg}`}
                        >
                          <Icon className="size-6" />
                        </div>

                        {game.badge && (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {game.badge}
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl font-bold text-foreground mb-2">{game.title}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2">
                        {game.description}
                      </p>
                    </div>

                    {/* Bottom card actions */}
                    <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                      {bestScore !== null && bestScore !== undefined ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                          <Trophy className="size-3.5" />
                          <span>أعلى نتيجة: {bestScore}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 font-medium">
                          جاهز للتحدي
                        </span>
                      )}

                      <Link
                        to={game.route}
                        onClick={() => {
                          sound.unlock();
                          sound.playCardPress();
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-transform active:scale-95 shadow-md shadow-primary/20 cursor-pointer"
                      >
                        <span>العب الآن</span>
                        <ArrowLeft className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="glass relative flex flex-col justify-between rounded-3xl p-6 h-full border border-border/40 opacity-60 select-none cursor-not-allowed">
                    {/* Top card info */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="size-12 rounded-2xl flex items-center justify-center bg-muted/60 text-muted-foreground border border-border/40">
                          <Icon className="size-6" />
                        </div>

                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
                          <Lock className="size-3" />
                          <span>قريبًا</span>
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-foreground/80 mb-2">{game.title}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2">
                        {game.description}
                      </p>
                    </div>

                    {/* Bottom card status */}
                    <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground/60 font-medium">
                        قيد التطوير
                      </span>
                      <Button
                        disabled
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-xs gap-1 opacity-50 cursor-not-allowed"
                      >
                        <span>قريبًا</span>
                        <Lock className="size-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <AppFooter />

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
