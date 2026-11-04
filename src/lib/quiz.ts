import { z } from "zod";
import { cyrb53, normalizeArabic } from "./anti-repeat";

export type Level = "easy" | "medium" | "hard";
export type Provider = "gemini" | "openrouter";

export type CategoryKey =
  | "capitals"
  | "flags"
  | "quotes"
  | "historical_figures"
  | "cartoons"
  | "football_players"
  | "landmarks"
  | "aerial_city"
  | "general_knowledge";

export interface CategoryInfo {
  key: CategoryKey;
  label: string;
  hasImage: boolean;
  description: string;
}

export const CATEGORIES: Record<CategoryKey, CategoryInfo> = {
  capitals: {
    key: "capitals",
    label: "عواصم الدول",
    hasImage: false,
    description: "أسئلة نصية عن عواصم العالم",
  },
  flags: {
    key: "flags",
    label: "أعلام الدول",
    hasImage: true,
    description: "صورة علم وتخمين الدولة",
  },
  quotes: {
    key: "quotes",
    label: "أقوال مأثورة",
    hasImage: false,
    description: "من قائل العبارة من الحكماء والأدباء",
  },
  historical_figures: {
    key: "historical_figures",
    label: "شخصيات تاريخية",
    hasImage: true,
    description: "صورة شخصية تاريخية بارزة وتخمينها",
  },
  cartoons: {
    key: "cartoons",
    label: "شخصيات كرتونية",
    hasImage: true,
    description: "صورة شخصية كرتونية شهيرة وتخمينها",
  },
  football_players: {
    key: "football_players",
    label: "لاعبو كرة القدم",
    hasImage: true,
    description: "صورة لاعب كرة قدم وتخمينه",
  },
  landmarks: {
    key: "landmarks",
    label: "معالم مشهورة",
    hasImage: true,
    description: "صورة معلم تاريخي أو سياحي وتخمينه",
  },
  aerial_city: {
    key: "aerial_city",
    label: "مدينة من الأعلى",
    hasImage: true,
    description: "صورة جوية للمدينة وتخمين اسمها",
  },
  general_knowledge: {
    key: "general_knowledge",
    label: "ثقافة عامة",
    hasImage: false,
    description: "تاريخ، جغرافيا، علوم، أدب، وتكنولوجيا",
  },
};

export const ALL_CATEGORY_KEYS: CategoryKey[] = [
  "capitals",
  "flags",
  "quotes",
  "historical_figures",
  "cartoons",
  "football_players",
  "landmarks",
  "aerial_city",
  "general_knowledge",
];

export interface Question {
  category: CategoryKey | string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  imageQuery?: string | undefined;
  countryCode?: string | undefined;
  topicKey?: string | undefined;
  imageUrl?: string | undefined;
}

export function getQuestionDedupeKey(q: {
  category: string;
  question: string;
  countryCode?: string | undefined;
  imageQuery?: string | undefined;
  topicKey?: string | undefined;
}): string {
  const cat = q.category;
  if (cat === "flags" && q.countryCode) {
    return `flag:${q.countryCode.trim().toLowerCase()}`;
  }
  if (
    q.imageQuery &&
    ["historical_figures", "cartoons", "football_players", "landmarks", "aerial_city"].includes(cat)
  ) {
    return `img:${cat}:${q.imageQuery.trim().toLowerCase()}`;
  }
  if (q.topicKey) {
    return `topic:${cat}:${q.topicKey.trim().toLowerCase()}`;
  }
  // Fallback: cyrb53 hash of normalized question
  return `q:${cyrb53(normalizeArabic(q.question))}`;
}

export interface Missed {
  question: string;
  correct: string;
  chosen?: string | undefined;
  category: string;
}

export interface Settings {
  geminiKey: string;
  geminiModels: string[];
  openrouterKey: string;
  openrouterModels: string[];
  volume: number;
  muted: boolean;
  lastUsedModel?: string | undefined;
}

export interface QuizSetupOptions {
  questionCount: 10 | 15 | 20;
  categories: CategoryKey[];
}

export class QuizError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export const LEVELS: Record<Level, { label: string; description: string; points: number }> = {
  easy: { label: "سهل", description: "معلومات ومعالم شائعة ومشهورة", points: 10 },
  medium: { label: "متوسط", description: "يتطلب ثقافة عامة ومعرفة جيدة", points: 15 },
  hard: { label: "صعب", description: "أسئلة دقيقة وتفاصيل للمحترفين", points: 20 },
};

export const ERROR_MESSAGES: Record<string, string> = {
  MISSING_KEY: "أدخل مفتاح API في الإعدادات أولاً للبدء.",
  BAD_KEY: "المفتاح غير صالح أو تم رفض الطلب، تحقق من المفاتيح والنماذج في الإعدادات.",
  RATE_LIMIT: "تم تجاوز الحد المسموح من الطلبات، انتظر قليلاً ثم أعد المحاولة.",
  NETWORK: "تعذر الاتصال بالشبكة، تحقق من اتصالك بالإنترنت.",
  INVALID_RESPONSE: "استجابة غير صالحة من مزود الذكاء الاصطناعي، أعد المحاولة.",
  NO_KEY: "أضف مفتاح API من الإعدادات للبدء.",
  CONFIG: "تحقق من إعدادات المفتاح والنماذج المحددة.",
  SERVER: "فشلت جميع النماذج المحددة في توليد الأسئلة، تحقق من الإعدادات وأعد المحاولة.",
};

// ---------- Arabic Country Name Safety Net ----------

let regionNamesAr: Intl.DisplayNames | null = null;
try {
  regionNamesAr = new Intl.DisplayNames(["ar"], { type: "region" });
} catch {
  regionNamesAr = null;
}

/** Converts any 2-letter country code to standard Arabic country name. */
export function formatArabicOption(text: string): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (/^[a-zA-Z]{2}$/.test(trimmed)) {
    try {
      const arabic = regionNamesAr?.of(trimmed.toUpperCase());
      if (arabic) return arabic;
    } catch {
      // ignore
    }
  }
  return trimmed;
}

export function sanitizeQuestion(q: Question): Question {
  const sanitizedOptions = q.options.map(formatArabicOption);
  return {
    ...q,
    options: sanitizedOptions,
    explanation: q.explanation || "",
  };
}

// ---------- Local storage (settings, setup, best scores, theme) ----------

const SETTINGS_KEY = "tahaddi-settings";
const SETUP_KEY = "tahaddi-setup";
const BEST_KEY = "tahaddi-best";
export const THEME_KEY = "tahaddi-theme";

export const DEFAULT_SETTINGS: Settings = {
  geminiKey: "",
  geminiModels: ["gemini-2.5-flash"],
  openrouterKey: "",
  openrouterModels: [],
  volume: 80,
  muted: false,
};

export const DEFAULT_SETUP_OPTIONS: QuizSetupOptions = {
  questionCount: 10,
  categories: ALL_CATEGORY_KEYS,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const geminiKey = typeof parsed["geminiKey"] === "string" ? parsed["geminiKey"] : "";
    let geminiModels: string[] = Array.isArray(parsed["geminiModels"])
      ? (parsed["geminiModels"] as string[])
      : [];
    if (
      geminiModels.length === 0 &&
      typeof parsed["geminiModel"] === "string" &&
      parsed["geminiModel"]
    ) {
      geminiModels = [parsed["geminiModel"]];
    }
    if (geminiModels.length === 0 && geminiKey) {
      geminiModels = ["gemini-2.5-flash"];
    }

    const openrouterKey =
      typeof parsed["openrouterKey"] === "string" ? parsed["openrouterKey"] : "";
    let openrouterModels: string[] = Array.isArray(parsed["openrouterModels"])
      ? (parsed["openrouterModels"] as string[])
      : [];
    if (
      openrouterModels.length === 0 &&
      typeof parsed["openrouterModel"] === "string" &&
      parsed["openrouterModel"]
    ) {
      openrouterModels = [parsed["openrouterModel"]];
    }

    const volume = typeof parsed["volume"] === "number" ? parsed["volume"] : 80;
    const muted = typeof parsed["muted"] === "boolean" ? parsed["muted"] : false;
    const lastUsedModel =
      typeof parsed["lastUsedModel"] === "string" ? parsed["lastUsedModel"] : undefined;

    return {
      geminiKey,
      geminiModels,
      openrouterKey,
      openrouterModels,
      volume,
      muted,
      lastUsedModel,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function hasAnyKey(s: Settings): boolean {
  return Boolean(s.geminiKey.trim()) || Boolean(s.openrouterKey.trim());
}

export const hasActiveKey = hasAnyKey;

export function loadSetupOptions(): QuizSetupOptions {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (!raw) return DEFAULT_SETUP_OPTIONS;
    const parsed = JSON.parse(raw) as Partial<QuizSetupOptions>;
    const count = [10, 15, 20].includes(parsed.questionCount as number)
      ? (parsed.questionCount as 10 | 15 | 20)
      : 10;
    const categories =
      Array.isArray(parsed.categories) && parsed.categories.length > 0
        ? parsed.categories.filter((c): c is CategoryKey =>
            ALL_CATEGORY_KEYS.includes(c as CategoryKey),
          )
        : ALL_CATEGORY_KEYS;
    return {
      questionCount: count,
      categories: categories.length > 0 ? categories : ALL_CATEGORY_KEYS,
    };
  } catch {
    return DEFAULT_SETUP_OPTIONS;
  }
}

export function saveSetupOptions(opt: QuizSetupOptions) {
  localStorage.setItem(SETUP_KEY, JSON.stringify(opt));
}

export type Best = Record<Level, number>;

export function loadBest(): Best {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (raw) return { easy: 0, medium: 0, hard: 0, ...(JSON.parse(raw) as Partial<Best>) };
  } catch {
    /* ignore */
  }
  return { easy: 0, medium: 0, hard: 0 };
}

export function saveBest(best: Best) {
  localStorage.setItem(BEST_KEY, JSON.stringify(best));
}

// ---------- Session memory of recent questions ----------

let recentQuestions: string[] = [];

export function getRecent(): string[] {
  return recentQuestions;
}

export function rememberQuestions(qs: Question[]) {
  recentQuestions = [...recentQuestions, ...qs.map((q) => q.question)].slice(-30);
}

export const FOCUS_SUBTOPICS: Record<CategoryKey, string[]> = {
  capitals: [
    "capital-east-africa",
    "capital-west-africa",
    "capital-north-africa",
    "capital-south-america",
    "capital-central-america",
    "capital-caribbean",
    "capital-scandinavia",
    "capital-balkans",
    "capital-central-europe",
    "capital-caucasus",
    "capital-central-asia",
    "capital-southeast-asia",
    "capital-east-asia",
    "capital-oceania",
    "capital-middle-east",
  ],
  flags: [
    "flag-african-island",
    "flag-south-american",
    "flag-oceania-polynesia",
    "flag-nordic-cross",
    "flag-caribbean",
    "flag-central-asia",
    "flag-southeast-asia",
    "flag-balkan-nation",
    "flag-arab-world",
    "flag-west-africa",
  ],
  quotes: [
    "quote-andalusian-poetry",
    "quote-islamic-golden-age",
    "quote-ancient-greek-philosopher",
    "quote-arab-nahda-enlightenment",
    "quote-sufi-mystic",
    "quote-modern-arabic-poet",
    "quote-stoic-philosophy",
    "quote-persian-wisdom",
    "quote-world-nobel-literature",
  ],
  historical_figures: [
    "hist-muslim-scientist",
    "hist-world-explorer",
    "hist-ancient-egyptian-pharaoh",
    "hist-babylonian-mesopotamian",
    "hist-islamic-golden-age-scholar",
    "hist-renaissance-polymath",
    "hist-resistance-leader",
    "hist-ancient-philosopher",
    "hist-astronomer-mathematician",
  ],
  cartoons: [
    "toon-classic-anime-mecha",
    "toon-90s-arab-dubbed-classic",
    "toon-disney-golden-age",
    "toon-pixar-icon",
    "toon-studio-ghibli-figure",
    "toon-classic-cartoon-rivalry",
    "toon-mystery-detective-anime",
    "toon-adventure-fantasy",
  ],
  football_players: [
    "football-legend-20th-century",
    "football-african-legend",
    "football-modern-asian-star",
    "football-arab-champion",
    "football-south-american-icon",
    "football-historic-goalkeeper",
    "football-playmaker-midfielder",
    "football-golden-boot-winner",
  ],
  landmarks: [
    "landmark-ancient-wonder",
    "landmark-islamic-architectural-gem",
    "landmark-asian-temple-complex",
    "landmark-european-cathedral-castle",
    "landmark-natural-wonder-canyon-falls",
    "landmark-modern-engineering-marvel",
    "landmark-mesoamerican-pyramid",
    "landmark-rock-cut-architecture",
  ],
  aerial_city: [
    "aerial-island-capital",
    "aerial-historic-canal-city",
    "aerial-desert-megacity",
    "aerial-mountain-valley-capital",
    "aerial-coastal-harbor-city",
    "aerial-ancient-walled-metropolis",
  ],
  general_knowledge: [
    "gk-astronomy-exoplanets-stars",
    "gk-human-anatomy-brain",
    "gk-oceanography-deep-sea",
    "gk-ancient-civilizations",
    "gk-physics-quantum-light",
    "gk-chemistry-elements-reaction",
    "gk-world-geography-straits-rivers",
    "gk-inventions-industrial-revolution",
    "gk-biology-flora-fauna",
  ],
};

// ---------- Prompt ----------

export function buildPrompt(
  level: Level,
  countToGenerate: number,
  categories: CategoryKey[],
  recent: string[],
  avoidQuestions: string[] = [],
): string {
  const levelLabels: Record<Level, string> = {
    easy: "سهل (أشهر الأشياء والمعلومات الشائعة جداً والواضحة للجميع)",
    medium: "متوسط (معلومات معروفة لكن تتطلب ثقافة عامة جيدة)",
    hard: "صعب (أشياء دقيقة وغير بديهية للمحترفين)",
  };

  const catGuidelines = categories
    .map((c) => {
      switch (c) {
        case "capitals":
          return `- عواصم الدول ("capitals"): سؤال نصي مثل: "ما هي عاصمة دولة كذا؟". الخيارات 4 عواصم مدن باللغة العربية. بدون صور. topicKey: اسم الدولة أو العاصمة بالإنجليزية slug (مثال: "capital-spain").`;
        case "flags":
          return `- أعلام الدول ("flags"): سؤال عن علم دولة مثل: "علم أي دولة هذا؟". الخيارات الأربعة يجب أن تكون أسماء الدول باللغة العربية الفصحى حصراً (مثال: روسيا، إسبانيا، إيطاليا، البرتغال). يُمنع منعاً باتاً كتابة رموز حروف مثل ru أو es أو it كخيارات. وضع رمز الدولة المكون من حرفين صغيرين فقط في خاصية countryCode بنظام ISO 3166-1 alpha-2 lowercase لجلب صورة العلم (مثال: "sa", "eg", "fr", "es", "ru"). لا تضع imageQuery.`;
        case "quotes":
          return `- أقوال مأثورة ("quotes"): "من قائل هذه العبارة: '...'؟" لأقوال مشهورة وموثقة يقيناً لحكماء وأدباء وفلاسفة وعلماء قدامى. الخيارات 4 أسماء شخصيات فكرية باللغة العربية. بدون صور. topicKey: اسم القائل بالإنجليزية (مثال: "al-mutanabbi").`;
        case "historical_figures":
          return `- شخصيات تاريخية ("historical_figures"): سؤال للتعرف على صورة شخصية تاريخية مثل: "من صاحب هذه الصورة؟". الخيارات 4 شخصيات تاريخية باللغة العربية (مثال: "صلاح الدين الأيوبي"، "نابليون بونابرت"). imageQuery: الاسم الدقيق لمقالة ويكيبيديا الإنجليزية فقط (مثال: "Saladin", "Napoleon", "Ibn Battuta"). topicKey: اسم الشخصية بالإنجليزية.`;
        case "cartoons":
          return `- شخصيات كرتونية ("cartoons"): سؤال للتعرف على صورة شخصية كرتونية مثل: "ما اسم هذه الشخصية الكرتونية؟". الخيارات 4 شخصيات كرتونية باللغة العربية (مثال: "ميكي ماوس"، "المحقق كونان"، "توم وجيري"). imageQuery: الاسم الدقيق لمقالة ويكيبيديا الإنجليزية فقط (مثال: "Mickey Mouse", "Conan Edogawa", "Tom Cat"). topicKey: اسم الشخصية بالإنجليزية.`;
        case "football_players":
          return `- لاعبو كرة القدم ("football_players"): سؤال للتعرف على صورة لاعب كرة قدم مثل: "من هذا اللاعب؟". الخيارات 4 لاعبين باللغة العربية (مثال: "ليونيل ميسي"، "محمد صلاح"، "كريستيانو رونالدو"). imageQuery: الاسم الدقيق لمقالة ويكيبيديا الإنجليزية فقط (مثال: "Lionel Messi", "Mohamed Salah", "Cristiano Ronaldo"). topicKey: اسم اللاعب بالإنجليزية.`;
        case "landmarks":
          return `- معالم مشهورة ("landmarks"): سؤال للتعرف على معلم مشهور مثل: "ما هذا المعلم الشهير؟". الخيارات 4 معالم باللغة العربية (مثال: "برج إيفل"، "أهرامات الجيزة"، "الكولوسيوم"). imageQuery: الاسم الدقيق لمقالة ويكيبيديا الإنجليزية فقط (مثال: "Eiffel Tower", "Great Pyramid of Giza", "Colosseum"). topicKey: اسم المعلم بالإنجليزية.`;
        case "aerial_city":
          return `- مدينة من الأعلى ("aerial_city"): سؤال للتعرف على مدينة من صورة جوية مثل: "أي مدينة تظهر في هذه الصورة الجوية؟". الخيارات 4 مدن باللغة العربية. imageQuery: اسم المدينة متبوعاً بـ aerial view بالإنجليزية (مثال: "Dubai aerial view", "Paris aerial view", "Cairo aerial view"). topicKey: اسم المدينة بالإنجليزية.`;
        case "general_knowledge":
          return `- ثقافة عامة ("general_knowledge"): سؤال نصي متعدد الخيارات في التاريخ أو الجغرافيا أو العلوم أو الأدب أو الرياضة أو التكنولوجيا. خيارات متجانسة باللغة العربية. بدون صور. topicKey: موضوع السؤال slug (مثال: "gk-photosynthesis").`;
      }
    })
    .join("\n");

  // Generate varied sub-topic assignments
  const assignments: string[] = [];
  const catPool = categories.length > 0 ? categories : ALL_CATEGORY_KEYS;
  for (let i = 0; i < countToGenerate; i++) {
    const cat = catPool[i % catPool.length]!;
    const subList = FOCUS_SUBTOPICS[cat] || [];
    const subTopic = subList.length > 0 ? subList[Math.floor(Math.random() * subList.length)] : cat;
    assignments.push(`- السؤال ${i + 1}: تصنيف "${cat}" بتوجيه فرعي: "${subTopic}"`);
  }

  const allToAvoid = Array.from(new Set([...recent, ...avoidQuestions])).slice(-80);

  return `أنت مولّد أسئلة مسابقات ثقافية عربية فصحى عالي الدقة والتنوع والاحتراف.
المطلوب إنشاء بالضبط ${countToGenerate} سؤالاً بمستوى صعوبة "${levelLabels[level]}".

التوجيهات الموزعة للأسئلة المطلوبة (التزم بهذا التوزيع التنوعي):
${assignments.join("\n")}

إرشادات التصنيفات:
${catGuidelines}

قواعد صارمة جداً (يجب الالتزام التام بها):
1. أعد كائن JSON صالح فقط بالشكل التالي تماماً:
{
  "questions": [
    {
      "category": "مفتاح التصنيف بالإنجليزية (capitals, flags, quotes, historical_figures, cartoons, football_players, landmarks, aerial_city, general_knowledge)",
      "topicKey": "slug إنجليزي فريد ومحدد لموضوع السؤال (مثال: capital-peru, quote-mutanabbi, gk-black-holes)",
      "question": "نص السؤال باللغة العربية الفصحى",
      "options": ["خيار 1 بالعربية", "خيار 2 بالعربية", "خيار 3 بالعربية", "خيار 4 بالعربية"],
      "correctIndex": 0,
      "explanation": "جملة توضيحية قصيرة باللغة العربية",
      "imageQuery": "عنوان مقالة ويكيبيديا الإنجليزية فقط للتصنيفات المصورة",
      "countryCode": "رمز الدولة بحرفين صغيرين فقط لتصنيف flags مثل eg أو sa أو fr"
    }
  ]
}
2. اللغة العربية الفصحى إجبارية: جميع نصوص الأسئلة والخيارات والشروح يجب أن تكون باللغة العربية الفصحى واستخدام الهجاء والأسماء الشائعة في الثقافة العربية. لا تضع أي حروف أو كلمات لاتينية في خيارات الإجابة إطلاقاً.
3. في تصنيف flags: الخيارات الأربعة يجب أن تكون أسماء الدول باللغة العربية كاملة. وممنوع وضع رموز الحروف مثل "ru" أو "es" في الخيارات.
4. لا تذكر الإجابة الصحيحة أو تلمح لها أبداً في نص السؤال.
5. خيار صحيح واحد فقط لكل سؤال (correctIndex بين 0 و3)، ونوّع موضع الإجابة الصحيحة بين 0 و3.
6. الخيارات الخاطئة الثلاثة يجب أن تكون من نفس الفئة والنوع وذات طول متقارب.
7. في تصنيف flags: ضع countryCode بحرفين صغيرين، ولا تضع imageQuery.
8. في تصنيفات الصور: تأكد أن imageQuery هو عنوان مقالة ويكيبيديا الإنجليزية الدقيق بدون كلمات إضافية.
${
  allToAvoid.length
    ? `9. تجنب تماماً تكرار أي من هذه الأسئلة والمواضيع التي طُرحت سابقاً (ممنوع إعادة طرحها أو أي أسئلة مشابهة لها مباشرة):\n${allToAvoid
        .map((q) => `- ${q}`)
        .join("\n")}`
    : ""
}
أعد مخرجات JSON فقط بدون أي نص أو مقدمات أو كتل markdown.`;
}

// ---------- Robust parsing ----------

const questionSchema = z.object({
  category: z.string().min(1),
  topicKey: z.string().optional(),
  question: z.string().min(3),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
  imageQuery: z.string().optional(),
  countryCode: z.string().optional(),
});

export function parseQuestions(raw: string, minCount = 1): Question[] {
  const text = raw
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        parsed = JSON.parse(text.slice(start, end + 1));
      } catch {
        parsed = undefined;
      }
    }
    if (parsed === undefined) {
      const aStart = text.indexOf("[");
      const aEnd = text.lastIndexOf("]");
      if (aStart !== -1 && aEnd > aStart) {
        try {
          parsed = JSON.parse(text.slice(aStart, aEnd + 1));
        } catch {
          parsed = undefined;
        }
      }
    }
  }

  const arr = Array.isArray(parsed)
    ? parsed
    : parsed !== undefined &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : undefined;

  if (!Array.isArray(arr) || arr.length === 0) {
    throw new QuizError("INVALID_RESPONSE");
  }

  const result: Question[] = [];
  for (const item of arr) {
    const res = questionSchema.safeParse(item);
    if (res.success) {
      result.push(sanitizeQuestion(res.data));
    }
  }

  if (result.length < minCount) {
    throw new QuizError("INVALID_RESPONSE");
  }

  return result;
}
