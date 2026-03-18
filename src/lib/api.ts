/**
 * Kinopoisk Unofficial API wrapper
 * https://kinopoiskapiunofficial.tech/documentation/api/
 */

const API_KEY = process.env.NEXT_PUBLIC_KINOPOISK_API_KEY || '';
const BASE_URL = 'https://kinopoiskapiunofficial.tech/api';

const CACHE_DURATION = 30 * 60 * 1000;
const cache = new Map<string, { data: unknown; timestamp: number }>();

let requestQueue: Array<{
  url: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}> = [];
let isProcessing = false;
const REQUEST_DELAY = 60;

async function processQueue() {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  while (requestQueue.length > 0) {
    const next = requestQueue.shift();
    if (!next) {
      continue;
    }

    try {
      const result = await fetchData(next.url);
      next.resolve(result);
    } catch (error) {
      next.reject(error as Error);
    }

    if (requestQueue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY));
    }
  }

  isProcessing = false;
}

function queueRequest(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    requestQueue.push({ url, resolve, reject });
    void processQueue();
  });
}

async function fetchData(url: string) {
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
  cache.set(url, { data, timestamp: Date.now() });
  return data;
}

function request<T = unknown>(endpoint: string): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  return queueRequest(url) as Promise<T>;
}

export interface Film {
  kinopoiskId?: number;
  filmId?: number;
  nameRu?: string;
  nameEn?: string;
  nameOriginal?: string;
  posterUrl?: string;
  posterUrlPreview?: string;
  coverUrl?: string;
  ratingKinopoisk?: number;
  ratingImdb?: number;
  ratingKinopoiskVoteCount?: number;
  rating?: number | string;
  year?: number;
  filmLength?: number;
  description?: string;
  shortDescription?: string;
  slogan?: string;
  type?: string;
  ratingAgeLimits?: string;
  endYear?: number;
  genres?: Array<{ genre: string }>;
  countries?: Array<{ country: string; id?: number }>;
}

export interface StaffPerson {
  staffId: number;
  nameRu?: string;
  nameEn?: string;
  professionKey: string;
}

export interface FilmsResponse {
  items?: Film[];
  films?: Film[];
  total?: number;
  totalPages?: number;
}

export interface FiltersResponse {
  genres: Array<{ id: number; genre: string }>;
  countries: Array<{ id: number; country: string }>;
}

const MONTHS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

export const KinoAPI = {
  getTopFilms(type = 'TOP_100_POPULAR_FILMS', page = 1) {
    return request<FilmsResponse>(`/v2.2/films/collections?type=${type}&page=${page}`);
  },

  getPremieres(year: number, month: number) {
    return request<{ items: Film[] }>(
      `/v2.2/films/premieres?year=${year}&month=${MONTHS[month - 1]}`
    );
  },

  getFilmById(id: number) {
    return request<Film>(`/v2.2/films/${id}`);
  },

  searchFilms(keyword: string, page = 1) {
    return request<FilmsResponse>(
      `/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(keyword)}&page=${page}`
    );
  },

  getSimilarFilms(id: number) {
    return request<{ items: Film[] }>(`/v2.2/films/${id}/similars`);
  },

  getFilmStaff(id: number) {
    return request<StaffPerson[]>(`/v1/staff?filmId=${id}`);
  },

  getFilmsWithFilters(params: Record<string, string | number> = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.set(key, String(value));
      }
    });

    if (!query.has('page')) {
      query.set('page', '1');
    }

    return request<FilmsResponse>(`/v2.2/films?${query.toString()}`);
  },

  getFilters() {
    return request<FiltersResponse>('/v2.2/films/filters');
  },
};

export function getFilmId(film: Film): number {
  return film.kinopoiskId || film.filmId || 0;
}

export function getFilmTitle(film: Film): string {
  return film.nameRu || film.nameEn || film.nameOriginal || 'Без названия';
}

export function formatRating(rating?: number | string | null): string | null {
  if (!rating || rating === 'null' || rating === 'None') {
    return null;
  }

  const number = parseFloat(String(rating));
  if (Number.isNaN(number)) {
    return null;
  }

  return number.toFixed(1);
}

export function getRatingClass(rating: string): 'high' | 'medium' | 'low' {
  const number = parseFloat(rating);
  if (number >= 7) {
    return 'high';
  }
  if (number >= 5) {
    return 'medium';
  }
  return 'low';
}

export function formatNumber(num?: number): string {
  if (!num) {
    return '0';
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

const CIS_COUNTRIES = new Set([
  'россия',
  'russia',
  'ссср',
  'ussr',
  'украина',
  'ukraine',
  'беларусь',
  'belarus',
  'белоруссия',
  'казахстан',
  'kazakhstan',
  'кыргызстан',
  'kyrgyzstan',
  'киргизия',
  'узбекистан',
  'uzbekistan',
  'таджикистан',
  'tajikistan',
  'туркменистан',
  'turkmenistan',
  'молдова',
  'moldova',
  'молдавия',
  'армения',
  'armenia',
  'азербайджан',
  'azerbaijan',
  'грузия',
  'georgia',
]);

export function filterFilms(films: Film[]): Film[] {
  if (!films || films.length === 0) {
    return films;
  }

  return films.filter((film) => {
    const countries = film.countries || [];
    if (countries.length === 0) {
      return true;
    }

    const isCisOnly = countries.every((country) =>
      CIS_COUNTRIES.has((country.country || '').toLowerCase())
    );

    if (!isCisOnly) {
      return true;
    }

    const rating = parseFloat(String(film.ratingKinopoisk || film.rating));
    return !Number.isNaN(rating) && rating >= 8.7;
  });
}
