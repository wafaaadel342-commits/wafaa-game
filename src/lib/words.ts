import {
  addSentencesToBank,
  addWordsToBank,
  cyrb53,
  fillFromLeastRecentlySeen,
  jaccardSimilarity,
  loadSentencesBank,
  loadWordsBank,
  normalizeArabic,
  selectRoundBankItems,
  tokenizeArabicWords,
  type BankSentenceItem,
  type BankWordItem,
} from "./anti-repeat";
import { executeRawWithFailover } from "./providers";
import type { Settings } from "./quiz";

// ============================================================================
// MODE A: WORDS ("جمع كلمة")
// ============================================================================

export type WordLevel = "easy" | "medium" | "hard";

export interface WordLevelInfo {
  key: WordLevel;
  label: string;
  letterRange: [number, number];
  points: number;
  description: string;
}

export const WORD_LEVELS: Record<WordLevel, WordLevelInfo> = {
  easy: {
    key: "easy",
    label: "سهل",
    letterRange: [3, 4],
    points: 10,
    description: "كلمات قصيرة من ٣ إلى ٤ حروف شائعة ومألوفة",
  },
  medium: {
    key: "medium",
    label: "متوسط",
    letterRange: [5, 5],
    points: 15,
    description: "كلمات من ٥ حروف تتطلب سرعة بديهة وتركيز",
  },
  hard: {
    key: "hard",
    label: "صعب",
    letterRange: [6, 7],
    points: 20,
    description: "كلمات طويلة من ٦ إلى ٧ حروف للمحترفين",
  },
};

export interface WordItem {
  id: string;
  word: string; // clean Arabic letters
  hint: string;
  category: string;
  scrambled: string[];
  alternatives?: string[] | undefined; // valid anagrams that use the exact same letters
}

export interface WordResultItem {
  word: string;
  hint: string;
  category: string;
  status: "solved" | "timeout" | "skipped";
  pointsEarned: number;
}

export interface WordsSetupOptions {
  wordCount: 5 | 10 | 15;
}

export const DEFAULT_WORDS_SETUP: WordsSetupOptions = {
  wordCount: 10,
};

// ============================================================================
// MODE B: SENTENCES ("جمع جملة")
// ============================================================================

export type SentenceLevel = "easy" | "medium" | "hard";

export interface SentenceLevelInfo {
  key: SentenceLevel;
  label: string;
  wordRange: [number, number];
  points: number;
  description: string;
}

export const SENTENCE_LEVELS: Record<SentenceLevel, SentenceLevelInfo> = {
  easy: {
    key: "easy",
    label: "سهل",
    wordRange: [3, 4],
    points: 15,
    description: "أمثال وحكم وجمل قصيرة من ٣ إلى ٤ كلمات شائعة",
  },
  medium: {
    key: "medium",
    label: "متوسط",
    wordRange: [5, 6],
    points: 25,
    description: "أقوال بليغة وحقائق من ٥ إلى ٦ كلمات تتطلب تركيزاً",
  },
  hard: {
    key: "hard",
    label: "صعب",
    wordRange: [7, 9],
    points: 40,
    description: "اقتباسات تراثية وجمل عميقة من ٧ إلى ٩ كلمات للمحترفين",
  },
};

export interface SentenceItem {
  id: string;
  sentence: string; // original clean Arabic sentence
  words: string[]; // clean words in correct order
  scrambled: string[]; // scrambled words
  hint?: string | undefined;
  category?: string | undefined;
  level: SentenceLevel;
  wordCount: number;
}

export interface SentenceResultItem {
  sentence: string;
  hint?: string | undefined;
  category?: string | undefined;
  status: "solved" | "timeout" | "skipped";
  pointsEarned: number;
  revealsUsed: number;
}

// ============================================================================
// STORAGE & SETTINGS FOR BOTH MODES
// ============================================================================

const WORDS_SETUP_KEY = "rakeb-setup";
const WORDS_BEST_KEY = "rakeb-word-best";
const LEGACY_WORDS_BEST_KEY = "rakeb-best";
const SENTENCE_BEST_KEY = "rakeb-sentence-best";

export type GameSubMode = "words" | "sentences";

export type WordsBest = Record<WordLevel, number>;
export type SentencesBest = Record<SentenceLevel, number>;

export function loadWordsBest(): WordsBest {
  if (typeof window === "undefined") return { easy: 0, medium: 0, hard: 0 };
  try {
    const raw = localStorage.getItem(WORDS_BEST_KEY) || localStorage.getItem(LEGACY_WORDS_BEST_KEY);
    if (raw) return { easy: 0, medium: 0, hard: 0, ...(JSON.parse(raw) as Partial<WordsBest>) };
  } catch {
    // ignore
  }
  return { easy: 0, medium: 0, hard: 0 };
}

export function saveWordsBest(best: WordsBest) {
  if (typeof window === "undefined") return;
  try {
    const s = JSON.stringify(best);
    localStorage.setItem(WORDS_BEST_KEY, s);
    localStorage.setItem(LEGACY_WORDS_BEST_KEY, s); // maintain backward compatibility
  } catch {
    // ignore
  }
}

export function loadSentencesBest(): SentencesBest {
  if (typeof window === "undefined") return { easy: 0, medium: 0, hard: 0 };
  try {
    const raw = localStorage.getItem(SENTENCE_BEST_KEY);
    if (raw) return { easy: 0, medium: 0, hard: 0, ...(JSON.parse(raw) as Partial<SentencesBest>) };
  } catch {
    // ignore
  }
  return { easy: 0, medium: 0, hard: 0 };
}

export function saveSentencesBest(best: SentencesBest) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SENTENCE_BEST_KEY, JSON.stringify(best));
  } catch {
    // ignore
  }
}

export function loadWordsSetup(): WordsSetupOptions {
  if (typeof window === "undefined") return DEFAULT_WORDS_SETUP;
  try {
    const raw = localStorage.getItem(WORDS_SETUP_KEY);
    if (!raw) return DEFAULT_WORDS_SETUP;
    const parsed = JSON.parse(raw) as Partial<WordsSetupOptions>;
    const count = [5, 10, 15].includes(parsed.wordCount as number)
      ? (parsed.wordCount as 5 | 10 | 15)
      : 10;
    return { wordCount: count };
  } catch {
    return DEFAULT_WORDS_SETUP;
  }
}

export function saveWordsSetup(opt: WordsSetupOptions) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WORDS_SETUP_KEY, JSON.stringify(opt));
  } catch {
    // ignore
  }
}

// ============================================================================
// ANAGRAM & LETTER HELPERS
// ============================================================================

export function cleanArabicWord(word: string): string {
  return word
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // tashkeel & tatweel
    .replace(/\s+/g, "")
    .trim();
}

export function isArabicOnly(text: string): boolean {
  return /^[\u0621-\u064A]+$/.test(text);
}

/** Check if two words are true anagrams of each other */
export function areTrueAnagrams(wordA: string, wordB: string): boolean {
  const a = normalizeArabic(wordA);
  const b = normalizeArabic(wordB);
  if (!a || !b || a === b) return false;
  const sortA = a.split("").sort().join("");
  const sortB = b.split("").sort().join("");
  return sortA === sortB;
}

/** Filter and validate list of anagram alternatives */
export function validateAnagramAlternatives(mainWord: string, alternatives?: string[]): string[] {
  if (!alternatives || !Array.isArray(alternatives)) return [];
  const valid: string[] = [];
  for (const alt of alternatives) {
    const clean = cleanArabicWord(alt);
    if (isArabicOnly(clean) && areTrueAnagrams(mainWord, clean) && !valid.includes(clean)) {
      valid.push(clean);
    }
  }
  return valid;
}

/** Fisher-Yates scramble ensuring output letters differ from input */
export function scrambleWord(word: string): string[] {
  const letters = word.split("");
  if (letters.length <= 1) return letters;

  const copy = [...letters];
  let attempts = 0;

  while (attempts < 25) {
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = temp;
    }
    if (copy.join("") !== word) {
      return copy;
    }
    attempts++;
  }

  // Fallback: reverse or swap adjacent
  const reversed = [...letters].reverse();
  if (reversed.join("") !== word) return reversed;

  for (let i = 0; i < copy.length - 1; i++) {
    if (copy[i] !== copy[i + 1]) {
      const t = copy[i]!;
      copy[i] = copy[i + 1]!;
      copy[i + 1] = t;
      break;
    }
  }
  return copy;
}

/** Fisher-Yates scramble for sentence words ensuring order differs */
export function scrambleWords(words: string[]): string[] {
  if (words.length <= 1) return [...words];
  const copy = [...words];
  const origJoined = words.join(" ");

  let attempts = 0;
  while (attempts < 30) {
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = temp;
    }
    if (copy.join(" ") !== origJoined) {
      return copy;
    }
    attempts++;
  }

  // Reverse if attempts failed
  const rev = [...words].reverse();
  if (rev.join(" ") !== origJoined) return rev;

  // Swap first two
  if (copy.length >= 2) {
    const temp = copy[0]!;
    copy[0] = copy[1]!;
    copy[1] = temp;
  }
  return copy;
}

// ============================================================================
// CURATED FALLBACK BANK: WORDS (80+ words from 3 to 7 letters)
// ============================================================================

export interface RawWordDefinition {
  word: string;
  hint: string;
  category: string;
  alternatives?: string[] | undefined;
}

export const FALLBACK_WORD_BANK: RawWordDefinition[] = [
  // 3 letters
  { word: "قلم", hint: "أداة للكتابة وتدوين الأفكار والعلوم", category: "أدوات منزلية" },
  { word: "شمس", hint: "النجم المضيء الذي يمنح الأرض النور والدفء", category: "طبيعة" },
  { word: "قمر", hint: "جرم سماوي ينير عتمة الليل ويعكس ضوء الشمس", category: "طبيعة" },
  { word: "نمر", hint: "حيوان مفترس مخطط وسريع من فصيلة السنوريات", category: "حيوانات" },
  {
    word: "بحر",
    hint: "مسطح مائي واسع مالح يغطي مساحات شاسعة من الأرض",
    category: "طبيعة",
    alternatives: ["حرب"],
  },
  { word: "ذهب", hint: "معدن نفيس أصفر برّاق ورمز للقيمة والثراء", category: "طبيعة" },
  { word: "عسل", hint: "سائل طبيعي حلو المذاق ينتجه النحل وفيه شفاء", category: "طبيعة" },
  { word: "خبز", hint: "غذاء رئيسي يُصنع من دقيق القمح ويُخبز في الأفران", category: "أغذية" },
  { word: "فيل", hint: "أضخم حيوان بري يمتلك خرطوماً طويلاً وأنياباً عاجية", category: "حيوانات" },
  {
    word: "صقر",
    hint: "طائر جارح حاد البصر يُستخدم في الصيد والرياضات التراثية",
    category: "حيوانات",
  },
  { word: "سيف", hint: "سلاح أبيض قديم من الفولاذ له حد ومقبض", category: "تاريخ" },
  { word: "عين", hint: "عضو الإبصار والرؤية في جسم الإنسان والحيوان", category: "جسم الإنسان" },
  { word: "نهر", hint: "مجرى مائي طبيعي عذب يصب في بحيرة أو بحر", category: "طبيعة" },
  { word: "ورد", hint: "زهر جميل الرائحة ومتعدد الألوان في الحدائق", category: "نباتات" },
  { word: "جبل", hint: "كتلة صخرية ضخمة مرتفعة وشاهقة عن سطح الأرض", category: "طبيعة" },
  { word: "نجم", hint: "كرة غازية متوهجة في السماء تبعث الضوء والحرارة", category: "فلك" },
  { word: "ثمر", hint: "نتاج الشجر وبذوره الطيبة بعد الإزهار", category: "نباتات" },
  {
    word: "قلب",
    hint: "عضلة حيوية تضخ الدم لكافة أعضاء الجسم",
    category: "جسم الإنسان",
    alternatives: ["لقب"],
  },

  // 4 letters
  {
    word: "كتاب",
    hint: "مجموعة من الأوراق المطبوعة بين غلافين للقراءة والتعلم",
    category: "أدوات منزلية",
  },
  { word: "ساعة", hint: "جهاز لمعرفة الوقت وتحديد الدقائق والثواني", category: "أدوات منزلية" },
  { word: "طائر", hint: "كائن حي يكسوه الريش وله جناحان ويطير في السماء", category: "حيوانات" },
  {
    word: "تفاح",
    hint: "فاكهة مشهورة غنية بالفيتامينات بألوان حمراء وخضراء",
    category: "فواكه وخضروات",
  },
  { word: "طبيب", hint: "شخص مؤهل لمعالجة المرضى ورعايتهم صحياً", category: "مهن" },
  { word: "هاتف", hint: "جهاز اتصالات ذكي نستخدمه للتواصل وتصفح الإنترنت", category: "تقنية" },
  { word: "شجرة", hint: "نبات خشبي كبير ذو جذع وفروع وأوراق خضراء", category: "طبيعة" },
  {
    word: "سفينة",
    hint: "مركبة بحرية ضخمة تنقل الركاب والبضائع عبر المحيطات",
    category: "مواصلات",
  },
  {
    word: "مطرقة",
    hint: "أداة يدوية تستخدم لدق المسامير وتكسير المواد الصلبة",
    category: "أدوات منزلية",
  },
  { word: "حصان", hint: "حيوان أصيل ورشيق يُستخدم في الفروسية والسباقات", category: "حيوانات" },
  { word: "مفتاح", hint: "أداة معدنية تُستخدم لفتح الأقفال والأبواب", category: "أدوات منزلية" },
  { word: "سحاب", hint: "تجمعات بيضاء أو رمادية من بخار الماء في كبد السماء", category: "طبيعة" },
  { word: "مسجد", hint: "مكان مقدس لإقامة الصلوات والعبادة لدى المسلمين", category: "عمارة" },
  { word: "مدينة", hint: "تجمع عمراني وسكاني كبير يضم شوارع وأسواق ومباني", category: "جغرافيا" },
  { word: "كوكب", hint: "جرم سماوي معتم يدور حول نجم مثل الأرض والمريخ", category: "فلك" },
  { word: "حديقة", hint: "مساحة خضراء مزروعة بالأزهار والأشجار للتنزه", category: "طبيعة" },
  { word: "رمان", hint: "فاكهة خريفية تحوي حبيبات حمراء كالياقوت", category: "فواكه وخضروات" },
  { word: "غابة", hint: "أرض شاسعة مليئة بالأشجار الكثيفة والحيوانات البرية", category: "طبيعة" },
  { word: "نورس", hint: "طائر بحري رمادي وأبيض يحلق قرب الشواطئ والموانئ", category: "حيوانات" },
  { word: "خاتم", hint: "حلقة معدنية من ذهب أو فضة تُلبس في الأصبع للزينة", category: "زينة" },
  { word: "قطار", hint: "مركبة نقل جماعية تسير على قضبان حديدية", category: "مواصلات" },

  // 5 letters
  { word: "حاسوب", hint: "جهاز إلكتروني متطور يعالج البيانات ويشغل التطبيقات", category: "تقنية" },
  { word: "تمساح", hint: "زاحف مائي ضخم ذو فك قوي للغاية وجلد حرشفي", category: "حيوانات" },
  { word: "برتقال", hint: "فاكهة شتوية حمضية مستديرة غنية بفيتامين ج", category: "فواكه وخضروات" },
  { word: "مهندس", hint: "محترف يخطط ويصمم المباني أو الآلات أو الأنظمة", category: "مهن" },
  { word: "طائرة", hint: "وسيلة نقل جوية سريعة تحلق بجناحين ومحركات نفاثة", category: "مواصلات" },
  {
    word: "مجهر",
    hint: "أداة بصرية لتكبير الكائنات الدقيقة التي لا تُرى بالعين",
    category: "علوم",
  },
  { word: "غزالة", hint: "حيوان ثديي جميل ورشيق وسريع العدو في البراري", category: "حيوانات" },
  { word: "سباحة", hint: "رياضة مائية محبوبة تقوي جميع عضلات الجسم", category: "رياضة" },
  {
    word: "محفظة",
    hint: "أداة جلدية صغيرة لحفظ النقود والبطاقات البنكية",
    category: "أدوات منزلية",
  },
  { word: "سيارة", hint: "مركبة برية مزودة بمحرك وأربع عجلات لنقل الأشخاص", category: "مواصلات" },
  { word: "زرافة", hint: "أطول كائن بري على كوكب الأرض برقبة ممتدة", category: "حيوانات" },
  { word: "فراشة", hint: "حشرة رقيقة ومجنحة بألوان بديعة تحط على الزهور", category: "طبيعة" },
  { word: "مكتبة", hint: "صرح ثقافي يضم آلاف الكتب والمراجع للبحث والمطالعة", category: "ثقافة" },
  { word: "قنديل", hint: "مصباح إنارة تقليدي أو كائن بحري رخوي مضيء", category: "طبيعة" },
  { word: "عاصفة", hint: "اضطراب جوي شديد يصحبه هبوب رياح عاتية وأمطار", category: "طقس" },
  { word: "مروحة", hint: "جهاز بشفرات دوارة لتوليد تيار هوائي وتبريد المكان", category: "أجهزة" },
  { word: "نافذة", hint: "فتحة في الجدار تسمح بمرور الضوء وتجديد الهواء", category: "عمارة" },
  { word: "صحراء", hint: "مساحة رملية شاسعة جافة قليلة الأمطار والنبات", category: "جغرافيا" },
  { word: "ميدالية", hint: "وسام معدني يُمنح للفائزين في البطولات الرياضية", category: "رياضة" },
  { word: "مطبوع", hint: "نص أو كتاب تم نقله بالمداد على الورق بواسطة المطبعة", category: "إعلام" },

  // 6 letters
  { word: "مستشفى", hint: "مؤسسة صحية متخصصة في علاج المرضى وإجراء العمليات", category: "صحة" },
  { word: "تلسكوب", hint: "منظار فلكي مخصص لرصد النجوم والكواكب البعيدة", category: "فلك" },
  { word: "صيدلاني", hint: "خبير ومختص في تحضير وصرف الأدوية الطبية", category: "مهن" },
  { word: "غواصة", hint: "سفينة بحرية متطورة قادرة على الغوص تحت سطح الماء", category: "تقنية" },
  {
    word: "طماطم",
    hint: "نبات أحمر ثمري غني بالعصارة أساسي في إعداد السلطة",
    category: "فواكه وخضروات",
  },
  { word: "كاميرا", hint: "أداة بصرية لالتقاط وتوثيق الصور وتسجيل الفيديو", category: "تقنية" },
  {
    word: "طاووس",
    hint: "طائر خلاب مشهور بريش ذيله المروحي ذي الألوان الزاهية",
    category: "حيوانات",
  },
  { word: "مسباح", hint: "سلسلة من الحبات تُستخدم للتسبيح والذكر", category: "تراث" },
  { word: "مهرجان", hint: "احتفال عام كبير يتضمن عروضاً فنية وترفيهية متنوعة", category: "ثقافة" },
  { word: "شلالات", hint: "تدفق المياه العذبة من ارتفاع صخري شاهق بشكل مبهر", category: "طبيعة" },
  { word: "بوصلة", hint: "أداة ملاحة بإبرة ممغنطة تشير دائماً نحو الشمال", category: "ملاحة" },
  {
    word: "أهرام",
    hint: "معالم حجرية ضخمة خالدة بناها الفراعنة في مصر القديمة",
    category: "تاريخ",
  },
  { word: "صاروخ", hint: "مركبة دفع نفاثة قادرة على اختراق الغلاف الجوي للفضاء", category: "فضاء" },
  { word: "بلبلة", hint: "اضطراب أو ارتباك وتداخل في الأمور والأصوات", category: "لغة" },

  // 7 letters
  { word: "ديناصور", hint: "حيوان زاحف عملاق عاش في العصور السحيقة وانقرض", category: "حيوانات" },
  { word: "ميكروفون", hint: "جهاز صوتي يحول الموجات الصوتية إلى إشارات كهربية", category: "تقنية" },
  {
    word: "فراولة",
    hint: "فاكهة حمراء شهية ومحبوبة ببذور خارجية صغيرة",
    category: "فواكه وخضروات",
  },
  { word: "سندباد", hint: "بحار أسطوري في الحكايات العربية اشتهر برحلاته السبع", category: "تراث" },
  { word: "طاحونة", hint: "آلة تقليدية تعمل بطاقة الرياح أو الماء لطحن الحبوب", category: "تراث" },
  { word: "أخطبوط", hint: "كائن بحري رخوي ذكي يمتلك ثمانية أذرع قوية", category: "حيوانات" },
  { word: "موسوعة", hint: "مرجع علمي ضخم وشامل يضم معارف في شتى المجالات", category: "علوم" },
  { word: "سنديانة", hint: "شجرة بلوط معمرة ترمز للقوة والرسوخ وطول العمر", category: "طبيعة" },
  { word: "مستكشف", hint: "شخص يبحث ويسافر لاكتشاف أراضٍ ومجهولات جديدة", category: "مهن" },
  {
    word: "أركيولوجيا",
    hint: "علم الآثار ودراسة بقايا الحضارات الإنسانية القديمة",
    category: "علوم",
  },
  {
    word: "منطاد",
    hint: "بالون ضخم يمتلئ بغاز خفيف أو هواء ساخن ليرتفع بالركاب",
    category: "مواصلات",
  },
  { word: "صيدلية", hint: "متجر طبي مرخص لبيع العقاقير والمستحضرات الدوائية", category: "صحة" },
];

// ============================================================================
// CURATED FALLBACK BANK: SENTENCES (40+ sentences across 3 levels)
// ============================================================================

export interface RawSentenceDefinition {
  sentence: string;
  hint: string;
  category: string;
  level: SentenceLevel;
}

export const FALLBACK_SENTENCE_BANK: RawSentenceDefinition[] = [
  // EASY: 3-4 words
  {
    sentence: "الوقت كالسيف إن لم تقطعه قطعك",
    hint: "حكمة شهيرة عن أهمية استغلال اللحظات",
    category: "حكم وأمثال",
    level: "easy",
  },
  {
    sentence: "العلم نور والجهل ظلام",
    hint: "مقولة عن فضل المعرفة وأثر الأمية",
    category: "حكم وأمثال",
    level: "easy",
  },
  {
    sentence: "الصبر مفتاح الفرج",
    hint: "مثل يحث على التريث وتحمل الشدائد",
    category: "حكم وأمثال",
    level: "easy",
  },
  {
    sentence: "من جد وجد",
    hint: "شطر مثل يؤكد أن العمل يثمر نجاحاً",
    category: "حكم وأمثال",
    level: "easy",
  },
  {
    sentence: "الوقاية خير من العلاج",
    hint: "مبدأ صحي وقائي لتجنب المرض",
    category: "صحة وحياة",
    level: "easy",
  },
  {
    sentence: "يد واحدة لا تصفق",
    hint: "مثل يحث على التعاون والتضامن الجماعي",
    category: "حكم وأمثال",
    level: "easy",
  },
  {
    sentence: "القناعة كنز لا يفنى",
    hint: "حكمة عن الرضا بما قسمه الله",
    category: "أخلاق وتزكية",
    level: "easy",
  },
  {
    sentence: "الجار قبل الدار",
    hint: "مثل شعبي يؤكد أهمية حسن الجيرة",
    category: "حكم وأمثال",
    level: "easy",
  },
  {
    sentence: "الرفيق قبل الطريق",
    hint: "حكمة تدعو لاختيار الصاحب الصالح في السفر",
    category: "حكم وأمثال",
    level: "easy",
  },
  {
    sentence: "في التأني السلامة",
    hint: "شطر حكمة ينهى عن العجلة والتهور",
    category: "حكم وأمثال",
    level: "easy",
  },
  {
    sentence: "الصدق منجاة والكذب مهواة",
    hint: "أثر التمسك بالحقيقة وتجنب الخداع",
    category: "أخلاق وتزكية",
    level: "easy",
  },
  {
    sentence: "قطرة الماء تثقب الصخر",
    hint: "دليل على قوة الاستمرارية والاجتهاد",
    category: "طبيعة وحكمة",
    level: "easy",
  },
  {
    sentence: "الصديق وقت الضيق",
    hint: "اختبار لمعرفة الأوفياء في الأزمات",
    category: "حكم وأمثال",
    level: "easy",
  },
  {
    sentence: "الحركة بركة والكسل هلكة",
    hint: "دعوة للنشاط والعمل وترك الخمول",
    category: "حكم وأمثال",
    level: "easy",
  },
  {
    sentence: "الكتاب خير جليس",
    hint: "عبارة لأبي العلاء المعري والمتنبي في القراءة",
    category: "ثقافة وأدب",
    level: "easy",
  },

  // MEDIUM: 5-6 words
  {
    sentence: "العقل السليم في الجسم السليم",
    hint: "مقولة تربوية تربط بين صحة البدن والذهن",
    category: "صحة وحياة",
    level: "medium",
  },
  {
    sentence: "لا تؤجل عمل اليوم إلى الغد",
    hint: "نصيحة ذهبية لتجنب التسويف وإنجاز المهام",
    category: "حكم وأمثال",
    level: "medium",
  },
  {
    sentence: "من سار على الدرب وصل للهدف",
    hint: "اليقين بأن الثبات يوصل للغايات المنشودة",
    category: "حكم وأمثال",
    level: "medium",
  },
  {
    sentence: "العلم في الصغر كالنقش على الحجر",
    hint: "أثر التنشئة المبكرة وترسيخ المبادئ",
    category: "تربية وتعليم",
    level: "medium",
  },
  {
    sentence: "من زرع حصد الخير في النهاية",
    hint: "الجزاء من جنس العمل وما تبذله تجنيه",
    category: "حكم وأمثال",
    level: "medium",
  },
  {
    sentence: "إذا تم العقل نقص الكلام الزائد",
    hint: "علامة رجاحة العقل والنضج الفكري",
    category: "أدب وبلاغة",
    level: "medium",
  },
  {
    sentence: "الشجرة المثمرة يقذفها الناس بالحجارة دوما",
    hint: "ضريبة التميز والنجاح بين الأقران",
    category: "حكم وأمثال",
    level: "medium",
  },
  {
    sentence: "اللسان حصانك إن صنته صانك وحماك",
    hint: "تحذير من زلات المنطق وأثر حفظ اللسان",
    category: "أدب وبلاغة",
    level: "medium",
  },
  {
    sentence: "تاج المروءة هو التواضع والإنصاف للجميع",
    hint: "أسمى خصال النبل ومكارم الأخلاق",
    category: "أخلاق وتزكية",
    level: "medium",
  },
  {
    sentence: "حبل الكذب قصير وحبل الصدق متين",
    hint: "مصير الأكاذيب الانكشاف مهما طال الوقت",
    category: "حكم وأمثال",
    level: "medium",
  },
  {
    sentence: "أول الغيث قطرة ثم ينهمر السيل",
    hint: "بداية الإنجازات الكبرى تبدأ بخطوة صغيرة",
    category: "طبيعة وحكمة",
    level: "medium",
  },
  {
    sentence: "رب ضارة نافعة للإنسان في مستقبله",
    hint: "الأمل في المنح الكامنة داخل المحن",
    category: "حكم وأمثال",
    level: "medium",
  },
  {
    sentence: "الصمت حكمة في مواقف الجهل والغضب",
    hint: "قيمة الهدوء حين يكون الكلام لا فائدة منه",
    category: "حكم وأمثال",
    level: "medium",
  },

  // HARD: 7-9 words
  {
    sentence: "إذا هبت رياحك فاغتنمها فإن لكل خافقة سكون",
    hint: "بيت شعر يدعو لاقتناص الفرص السانحة قبل فواتها",
    category: "شعر وحكمة",
    level: "hard",
  },
  {
    sentence: "لا تطلب سرعة العمل بل اطلب تجويده وإتقانه التام",
    hint: "قيمة الإتقان والجودة فوق معايير العجلة والسرعة",
    category: "حكم وتوجيه",
    level: "hard",
  },
  {
    sentence: "ذو العقل يشقى في النعيم بعقله وأخو الجهالة ينعم",
    hint: "بيت شعر شهير لأبي الطيب المتنبي في ألم التفكير",
    category: "شعر وأدب",
    level: "hard",
  },
  {
    sentence: "إنما الأمم الأخلاق ما بقيت فإن هم ذهبت أخلاقهم ذهبوا",
    hint: "بيت شعر لأحمد شوقي أمير الشعراء عن جوهر الحضارات",
    category: "شعر وأدب",
    level: "hard",
  },
  {
    sentence: "ما طار طير وارتفع إلا كما طار وقع بالتمام",
    hint: "مثل يحذر من الغرور وعاقبة التكبر",
    category: "حكم وأمثال",
    level: "hard",
  },
  {
    sentence: "على قدر أهل العزم تأتي العزائم وتأتي المكارم الكبرى",
    hint: "مطلع قصيدة المتنبي في مدح سيف الدولة الحمداني",
    category: "شعر وأدب",
    level: "hard",
  },
  {
    sentence: "الأفعال أبلغ من الأقوال والقدوة الحسنة أعظم من النصيحة",
    hint: "أثر التطبيق العملي وسلوك القدوة في الإقناع",
    category: "تربية وحكمة",
    level: "hard",
  },
  {
    sentence: "من استشار الرجال استعار عقولهم ومن تفرد برأيه زل",
    hint: "قيمة الشورى وتبادل الخبرات لتجنب الأخطاء",
    category: "حكم وتوجيه",
    level: "hard",
  },
  {
    sentence: "لكل داء دواء يستطب به إلا الحماقة أعيت من يداويها",
    hint: "بيت شعر عربي بليغ في استحالة إقناع الأحمق",
    category: "شعر وحكمة",
    level: "hard",
  },
  {
    sentence: "لا تحسبن العلم ينفع وحده ما لم يتوج ربه بخلاق",
    hint: "بيت لحافظ إبراهيم يؤكد ضرورة اقتران العلم بالأخلاق",
    category: "شعر وأدب",
    level: "hard",
  },
  {
    sentence: "عش عزيزا أو مت وأنت كريم بين طعن القنا",
    hint: "شطر بيت للمتنبي في عزة النفس والأنفة",
    category: "شعر وأدب",
    level: "hard",
  },
  {
    sentence: "من طلب العلا سهر الليالي وجاهد نفسه ليصل للقمة",
    hint: "حكمة في وجوب الصبر والتعب لنيل المعالي",
    category: "حكم وأمثال",
    level: "hard",
  },
];

// ============================================================================
// CONVERSIONS TO/FROM BANK ITEMS
// ============================================================================

export function rawWordToBankItem(def: RawWordDefinition, level: WordLevel): BankWordItem {
  const clean = cleanArabicWord(def.word);
  const key = `word:${normalizeArabic(clean)}`;
  const alts = validateAnagramAlternatives(clean, def.alternatives);
  return {
    id: cyrb53(key),
    key,
    word: clean,
    level,
    hint: def.hint,
    category: def.category,
    scrambled: scrambleWord(clean),
    alternatives: alts.length > 0 ? alts : undefined,
    addedAt: Date.now(),
  };
}

export function bankWordToWordItem(item: BankWordItem): WordItem {
  return {
    id: item.id,
    word: item.word,
    hint: item.hint,
    category: item.category,
    scrambled: scrambleWord(item.word),
    alternatives: item.alternatives,
  };
}

export function rawSentenceToBankItem(def: RawSentenceDefinition): BankSentenceItem {
  const norm = normalizeArabic(def.sentence);
  const words = tokenizeArabicWords(def.sentence);
  const key = `sent:${cyrb53(norm)}`;
  return {
    id: cyrb53(key),
    key,
    sentence: def.sentence.trim(),
    level: def.level,
    words,
    hint: def.hint,
    category: def.category,
    wordCount: words.length,
    addedAt: Date.now(),
  };
}

export function bankSentenceToSentenceItem(item: BankSentenceItem): SentenceItem {
  return {
    id: item.id,
    sentence: item.sentence,
    words: item.words,
    scrambled: scrambleWords(item.words),
    hint: item.hint,
    category: item.category,
    level: item.level,
    wordCount: item.wordCount,
  };
}

// ============================================================================
// AI PROMPT & PARSING FOR WORDS (MODE A)
// ============================================================================

const WORD_SUBTOPICS = [
  "حيوانات برية وبحرية",
  "نباتات وفواكه وخضروات",
  "أدوات ومنتجات منزلية",
  "مهن وتخصصات شائعة",
  "معالم وظواهر طبيعية",
  "أجهزة وتقنيات حديثة",
  "رياضات وألعاب مشهورة",
  "جغرافيا وتضاريس العالم",
];

export function buildWordsPrompt(level: WordLevel, count: number, avoidWords: string[]): string {
  const info = WORD_LEVELS[level];
  const [minL, maxL] = info.letterRange;
  const lengthDesc = minL === maxL ? `بالضبط ${minL} أحرف` : `بين ${minL} إلى ${maxL} أحرف`;

  const avoidDesc =
    avoidWords.length > 0
      ? `\nتجنب تماماً تكرار هذه الكلمات السابقة: ${avoidWords.slice(-80).join("، ")}.`
      : "";

  return `أنت صانع ألغاز لعبة "ركّب الكلمة" باللغة العربية الفصحى.
المطلوب توليد ${count} كلمة عربية فصيحة وشائعة للعبة ترتيب الحروف المبعثرة بمستوى صعوبة "${info.label}".

التوجيهات الصارمة:
1. طول كل كلمة: ${lengthDesc}.
2. الحروف: أحرف عربية فقط من أ إلى ي (بدون تشكيل، بدون حركات، بدون مسافات، وبدون إنجليزية).
3. الكلمات: أسماء ومفردات فصيحة شائعة من: ${WORD_SUBTOPICS.join("، ")}.
4. التلميح (hint): جملة قصيرة ذكية تصف الكلمة بدون ذكر الكلمة نفسها أو أي اشتقاق مباشر منها.
5. الكلمات البديلة (alternatives): إذا وُجدت كلمات عربية فصيحة أخرى صحيحة مكوّنة من نفس الحروف تماماً (جناس/anagram)، اذكرها في مصفوفة alternatives.${avoidDesc}

أرجع الإجابة فقط بصيغة JSON صالحة بالشكل التالي دون أي نصوص إضافية:
{
  "words": [
    {
      "word": "حاسوب",
      "hint": "جهاز إلكتروني يعالج البيانات ويشغل التطبيقات",
      "category": "تقنية",
      "alternatives": []
    }
  ]
}`;
}

export function parseWordsResponse(text: string, level: WordLevel): RawWordDefinition[] {
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
        // ignore
      }
    }
  }

  const list: unknown[] =
    parsed && typeof parsed === "object" && Array.isArray((parsed as { words?: unknown }).words)
      ? (parsed as { words: unknown[] }).words
      : Array.isArray(parsed)
        ? parsed
        : [];

  const [minL, maxL] = WORD_LEVELS[level].letterRange;
  const valid: RawWordDefinition[] = [];

  for (const item of list) {
    if (item && typeof item === "object") {
      const w = cleanArabicWord(String((item as { word?: string }).word ?? ""));
      const hint = String((item as { hint?: string }).hint ?? "").trim();
      const cat = String((item as { category?: string }).category ?? "ثقافة عامة").trim();
      const alts = Array.isArray((item as { alternatives?: unknown[] }).alternatives)
        ? (item as { alternatives: unknown[] }).alternatives.map((a) => String(a))
        : undefined;

      if (isArabicOnly(w) && w.length >= minL && w.length <= maxL && hint.length > 2) {
        if (!valid.some((v) => v.word === w)) {
          valid.push({ word: w, hint, category: cat, alternatives: alts });
        }
      }
    }
  }

  return valid;
}

// ============================================================================
// AI PROMPT & PARSING FOR SENTENCES (MODE B)
// ============================================================================

export function buildSentencesPrompt(
  level: SentenceLevel,
  count: number,
  avoidSentences: string[],
): string {
  const info = SENTENCE_LEVELS[level];
  const [minW, maxW] = info.wordRange;

  const avoidDesc =
    avoidSentences.length > 0
      ? `\nتجنب تماماً تكرار أو تشابه أي من هذه الجمل السابقة:\n${avoidSentences
          .slice(-60)
          .map((s) => `- ${s}`)
          .join("\n")}`
      : "";

  return `أنت صانع ألغاز لعبة "ركّب الجملة" باللغة العربية الفصحى.
المطلوب إنشاء ${count} جملة عربية فصيحة ومفيدة (حكم، أمثال شعبية شهيرة، حقائق علمية، أقوال مأثورة، عبارات ملهمة) بمستوى صعوبة "${info.label}".

القواعد الصارمة:
1. عدد الكلمات في كل جملة: بين ${minW} إلى ${maxW} كلمات عربية بالضبط.
2. الكلمات واضحة، فصيحة، معبرة، ومفهومة لجميع الناطقين باللغة العربية.
3. التلميح (hint): توضيح ذكي لمغزى الجملة أو تصنيفها بدون ذكر كلماتها الأساسية.
4. التصنيف (category): حكم وأمثال، شعر وأدب، علوم وطبيعة، أخلاق وتزكية، تاريخ وحضارة.${avoidDesc}

أرجع الإجابة فقط بكائن JSON صالح بالشكل التالي:
{
  "sentences": [
    {
      "sentence": "الوقت كالسيف إن لم تقطعه قطعك",
      "hint": "حكمة شهيرة عن أهمية استغلال اللحظات",
      "category": "حكم وأمثال"
    }
  ]
}`;
}

export function parseSentencesResponse(
  text: string,
  level: SentenceLevel,
): RawSentenceDefinition[] {
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
        // ignore
      }
    }
  }

  const list: unknown[] =
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { sentences?: unknown }).sentences)
      ? (parsed as { sentences: unknown[] }).sentences
      : Array.isArray(parsed)
        ? parsed
        : [];

  const [minW, maxW] = SENTENCE_LEVELS[level].wordRange;
  const valid: RawSentenceDefinition[] = [];

  for (const item of list) {
    if (item && typeof item === "object") {
      const sentence = String((item as { sentence?: string }).sentence ?? "").trim();
      const hint = String((item as { hint?: string }).hint ?? "").trim();
      const category = String((item as { category?: string }).category ?? "حكم وأمثال").trim();

      const words = tokenizeArabicWords(sentence);
      if (words.length >= minW && words.length <= maxW && sentence.length > 5) {
        // Check near duplicates
        const isNearDuplicate = valid.some(
          (v) => jaccardSimilarity(tokenizeArabicWords(v.sentence), words) >= 0.8,
        );
        if (!isNearDuplicate) {
          valid.push({ sentence, hint, category, level });
        }
      }
    }
  }

  return valid;
}

// ============================================================================
// ROUND LOADER FOR MODE A: WORDS
// ============================================================================

export async function loadRoundWords(
  settings: Settings,
  level: WordLevel,
  count: number,
): Promise<WordItem[]> {
  const bank = loadWordsBank();

  // 1. Check local bank for unseen words
  const { chosen, shortfall } = selectRoundBankItems<BankWordItem>(bank, level, count);

  let selectedBankItems: BankWordItem[] = [...chosen];

  if (shortfall > 0) {
    const hasKey = Boolean(settings.geminiKey.trim()) || Boolean(settings.openrouterKey.trim());
    if (hasKey) {
      try {
        const avoidList = [
          ...selectedBankItems.map((b) => b.word),
          ...bank.slice(-60).map((b) => b.word),
        ];
        const prompt = buildWordsPrompt(level, shortfall + 5, avoidList);
        const rawText = await executeRawWithFailover(settings, prompt, 22000);
        const aiWords = parseWordsResponse(rawText, level);

        if (aiWords.length > 0) {
          const bankItems = aiWords.map((w) => rawWordToBankItem(w, level));
          addWordsToBank(bankItems);

          for (const item of bankItems) {
            if (selectedBankItems.length >= count) break;
            if (!selectedBankItems.some((s) => s.key === item.key)) {
              selectedBankItems.push(item);
            }
          }
        }
      } catch (err) {
        console.warn("AI words load failed, will use fallback:", err);
      }
    }
  }

  // If still shortfall, fill from least-recently-seen bank items
  if (selectedBankItems.length < count) {
    const chosenKeys = new Set(selectedBankItems.map((s) => s.key));
    const leastSeen = fillFromLeastRecentlySeen<BankWordItem>(
      bank,
      level,
      count - selectedBankItems.length,
      chosenKeys,
    );
    selectedBankItems = [...selectedBankItems, ...leastSeen];
  }

  // If still short (e.g. empty bank), seed from curated fallback bank
  if (selectedBankItems.length < count) {
    const [minL, maxL] = WORD_LEVELS[level].letterRange;
    const fallbackCandidates = FALLBACK_WORD_BANK.filter((w) => {
      const c = cleanArabicWord(w.word);
      return c.length >= minL && c.length <= maxL;
    });

    const chosenKeys = new Set(selectedBankItems.map((s) => s.key));
    for (const def of fallbackCandidates) {
      if (selectedBankItems.length >= count) break;
      const bItem = rawWordToBankItem(def, level);
      if (!chosenKeys.has(bItem.key)) {
        chosenKeys.add(bItem.key);
        selectedBankItems.push(bItem);
      }
    }
    // Also save fallback items to bank
    addWordsToBank(selectedBankItems);
  }

  return selectedBankItems.slice(0, count).map(bankWordToWordItem);
}

// ============================================================================
// ROUND LOADER FOR MODE B: SENTENCES
// ============================================================================

export async function loadRoundSentences(
  settings: Settings,
  level: SentenceLevel,
  count: number,
): Promise<SentenceItem[]> {
  const bank = loadSentencesBank();

  // 1. Check local bank for unseen sentences
  const { chosen, shortfall } = selectRoundBankItems<BankSentenceItem>(bank, level, count);

  let selectedBankItems: BankSentenceItem[] = [...chosen];

  if (shortfall > 0) {
    const hasKey = Boolean(settings.geminiKey.trim()) || Boolean(settings.openrouterKey.trim());
    if (hasKey) {
      try {
        const avoidList = [
          ...selectedBankItems.map((b) => b.sentence),
          ...bank.slice(-50).map((b) => b.sentence),
        ];
        const prompt = buildSentencesPrompt(level, shortfall + 4, avoidList);
        const rawText = await executeRawWithFailover(settings, prompt, 25000);
        const aiSentences = parseSentencesResponse(rawText, level);

        if (aiSentences.length > 0) {
          const bankItems = aiSentences.map(rawSentenceToBankItem);
          addSentencesToBank(bankItems);

          for (const item of bankItems) {
            if (selectedBankItems.length >= count) break;
            const duplicate = selectedBankItems.some(
              (s) => s.key === item.key || jaccardSimilarity(s.words, item.words) >= 0.8,
            );
            if (!duplicate) {
              selectedBankItems.push(item);
            }
          }
        }
      } catch (err) {
        console.warn("AI sentences load failed, will use fallback:", err);
      }
    }
  }

  // If still shortfall, fill from least-recently-seen bank items
  if (selectedBankItems.length < count) {
    const chosenKeys = new Set(selectedBankItems.map((s) => s.key));
    const leastSeen = fillFromLeastRecentlySeen<BankSentenceItem>(
      bank,
      level,
      count - selectedBankItems.length,
      chosenKeys,
    );
    selectedBankItems = [...selectedBankItems, ...leastSeen];
  }

  // If still short, seed from curated fallback sentences
  if (selectedBankItems.length < count) {
    const fallbackCandidates = FALLBACK_SENTENCE_BANK.filter((s) => s.level === level);
    const chosenKeys = new Set(selectedBankItems.map((s) => s.key));

    for (const def of fallbackCandidates) {
      if (selectedBankItems.length >= count) break;
      const bItem = rawSentenceToBankItem(def);
      if (!chosenKeys.has(bItem.key)) {
        chosenKeys.add(bItem.key);
        selectedBankItems.push(bItem);
      }
    }
    // Save to bank
    addSentencesToBank(selectedBankItems);
  }

  return selectedBankItems.slice(0, count).map(bankSentenceToSentenceItem);
}
