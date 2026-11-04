export interface ModelItem {
  id: string;
  label: string;
  isFree?: boolean;
}

const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedData {
  timestamp: number;
  models: ModelItem[];
}

function getCached(key: string): ModelItem[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedData;
    if (Date.now() - parsed.timestamp < CACHE_EXPIRY_MS && Array.isArray(parsed.models)) {
      return parsed.models;
    }
  } catch {
    // ignore
  }
  return null;
}

function setCached(key: string, models: ModelItem[]) {
  try {
    const data: CachedData = { timestamp: Date.now(), models };
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore
  }
}

/** Fetches text generation models from Google AI Studio (Gemini). */
export async function fetchGeminiModels(
  apiKey: string,
  forceRefresh = false,
): Promise<ModelItem[]> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return [];

  const cacheKey = `tahaddi-models-gemini-${cleanKey.slice(-6)}`;
  if (!forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached && cached.length > 0) return cached;
  }

  const allModels: ModelItem[] = [];
  let pageToken: string | undefined = undefined;

  const excludedSubstrings = ["embedding", "imagen", "veo", "tts", "aqa", "speech", "whisper"];

  try {
    for (let page = 0; page < 4; page++) {
      const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
      url.searchParams.set("pageSize", "200");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url.toString(), {
        headers: {
          "x-goog-api-key": cleanKey,
        },
      });

      if (!res.ok) {
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          throw new Error("المفتاح غير صالح");
        }
        throw new Error("تعذّر تحميل القائمة");
      }

      const data = await res.json();
      const rawList = Array.isArray(data?.models) ? data.models : [];

      for (const m of rawList) {
        const methods = Array.isArray(m.supportedGenerationMethods)
          ? m.supportedGenerationMethods
          : [];
        if (!methods.includes("generateContent")) continue;

        const rawName = String(m.name || "");
        const id = rawName.replace(/^models\//, "");
        const lowerId = id.toLowerCase();

        // Exclude embeddings, image/video generation, and TTS models
        if (excludedSubstrings.some((sub) => lowerId.includes(sub))) {
          continue;
        }

        const label = String(m.displayName || id);
        allModels.push({ id, label });
      }

      pageToken = typeof data?.nextPageToken === "string" ? data.nextPageToken : undefined;
      if (!pageToken) break;
    }
  } catch (err: unknown) {
    if (err instanceof Error) throw err;
    throw new Error("تعذّر تحميل القائمة");
  }

  if (allModels.length > 0) {
    setCached(cacheKey, allModels);
  }
  return allModels;
}

/** Fetches models from OpenRouter (no API key needed for model catalogue). */
export async function fetchOpenRouterModels(forceRefresh = false): Promise<ModelItem[]> {
  const cacheKey = "tahaddi-models-openrouter";
  if (!forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached && cached.length > 0) return cached;
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    if (!res.ok) {
      throw new Error("تعذّر تحميل القائمة");
    }

    const json = await res.json();
    const dataList = Array.isArray(json?.data) ? json.data : [];
    const models: ModelItem[] = [];

    for (const item of dataList) {
      const id = String(item.id || "");
      if (!id) continue;

      const modality = String(item.architecture?.modality || "");
      // Keep text-output models
      if (modality && !modality.includes("->text")) {
        continue;
      }

      const isFree =
        id.endsWith(":free") ||
        (String(item.pricing?.prompt) === "0" && String(item.pricing?.completion) === "0");

      models.push({
        id,
        label: String(item.name || id),
        isFree,
      });
    }

    if (models.length > 0) {
      setCached(cacheKey, models);
    }
    return models;
  } catch (err: unknown) {
    if (err instanceof Error) throw err;
    throw new Error("تعذّر تحميل القائمة");
  }
}

/** Picks a sensible default model when no model has been selected yet. */
export function getSensibleDefault(provider: "gemini" | "openrouter", models: ModelItem[]): string {
  if (models.length === 0) {
    return provider === "gemini" ? "gemini-2.5-flash" : "openai/gpt-4o-mini";
  }

  if (provider === "gemini") {
    // Prefer modern flash models
    const flash = models.find((m) => m.id.toLowerCase().includes("flash") && !m.id.includes("8b"));
    if (flash) return flash.id;
    const anyFlash = models.find((m) => m.id.toLowerCase().includes("flash"));
    if (anyFlash) return anyFlash.id;
    return models[0]!.id;
  }

  // OpenRouter: prefer a free model or popular flash model
  const freeModel = models.find(
    (m) =>
      m.isFree &&
      (m.id.toLowerCase().includes("flash") ||
        m.id.toLowerCase().includes("mini") ||
        m.id.toLowerCase().includes("chat")),
  );
  if (freeModel) return freeModel.id;

  const anyFree = models.find((m) => m.isFree);
  if (anyFree) return anyFree.id;

  return models[0]!.id;
}
