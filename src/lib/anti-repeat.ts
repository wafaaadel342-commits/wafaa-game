/**
 * Shared Anti-Repeat and Persistent Content Bank System
 * Used across all games ("تحدّي المعرفة", "ركّب الكلمة", "ركّب الجملة").
 */

// ---------------- 1. Arabic Text Normalization ----------------

/**
 * Normalizes Arabic text for deduplication:
 * - Strips diacritics (tashkeel) and tatweel (kashida)
 * - Normalizes Alef variants (أ / إ / آ / ٱ -> ا)
 * - Normalizes Taa Marbuta (ة -> ه)
 * - Normalizes Yaa variants (ى -> ي)
 * - Strips punctuation, symbols, extra spaces
 * - Lowercases Latin characters
 */
export function normalizeArabic(text: string): string {
  if (!text) return "";
  return (
    text
      // Remove diacritics / tashkeel: fathatan, dammatan, kasratan, fatha, damma, kasra, shadda, sukun, dagger alef, etc.
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
      // Remove tatweel (kashida)
      .replace(/\u0640/g, "")
      // Unify Alef forms
      .replace(/[أإآٱ]/g, "ا")
      // Unify Taa Marbuta to Haa
      .replace(/ة/g, "ه")
      // Unify Alef Maksura to Yaa
      .replace(/ى/g, "ي")
      // Replace punctuation and special characters with space
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'«»؛،؟—–[\]<>|\\]/g, " ")
      // Lowercase any Latin characters
      .toLowerCase()
      // Collapse consecutive whitespace to single space and trim
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Extracts a normalized word array from a sentence.
 */
export function tokenizeArabicWords(sentence: string): string[] {
  const norm = normalizeArabic(sentence);
  if (!norm) return [];
  return norm.split(" ").filter((w) => w.length > 0);
}

// ---------------- 2. 53-Bit cyrb53 Hash ----------------

/**
 * 53-bit cyrb53 hash returning a hexadecimal string.
 * Deterministic and collision-resistant for strings.
 */
export function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

// ---------------- 3. Jaccard Similarity for Sentences ----------------

/**
 * Computes Jaccard similarity between two token sets of Arabic words.
 * Returns value between 0 (disjoint) and 1 (identical set).
 */
export function jaccardSimilarity(wordsA: string[], wordsB: string[]): number {
  if (wordsA.length === 0 && wordsB.length === 0) return 1.0;
  if (wordsA.length === 0 || wordsB.length === 0) return 0.0;

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  let intersectionCount = 0;
  for (const w of setA) {
    if (setB.has(w)) {
      intersectionCount++;
    }
  }

  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

// ---------------- 4. Storage Keys & Capacities ----------------

const SEEN_STORAGE_KEY = "tahaddi-seen-v1";
const BANK_QUIZ_KEY = "tahaddi-bank-quiz-v1";
const BANK_WORDS_KEY = "tahaddi-bank-words-v1";
const BANK_SENTENCES_KEY = "tahaddi-bank-sentences-v1";

export const CAPS = {
  seenHistory: 4000,
  quizBank: 1200,
  wordsBank: 1500,
  sentencesBank: 1500,
} as const;

// ---------------- 5. Safe LocalStorage Helpers ----------------

function safeGetItem<T>(key: string, validator: (data: unknown) => data is T, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return validator(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function safeSetItemWithEviction<T>(
  key: string,
  value: T,
  evictOlderFraction: (current: T, fraction: number) => T,
): boolean {
  if (typeof window === "undefined") return false;
  const serialized = JSON.stringify(value);
  try {
    localStorage.setItem(key, serialized);
    return true;
  } catch (err: unknown) {
    // Check for QuotaExceededError
    const isQuota =
      err instanceof DOMException &&
      (err.code === 22 ||
        err.code === 1014 ||
        err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED");

    if (isQuota) {
      try {
        const reduced = evictOlderFraction(value, 0.2); // Evict 20% oldest
        localStorage.setItem(key, JSON.stringify(reduced));
        return true;
      } catch {
        // If still failing, do not crash the app
        return false;
      }
    }
    return false;
  }
}

// ---------------- 6. Seen History Tracking (Map of key -> timestamp) ----------------

interface SeenData {
  version: 1;
  seen: Record<string, number>; // key -> timestamp ms
}

function isSeenData(data: unknown): data is SeenData {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as SeenData).version === 1 &&
    typeof (data as SeenData).seen === "object" &&
    (data as SeenData).seen !== null
  );
}

export function loadSeenMap(): Record<string, number> {
  const data = safeGetItem<SeenData>(SEEN_STORAGE_KEY, isSeenData, { version: 1, seen: {} });
  return data.seen;
}

export function isItemSeen(itemKey: string): boolean {
  const seenMap = loadSeenMap();
  return Boolean(seenMap[itemKey]);
}

/**
 * Marks an item as seen ONLY when it is displayed to the user.
 * Capped at 4000 items (oldest evicted first).
 */
export function markItemSeen(itemKey: string, timestamp = Date.now()) {
  if (!itemKey) return;
  const current = loadSeenMap();
  current[itemKey] = timestamp;

  // Check cap
  const entries = Object.entries(current);
  if (entries.length > CAPS.seenHistory) {
    // Sort ascending by timestamp (oldest first)
    entries.sort((a, b) => a[1] - b[1]);
    const toRemoveCount = entries.length - CAPS.seenHistory;
    for (let i = 0; i < toRemoveCount; i++) {
      const k = entries[i]?.[0];
      if (k) delete current[k];
    }
  }

  safeSetItemWithEviction<SeenData>(
    SEEN_STORAGE_KEY,
    { version: 1, seen: current },
    (data, fraction) => {
      const e = Object.entries(data.seen).sort((a, b) => a[1] - b[1]);
      const removeCount = Math.ceil(e.length * fraction);
      for (let i = 0; i < removeCount; i++) {
        const k = e[i]?.[0];
        if (k) delete data.seen[k];
      }
      return data;
    },
  );
}

/**
 * Resets seen history while preserving the content bank.
 */
export function clearSeenHistory() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SEEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ---------------- 7. Persistent Content Bank ----------------

export interface BankQuizItem {
  id: string; // cyrb53 hash
  key: string; // dedupe key (e.g. topicKey / question hash / flag:code / img:query)
  level: "easy" | "medium" | "hard";
  category: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topicKey?: string | undefined;
  countryCode?: string | undefined;
  imageQuery?: string | undefined;
  addedAt: number;
}

export interface BankWordItem {
  id: string; // cyrb53 hash
  key: string; // normalized word
  word: string;
  level: "easy" | "medium" | "hard";
  hint: string;
  category: string;
  scrambled: string[];
  alternatives?: string[] | undefined;
  addedAt: number;
}

export interface BankSentenceItem {
  id: string; // cyrb53 hash
  key: string; // cyrb53(normalizedSentence)
  sentence: string;
  level: "easy" | "medium" | "hard";
  words: string[];
  hint?: string | undefined;
  category?: string | undefined;
  wordCount: number;
  addedAt: number;
}

interface BankContainer<T> {
  version: 1;
  items: T[];
}

function makeBankValidator<T>(itemCheck: (item: unknown) => boolean) {
  return (data: unknown): data is BankContainer<T> => {
    return (
      typeof data === "object" &&
      data !== null &&
      (data as BankContainer<T>).version === 1 &&
      Array.isArray((data as BankContainer<T>).items) &&
      (data as BankContainer<T>).items.every(itemCheck)
    );
  };
}

const isQuizBank = makeBankValidator<BankQuizItem>(
  (it) =>
    typeof it === "object" &&
    it !== null &&
    typeof (it as BankQuizItem).id === "string" &&
    typeof (it as BankQuizItem).key === "string" &&
    typeof (it as BankQuizItem).question === "string" &&
    Array.isArray((it as BankQuizItem).options),
);

const isWordsBank = makeBankValidator<BankWordItem>(
  (it) =>
    typeof it === "object" &&
    it !== null &&
    typeof (it as BankWordItem).id === "string" &&
    typeof (it as BankWordItem).word === "string" &&
    Array.isArray((it as BankWordItem).scrambled),
);

const isSentencesBank = makeBankValidator<BankSentenceItem>(
  (it) =>
    typeof it === "object" &&
    it !== null &&
    typeof (it as BankSentenceItem).id === "string" &&
    typeof (it as BankSentenceItem).sentence === "string" &&
    Array.isArray((it as BankSentenceItem).words),
);

/** Eviction rule: seen items first (oldest first). Never evict unseen while seen exist. */
function evictBankItems<T extends { key: string; addedAt: number }>(
  items: T[],
  maxCap: number,
  seenMap: Record<string, number>,
): T[] {
  if (items.length <= maxCap) return items;

  // Partition into seen and unseen
  const seenItems: { item: T; seenAt: number }[] = [];
  const unseenItems: T[] = [];

  for (const it of items) {
    const seenAt = seenMap[it.key];
    if (seenAt) {
      seenItems.push({ item: it, seenAt });
    } else {
      unseenItems.push(it);
    }
  }

  // Sort seen items oldest seen first
  seenItems.sort((a, b) => a.seenAt - b.seenAt);

  const neededToRemove = items.length - maxCap;
  if (seenItems.length >= neededToRemove) {
    // We can remove entirely from seen items
    const remainingSeen = seenItems.slice(neededToRemove).map((x) => x.item);
    return [...unseenItems, ...remainingSeen];
  }

  // If seen items are exhausted, remove oldest unseen by addedAt
  unseenItems.sort((a, b) => a.addedAt - b.addedAt);
  const remainingToRemove = neededToRemove - seenItems.length;
  const remainingUnseen = unseenItems.slice(remainingToRemove);
  return remainingUnseen;
}

// Generic Bank Operations
function loadBankItems<T>(
  key: string,
  validator: (data: unknown) => data is BankContainer<T>,
): T[] {
  const container = safeGetItem<BankContainer<T>>(key, validator, { version: 1, items: [] });
  return container.items;
}

function saveBankItems<T extends { key: string; addedAt: number }>(
  key: string,
  items: T[],
  maxCap: number,
) {
  const seenMap = loadSeenMap();
  const capped = evictBankItems(items, maxCap, seenMap);

  safeSetItemWithEviction<BankContainer<T>>(
    key,
    { version: 1, items: capped },
    (container, fraction) => {
      const countToRemove = Math.ceil(container.items.length * fraction);
      return {
        version: 1,
        items: evictBankItems(container.items, container.items.length - countToRemove, seenMap),
      };
    },
  );
}

// ---------------- Quiz Bank API ----------------

export function loadQuizBank(): BankQuizItem[] {
  return loadBankItems<BankQuizItem>(BANK_QUIZ_KEY, isQuizBank);
}

export function saveQuizBank(items: BankQuizItem[]) {
  saveBankItems(BANK_QUIZ_KEY, items, CAPS.quizBank);
}

export function addQuestionsToBank(questions: BankQuizItem[]) {
  if (questions.length === 0) return;
  const current = loadQuizBank();
  const existingKeySet = new Set(current.map((q) => q.key));
  const newToAdd: BankQuizItem[] = [];

  for (const q of questions) {
    if (!existingKeySet.has(q.key)) {
      existingKeySet.add(q.key);
      newToAdd.push(q);
    }
  }

  if (newToAdd.length > 0) {
    saveQuizBank([...current, ...newToAdd]);
  }
}

// ---------------- Words Bank API ----------------

export function loadWordsBank(): BankWordItem[] {
  return loadBankItems<BankWordItem>(BANK_WORDS_KEY, isWordsBank);
}

export function saveWordsBank(items: BankWordItem[]) {
  saveBankItems(BANK_WORDS_KEY, items, CAPS.wordsBank);
}

export function addWordsToBank(words: BankWordItem[]) {
  if (words.length === 0) return;
  const current = loadWordsBank();
  const existingKeySet = new Set(current.map((w) => w.key));
  const newToAdd: BankWordItem[] = [];

  for (const w of words) {
    if (!existingKeySet.has(w.key)) {
      existingKeySet.add(w.key);
      newToAdd.push(w);
    }
  }

  if (newToAdd.length > 0) {
    saveWordsBank([...current, ...newToAdd]);
  }
}

// ---------------- Sentences Bank API ----------------

export function loadSentencesBank(): BankSentenceItem[] {
  return loadBankItems<BankSentenceItem>(BANK_SENTENCES_KEY, isSentencesBank);
}

export function saveSentencesBank(items: BankSentenceItem[]) {
  saveBankItems(BANK_SENTENCES_KEY, items, CAPS.sentencesBank);
}

export function addSentencesToBank(sentences: BankSentenceItem[]) {
  if (sentences.length === 0) return;
  const current = loadSentencesBank();
  const existingKeySet = new Set(current.map((s) => s.key));
  const existingWordSets = current.map((s) => s.words);
  const newToAdd: BankSentenceItem[] = [];

  for (const s of sentences) {
    if (existingKeySet.has(s.key)) continue;

    // Check Jaccard similarity against all existing and newly added sentences
    const isNearDuplicate =
      existingWordSets.some((words) => jaccardSimilarity(s.words, words) >= 0.8) ||
      newToAdd.some((other) => jaccardSimilarity(s.words, other.words) >= 0.8);

    if (!isNearDuplicate) {
      existingKeySet.add(s.key);
      existingWordSets.push(s.words);
      newToAdd.push(s);
    }
  }

  if (newToAdd.length > 0) {
    saveSentencesBank([...current, ...newToAdd]);
  }
}

// ---------------- Clear Bank API ----------------

export function clearAllBanks() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(BANK_QUIZ_KEY);
    localStorage.removeItem(BANK_WORDS_KEY);
    localStorage.removeItem(BANK_SENTENCES_KEY);
  } catch {
    // ignore
  }
}

// ---------------- 8. Selection Algorithm ----------------

/**
 * Selects candidate items for a round adhering to:
 * 1. Unseen bank items matching criteria (random, balanced)
 * 2. Shortfall to be fetched from AI
 * 3. Least-recently-seen bank items if still short
 * Never duplicates within a round.
 */
export function selectRoundBankItems<T extends { key: string; level: string }>(
  bankItems: T[],
  level: string,
  neededCount: number,
  filterFn?: (item: T) => boolean,
): { chosen: T[]; shortfall: number } {
  const seenMap = loadSeenMap();

  const matching = bankItems.filter((it) => it.level === level && (filterFn ? filterFn(it) : true));

  const unseen: T[] = [];
  const seen: { item: T; seenAt: number }[] = [];

  for (const it of matching) {
    const seenAt = seenMap[it.key];
    if (seenAt) {
      seen.push({ item: it, seenAt });
    } else {
      unseen.push(it);
    }
  }

  // Shuffle unseen using Fisher-Yates
  const shuffledUnseen = [...unseen];
  for (let i = shuffledUnseen.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffledUnseen[i]!;
    shuffledUnseen[i] = shuffledUnseen[j]!;
    shuffledUnseen[j] = temp;
  }

  const chosen: T[] = [];
  const chosenKeys = new Set<string>();

  for (const it of shuffledUnseen) {
    if (chosen.length >= neededCount) break;
    if (!chosenKeys.has(it.key)) {
      chosenKeys.add(it.key);
      chosen.push(it);
    }
  }

  const shortfall = neededCount - chosen.length;
  return { chosen, shortfall };
}

/**
 * Fills remaining shortfall from least-recently-seen items if AI or offline fallback is needed.
 */
export function fillFromLeastRecentlySeen<T extends { key: string; level: string }>(
  bankItems: T[],
  level: string,
  neededCount: number,
  alreadyChosenKeys: Set<string>,
  filterFn?: (item: T) => boolean,
): T[] {
  const seenMap = loadSeenMap();
  const matching = bankItems.filter(
    (it) =>
      it.level === level && !alreadyChosenKeys.has(it.key) && (filterFn ? filterFn(it) : true),
  );

  const scored = matching.map((it) => ({
    item: it,
    seenAt: seenMap[it.key] ?? 0,
  }));

  // Sort ascending: oldest seenAt first
  scored.sort((a, b) => a.seenAt - b.seenAt);

  const filled: T[] = [];
  for (const s of scored) {
    if (filled.length >= neededCount) break;
    if (!alreadyChosenKeys.has(s.item.key)) {
      alreadyChosenKeys.add(s.item.key);
      filled.push(s.item);
    }
  }

  return filled;
}

// ---------------- 9. Bank Statistics ----------------

export interface BankStats {
  quiz: {
    total: number;
    unseen: number;
    byLevel: Record<"easy" | "medium" | "hard", { total: number; unseen: number }>;
  };
  words: {
    total: number;
    unseen: number;
    byLevel: Record<"easy" | "medium" | "hard", { total: number; unseen: number }>;
  };
  sentences: {
    total: number;
    unseen: number;
    byLevel: Record<"easy" | "medium" | "hard", { total: number; unseen: number }>;
  };
}

export function getBankStats(): BankStats {
  const seenMap = loadSeenMap();

  const quiz = loadQuizBank();
  const words = loadWordsBank();
  const sentences = loadSentencesBank();

  const countFor = <T extends { key: string; level: "easy" | "medium" | "hard" }>(items: T[]) => {
    const res = {
      total: items.length,
      unseen: 0,
      byLevel: {
        easy: { total: 0, unseen: 0 },
        medium: { total: 0, unseen: 0 },
        hard: { total: 0, unseen: 0 },
      },
    };
    for (const it of items) {
      const isUnseen = !seenMap[it.key];
      if (isUnseen) res.unseen++;
      if (res.byLevel[it.level]) {
        res.byLevel[it.level].total++;
        if (isUnseen) res.byLevel[it.level].unseen++;
      }
    }
    return res;
  };

  return {
    quiz: countFor(quiz),
    words: countFor(words),
    sentences: countFor(sentences),
  };
}
