import type { LucideIcon } from "lucide-react";
import { Brain, SpellCheck, Quote, HelpCircle, Layers, CheckCircle2 } from "lucide-react";

export interface GameDefinition {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  gradient: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  route: string;
  status: "ready" | "soon";
  storageBestKey?: string;
}

export const GAMES_REGISTRY: GameDefinition[] = [
  {
    id: "quiz",
    title: "تحدّي المعرفة",
    description: "اختبر معلوماتك العامة، عواصم العالم، أعلام الدول، والشخصيات التاريخية والمعالم",
    icon: Brain,
    badge: "مكتمل",
    gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
    accentBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    accentText: "text-emerald-600 dark:text-emerald-400",
    accentBorder: "hover:border-emerald-500/50 hover:shadow-emerald-500/10",
    route: "/quiz",
    status: "ready",
    storageBestKey: "tahaddi-best",
  },
  {
    id: "words",
    title: "ركّب الكلمة والجملة",
    description:
      "رتّب الحروف المبعثرة واجمع الكلمات والجمل العربية من خلال تلميحات ذكية وتحدي الوقت",
    icon: SpellCheck,
    badge: "جديد",
    gradient: "from-violet-500/20 via-amber-500/10 to-transparent",
    accentBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
    accentText: "text-violet-600 dark:text-violet-400",
    accentBorder: "hover:border-violet-500/50 hover:shadow-violet-500/10",
    route: "/words",
    status: "ready",
    storageBestKey: "rakeb-best",
  },
  {
    id: "proverbs",
    title: "أكمل المثل",
    description: "أكمل الأمثال الشعبية والعربية الشهيرة واختبر حفظك للحكمة والتراث",
    icon: Quote,
    gradient: "from-amber-500/15 via-orange-500/5 to-transparent",
    accentBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    accentText: "text-amber-600 dark:text-amber-400",
    accentBorder: "border-border/60",
    route: "#",
    status: "soon",
  },
  {
    id: "guess-word",
    title: "خمّن الكلمة",
    description: "خمّن الكلمة المخفية في ٦ محاولات مع إشارات لونية للحروف الصحيحة",
    icon: HelpCircle,
    gradient: "from-blue-500/15 via-indigo-500/5 to-transparent",
    accentBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    accentText: "text-blue-600 dark:text-blue-400",
    accentBorder: "border-border/60",
    route: "#",
    status: "soon",
  },
  {
    id: "memory-cards",
    title: "ذاكرة الكروت",
    description: "اقلب الكروت وطابق الأزواج المتشابهة بأقل عدد من الحركات",
    icon: Layers,
    gradient: "from-fuchsia-500/15 via-pink-500/5 to-transparent",
    accentBg: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30",
    accentText: "text-fuchsia-600 dark:text-fuchsia-400",
    accentBorder: "border-border/60",
    route: "#",
    status: "soon",
  },
  {
    id: "true-or-false",
    title: "صح أم خطأ",
    description: "جولات سريعة ضد الوقت لتقييم صحة المعلومات والحقائق العلمية",
    icon: CheckCircle2,
    gradient: "from-rose-500/15 via-red-500/5 to-transparent",
    accentBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    accentText: "text-rose-600 dark:text-rose-400",
    accentBorder: "border-border/60",
    route: "#",
    status: "soon",
  },
];

/** Retrieve highest best score recorded for a game */
export function getGameBestScore(bestKey?: string): number | null {
  if (!bestKey || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(bestKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, number>;
    const values = Object.values(parsed).filter((v) => typeof v === "number");
    if (values.length === 0) return null;
    const max = Math.max(...values);
    return max > 0 ? max : null;
  } catch {
    return null;
  }
}
