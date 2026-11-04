import { useState } from "react";
import { Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { sound } from "@/lib/sound";
import {
  SENTENCE_LEVELS,
  WORD_LEVELS,
  type GameSubMode,
  type SentenceLevel,
  type WordLevel,
  type WordsSetupOptions,
} from "@/lib/words";

interface WordsSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: GameSubMode;
  level: WordLevel | SentenceLevel;
  setupOptions: WordsSetupOptions;
  onStartGame: (options: WordsSetupOptions) => void;
}

const COUNT_OPTIONS: Array<5 | 10 | 15> = [5, 10, 15];

export function WordsSetupDialog({
  open,
  onOpenChange,
  mode,
  level,
  setupOptions,
  onStartGame,
}: WordsSetupDialogProps) {
  const [count, setCount] = useState<5 | 10 | 15>(setupOptions.wordCount);
  const isWords = mode === "words";
  const wordInfo = isWords ? WORD_LEVELS[level as WordLevel] : null;
  const sentenceInfo = !isWords ? SENTENCE_LEVELS[level as SentenceLevel] : null;

  const handleStart = () => {
    sound.unlock();
    sound.playClick();
    onStartGame({ wordCount: count });
  };

  const levelLabel = wordInfo?.label || sentenceInfo?.label || "";
  const points = wordInfo?.points || sentenceInfo?.points || 10;
  const rangeLabel = wordInfo
    ? wordInfo.letterRange[0] === wordInfo.letterRange[1]
      ? `${wordInfo.letterRange[0]} أحرف`
      : `${wordInfo.letterRange[0]}-${wordInfo.letterRange[1]} أحرف`
    : sentenceInfo
      ? `${sentenceInfo.wordRange[0]}-${sentenceInfo.wordRange[1]} كلمات`
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/60 bg-card/95 backdrop-blur-xl">
        <DialogHeader className="text-right">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-violet-500/15 text-violet-600 dark:text-violet-400">
              المستوى: {levelLabel}
            </span>
            <span className="text-xs text-muted-foreground">
              ({rangeLabel} • {points} نقطة لكل {isWords ? "كلمة" : "جملة"})
            </span>
          </div>
          <DialogTitle className="text-xl font-bold">
            {isWords ? "إعداد جولة ركّب الكلمة" : "إعداد جولة ركّب الجملة"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {isWords
              ? "اختر عدد الكلمات التي ترغب في حلّها خلال هذا التحدي."
              : "اختر عدد الجمل التي ترغب في تركيبها خلال هذا التحدي."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground block">
              {isWords ? "عدد الكلمات" : "عدد الجمل"}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {COUNT_OPTIONS.map((c) => {
                const isSelected = count === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      sound.unlock();
                      sound.playClick();
                      setCount(c);
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/25 scale-[1.02]"
                        : "bg-muted/40 hover:bg-muted text-foreground border-border/60"
                    }`}
                  >
                    {c} {isWords ? "كلمات" : "جمل"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleStart}
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold gap-2 cursor-pointer shadow-md shadow-violet-500/20"
          >
            <Play className="size-4 fill-white" />
            <span>ابدأ التحدي</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
