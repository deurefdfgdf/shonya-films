import { KinoAPI, type Film, getFilmId } from './api';

interface AiFilmEntry {
  name: string;
  year?: number;
  reason?: string;
}

export interface AiProbeResponse {
  tags: string[];
  films: AiFilmEntry[] | string[];
}

export interface AiFinalResponse {
  films: Array<{ name: string; year?: number; reason: string }>;
}

async function callAiApi<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `AI API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export type WatchedReaction = { title: string; reaction?: string };

export async function getQuickRecommendations(tags: string[], watchedTitles?: string[], watchedReactions?: WatchedReaction[]): Promise<{ films: AiFilmEntry[] | string[] }> {
  return callAiApi({ action: 'quickRecommendations', tags, watchedTitles, watchedReactions });
}

export async function getProbeFilms(userQuery: string, watchedTitles?: string[], watchedReactions?: WatchedReaction[]): Promise<AiProbeResponse> {
  return callAiApi({ action: 'probeFilms', userQuery, watchedTitles, watchedReactions });
}

export async function getFinalRecommendations(
  userQuery: string,
  liked: string[],
  disliked: string[],
  skipped: string[],
  watchedTitles?: string[],
  watchedReactions?: WatchedReaction[],
): Promise<AiFinalResponse> {
  return callAiApi({ action: 'finalRecommendations', userQuery, liked, disliked, skipped, watchedTitles, watchedReactions });
}

function normalizeFilmEntries(entries: AiFilmEntry[] | string[]): AiFilmEntry[] {
  return entries.map((e) => (typeof e === 'string' ? { name: e } : e));
}

export async function resolveFilmNames(entries: AiFilmEntry[] | string[]): Promise<Film[]> {
  const normalized = normalizeFilmEntries(entries);

  const results = await Promise.allSettled(
    normalized.map((entry) => {
      const query = entry.year ? `${entry.name} ${entry.year}` : entry.name;
      return KinoAPI.searchFilms(query);
    })
  );

  const films: Film[] = [];
  const seenIds = new Set<number>();

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      const items = result.value.films || result.value.items || [];
      const entry = normalized[i];
      // Prefer a match with the right year
      const match = (entry.year
        ? items.find((f: Film) => f.year === entry.year) || items[0]
        : items[0]) as Film | undefined;
      if (match) {
        const id = getFilmId(match);
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          films.push(match);
        }
      }
    }
  }

  return films;
}
