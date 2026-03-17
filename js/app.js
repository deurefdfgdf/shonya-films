/**
 * Main Application - orchestrates the movie website
 */

(function () {
    'use strict';

    // ===== State =====
    const state = {
        currentSection: 'home',
        heroFilms: [],
        heroIndex: 0,
        heroTimer: null,
        catalogPage: 1,
        catalogType: 'popular', // popular, top250, premieres, series
        catalogTotalPages: 1,
        filtersLoaded: false,
        searchTimeout: null,
    };

    // ===== DOM Elements =====
    const $ = id => document.getElementById(id);

    // ===== Init =====
    document.addEventListener('DOMContentLoaded', () => {
        initHeader();
        initSearch();
        initModal();
        initNavigation();
        loadHomePage();
        loadFilters();
    });

    // ===== Header Scroll Effect =====
    function initHeader() {
        const header = $('header');
        let lastScroll = 0;

        window.addEventListener('scroll', () => {
            const scroll = window.scrollY;
            if (scroll > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
            lastScroll = scroll;
        }, { passive: true });
    }

    // ===== Search =====
    function initSearch() {
        const searchInput = $('search-input');
        const searchResults = $('search-results');
        const searchBar = $('search-bar');

        // Mobile: toggle search bar expansion
        if (window.innerWidth <= 768) {
            const searchIcon = searchBar.querySelector('.search-bar__icon');
            searchIcon.addEventListener('click', (e) => {
                if (!searchBar.classList.contains('expanded')) {
                    e.preventDefault();
                    searchBar.classList.add('expanded');
                    searchInput.focus();
                }
            });
        }

        // Live search with debounce
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            clearTimeout(state.searchTimeout);

            if (query.length < 2) {
                searchResults.classList.remove('active');
                searchResults.innerHTML = '';
                return;
            }

            searchResults.innerHTML = '<div class="search-loading">Поиск...</div>';
            searchResults.classList.add('active');

            state.searchTimeout = setTimeout(async () => {
                try {
                    const data = await KinoAPI.searchFilms(query);
                    UI.renderSearchResults(searchResults, data.films || data.items || []);
                } catch (error) {
                    searchResults.innerHTML = '<div class="search-empty">Ошибка поиска 😞</div>';
                }
            }, 400);
        });

        // Close search on outside click
        document.addEventListener('click', (e) => {
            if (!searchBar.contains(e.target)) {
                searchResults.classList.remove('active');
                if (window.innerWidth <= 768) {
                    searchBar.classList.remove('expanded');
                }
            }
        });

        // Close on Escape
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchResults.classList.remove('active');
                searchInput.blur();
            }
        });
    }

    // ===== Modal =====
    function initModal() {
        const modal = $('film-modal');
        const closeBtn = $('modal-close');
        const backdrop = $('modal-backdrop');

        closeBtn.addEventListener('click', UI.closeModal);
        backdrop.addEventListener('click', UI.closeModal);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                UI.closeModal();
            }
        });
    }

    // ===== Navigation =====
    function initNavigation() {
        const mobileMenuBtn = $('mobile-menu-btn');
        const nav = $('nav');

        // Mobile menu toggle
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenuBtn.classList.toggle('active');
            nav.classList.toggle('active');
        });

        // Nav link clicks
        document.querySelectorAll('[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                navigateTo(section);
                // Close mobile menu
                mobileMenuBtn.classList.remove('active');
                nav.classList.remove('active');
            });
        });
    }

    function navigateTo(section) {
        // Update active nav link
        document.querySelectorAll('.nav__link').forEach(l => l.classList.remove('active'));
        const activeLink = document.querySelector(`.nav__link[data-section="${section}"]`);
        if (activeLink) activeLink.classList.add('active');

        state.currentSection = section;
        state.catalogPage = 1;

        if (section === 'home') {
            $('home-sections').classList.remove('hidden');
            $('catalog-section').classList.add('hidden');
            $('hero-section').classList.remove('hidden');
            $('catalog-filters').classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            $('home-sections').classList.add('hidden');
            $('catalog-section').classList.remove('hidden');
            $('hero-section').classList.add('hidden');

            loadCatalog(section);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // ===== Load Home Page =====
    async function loadHomePage() {
        // Show skeletons
        const popularGrid = $('popular-grid');
        const topGrid = $('top-grid');
        const premieresGrid = $('premieres-grid');

        popularGrid.appendChild(UI.createSkeletonCards(7));
        topGrid.appendChild(UI.createSkeletonCards(7));
        premieresGrid.appendChild(UI.createSkeletonCards(7));

        // Load all sections independently — one failure won't break others
        const results = await Promise.allSettled([
            KinoAPI.getTopFilms('TOP_POPULAR_MOVIES', 1),
            KinoAPI.getTopFilms('TOP_250_MOVIES', 1),
            loadPremieres(),
        ]);

        // Render popular films
        if (results[0].status === 'fulfilled') {
            const popularFilms = results[0].value.items || results[0].value.films || [];
            UI.renderFilms(popularGrid, popularFilms.slice(0, 14));
            // Set hero with popular films (filtered)
            state.heroFilms = UI.filterRussianJunk(popularFilms).slice(0, 5);
            initHero();
        } else {
            console.error('Error loading popular:', results[0].reason);
            popularGrid.innerHTML = '<div class="search-empty">Ошибка загрузки популярных 😞</div>';
        }

        // Render top 250
        if (results[1].status === 'fulfilled') {
            const topFilms = results[1].value.items || results[1].value.films || [];
            UI.renderFilms(topGrid, topFilms.slice(0, 14));
        } else {
            console.error('Error loading top 250:', results[1].reason);
            topGrid.innerHTML = '<div class="search-empty">Ошибка загрузки Топ 250 😞</div>';
        }

        // Render premieres
        if (results[2].status === 'fulfilled') {
            const premiereFilms = results[2].value || [];
            UI.renderFilms(premieresGrid, premiereFilms.slice(0, 14));
        } else {
            console.error('Error loading premieres:', results[2].reason);
            premieresGrid.innerHTML = '<div class="search-empty">Ошибка загрузки премьер 😞</div>';
        }
    }

    async function loadPremieres() {
        const now = new Date();
        try {
            const data = await KinoAPI.getPremieres(now.getFullYear(), now.getMonth() + 1);
            return data.items || [];
        } catch {
            return [];
        }
    }

    // ===== Hero Slider =====
    function initHero() {
        if (state.heroFilms.length === 0) return;

        // Create dots
        const dotsContainer = $('hero-dots');
        dotsContainer.innerHTML = '';
        state.heroFilms.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.className = `hero__dot ${i === 0 ? 'active' : ''}`;
            dot.addEventListener('click', () => setHeroSlide(i));
            dotsContainer.appendChild(dot);
        });

        // Set first slide
        setHeroSlide(0);

        // Navigation
        $('hero-prev').addEventListener('click', () => {
            setHeroSlide((state.heroIndex - 1 + state.heroFilms.length) % state.heroFilms.length);
        });

        $('hero-next').addEventListener('click', () => {
            setHeroSlide((state.heroIndex + 1) % state.heroFilms.length);
        });

        // Auto-slide
        startHeroTimer();
    }

    function setHeroSlide(index) {
        const film = state.heroFilms[index];
        if (!film) return;

        state.heroIndex = index;

        const backdrop = $('hero-backdrop');
        const title = $('hero-title');
        const description = $('hero-description');
        const meta = $('hero-meta');
        const badge = $('hero-badge');
        const detailsBtn = $('hero-details-btn');

        const filmTitle = film.nameRu || film.nameEn || film.nameOriginal || 'Без названия';
        const rating = UI.formatRating(film.ratingKinopoisk || film.rating);
        const ratingClass = rating ? UI.getRatingClass(rating) : '';
        const year = film.year || '';
        const genres = film.genres ? film.genres.map(g => g.genre).slice(0, 3).join(', ') : '';
        const countries = film.countries ? film.countries.map(c => c.country).slice(0, 2).join(', ') : '';

        // Update backdrop
        const posterUrl = film.coverUrl || film.posterUrl || film.posterUrlPreview || '';
        backdrop.classList.remove('loaded');
        backdrop.style.backgroundImage = `url(${posterUrl})`;
        requestAnimationFrame(() => {
            backdrop.classList.add('loaded');
        });

        // Update content
        badge.innerHTML = rating
            ? `<span class="rating ${ratingClass === 'high' ? 'rating--high' : ''}" style="color:${ratingClass === 'high' ? 'var(--color-success)' : ratingClass === 'medium' ? 'var(--color-warning)' : 'var(--color-accent)'}">★ ${rating}</span> Кинопоиск`
            : '🎬 Рекомендуем';

        title.textContent = filmTitle;

        description.textContent = film.shortDescription || film.description || '';

        meta.innerHTML = `
            ${year ? `<span class="hero__meta-item">📅 ${year}</span>` : ''}
            ${genres ? `<span class="hero__meta-item">🎭 ${genres}</span>` : ''}
            ${countries ? `<span class="hero__meta-item">🌍 ${countries}</span>` : ''}
        `;

        // Details button
        detailsBtn.onclick = () => UI.openFilmModal(film.kinopoiskId || film.filmId);

        // Update dots
        document.querySelectorAll('.hero__dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });

        // Reset timer
        startHeroTimer();
    }

    function startHeroTimer() {
        clearInterval(state.heroTimer);
        state.heroTimer = setInterval(() => {
            setHeroSlide((state.heroIndex + 1) % state.heroFilms.length);
        }, 6000);
    }

    // ===== Catalog =====
    async function loadCatalog(type) {
        const grid = $('catalog-grid');
        const titleEl = $('catalog-title');
        const loadMoreBtn = $('load-more-btn');
        const filtersEl = $('catalog-filters');

        state.catalogType = type;
        state.catalogPage = 1;

        // Set title
        const titles = {
            popular: '🔥 Популярные фильмы',
            top250: '⭐ Топ 250 лучших фильмов',
            premieres: '🎬 Премьеры',
            series: '📺 Сериалы',
        };
        titleEl.textContent = titles[type] || 'Каталог';

        // Show/hide filters
        if (type === 'premieres') {
            filtersEl.classList.add('hidden');
        } else {
            filtersEl.classList.remove('hidden');
        }

        // Show loading
        grid.innerHTML = '';
        grid.appendChild(UI.createSkeletonCards(30));

        const PAGES_PER_LOAD = 3; // Load 3 pages at once (~60 films)

        try {
            let films = [];
            let totalPages = 1;

            if (type === 'popular') {
                const pages = await Promise.all(
                    Array.from({ length: PAGES_PER_LOAD }, (_, i) => KinoAPI.getTopFilms('TOP_POPULAR_MOVIES', i + 1))
                );
                films = pages.flatMap(d => d.items || d.films || []);
                totalPages = pages[0].totalPages || 1;
            } else if (type === 'top250') {
                const pages = await Promise.all(
                    Array.from({ length: PAGES_PER_LOAD }, (_, i) => KinoAPI.getTopFilms('TOP_250_MOVIES', i + 1))
                );
                films = pages.flatMap(d => d.items || d.films || []);
                totalPages = pages[0].totalPages || 1;
            } else if (type === 'premieres') {
                const now = new Date();
                const data = await KinoAPI.getPremieres(now.getFullYear(), now.getMonth() + 1);
                films = data.items || [];
                totalPages = 1;
            } else if (type === 'series') {
                const pages = await Promise.all(
                    Array.from({ length: PAGES_PER_LOAD }, (_, i) => KinoAPI.getFilmsWithFilters({ type: 'TV_SERIES', order: 'NUM_VOTE', page: i + 1 }))
                );
                films = pages.flatMap(d => d.items || []);
                totalPages = pages[0].totalPages || 1;
            }

            state.catalogPage = PAGES_PER_LOAD;
            state.catalogTotalPages = totalPages;
            UI.renderFilms(grid, films);

            // Show/hide load more
            if (state.catalogPage < state.catalogTotalPages && type !== 'premieres') {
                $('load-more').classList.remove('hidden');
            } else {
                $('load-more').classList.add('hidden');
            }

        } catch (error) {
            console.error('Error loading catalog:', error);
            grid.innerHTML = '<div class="search-empty">Ошибка загрузки данных 😞</div>';
        }

        // Load more button
        loadMoreBtn.onclick = () => loadMoreCatalog();
    }

    async function loadMoreCatalog() {
        const grid = $('catalog-grid');
        const loadMoreBtn = $('load-more-btn');

        const PAGES_PER_LOAD = 3;
        const startPage = state.catalogPage + 1;
        const endPage = Math.min(startPage + PAGES_PER_LOAD - 1, state.catalogTotalPages);
        const pagesToLoad = endPage - startPage + 1;

        if (pagesToLoad <= 0) {
            $('load-more').classList.add('hidden');
            return;
        }

        loadMoreBtn.textContent = 'Загрузка...';
        loadMoreBtn.disabled = true;

        try {
            let films = [];

            if (state.catalogType === 'popular') {
                const pages = await Promise.all(
                    Array.from({ length: pagesToLoad }, (_, i) => KinoAPI.getTopFilms('TOP_POPULAR_MOVIES', startPage + i))
                );
                films = pages.flatMap(d => d.items || d.films || []);
            } else if (state.catalogType === 'top250') {
                const pages = await Promise.all(
                    Array.from({ length: pagesToLoad }, (_, i) => KinoAPI.getTopFilms('TOP_250_MOVIES', startPage + i))
                );
                films = pages.flatMap(d => d.items || d.films || []);
            } else if (state.catalogType === 'series') {
                const genre = $('filter-genre').value;
                const country = $('filter-country').value;
                const yearFrom = $('filter-year').value;
                const order = $('filter-order').value;

                const pages = await Promise.all(
                    Array.from({ length: pagesToLoad }, (_, i) => {
                        const params = { type: 'TV_SERIES', order, page: startPage + i };
                        if (genre) params.genres = genre;
                        if (country) params.countries = country;
                        if (yearFrom) { params.yearFrom = yearFrom; params.yearTo = yearFrom; }
                        return KinoAPI.getFilmsWithFilters(params);
                    })
                );
                films = pages.flatMap(d => d.items || []);
            }

            state.catalogPage = endPage;
            UI.renderFilms(grid, films, true);

            if (state.catalogPage >= state.catalogTotalPages) {
                $('load-more').classList.add('hidden');
            }

        } catch (error) {
            console.error('Error loading more:', error);
        }

        loadMoreBtn.textContent = 'Загрузить ещё';
        loadMoreBtn.disabled = false;
    }

    // ===== Filters =====
    async function loadFilters() {
        if (state.filtersLoaded) return;

        try {
            const data = await KinoAPI.getFilters();

            // Populate genres
            const genreSelect = $('filter-genre');
            if (data.genres) {
                data.genres.forEach(g => {
                    if (g.genre) {
                        const opt = document.createElement('option');
                        opt.value = g.id;
                        opt.textContent = g.genre;
                        genreSelect.appendChild(opt);
                    }
                });
            }

            // Populate countries
            const countrySelect = $('filter-country');
            if (data.countries) {
                // Show only major countries first
                const majorCountries = data.countries.filter(c =>
                    ['Россия', 'США', 'Великобритания', 'Франция', 'Германия', 'Италия', 'Испания', 'Япония', 'Корея Южная', 'Индия', 'Китай', 'Канада', 'Австралия'].includes(c.country)
                );
                const otherCountries = data.countries.filter(c => !majorCountries.includes(c));

                majorCountries.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.country;
                    countrySelect.appendChild(opt);
                });

                if (otherCountries.length > 0) {
                    const separator = document.createElement('option');
                    separator.disabled = true;
                    separator.textContent = '───────────';
                    countrySelect.appendChild(separator);

                    otherCountries.forEach(c => {
                        if (c.country) {
                            const opt = document.createElement('option');
                            opt.value = c.id;
                            opt.textContent = c.country;
                            countrySelect.appendChild(opt);
                        }
                    });
                }
            }

            // Populate years
            const yearSelect = $('filter-year');
            const currentYear = new Date().getFullYear();
            for (let y = currentYear; y >= 1950; y--) {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = y;
                yearSelect.appendChild(opt);
            }

            state.filtersLoaded = true;

            // Filter change handlers
            [genreSelect, countrySelect, yearSelect, $('filter-order')].forEach(select => {
                select.addEventListener('change', () => {
                    if (state.currentSection !== 'home') {
                        applyFilters();
                    }
                });
            });

        } catch (error) {
            console.error('Error loading filters:', error);
        }
    }

    async function applyFilters() {
        const grid = $('catalog-grid');
        state.catalogPage = 1;

        const genre = $('filter-genre').value;
        const country = $('filter-country').value;
        const yearFrom = $('filter-year').value;
        const order = $('filter-order').value;

        grid.innerHTML = '';
        grid.appendChild(UI.createSkeletonCards(20));

        try {
            const params = {
                order,
                page: 1,
            };

            if (state.catalogType === 'series') {
                params.type = 'TV_SERIES';
            }
            if (genre) params.genres = genre;
            if (country) params.countries = country;
            if (yearFrom) { params.yearFrom = yearFrom; params.yearTo = yearFrom; }

            const data = await KinoAPI.getFilmsWithFilters(params);
            const films = data.items || [];
            state.catalogTotalPages = data.totalPages || 1;

            UI.renderFilms(grid, films);

            if (state.catalogPage < state.catalogTotalPages) {
                $('load-more').classList.remove('hidden');
            } else {
                $('load-more').classList.add('hidden');
            }

        } catch (error) {
            console.error('Error applying filters:', error);
            grid.innerHTML = '<div class="search-empty">Ошибка загрузки 😞</div>';
        }
    }

})();
