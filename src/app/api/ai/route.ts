import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'arcee-ai/trinity-large-preview:free';

const SYSTEM_PROMPT = `Ты — эксперт по кино и сериалам. Отвечай ТОЛЬКО валидным JSON без markdown-блоков, без \`\`\`.
Рекомендуй фильмы и сериалы всех стран и эпох.
Названия фильмов давай на русском языке (как они известны в русскоязычном прокате).
Не повторяй одни и те же фильмы. Будь разнообразен в рекомендациях.`;

interface AiMessage {
  role: 'system' | 'user';
  content: string;
}

function buildMessages(action: string, payload: Record<string, unknown>): AiMessage[] {
  const watchedTitles = payload.watchedTitles as string[] | undefined;
  const watchedNote = watchedTitles && watchedTitles.length > 0
    ? `\nПользователь уже смотрел: ${watchedTitles.join(', ')}.\nНЕ рекомендуй эти фильмы. Учитывай их при анализе вкуса.\n`
    : '';

  switch (action) {
    case 'quickRecommendations': {
      const tags = payload.tags as string[];
      return [{
        role: 'user',
        content: `${watchedNote}Пользователь хочет посмотреть кино с такими настроениями: ${tags.join(', ')}.
Подбери 10 фильмов или сериалов которые идеально подходят.
Верни JSON: { "films": ["название1", "название2", ...] }`,
      }];
    }
    case 'probeFilms': {
      const userQuery = payload.userQuery as string;
      return [{
        role: 'user',
        content: `${watchedNote}Пользователь описал что хочет посмотреть: "${userQuery}"

Проанализируй запрос. Извлеки 3-6 ключевых тегов (жанр, настроение, тип персонажа, атмосфера).
Предложи 10 пробных фильмов/сериалов чтобы понять вкус пользователя — выбирай разнообразные, от очевидных до неожиданных.
Верни JSON: { "tags": ["тег1", "тег2", ...], "films": ["название1", "название2", ...] }`,
      }];
    }
    case 'finalRecommendations': {
      const { userQuery, liked, disliked, skipped } = payload as {
        userQuery: string; liked: string[]; disliked: string[]; skipped: string[];
      };
      return [{
        role: 'user',
        content: `${watchedNote}Изначальный запрос пользователя: "${userQuery}"

Обратная связь по пробным фильмам:
${(liked as string[]).length > 0 ? `Понравились: ${(liked as string[]).join(', ')}` : 'Ничего не понравилось'}
${(disliked as string[]).length > 0 ? `Не понравились: ${(disliked as string[]).join(', ')}` : ''}
${(skipped as string[]).length > 0 ? `Не смотрел: ${(skipped as string[]).join(', ')}` : ''}

На основе этой обратной связи подбери 10 финальных рекомендаций. Учитывай что понравилось и НЕ предлагай то что не зашло и похожее на это.
Для каждого фильма укажи короткую причину (2-4 слова) почему он подходит.
Верни JSON: { "films": [{ "name": "Название", "reason": "причина" }, ...] }`,
      }];
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

function parseAiJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned) as T;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action, ...payload } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action field' }, { status: 400 });
    }

    const userMessages = buildMessages(action, payload);
    const messages = [{ role: 'system' as const, content: SYSTEM_PROMPT }, ...userMessages];

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://shonya-films.vercel.app',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.85,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `OpenRouter error: ${response.status}`, details: text },
        { status: response.status },
      );
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const parsed = parseAiJson(raw);

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
