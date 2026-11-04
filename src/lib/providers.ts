import {
  addQuestionsToBank,
  cyrb53,
  fillFromLeastRecentlySeen,
  loadQuizBank,
  selectRoundBankItems,
  type BankQuizItem,
} from "./anti-repeat";
import { prepareRoundQuestions } from "./images";
import {
  buildPrompt,
  getQuestionDedupeKey,
  getRecent,
  parseQuestions,
  QuizError,
  rememberQuestions,
  type CategoryKey,
  type Level,
  type Question,
  type Settings,
} from "./quiz";

interface Candidate {
  provider: "gemini" | "openrouter";
  modelId: string;
  apiKey: string;
}

// In-memory model failure tracking (5-minute skip)
const failedModels = new Map<string, number>();

function markModelFailed(key: string) {
  failedModels.set(key, Date.now() + 5 * 60 * 1000);
}

function isModelCoolingDown(key: string): boolean {
  const until = failedModels.get(key);
  if (!until) return false;
  if (Date.now() > until) {
    failedModels.delete(key);
    return false;
  }
  return true;
}

/** Record the last successfully used model for display in Settings */
export function recordLastUsedModel(modelLabel: string) {
  try {
    const raw = localStorage.getItem("tahaddi-settings");
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.lastUsedModel = modelLabel;
    localStorage.setItem("tahaddi-settings", JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

/** Shuffles an array randomly (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
}

/** Builds candidate pool = all selected models of all providers that have keys */
function buildCandidates(settings: Settings): Candidate[] {
  const candidates: Candidate[] = [];
  const geminiKey = settings.geminiKey.trim();
  if (geminiKey) {
    const models = settings.geminiModels.length > 0 ? settings.geminiModels : ["gemini-2.5-flash"];
    for (const m of models) {
      if (m.trim()) {
        candidates.push({ provider: "gemini", modelId: m.trim(), apiKey: geminiKey });
      }
    }
  }

  const openrouterKey = settings.openrouterKey.trim();
  if (openrouterKey) {
    const models = settings.openrouterModels.length > 0 ? settings.openrouterModels : [];
    for (const m of models) {
      if (m.trim()) {
        candidates.push({ provider: "openrouter", modelId: m.trim(), apiKey: openrouterKey });
      }
    }
  }

  return candidates;
}

/** Returns shuffled candidate pool filtering out temporarily failed models */
function getShuffledCandidates(settings: Settings): Candidate[] {
  const all = buildCandidates(settings);
  if (all.length === 0) return [];

  const available = all.filter((c) => !isModelCoolingDown(`${c.provider}:${c.modelId}`));
  // If all are cooling down, reset and try all again
  if (available.length === 0) {
    failedModels.clear();
    return shuffle(all);
  }
  return shuffle(available);
}

/** Single candidate attempt with timeout */
async function callCandidate(
  candidate: Candidate,
  prompt: string,
  timeoutMs: number,
  minCount: number,
): Promise<Question[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (candidate.provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate.modelId)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": candidate.apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 1.0,
            },
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const text: string =
        json?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("") ?? "";
      if (!text.trim()) throw new Error("Empty response");

      return parseQuestions(text, minCount);
    } else {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${candidate.apiKey}`,
        },
        body: JSON.stringify({
          model: candidate.modelId,
          messages: [{ role: "user", content: prompt }],
          temperature: 1.0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const text: string = json?.choices?.[0]?.message?.content ?? "";
      if (!text.trim()) throw new Error("Empty response");

      return parseQuestions(text, minCount);
    }
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Executes a request trying candidates from the shuffled pool with automatic failover.
 */
export async function executeWithFailover(
  settings: Settings,
  prompt: string,
  timeoutMs: number,
  minCount: number,
): Promise<Question[]> {
  const candidates = getShuffledCandidates(settings);
  if (candidates.length === 0) {
    throw new QuizError("MISSING_KEY");
  }

  // If only 1 candidate exists, try twice
  const attempts: Candidate[] =
    candidates.length === 1 ? [candidates[0]!, candidates[0]!] : [...candidates];

  let lastError: unknown = null;

  for (const candidate of attempts) {
    const candidateKey = `${candidate.provider}:${candidate.modelId}`;
    try {
      const questions = await callCandidate(candidate, prompt, timeoutMs, minCount);
      const providerLabel = candidate.provider === "gemini" ? "Google Gemini" : "OpenRouter";
      recordLastUsedModel(`${providerLabel} (${candidate.modelId})`);
      return questions;
    } catch (err) {
      lastError = err;
      markModelFailed(candidateKey);
    }
  }

  // All candidates failed
  if (lastError instanceof QuizError) throw lastError;
  throw new QuizError("SERVER");
}

/** Single raw candidate attempt returning raw text with timeout */
async function callRawCandidate(
  candidate: Candidate,
  prompt: string,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (candidate.provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate.modelId)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": candidate.apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 1.0,
            },
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const text: string =
        json?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("") ?? "";
      if (!text.trim()) throw new Error("Empty response");

      return text;
    } else {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${candidate.apiKey}`,
        },
        body: JSON.stringify({
          model: candidate.modelId,
          messages: [{ role: "user", content: prompt }],
          temperature: 1.0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const text: string = json?.choices?.[0]?.message?.content ?? "";
      if (!text.trim()) throw new Error("Empty response");

      return text;
    }
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Executes a raw prompt with automatic failover across candidates.
 */
export async function executeRawWithFailover(
  settings: Settings,
  prompt: string,
  timeoutMs = 25000,
): Promise<string> {
  const candidates = getShuffledCandidates(settings);
  if (candidates.length === 0) {
    throw new QuizError("MISSING_KEY");
  }

  const attempts: Candidate[] =
    candidates.length === 1 ? [candidates[0]!, candidates[0]!] : [...candidates];

  let lastError: unknown = null;

  for (const candidate of attempts) {
    const candidateKey = `${candidate.provider}:${candidate.modelId}`;
    try {
      const text = await callRawCandidate(candidate, prompt, timeoutMs);
      const providerLabel = candidate.provider === "gemini" ? "Google Gemini" : "OpenRouter";
      recordLastUsedModel(`${providerLabel} (${candidate.modelId})`);
      return text;
    } catch (err) {
      lastError = err;
      markModelFailed(candidateKey);
    }
  }

  if (lastError instanceof QuizError) throw lastError;
  throw new QuizError("SERVER");
}

/** Convert Question to BankQuizItem without resolved imageUrl */
export function questionToBankItem(q: Question, level: Level): BankQuizItem {
  const key = getQuestionDedupeKey(q);
  return {
    id: cyrb53(key),
    key,
    level,
    category: q.category,
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    topicKey: q.topicKey,
    countryCode: q.countryCode,
    imageQuery: q.imageQuery,
    addedAt: Date.now(),
  };
}

/** Convert BankQuizItem to Question */
export function bankItemToQuestion(item: BankQuizItem): Question {
  return {
    category: item.category,
    question: item.question,
    options: item.options,
    correctIndex: item.correctIndex,
    explanation: item.explanation,
    topicKey: item.topicKey,
    countryCode: item.countryCode,
    imageQuery: item.imageQuery,
  };
}

/**
 * Step 1: Initial batch load (fast start).
 * First checks bank for 2 matching unseen questions.
 * If bank is short, generates 3 questions (+ spares) from AI and stores in bank.
 */
export async function fetchInitialBatch(
  level: Level,
  settings: Settings,
  categories: CategoryKey[],
): Promise<Question[]> {
  // 1. Check persistent bank first
  const bank = loadQuizBank();
  const { chosen } = selectRoundBankItems<BankQuizItem>(bank, level, 2, (item) =>
    categories.includes(item.category as CategoryKey),
  );

  if (chosen.length >= 2) {
    const questions = chosen.map(bankItemToQuestion);
    const prepared = await prepareRoundQuestions(questions, 2, 4000);
    if (prepared.length >= 2) {
      rememberQuestions(prepared);
      return prepared;
    }
  }

  // 2. Shortfall: request 3 questions from AI
  const recent = getRecent();
  const avoidKeys = bank.slice(-60).map((b) => b.topicKey || b.question);
  const prompt = buildPrompt(level, 3, categories, recent, avoidKeys);

  const tryFetch = async (): Promise<Question[]> => {
    const raw = await executeWithFailover(settings, prompt, 20000, 1);
    // Store in bank immediately before resolving images (so spares are preserved)
    addQuestionsToBank(raw.map((q) => questionToBankItem(q, level)));
    const prepared = await prepareRoundQuestions(raw, 2, 6000);
    return prepared;
  };

  try {
    let result = await tryFetch();
    if (result.length < 2) {
      result = await tryFetch();
    }
    if (result.length === 0) {
      throw new QuizError("INVALID_RESPONSE");
    }
    rememberQuestions(result);
    return result;
  } catch (e) {
    // If AI fails, check if we have any least-recently-seen bank items as fallback
    const fallbackBankItems = fillFromLeastRecentlySeen<BankQuizItem>(
      bank,
      level,
      2,
      new Set(),
      (item) => categories.includes(item.category as CategoryKey),
    );
    if (fallbackBankItems.length >= 2) {
      const prepared = await prepareRoundQuestions(
        fallbackBankItems.map(bankItemToQuestion),
        2,
        4000,
      );
      if (prepared.length >= 2) {
        rememberQuestions(prepared);
        return prepared;
      }
    }
    throw e;
  }
}

/**
 * Step 2: Background batch for all remaining questions.
 * Checks bank first, generates only shortfall + 5 spares from AI, stores to bank.
 */
export async function fetchRemainingBatch(
  level: Level,
  settings: Settings,
  remainingNeeded: number,
  categories: CategoryKey[],
  existingQuestions: Question[],
): Promise<Question[]> {
  if (remainingNeeded <= 0) return [];

  const bank = loadQuizBank();
  const existingKeys = new Set(existingQuestions.map(getQuestionDedupeKey));

  // Check bank for matching unseen questions
  const { chosen: bankChosen, shortfall } = selectRoundBankItems<BankQuizItem>(
    bank,
    level,
    remainingNeeded,
    (item) => categories.includes(item.category as CategoryKey) && !existingKeys.has(item.key),
  );

  let candidateQuestions: Question[] = bankChosen.map(bankItemToQuestion);

  if (shortfall > 0) {
    const countToGenerate = shortfall + 5; // Request shortfall + 5 spares
    const recent = getRecent();
    const avoidTitles = [
      ...existingQuestions.map((q) => q.question),
      ...bankChosen.map((q) => q.question),
      ...bank.slice(-60).map((b) => b.topicKey || b.question),
    ];
    const prompt = buildPrompt(level, countToGenerate, categories, recent, avoidTitles);

    const tryFetch = async (): Promise<Question[]> => {
      const raw = await executeWithFailover(settings, prompt, 45000, 1);
      // Store all newly generated questions in bank
      addQuestionsToBank(raw.map((q) => questionToBankItem(q, level)));
      return raw;
    };

    try {
      const generated = await tryFetch();
      candidateQuestions = [...candidateQuestions, ...generated];
    } catch {
      try {
        const retryGenerated = await tryFetch();
        candidateQuestions = [...candidateQuestions, ...retryGenerated];
      } catch {
        // AI failed, fill from least-recently-seen bank items
        const chosenKeys = new Set(candidateQuestions.map(getQuestionDedupeKey));
        const leastSeen = fillFromLeastRecentlySeen<BankQuizItem>(
          bank,
          level,
          shortfall,
          new Set([...existingKeys, ...chosenKeys]),
          (item) => categories.includes(item.category as CategoryKey),
        );
        candidateQuestions = [...candidateQuestions, ...leastSeen.map(bankItemToQuestion)];
      }
    }
  }

  const prepared = await prepareRoundQuestions(candidateQuestions, remainingNeeded, 6000);
  rememberQuestions(prepared);
  return prepared;
}
