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

        // Extract all possible video IDs from the page
        const regex = /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g;
        const ids = new Set<string>();
        let match;

        while ((match = regex.exec(html)) !== null) {
            ids.add(match[1]);
        }

        // Fallback simple match if ytInitialData fails
        if (ids.size === 0) {
            const backupRegex = /\/watch\?v=([a-zA-Z0-9_-]{11})/g;
            while ((match = backupRegex.exec(html)) !== null) {
                ids.add(match[1]);
            }
        }

        const candidateIds = Array.from(ids).slice(0, 4);

        // Fetch watch pages concurrently to check if embedding is allowed
        const playabilityChecks = await Promise.all(
            candidateIds.map(async (id) => {
                try {
                    const res = await fetch(`https://www.youtube.com/watch?v=${id}`, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                    });
                    const pageHtml = await res.text();

                    // We check if "playableInEmbed":true exists in the javascript configuration payload
                    const isEmbeddable = pageHtml.includes('"playableInEmbed":true') || pageHtml.includes('"playableInEmbed": true');
                    return { id, isEmbeddable };
                } catch (e) {
                    return { id, isEmbeddable: false };
                }
            })
        );

        // Return the first candidate that is explicitly embeddable
        for (const { id, isEmbeddable } of playabilityChecks) {
            if (isEmbeddable) {
                CACHE.set(q, { id, time: now });
                return NextResponse.json({ id });
            }
        }

        // If none are verifiably embeddable, just fallback to the very first one as a last resort
        if (candidateIds.length > 0) {
            const fallbackId = candidateIds[0];
            CACHE.set(q, { id: fallbackId, time: now });
            return NextResponse.json({ id: fallbackId });
        }

        CACHE.set(q, { id: null, time: now });
        return NextResponse.json({ id: null });
    } catch (error) {
        console.error('YouTube search error:', error);
        return NextResponse.json({ id: null }, { status: 500 });
    }
}
