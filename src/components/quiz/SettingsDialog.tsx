import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Flame,
  HelpCircle,
  KeyRound,
  Layers,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { clearAllBanks, clearSeenHistory, getBankStats, type BankStats } from "@/lib/anti-repeat";
import { runBankFilling, type FillProgress, type FillTarget } from "@/lib/bank-filler";
import {
  fetchGeminiModels,
  fetchOpenRouterModels,
  getSensibleDefault,
  type ModelItem,
} from "@/lib/models";
import { type Settings } from "@/lib/quiz";
import { sound } from "@/lib/sound";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export function SettingsDialog({ open, onOpenChange, settings, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<"models" | "bank">("models");
  const [draft, setDraft] = useState<Settings>(settings);

  // Visibility states
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);

  // Model lists state
  const [geminiList, setGeminiList] = useState<ModelItem[]>([]);
  const [loadingGemini, setLoadingGemini] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [geminiSearch, setGeminiSearch] = useState("");
  const [manualGemini, setManualGemini] = useState("");

  const [openrouterList, setOpenrouterList] = useState<ModelItem[]>([]);
  const [loadingOpenrouter, setLoadingOpenrouter] = useState(false);
  const [openrouterError, setOpenrouterError] = useState<string | null>(null);
  const [openrouterSearch, setOpenrouterSearch] = useState("");
  const [manualOpenrouter, setManualOpenrouter] = useState("");
  const [freeOnlyOpenrouter, setFreeOnlyOpenrouter] = useState(false);

  // Content Bank Manager State
  const [bankStats, setBankStats] = useState<BankStats>(() => getBankStats());
  const [fillTarget, setFillTarget] = useState<FillTarget>("all");
  const [fillCount, setFillCount] = useState<number>(50);
  const [isFilling, setIsFilling] = useState(false);
  const [fillProgress, setFillProgress] = useState<FillProgress | null>(null);
  const cancelRef = useRef(false);

  const [confirmClearSeen, setConfirmClearSeen] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const refreshStats = () => {
    setBankStats(getBankStats());
  };

  // Resync draft and bank stats when dialog opens
  useEffect(() => {
    if (open) {
      setDraft({ ...settings });
      setGeminiError(null);
      setOpenrouterError(null);
      refreshStats();
      setConfirmClearSeen(false);
      setConfirmClearAll(false);
    }
  }, [open, settings]);

  // Load Gemini models
  const loadGemini = async (key: string, force = false) => {
    if (!key.trim()) {
      setGeminiList([]);
      setGeminiError(null);
      return;
    }
    setLoadingGemini(true);
    setGeminiError(null);
    try {
      const list = await fetchGeminiModels(key, force);
      setGeminiList(list);
      // Auto-select default if none selected
      if (draft.geminiModels.length === 0 && list.length > 0) {
        const def = getSensibleDefault("gemini", list);
        setDraft((d) => ({ ...d, geminiModels: [def] }));
      }
    } catch (err: unknown) {
      setGeminiError(err instanceof Error ? err.message : "تعذّر تحميل القائمة");
    } finally {
      setLoadingGemini(false);
    }
  };

  // Load OpenRouter models
  const loadOpenRouter = async (force = false) => {
    setLoadingOpenrouter(true);
    setOpenrouterError(null);
    try {
      const list = await fetchOpenRouterModels(force);
      setOpenrouterList(list);
      // Auto-select default if none selected and key exists
      if (draft.openrouterModels.length === 0 && list.length > 0 && draft.openrouterKey.trim()) {
        const def = getSensibleDefault("openrouter", list);
        setDraft((d) => ({ ...d, openrouterModels: [def] }));
      }
    } catch (err: unknown) {
      setOpenrouterError(err instanceof Error ? err.message : "تعذّر تحميل القائمة");
    } finally {
      setLoadingOpenrouter(false);
    }
  };

  // Trigger loads when dialog opens
  useEffect(() => {
    if (open) {
      if (draft.geminiKey.trim()) {
        void loadGemini(draft.geminiKey);
      }
      void loadOpenRouter();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleVolumeChange = (value: number[]) => {
    const val = value[0] ?? 80;
    setDraft((d) => ({ ...d, volume: val }));
  };

  const testSound = () => {
    sound.setVolume(draft.volume);
    sound.play("correct");
  };

  // Model selection toggles
  const toggleGeminiModel = (modelId: string) => {
    setDraft((d) => {
      const exists = d.geminiModels.includes(modelId);
      const updated = exists
        ? d.geminiModels.filter((id) => id !== modelId)
        : [...d.geminiModels, modelId];
      return { ...d, geminiModels: updated };
    });
  };

  const toggleOpenrouterModel = (modelId: string) => {
    setDraft((d) => {
      const exists = d.openrouterModels.includes(modelId);
      const updated = exists
        ? d.openrouterModels.filter((id) => id !== modelId)
        : [...d.openrouterModels, modelId];
      return { ...d, openrouterModels: updated };
    });
  };

  const addManualGemini = () => {
    const trimmed = manualGemini.trim();
    if (!trimmed) return;
    if (!draft.geminiModels.includes(trimmed)) {
      setDraft((d) => ({ ...d, geminiModels: [...d.geminiModels, trimmed] }));
    }
    setManualGemini("");
  };

  const addManualOpenrouter = () => {
    const trimmed = manualOpenrouter.trim();
    if (!trimmed) return;
    if (!draft.openrouterModels.includes(trimmed)) {
      setDraft((d) => ({ ...d, openrouterModels: [...d.openrouterModels, trimmed] }));
    }
    setManualOpenrouter("");
  };

  // Filtered Gemini models (limit ~100)
  const filteredGemini = useMemo(() => {
    const q = geminiSearch.trim().toLowerCase();
    const matches = geminiList.filter(
      (m) => m.id.toLowerCase().includes(q) || m.label.toLowerCase().includes(q),
    );
    return matches.slice(0, 100);
  }, [geminiList, geminiSearch]);

  // Filtered OpenRouter models (limit ~100)
  const filteredOpenrouter = useMemo(() => {
    const q = openrouterSearch.trim().toLowerCase();
    let matches = openrouterList;
    if (freeOnlyOpenrouter) {
      matches = matches.filter((m) => m.isFree);
    }
    if (q) {
      matches = matches.filter(
        (m) => m.id.toLowerCase().includes(q) || m.label.toLowerCase().includes(q),
      );
    }
    return matches.slice(0, 100);
  }, [openrouterList, openrouterSearch, freeOnlyOpenrouter]);

  const handleSave = () => {
    sound.setVolume(draft.volume);
    onSave(draft);
    toast.success("تم الحفظ بنجاح");
  };

  // Content Bank Actions
  const handleStartFill = async () => {
    if (!draft.geminiKey.trim() && !draft.openrouterKey.trim()) {
      toast.error("يرجى إدخال مفتاح API أولاً (Gemini أو OpenRouter) لبدء التعبئة.");
      return;
    }
    setIsFilling(true);
    cancelRef.current = false;
    setFillProgress({
      completed: 0,
      total: fillCount,
      currentTask: "جاري بدء التوليد والتعبئة...",
    });

    try {
      const res = await runBankFilling(
        draft,
        fillTarget,
        fillCount,
        (p) => setFillProgress(p),
        () => cancelRef.current,
      );
      refreshStats();
      if (res.error) {
        toast.error(res.error);
      } else if (cancelRef.current) {
        toast.info(`تم إيقاف التعبئة. تمت إضافة ${res.added} عنصراً إلى البنك.`);
      } else {
        toast.success(`تمت تعبئة البنك بنجاح بإضافة ${res.added} عنصراً جديداً! 🎉`);
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error("حدث خطأ أثناء تعبئة البنك.");
    } finally {
      setIsFilling(false);
      setFillProgress(null);
      refreshStats();
    }
  };

  const handleCancelFill = () => {
    cancelRef.current = true;
    toast.info("جاري إيقاف العملية بعد إنهاء الدفعة الحالية...");
  };

  const handleClearSeen = () => {
    clearSeenHistory();
    setConfirmClearSeen(false);
    refreshStats();
    toast.success("تم مسح سجل المشاهدة! أصبحت جميع عناصر البنك غير مشاهدة وجاهزة للعب.");
  };

  const handleClearAll = () => {
    clearAllBanks();
    clearSeenHistory();
    setConfirmClearAll(false);
    refreshStats();
    toast.success("تم مسح محتوى البنك بالكامل.");
  };

  const totalBankItems = bankStats.quiz.total + bankStats.words.total + bankStats.sentences.total;
  const totalUnseenItems =
    bankStats.quiz.unseen + bankStats.words.unseen + bankStats.sentences.unseen;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">الإعدادات وبنك المحتوى</DialogTitle>
          <DialogDescription>
            تخصيص نماذج الذكاء الاصطناعي، ومستوى الصوت، وإدارة بنك المحتوى التلقائي لمنع التكرار.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-border/70 pb-3 mt-2">
          <button
            type="button"
            onClick={() => setActiveTab("models")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === "models"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary/40",
            )}
          >
            <Sparkles className="size-4" />
            نماذج الذكاء والصوت
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("bank");
              refreshStats();
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all relative",
              activeTab === "bank"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary/40",
            )}
          >
            <Database className="size-4" />
            بنك المحتوى
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-mono font-bold",
                activeTab === "bank"
                  ? "bg-primary-foreground/20 text-inherit"
                  : "bg-secondary text-foreground",
              )}
            >
              {totalBankItems}
            </span>
          </button>
        </div>

        {activeTab === "models" ? (
          <div className="mt-4 space-y-6">
            {/* SECTION 1: Google AI Studio (Gemini) */}
            <div className="rounded-2xl border border-border/80 bg-secondary/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  <h3 className="font-bold text-base">Google AI Studio (Gemini)</h3>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {draft.geminiModels.length} نموذج محدد
                </span>
              </div>

              {/* Key input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">مفتاح API</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type={showGeminiKey ? "text" : "password"}
                      dir="ltr"
                      className="pe-9 font-mono text-sm"
                      placeholder="AIzaSy..."
                      value={draft.geminiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((d) => ({ ...d, geminiKey: val }));
                      }}
                      onBlur={() => {
                        if (draft.geminiKey.trim()) {
                          void loadGemini(draft.geminiKey);
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="إظهار/إخفاء المفتاح"
                    onClick={() => setShowGeminiKey((v) => !v)}
                  >
                    {showGeminiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="حذف المفتاح"
                    disabled={!draft.geminiKey}
                    onClick={() => {
                      setDraft((d) => ({ ...d, geminiKey: "", geminiModels: [] }));
                      setGeminiList([]);
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!draft.geminiKey.trim() || loadingGemini}
                    onClick={() => void loadGemini(draft.geminiKey, true)}
                    className="font-bold gap-1.5 shrink-0"
                  >
                    <RefreshCw className={`size-3.5 ${loadingGemini ? "animate-spin" : ""}`} />
                    تحديث القائمة
                  </Button>
                </div>
              </div>

              {geminiError && (
                <p className="flex items-center gap-1.5 text-xs text-destructive font-semibold">
                  <AlertCircle className="size-4" />
                  {geminiError}
                </p>
              )}

              {/* Model Selection Area */}
              {draft.geminiKey.trim() && (
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="ابحث في نماذج Gemini..."
                        value={geminiSearch}
                        onChange={(e) => setGeminiSearch(e.target.value)}
                        className="h-8 text-xs pe-8"
                      />
                    </div>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-border/60 bg-background/50 p-2">
                    {loadingGemini ? (
                      <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                        <RefreshCw className="size-3.5 animate-spin" />
                        جاري جلب النماذج المتاحة...
                      </div>
                    ) : filteredGemini.length === 0 ? (
                      <p className="text-center py-4 text-xs text-muted-foreground">
                        لا توجد نماذج مطابقة للبحث.
                      </p>
                    ) : (
                      filteredGemini.map((m) => {
                        const selected = draft.geminiModels.includes(m.id);
                        return (
                          <label
                            key={m.id}
                            className={`flex items-center justify-between gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                              selected
                                ? "bg-primary/10 text-primary font-bold"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleGeminiModel(m.id)}
                                className="size-3.5 rounded border-primary accent-primary"
                              />
                              <span className="truncate">{m.label}</span>
                            </div>
                            <span
                              className="text-[10px] font-mono text-muted-foreground shrink-0"
                              dir="ltr"
                            >
                              {m.id}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>

                  {/* Manual Model ID fallback */}
                  <div className="flex gap-2 pt-1">
                    <Input
                      placeholder="إضافة موديل يدويًا (مثال: gemini-2.5-flash)"
                      dir="ltr"
                      value={manualGemini}
                      onChange={(e) => setManualGemini(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addManualGemini}
                      disabled={!manualGemini.trim()}
                      className="h-8 text-xs font-bold gap-1 shrink-0"
                    >
                      <Plus className="size-3.5" /> إضافة
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: OpenRouter */}
            <div className="rounded-2xl border border-border/80 bg-secondary/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-accent" />
                  <h3 className="font-bold text-base">OpenRouter</h3>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent-foreground font-mono">
                  {draft.openrouterModels.length} محدد
                </span>
              </div>

              {/* Key input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">مفتاح API</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type={showOpenrouterKey ? "text" : "password"}
                      dir="ltr"
                      className="pe-9 font-mono text-sm"
                      placeholder="sk-or-v1-..."
                      value={draft.openrouterKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((d) => ({ ...d, openrouterKey: val }));
                      }}
                      onBlur={() => {
                        if (draft.openrouterKey.trim() && openrouterList.length === 0) {
                          void loadOpenRouter();
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="إظهار/إخفاء المفتاح"
                    onClick={() => setShowOpenrouterKey((v) => !v)}
                  >
                    {showOpenrouterKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="حذف المفتاح"
                    disabled={!draft.openrouterKey}
                    onClick={() => {
                      setDraft((d) => ({ ...d, openrouterKey: "", openrouterModels: [] }));
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingOpenrouter}
                    onClick={() => void loadOpenRouter(true)}
                    className="font-bold gap-1.5 shrink-0"
                  >
                    <RefreshCw className={`size-3.5 ${loadingOpenrouter ? "animate-spin" : ""}`} />
                    تحديث القائمة
                  </Button>
                </div>
              </div>

              {openrouterError && (
                <p className="flex items-center gap-1.5 text-xs text-destructive font-semibold">
                  <AlertCircle className="size-4" />
                  {openrouterError}
                </p>
              )}

              {/* Model Selection Area */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="ابحث في نماذج OpenRouter..."
                      value={openrouterSearch}
                      onChange={(e) => setOpenrouterSearch(e.target.value)}
                      className="h-8 text-xs pe-8"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none shrink-0 px-2 py-1 rounded-lg border border-border/80 bg-background/50">
                    <input
                      type="checkbox"
                      checked={freeOnlyOpenrouter}
                      onChange={(e) => setFreeOnlyOpenrouter(e.target.checked)}
                      className="size-3.5 rounded border-primary accent-primary"
                    />
                    مجاني فقط
                  </label>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-border/60 bg-background/50 p-2">
                  {loadingOpenrouter ? (
                    <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                      <RefreshCw className="size-3.5 animate-spin" />
                      جاري جلب نماذج OpenRouter...
                    </div>
                  ) : filteredOpenrouter.length === 0 ? (
                    <p className="text-center py-4 text-xs text-muted-foreground">
                      لا توجد نماذج مطابقة للبحث.
                    </p>
                  ) : (
                    filteredOpenrouter.map((m) => {
                      const selected = draft.openrouterModels.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center justify-between gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                            selected
                              ? "bg-accent/20 text-foreground font-bold"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleOpenrouterModel(m.id)}
                              className="size-3.5 rounded border-accent accent-accent"
                            />
                            <span className="truncate">{m.label}</span>
                            {m.isFree && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-easy/15 text-easy font-bold">
                                مجاني
                              </span>
                            )}
                          </div>
                          <span
                            className="text-[10px] font-mono text-muted-foreground shrink-0"
                            dir="ltr"
                          >
                            {m.id}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                {/* Manual Model ID fallback */}
                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="إضافة موديل يدويًا (مثال: meta-llama/llama-3.3-70b-instruct:free)"
                    dir="ltr"
                    value={manualOpenrouter}
                    onChange={(e) => setManualOpenrouter(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addManualOpenrouter}
                    disabled={!manualOpenrouter.trim()}
                    className="h-8 text-xs font-bold gap-1 shrink-0"
                  >
                    <Plus className="size-3.5" /> إضافة
                  </Button>
                </div>
              </div>
            </div>

            {/* SECTION 3: Volume Slider */}
            <div className="space-y-3 rounded-2xl bg-secondary/30 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="size-4 text-primary" />
                  <Label className="font-bold text-sm">مستوى المؤثرات الصوتية</Label>
                </div>
                <span className="text-xs font-bold text-primary">{draft.volume}%</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[draft.volume]}
                onValueChange={handleVolumeChange}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={testSound}
                  className="text-xs"
                >
                  تجربة الصوت 🔊
                </Button>
              </div>
            </div>

            {/* Last Used Model Transparency Line */}
            {draft.lastUsedModel && (
              <p className="text-xs text-muted-foreground text-center font-medium">
                آخر موديل استُخدم:{" "}
                <span className="font-bold text-foreground" dir="ltr">
                  {draft.lastUsedModel}
                </span>
              </p>
            )}

            <Button className="w-full text-base font-bold shadow-md" size="lg" onClick={handleSave}>
              حفظ التغييرات
            </Button>
          </div>
        ) : (
          /* ================= ACTIVE TAB: CONTENT BANK ================= */
          <div className="mt-4 space-y-6">
            {/* Explainer Banner */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
              <Database className="size-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs space-y-1 text-muted-foreground leading-relaxed">
                <p className="font-bold text-foreground text-sm">
                  نظام منع التكرار وبنك المحتوى المحلي الدائم
                </p>
                <p>
                  يتم حفظ الأسئلة والكلمات والجمل المُنشأة محلياً في متصفحك بمعرفات مشفّرة ومضادة
                  للتكرار. تُسجل المشاهدة فقط عندما يُعرض السؤال أو الكلمة على الشاشة، مما يضمن
                  تجربة لعب جديدة دائماً وبلا انتظار.
                </p>
              </div>
            </div>

            {/* Bank Stats Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Layers className="size-4 text-primary" />
                  إحصائيات بنك المحتوى الحالي
                </h3>
                <span className="text-xs font-semibold text-muted-foreground">
                  الإجمالي: <strong className="text-foreground">{totalBankItems}</strong> عنصر (
                  {totalUnseenItems} غير مشاهد)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Card 1: Quiz */}
                <div className="rounded-2xl border border-border/80 bg-secondary/20 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">تحدّي المعرفة</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                      {bankStats.quiz.unseen} غير مشاهد
                    </span>
                  </div>
                  <div className="text-2xl font-black text-foreground">
                    {bankStats.quiz.total}{" "}
                    <span className="text-xs font-normal text-muted-foreground">سؤال مخزن</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-1 border-t border-border/60 text-[11px] text-muted-foreground">
                    <div>
                      <span className="block text-easy font-bold">سهل</span>
                      {bankStats.quiz.byLevel.easy.unseen} / {bankStats.quiz.byLevel.easy.total}
                    </div>
                    <div>
                      <span className="block text-medium font-bold">متوسط</span>
                      {bankStats.quiz.byLevel.medium.unseen} / {bankStats.quiz.byLevel.medium.total}
                    </div>
                    <div>
                      <span className="block text-hard font-bold">صعب</span>
                      {bankStats.quiz.byLevel.hard.unseen} / {bankStats.quiz.byLevel.hard.total}
                    </div>
                  </div>
                </div>

                {/* Card 2: Words */}
                <div className="rounded-2xl border border-border/80 bg-secondary/20 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">ركّب الكلمة</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground font-bold">
                      {bankStats.words.unseen} غير مشاهد
                    </span>
                  </div>
                  <div className="text-2xl font-black text-foreground">
                    {bankStats.words.total}{" "}
                    <span className="text-xs font-normal text-muted-foreground">كلمة مخزنة</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-1 border-t border-border/60 text-[11px] text-muted-foreground">
                    <div>
                      <span className="block text-easy font-bold">سهل</span>
                      {bankStats.words.byLevel.easy.unseen} / {bankStats.words.byLevel.easy.total}
                    </div>
                    <div>
                      <span className="block text-medium font-bold">متوسط</span>
                      {bankStats.words.byLevel.medium.unseen} /{" "}
                      {bankStats.words.byLevel.medium.total}
                    </div>
                    <div>
                      <span className="block text-hard font-bold">صعب</span>
                      {bankStats.words.byLevel.hard.unseen} / {bankStats.words.byLevel.hard.total}
                    </div>
                  </div>
                </div>

                {/* Card 3: Sentences */}
                <div className="rounded-2xl border border-border/80 bg-secondary/20 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">ركّب الجملة</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-easy/20 text-easy font-bold">
                      {bankStats.sentences.unseen} غير مشاهد
                    </span>
                  </div>
                  <div className="text-2xl font-black text-foreground">
                    {bankStats.sentences.total}{" "}
                    <span className="text-xs font-normal text-muted-foreground">جملة مخزنة</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-1 border-t border-border/60 text-[11px] text-muted-foreground">
                    <div>
                      <span className="block text-easy font-bold">سهل</span>
                      {bankStats.sentences.byLevel.easy.unseen} /{" "}
                      {bankStats.sentences.byLevel.easy.total}
                    </div>
                    <div>
                      <span className="block text-medium font-bold">متوسط</span>
                      {bankStats.sentences.byLevel.medium.unseen} /{" "}
                      {bankStats.sentences.byLevel.medium.total}
                    </div>
                    <div>
                      <span className="block text-hard font-bold">صعب</span>
                      {bankStats.sentences.byLevel.hard.unseen} /{" "}
                      {bankStats.sentences.byLevel.hard.total}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filling Tool */}
            <div className="rounded-2xl border border-border/80 bg-secondary/20 p-4 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h3 className="font-bold text-base">
                    تعبئة البنك تلقائياً بواسطة الذكاء الاصطناعي
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  توليد دفعات متتالية من الأسئلة والكلمات والجمل عالية الجودة وتخزينها مسبقاً لبدء
                  فوري بدون انتظار.
                </p>
              </div>

              {!isFilling ? (
                <div className="space-y-3.5">
                  {/* Target Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">
                      نوع المحتوى المراد تعبئته
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "all", label: "الكل (توازن)" },
                        { id: "quiz", label: "تحدّي المعرفة" },
                        { id: "words", label: "ركّب الكلمة" },
                        { id: "sentences", label: "ركّب الجملة" },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setFillTarget(t.id as FillTarget)}
                          className={cn(
                            "py-2 px-3 rounded-xl text-xs font-bold transition-all border",
                            fillTarget === t.id
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "border-border/60 hover:bg-muted/60 text-muted-foreground",
                          )}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Count Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">
                      العدد المطلوب توليده
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[50, 100, 200].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setFillCount(c)}
                          className={cn(
                            "py-2 px-3 rounded-xl text-xs font-bold transition-all border",
                            fillCount === c
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "border-border/60 hover:bg-muted/60 text-muted-foreground",
                          )}
                        >
                          {c} عنصر
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={handleStartFill}
                    className="w-full font-bold gap-2 text-sm shadow-md"
                    size="lg"
                  >
                    <Sparkles className="size-4" />
                    بدء تعبئة البنك ({fillCount} عنصر)
                  </Button>
                </div>
              ) : (
                /* Active Filling Progress UI */
                <div className="space-y-3 p-4 rounded-xl border border-primary/30 bg-primary/5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-primary">
                      <RefreshCw className="size-3.5 animate-spin" />
                      جاري التعبئة في الخلفية...
                    </span>
                    <span className="font-mono text-foreground">
                      {fillProgress ? `${fillProgress.completed} / ${fillProgress.total}` : ""}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2.5 w-full rounded-full bg-secondary/80 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${
                          fillProgress
                            ? Math.min(
                                100,
                                Math.round((fillProgress.completed / fillProgress.total) * 100),
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    {fillProgress?.currentTask || "جاري التوليد..."}
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelFill}
                    className="w-full text-xs font-bold border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5"
                  >
                    <XCircle className="size-4" />
                    إلغاء التعبئة
                  </Button>
                </div>
              )}
            </div>

            {/* Maintenance & Reset Actions */}
            <div className="rounded-2xl border border-border/80 bg-secondary/20 p-4 space-y-4">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <RotateCcw className="size-4 text-muted-foreground" />
                خيارات الصيانة وإعادة التعيين
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Reset Seen History */}
                <div className="rounded-xl border border-border/60 p-3 bg-background/50 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h4 className="font-bold text-xs text-foreground">تصفير سجل المشاهدة</h4>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      يُعيد اعتبار جميع الأسئلة والكلمات كأنها جديدة لتلعب بها من جديد، مع الحفاظ
                      على كل المحتوى المخزن.
                    </p>
                  </div>

                  {!confirmClearSeen ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmClearSeen(true)}
                      className="w-full text-xs font-bold gap-1"
                    >
                      <RotateCcw className="size-3.5" />
                      تصفير سجل المشاهدة
                    </Button>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleClearSeen}
                        className="flex-1 text-xs font-bold"
                      >
                        تأكيد التصفير
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmClearSeen(false)}
                        className="text-xs"
                      >
                        إلغاء
                      </Button>
                    </div>
                  )}
                </div>

                {/* Clear Entire Bank */}
                <div className="rounded-xl border border-destructive/30 p-3 bg-destructive/5 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h4 className="font-bold text-xs text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5" />
                      مسح البنك بالكامل
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      حذف جميع الأسئلة والكلمات والجمل المخزنة محلياً في هذا المتصفح تماماً.
                    </p>
                  </div>

                  {!confirmClearAll ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmClearAll(true)}
                      className="w-full text-xs font-bold text-destructive border-destructive/40 hover:bg-destructive/10 gap-1"
                    >
                      <Trash2 className="size-3.5" />
                      مسح البنك بالكامل
                    </Button>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleClearAll}
                        className="flex-1 text-xs font-bold"
                      >
                        نعم، احذف كل شيء
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmClearAll(false)}
                        className="text-xs"
                      >
                        إلغاء
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
