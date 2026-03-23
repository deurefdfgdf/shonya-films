import { NextRequest, NextResponse } from 'next/server';

const CACHE = new Map<string, { id: string | null; time: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
        return NextResponse.json({ id: null }, { status: 400 });
    }

    const now = Date.now();
    const cached = CACHE.get(q);
    if (cached && now - cached.time < CACHE_TTL) {
        return NextResponse.json({ id: cached.id });
    }

    try {
        const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            },
        });

        if (!response.ok) {
            throw new Error(`YouTube responded with ${response.status}`);
        }

        const html = await response.text();
        // Look for the standard video identifier in the raw JSON state pushed in YouTube's HTML
        // usually in ytInitialData
        const regex = /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/;
        const match = html.match(regex);

        if (match && match[1]) {
            const id = match[1];
            CACHE.set(q, { id, time: now });
            return NextResponse.json({ id });
        }

        // Try a simpler match if ytInitialData fails
        const backupRegex = /\/watch\?v=([a-zA-Z0-9_-]{11})/;
        const backupMatch = html.match(backupRegex);

        if (backupMatch && backupMatch[1]) {
            const id = backupMatch[1];
            CACHE.set(q, { id, time: now });
            return NextResponse.json({ id });
        }

        CACHE.set(q, { id: null, time: now });
        return NextResponse.json({ id: null });
    } catch (error) {
        console.error('YouTube search error:', error);
        return NextResponse.json({ id: null }, { status: 500 });
    }
}
