import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'stepfun-ai/step-3.5-flash:free';

const SYSTEM_PROMPT = `Ты — кинокритик-эксперт с глубоким знанием мирового кинематографа. Отвечай ТОЛЬКО валидным JSON без markdown-блоков, без \`\`\`.

Правила:
- Названия фильмов давай на русском языке (как в русскоязычном прокате)
- Для каждого фильма ОБЯЗАТЕЛЬНО указывай год выпуска
- Рекомендуй разнообразно: разные страны, эпохи, режиссёры
- Смешивай известные и малоизвестные фильмы (70% популярных, 30% артхаус/нишевых)
- НЕ повторяй фильмы. Каждая рекомендация должна быть уникальной
- Предпочитай фильмы с высоким рейтингом (7+ на Кинопоиске)`;

interface AiMessage {
  role: 'system' | 'user';
  content: string;
}

function buildMessages(action: string, payload: Record<string, unknown>): AiMessage[] {
  const watchedTitles = payload.watchedTitles as string[] | undefined;
  const watchedReactions = payload.watchedReactions as Array<{ title: string; reaction?: string }> | undefined;

  let watchedNote = '';
  if (watchedReactions && watchedReactions.length > 0) {
    const liked = watchedReactions.filter((w) => w.reaction === 'liked').map((w) => w.title);
    const neutral = watchedReactions.filter((w) => w.reaction === 'neutral').map((w) => w.title);
    const disliked = watchedReactions.filter((w) => w.reaction === 'disliked').map((w) => w.title);
    const noReaction = watchedReactions.filter((w) => !w.reaction).map((w) => w.title);

    watchedNote = '\nИстория просмотров пользователя:\n';
    if (liked.length > 0) watchedNote += `Очень понравились: ${liked.join(', ')}\n`;
    if (neutral.length > 0) watchedNote += `Нормально отнёсся: ${neutral.join(', ')}\n`;
    if (disliked.length > 0) watchedNote += `Не понравились: ${disliked.join(', ')}\n`;
    if (noReaction.length > 0) watchedNote += `Смотрел (без оценки): ${noReaction.join(', ')}\n`;
    watchedNote += 'НЕ рекомендуй эти фильмы. Используй эту историю чтобы понять вкус пользователя — рекомендуй похожее на то что понравилось, избегай похожего на то что не понравилось.\n';
  } else if (watchedTitles && watchedTitles.length > 0) {
    watchedNote = `\nПользователь уже смотрел: ${watchedTitles.join(', ')}.\nНЕ рекомендуй эти фильмы. Учитывай их при анализе вкуса.\n`;
  }

  switch (action) {
    case 'quickRecommendations': {
      const tags = payload.tags as string[];
      return [{
        role: 'user',
        content: `${watchedNote}Пользователь хочет посмотреть кино с такими настроениями: ${tags.join(', ')}.
Подбери 12 фильмов или сериалов которые идеально подходят. Миксуй классику и современное кино.
Верни JSON: { "films": [{ "name": "Название", "year": 2020 }, ...] }`,
      }];
    }
    case 'probeFilms': {
      const userQuery = payload.userQuery as string;
      return [{
        role: 'user',
        content: `${watchedNote}Пользователь описал что хочет посмотреть: "${userQuery}"

Проанализируй запрос. Извлеки 3-6 ключевых тегов (жанр, настроение, тип персонажа, атмосфера).
Предложи 10 пробных фильмов/сериалов чтобы понять вкус пользователя — выбирай разнообразные, от очевидных до неожиданных. Включи фильмы разных десятилетий и стран.
Верни JSON: { "tags": ["тег1", ...], "films": [{ "name": "Название", "year": 2020 }, ...] }`,
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

Проанализируй что общего у понравившихся фильмов (стиль, атмосфера, темы). Подбери 12 финальных рекомендаций. НЕ предлагай фильмы похожие на те что не понравились.
Для каждого фильма укажи короткую причину (2-5 слов) почему он подходит именно этому пользователю.
Верни JSON: { "films": [{ "name": "Название", "year": 2020, "reason": "причина" }, ...] }`,
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
        temperature: 0.7,
        max_tokens: 2000,
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
