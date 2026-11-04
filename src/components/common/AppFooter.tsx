import { Heart, Sparkles, BookOpen } from "lucide-react";

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full mt-auto border-t border-border/40 backdrop-blur-md bg-background/70 text-foreground transition-colors">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col items-center gap-4 text-center">
        {/* Special Dedication Badge */}
        <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-2xl sm:rounded-full glass border border-rose-500/25 bg-gradient-to-r from-rose-500/10 via-background to-rose-500/10 shadow-sm text-xs sm:text-sm font-medium leading-relaxed max-w-2xl">
          <Heart className="size-4 text-rose-500 fill-rose-500 animate-pulse shrink-0" />
          <span className="text-muted-foreground">
            تم التصميم بواسطة{" "}
            <strong className="font-bold text-foreground underline decoration-rose-500/40 underline-offset-4">
              اسلام زايد
            </strong>{" "}
            ك هدية لحبيبتوا{" "}
            <strong className="font-bold text-rose-600 dark:text-rose-400">وفاء عادل</strong> بشكل
            احترافي ومميز
          </span>
          <Sparkles className="size-4 text-amber-400 shrink-0" />
        </div>

        {/* Site Branding & Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between w-full pt-3 border-t border-border/20 text-xs text-muted-foreground gap-2">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <BookOpen className="size-3" />
            </div>
            <span className="font-semibold text-foreground/80">ثقف نفسك</span>
            <span>—</span>
            <span>منصة ألعاب العقل والمعرفة العربية</span>
          </div>

          <div className="flex items-center gap-3">
            <span>جميع الحقوق محفوظة © {currentYear}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
