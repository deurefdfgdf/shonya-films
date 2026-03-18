import { KinoAPI, type Film, getFilmId } from './api';

export interface AiProbeResponse {
  tags: string[];
  films: string[];
}

export interface AiFinalResponse {
  films: Array<{ name: string; reason: string }>;
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

export async function getQuickRecommendations(tags: string[], watchedTitles?: string[]): Promise<{ films: string[] }> {
  return callAiApi({ action: 'quickRecommendations', tags, watchedTitles });
}

export async function getProbeFilms(userQuery: string, watchedTitles?: string[]): Promise<AiProbeResponse> {
  return callAiApi({ action: 'probeFilms', userQuery, watchedTitles });
}

export async function getFinalRecommendations(
  userQuery: string,
  liked: string[],
  disliked: string[],
  skipped: string[],
  watchedTitles?: string[],
): Promise<AiFinalResponse> {
  return callAiApi({ action: 'finalRecommendations', userQuery, liked, disliked, skipped, watchedTitles });
}

export async function resolveFilmNames(names: string[]): Promise<Film[]> {
  const results = await Promise.allSettled(
    names.map((name) => KinoAPI.searchFilms(name))
  );

  const films: Film[] = [];
  const seenIds = new Set<number>();

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const items = result.value.films || result.value.items || [];
      const first = items[0];
      if (first) {
        const id = getFilmId(first);
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          films.push(first);
        }
      }
    }
  }

  return films;
}
