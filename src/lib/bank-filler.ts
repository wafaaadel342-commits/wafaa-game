import {
  addQuestionsToBank,
  addSentencesToBank,
  addWordsToBank,
  loadQuizBank,
  loadSentencesBank,
  loadWordsBank,
} from "./anti-repeat";
import { executeRawWithFailover, executeWithFailover, questionToBankItem } from "./providers";
import {
  ALL_CATEGORY_KEYS,
  buildPrompt,
  type CategoryKey,
  type Level,
  type Settings,
} from "./quiz";
import {
  buildSentencesPrompt,
  buildWordsPrompt,
  parseSentencesResponse,
  parseWordsResponse,
  rawSentenceToBankItem,
  rawWordToBankItem,
  type SentenceLevel,
  type WordLevel,
} from "./words";

export type FillTarget = "all" | "quiz" | "words" | "sentences";

export interface FillProgress {
  completed: number;
  total: number;
  currentTask: string;
}

const LEVELS_CYCLE: ("easy" | "medium" | "hard")[] = ["easy", "medium", "hard"];

/**
 * Fills the local content bank in sequential batches of ~15-20 items.
 * Uses the candidate provider pool with automatic failover.
 * Pauses ~1s between batches and respects cancellation.
 */
export async function runBankFilling(
  settings: Settings,
  target: FillTarget,
  totalRequested: number,
  onProgress: (p: FillProgress) => void,
  isCancelled: () => boolean,
): Promise<{ added: number; error?: string }> {
  let completed = 0;
  const batchSize = 15;
  let cycleIndex = 0;

  // Decide targets sequence
  const targetsSequence: ("quiz" | "words" | "sentences")[] =
    target === "all" ? ["quiz", "words", "sentences"] : [target];

  let seqIdx = 0;

  while (completed < totalRequested) {
    if (isCancelled()) {
      return { added: completed };
    }

    const currentType = targetsSequence[seqIdx % targetsSequence.length]!;
    seqIdx++;

    const currentLevel = LEVELS_CYCLE[cycleIndex % LEVELS_CYCLE.length]!;
    cycleIndex++;

    const countThisBatch = Math.min(batchSize, totalRequested - completed);

    if (currentType === "quiz") {
      onProgress({
        completed,
        total: totalRequested,
        currentTask: `توليد ${countThisBatch} سؤالاً لتحدّي المعرفة (مستوى: ${currentLevel})...`,
      });

      try {
        const bank = loadQuizBank();
        const avoid = bank.slice(-60).map((q) => q.topicKey || q.question);
        const categories: CategoryKey[] = ALL_CATEGORY_KEYS;
        const prompt = buildPrompt(currentLevel as Level, countThisBatch, categories, [], avoid);

        const rawQuestions = await executeWithFailover(settings, prompt, 35000, 1);
        const bankItems = rawQuestions.map((q) => questionToBankItem(q, currentLevel as Level));
        addQuestionsToBank(bankItems);
        completed += bankItems.length;
      } catch (err: unknown) {
        console.warn("Quiz batch fill failed:", err);
        return {
          added: completed,
          error:
            completed > 0
              ? `تمت إضافة ${completed} عنصراً، ثم توقفت التعبئة لتعذر استجابة المزودين.`
              : "تعذرت استجابة المزودين لتعبئة البنك، تحقق من صحة المفاتيح والنماذج.",
        };
      }
    } else if (currentType === "words") {
      onProgress({
        completed,
        total: totalRequested,
        currentTask: `توليد ${countThisBatch} كلمة للعبة ركّب الكلمة (مستوى: ${currentLevel})...`,
      });

      try {
        const bank = loadWordsBank();
        const avoid = bank.slice(-60).map((w) => w.word);
        const prompt = buildWordsPrompt(currentLevel as WordLevel, countThisBatch, avoid);

        const rawText = await executeRawWithFailover(settings, prompt, 30000);
        const parsed = parseWordsResponse(rawText, currentLevel as WordLevel);
        const bankItems = parsed.map((w) => rawWordToBankItem(w, currentLevel as WordLevel));
        addWordsToBank(bankItems);
        completed += bankItems.length;
      } catch (err: unknown) {
        console.warn("Words batch fill failed:", err);
        return {
          added: completed,
          error:
            completed > 0
              ? `تمت إضافة ${completed} عنصراً، ثم توقفت التعبئة لتعذر استجابة المزودين.`
              : "تعذرت استجابة المزودين لتعبئة البنك، تحقق من صحة المفاتيح والنماذج.",
        };
      }
    } else {
      // Sentences
      onProgress({
        completed,
        total: totalRequested,
        currentTask: `توليد ${countThisBatch} جملة للعبة ركّب الجملة (مستوى: ${currentLevel})...`,
      });

      try {
        const bank = loadSentencesBank();
        const avoid = bank.slice(-50).map((s) => s.sentence);
        const prompt = buildSentencesPrompt(currentLevel as SentenceLevel, countThisBatch, avoid);

        const rawText = await executeRawWithFailover(settings, prompt, 30000);
        const parsed = parseSentencesResponse(rawText, currentLevel as SentenceLevel);
        const bankItems = parsed.map(rawSentenceToBankItem);
        addSentencesToBank(bankItems);
        completed += bankItems.length;
      } catch (err: unknown) {
        console.warn("Sentences batch fill failed:", err);
        return {
          added: completed,
          error:
            completed > 0
              ? `تمت إضافة ${completed} عنصراً، ثم توقفت التعبئة لتعذر استجابة المزودين.`
              : "تعذرت استجابة المزودين لتعبئة البنك، تحقق من صحة المفاتيح والنماذج.",
        };
      }
    }

    onProgress({
      completed,
      total: totalRequested,
      currentTask: `تم حفظ الدفعة بنجاح (+${countThisBatch}). الاستعداد للدفعة التالية...`,
    });

    // Pause ~1s between batches if more remain
    if (completed < totalRequested && !isCancelled()) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { added: completed };
}
