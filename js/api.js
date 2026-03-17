/**
 * Kinopoisk Unofficial API wrapper
 * API Documentation: https://kinopoiskapiunofficial.tech/documentation/api/
 */

const KinoAPI = (() => {
    // API Key — get yours at https://kinopoiskapiunofficial.tech/
    const API_KEY = '4075f2f6-6bea-477d-b54a-ec82f7737aaf';
    const BASE_URL = 'https://kinopoiskapiunofficial.tech/api';

    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    const cache = new Map();

    // Rate limiter: max 20 requests/sec
    let requestQueue = [];
    let isProcessing = false;
    const REQUEST_DELAY = 60; // ms between requests

    async function processQueue() {
        if (isProcessing) return;
        isProcessing = true;
        while (requestQueue.length > 0) {
            const { url, resolve, reject } = requestQueue.shift();
            try {
                const result = await fetchData(url);
                resolve(result);
            } catch (err) {
                reject(err);
            }
            if (requestQueue.length > 0) {
                await new Promise(r => setTimeout(r, REQUEST_DELAY));
            }
        }
        isProcessing = false;
    }

    function queueRequest(url) {
        return new Promise((resolve, reject) => {
            requestQueue.push({ url, resolve, reject });
            processQueue();
        });
    }

    async function fetchData(url) {
        // Check cache
        const cached = cache.get(url);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.data;
        }

        const response = await fetch(url, {
            headers: {
                'X-API-KEY': API_KEY,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 402) {
                throw new Error('API quota exceeded. Please try again later.');
            }
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();

        // Cache the result
        cache.set(url, { data, timestamp: Date.now() });

        return data;
    }

    function request(endpoint) {
        const url = `${BASE_URL}${endpoint}`;
        return queueRequest(url);
    }

    // ===== API Methods =====

    /**
     * Get top films (popular, best, etc.)
     * type: TOP_100_POPULAR_FILMS | TOP_250_BEST_FILMS | TOP_AWAIT_FILMS
     */
    async function getTopFilms(type = 'TOP_100_POPULAR_FILMS', page = 1) {
        return request(`/v2.2/films/collections?type=${type}&page=${page}`);
    }

    /**
     * Get film premieres for a given year/month
     */
    async function getPremieres(year, month) {
        return request(`/v2.2/films/premieres?year=${year}&month=${getMonthName(month)}`);
    }

    /**
     * Get film details by ID
     */
    async function getFilmById(id) {
        return request(`/v2.2/films/${id}`);
    }

    /**
     * Search films by keyword
     */
    async function searchFilms(keyword, page = 1) {
        return request(`/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(keyword)}&page=${page}`);
    }

    /**
     * Get videos (trailers) for a film
     */
    async function getFilmVideos(id) {
        return request(`/v2.2/films/${id}/videos`);
    }

    /**
     * Get similar films
     */
    async function getSimilarFilms(id) {
        return request(`/v2.2/films/${id}/similars`);
    }

    /**
     * Get film images / stills
     */
    async function getFilmImages(id, type = 'STILL', page = 1) {
        return request(`/v2.2/films/${id}/images?type=${type}&page=${page}`);
    }

    /**
     * Get film staff (actors, directors)
     */
    async function getFilmStaff(id) {
        return request(`/v1/staff?filmId=${id}`);
    }

    /**
     * Get films with filters (genre, country, year, etc.)
     */
    async function getFilmsWithFilters(params = {}) {
        const query = new URLSearchParams();
        if (params.genres) query.set('genres', params.genres);
        if (params.countries) query.set('countries', params.countries);
        if (params.yearFrom) query.set('yearFrom', params.yearFrom);
        if (params.yearTo) query.set('yearTo', params.yearTo);
        if (params.ratingFrom) query.set('ratingFrom', params.ratingFrom);
        if (params.order) query.set('order', params.order);
        if (params.type) query.set('type', params.type);
        if (params.page) query.set('page', params.page);
        query.set('page', params.page || 1);
        return request(`/v2.2/films?${query.toString()}`);
    }

    /**
     * Get genres and countries list (for filters)
     */
    async function getFilters() {
        return request(`/v2.2/films/filters`);
    }

    /**
     * Get film box office
     */
    async function getBoxOffice(id) {
        return request(`/v2.2/films/${id}/box_office`);
    }

    /**
     * Get film facts
     */
    async function getFilmFacts(id) {
        return request(`/v2.2/films/${id}/facts`);
    }

    /**
     * Get film awards
     */
    async function getFilmAwards(id) {
        return request(`/v2.2/films/${id}/awards`);
    }

    /**
     * Get film seasons (for TV series)
     */
    async function getFilmSeasons(id) {
        return request(`/v2.2/films/${id}/seasons`);
    }

    // Helper: month number to English name
    function getMonthName(month) {
        const months = [
            'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
            'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
        ];
        return months[month - 1] || 'JANUARY';
    }

    return {
        getTopFilms,
        getPremieres,
        getFilmById,
        searchFilms,
        getFilmVideos,
        getSimilarFilms,
        getFilmImages,
        getFilmStaff,
        getFilmsWithFilters,
        getFilters,
        getBoxOffice,
        getFilmFacts,
        getFilmAwards,
        getFilmSeasons,
    };
})();
