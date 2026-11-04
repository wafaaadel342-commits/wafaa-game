import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Gamepad2,
  Home,
  Moon,
  Settings as SettingsIcon,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { sound } from "@/lib/sound";
import { THEME_KEY } from "@/lib/quiz";

interface AppHeaderProps {
  onOpenSettings?: () => void;
  showHomeButton?: boolean;
  gameTitle?: string;
}

export function AppHeader({ onOpenSettings, showHomeButton = false, gameTitle }: AppHeaderProps) {
  const [dark, setDark] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const isDark = typeof window !== "undefined" && localStorage.getItem(THEME_KEY) === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    setMuted(sound.isMuted());

    // Auto unlock on first interaction
    const unlockAudio = () => {
      sound.unlock();
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const toggleTheme = () => {
    sound.unlock();
    sound.playClick();
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      // ignore
    }
  };

  const toggleSound = () => {
    sound.unlock();
    const nextMuted = sound.toggleMute();
    setMuted(nextMuted);
    if (!nextMuted) {
      sound.playClick();
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full px-4 py-3 border-b border-border/40 backdrop-blur-md bg-background/70">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Logo & App Name */}
        <div className="flex items-center gap-3">
          {showHomeButton && (
            <Link
              to="/"
              aria-label="العودة للملعب الرئيسي"
              onClick={() => {
                sound.unlock();
                sound.playSwoosh();
              }}
              className="inline-flex items-center justify-center size-9 rounded-full glass hover:bg-accent/80 transition-transform active:scale-95 text-foreground cursor-pointer"
            >
              <Home className="size-4" />
            </Link>
          )}

          <Link
            to="/"
            onClick={() => {
              sound.unlock();
              sound.playClick();
            }}
            className="flex items-center gap-2 group cursor-pointer"
          >
            <div className="size-9 rounded-xl bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20 transition-transform group-hover:scale-105">
              <Gamepad2 className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                ثقف نفسك
              </span>
              {gameTitle && (
                <span className="text-xs font-medium text-muted-foreground -mt-1">{gameTitle}</span>
              )}
            </div>
          </Link>
        </div>

        {/* Global Controls: Sound, Theme, AI Settings */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {onOpenSettings && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="إعدادات الذكاء الاصطناعي"
              onClick={() => {
                sound.unlock();
                sound.playClick();
                onOpenSettings();
              }}
              className="glass size-9 rounded-full cursor-pointer hover:bg-accent/80 transition-transform active:scale-95"
            >
              <SettingsIcon className="size-4.5 text-foreground" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
            onClick={toggleSound}
            className={`glass size-9 rounded-full cursor-pointer hover:bg-accent/80 transition-transform active:scale-95 ${
              muted ? "text-muted-foreground opacity-70" : "text-primary"
            }`}
          >
            {muted ? <VolumeX className="size-4.5" /> : <Volume2 className="size-4.5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label={dark ? "الوضع النهاري" : "الوضع الليلي"}
            onClick={toggleTheme}
            className="glass size-9 rounded-full cursor-pointer hover:bg-accent/80 transition-transform active:scale-95"
          >
            {dark ? (
              <Sun className="size-4.5 text-amber-400" />
            ) : (
              <Moon className="size-4.5 text-foreground" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
