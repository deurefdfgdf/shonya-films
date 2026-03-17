import { KinoAPI, type Film, getFilmId } from './api';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_KEY = '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';
const MODEL = 'openrouter/hunter-alpha';

const SYSTEM_PROMPT = `Ты — эксперт по кино и сериалам. Отвечай ТОЛЬКО валидным JSON без markdown-блоков, без \`\`\`.
Рекомендуй фильмы и сериалы всех стран и эпох.
Названия фильмов давай на русском языке (как они известны в русскоязычном прокате).
Не повторяй одни и те же фильмы. Будь разнообразен в рекомендациях.`;

interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiProbeResponse {
  tags: string[];
  films: string[];
}

export interface AiFinalResponse {
  films: Array<{ name: string; reason: string }>;
}

async function callOpenRouter(messages: AiMessage[]): Promise<string> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://shonya-films.github.io',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system' as const, content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.85,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseAiJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/```json?\n?/g, '')
    .replace(/```/g, '')
    .trim();
  return JSON.parse(cleaned) as T;
}

export async function getQuickRecommendations(tags: string[]): Promise<{ films: string[] }> {
  const raw = await callOpenRouter([
    {
      role: 'user',
      content: `Пользователь хочет посмотреть кино с такими настроениями: ${tags.join(', ')}.
Подбери 10 фильмов или сериалов которые идеально подходят.
Верни JSON: { "films": ["название1", "название2", ...] }`,
    },
  ]);
  return parseAiJson(raw);
}

export async function getProbeFilms(userQuery: string): Promise<AiProbeResponse> {
  const raw = await callOpenRouter([
    {
      role: 'user',
      content: `Пользователь описал что хочет посмотреть: "${userQuery}"

Проанализируй запрос. Извлеки 3-6 ключевых тегов (жанр, настроение, тип персонажа, атмосфера).
Предложи 10 пробных фильмов/сериалов чтобы понять вкус пользователя — выбирай разнообразные, от очевидных до неожиданных.
Верни JSON: { "tags": ["тег1", "тег2", ...], "films": ["название1", "название2", ...] }`,
    },
  ]);
  return parseAiJson(raw);
}

export async function getFinalRecommendations(
  userQuery: string,
  liked: string[],
  disliked: string[],
  skipped: string[]
): Promise<AiFinalResponse> {
  const raw = await callOpenRouter([
    {
      role: 'user',
      content: `Изначальный запрос пользователя: "${userQuery}"

Обратная связь по пробным фильмам:
${liked.length > 0 ? `Понравились: ${liked.join(', ')}` : 'Ничего не понравилось'}
${disliked.length > 0 ? `Не понравились: ${disliked.join(', ')}` : ''}
${skipped.length > 0 ? `Не смотрел: ${skipped.join(', ')}` : ''}

На основе этой обратной связи подбери 10 финальных рекомендаций. Учитывай что понравилось и НЕ предлагай то что не зашло и похожее на это.
Для каждого фильма укажи короткую причину (2-4 слова) почему он подходит.
Верни JSON: { "films": [{ "name": "Название", "reason": "причина" }, ...] }`,
    },
  ]);
  return parseAiJson(raw);
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
