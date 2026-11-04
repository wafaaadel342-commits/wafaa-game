import type { Question } from "./quiz";

/** Tests if an image URL loads successfully within a specified timeout. */
export function testLoadImage(url: string, timeoutMs = 6000): Promise<boolean> {
  if (typeof window === "undefined" || !url) return Promise.resolve(false);
  return new Promise((resolve) => {
    let resolved = false;
    const img = new Image();
    img.referrerPolicy = "no-referrer";

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        img.onload = null;
        img.onerror = null;
        resolve(false);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(true);
      }
    };

    img.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(false);
      }
    };

    img.src = url;
  });
}

/** Preloads an image into the browser cache. */
export function preloadImage(url?: string) {
  if (typeof window === "undefined" || !url) return;
  const img = new Image();
  img.referrerPolicy = "no-referrer";
  img.src = url;
}

/** Fetch thumbnail from English Wikipedia API. */
async function fetchWikipediaThumbnail(query: string, timeoutMs = 5000): Promise<string | null> {
  const clean = query.trim().replace(/^"|"$/g, "");
  if (!clean) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      clean,
    )}&prop=pageimages&piprop=thumbnail&pithumbsize=800&redirects=1&format=json&origin=*`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const firstPage = Object.values(pages)[0] as
      { thumbnail?: { source?: string }; missing?: boolean } | undefined;
    if (firstPage?.thumbnail?.source) {
      return firstPage.thumbnail.source;
    }
    return null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** Fetch first image thumbnail from Wikimedia Commons search (for aerial city views). */
async function fetchCommonsAerialThumbnail(
  query: string,
  timeoutMs = 5000,
): Promise<string | null> {
  const clean = query.trim().replace(/^"|"$/g, "");
  if (!clean) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      clean,
    )}&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;

    const pageList = Object.values(pages) as Array<{
      imageinfo?: Array<{ thumburl?: string; url?: string }>;
    }>;

    for (const p of pageList) {
      const info = p.imageinfo?.[0];
      const target = info?.thumburl || info?.url;
      if (target && /\.(jpe?g|png|webp)(\?|$)/i.test(target)) {
        return target;
      }
    }
    return null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** Resolves the image URL for a single question based on category and metadata. */
export async function resolveQuestionImage(q: Question, timeoutMs = 6000): Promise<string | null> {
  const category = q.category;

  if (category === "flags") {
    let code = q.countryCode?.trim().toLowerCase();
    if (!code && q.imageQuery) {
      // fallback if model placed code in imageQuery
      const match = q.imageQuery.trim().match(/^[a-z]{2}$/i);
      if (match) code = match[0].toLowerCase();
    }
    if (!code || !/^[a-z]{2}$/.test(code)) return null;
    const flagUrl = `https://flagcdn.com/w640/${code}.png`;
    const ok = await testLoadImage(flagUrl, timeoutMs);
    return ok ? flagUrl : null;
  }

  if (
    category === "historical_figures" ||
    category === "cartoons" ||
    category === "football_players" ||
    category === "landmarks"
  ) {
    if (!q.imageQuery) return null;
    const thumb = await fetchWikipediaThumbnail(q.imageQuery, timeoutMs - 1500);
    if (!thumb) return null;
    const ok = await testLoadImage(thumb, timeoutMs);
    return ok ? thumb : null;
  }

  if (category === "aerial_city") {
    if (!q.imageQuery) return null;
    let thumb = await fetchCommonsAerialThumbnail(q.imageQuery, timeoutMs - 1500);
    if (!thumb) {
      // Fallback: try searching with plain title or skyline
      const simplified = q.imageQuery.replace(/aerial view/i, "skyline").trim();
      thumb = await fetchCommonsAerialThumbnail(simplified, timeoutMs - 1500);
    }
    if (!thumb) {
      // Fallback to Wikipedia page image if commons search had no match
      const cityTitle = q.imageQuery.replace(/aerial view/i, "").trim();
      thumb = await fetchWikipediaThumbnail(cityTitle, timeoutMs - 1500);
    }
    if (!thumb) return null;
    const ok = await testLoadImage(thumb, timeoutMs);
    return ok ? thumb : null;
  }

  // Non-image categories (capitals, quotes, general_knowledge)
  return null;
}

/**
 * Resolves images in parallel for all questions with a 6-second timeout before round starts.
 * Drops any question whose image fails, then trims to target count.
 */
export async function prepareRoundQuestions(
  rawQuestions: Question[],
  targetCount: number,
  timeoutMs = 6000,
): Promise<Question[]> {
  const resolutionPromises = rawQuestions.map(async (q): Promise<Question | null> => {
    const isImageCategory =
      q.category === "flags" ||
      q.category === "historical_figures" ||
      q.category === "cartoons" ||
      q.category === "football_players" ||
      q.category === "landmarks" ||
      q.category === "aerial_city";

    if (!isImageCategory) {
      return { ...q, imageUrl: undefined };
    }

    const resolvedUrl = await resolveQuestionImage(q, timeoutMs);
    if (!resolvedUrl) {
      return null; // Drop question if image resolution fails
    }
    return { ...q, imageUrl: resolvedUrl };
  });

  const results = await Promise.all(resolutionPromises);
  const validQuestions = results.filter((q): q is Question => q !== null);

  // Return up to targetCount
  return validQuestions.slice(0, targetCount);
}
