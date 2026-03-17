/**
 * UI Helper Functions - rendering cards, modals, etc.
 */

const UI = (() => {
    /**
     * Get rating class based on value
     */
    function getRatingClass(rating) {
        const num = parseFloat(rating);
        if (num >= 7) return 'high';
        if (num >= 5) return 'medium';
        return 'low';
    }

    /**
     * Format rating display
     */
    function formatRating(rating) {
        if (!rating || rating === 'null' || rating === 'None') return null;
        const num = parseFloat(rating);
        if (isNaN(num)) return null;
        return num.toFixed(1);
    }

    /**
     * Create a film card element
     */
    function createFilmCard(film) {
        const card = document.createElement('div');
        card.className = 'film-card';
        card.setAttribute('data-film-id', film.kinopoiskId || film.filmId);

        const rating = formatRating(film.ratingKinopoisk || film.rating);
        const ratingClass = rating ? getRatingClass(rating) : '';

        const title = film.nameRu || film.nameEn || film.nameOriginal || 'Без названия';
        const year = film.year || '';
        const genres = film.genres ? film.genres.map(g => g.genre).slice(0, 2).join(', ') : '';
        const posterUrl = film.posterUrlPreview || film.posterUrl || '';

        card.innerHTML = `
            ${rating ? `<div class="film-card__rating film-card__rating--${ratingClass}">★ ${rating}</div>` : ''}
            <div class="film-card__poster">
                ${posterUrl
                ? `<img src="${posterUrl}" alt="${title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'placeholder\\'>🎬</div>'">`
                : '<div class="placeholder">🎬</div>'}
            </div>
            <div class="film-card__overlay">
                <div class="film-card__overlay-info">
                    ${genres ? `<div>${genres}</div>` : ''}
                    ${year ? `<div>${year}</div>` : ''}
                </div>
            </div>
            <div class="film-card__info">
                <div class="film-card__title" title="${title}">${title}</div>
                <div class="film-card__meta">${[year, genres].filter(Boolean).join(' • ')}</div>
            </div>
        `;

        card.addEventListener('click', () => {
            openFilmModal(film.kinopoiskId || film.filmId);
        });

        return card;
    }

    /**
     * Create skeleton loading cards
     */
    function createSkeletonCards(count = 7) {
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const card = document.createElement('div');
            card.className = 'film-card skeleton';
            card.innerHTML = `
                <div class="film-card__poster"></div>
                <div class="film-card__info">
                    <div class="film-card__title" style="width:80%;height:14px;background:var(--color-bg-card-hover);border-radius:4px">&nbsp;</div>
                    <div class="film-card__meta" style="width:60%;height:12px;background:var(--color-bg-card-hover);border-radius:4px;margin-top:6px">&nbsp;</div>
                </div>
            `;
            fragment.appendChild(card);
        }
        return fragment;
    }

    /**
     * Filter out low-quality CIS films
     * Keeps CIS films only if rating >= 8.7
     * Films co-produced with non-CIS countries (e.g. Russia + USA) are kept
     */
    const CIS_COUNTRIES = new Set([
        'россия', 'russia', 'ссср', 'ussr',
        'украина', 'ukraine',
        'беларусь', 'belarus', 'белоруссия',
        'казахстан', 'kazakhstan',
        'кыргызстан', 'kyrgyzstan', 'киргизия',
        'узбекистан', 'uzbekistan',
        'таджикистан', 'tajikistan',
        'туркменистан', 'turkmenistan',
        'молдова', 'moldova', 'молдавия',
        'армения', 'armenia',
        'азербайджан', 'azerbaijan',
        'грузия', 'georgia',
    ]);

    function filterRussianJunk(films) {
        if (!films || films.length === 0) return films;

        const MIN_RATING = 8.7;

        return films.filter(film => {
            const countries = film.countries || [];
            if (countries.length === 0) return true;

            // Check if ALL countries are CIS
            const isCISOnly = countries.every(c =>
                CIS_COUNTRIES.has((c.country || '').toLowerCase())
            );

            if (!isCISOnly) return true; // Has non-CIS country → keep

            // CIS-only film → only keep if rating is high enough
            const rating = parseFloat(film.ratingKinopoisk || film.rating);
            return !isNaN(rating) && rating >= MIN_RATING;
        });
    }

    /**
     * Render films into a container
     */
    function renderFilms(container, films, append = false) {
        if (!append) {
            container.innerHTML = '';
        }

        // Remove skeletons
        container.querySelectorAll('.skeleton').forEach(s => s.remove());

        // Filter out low-quality Russian films
        const filteredFilms = filterRussianJunk(films);

        if (!filteredFilms || filteredFilms.length === 0) {
            if (!append) {
                container.innerHTML = '<div class="search-empty">Фильмы не найдены 😔</div>';
            }
            return;
        }

        const fragment = document.createDocumentFragment();
        filteredFilms.forEach(film => {
            fragment.appendChild(createFilmCard(film));
        });
        container.appendChild(fragment);
    }

    /**
     * Open film detail modal
     */
    async function openFilmModal(filmId) {
        const modal = document.getElementById('film-modal');
        const modalBody = document.getElementById('modal-body');

        // Show modal with loading
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        modalBody.innerHTML = '<div class="loading-spinner"></div>';

        try {
            // Fetch film details and staff in parallel
            const [film, staffData] = await Promise.all([
                KinoAPI.getFilmById(filmId),
                KinoAPI.getFilmStaff(filmId).catch(() => [])
            ]);

            // Get similar films (non-blocking)
            const similarsPromise = KinoAPI.getSimilarFilms(filmId).catch(() => ({ items: [] }));

            const title = film.nameRu || film.nameEn || film.nameOriginal || 'Без названия';
            const originalTitle = film.nameOriginal || film.nameEn || '';
            const rating = formatRating(film.ratingKinopoisk);
            const ratingClass = rating ? getRatingClass(rating) : '';
            const genres = film.genres ? film.genres.map(g => g.genre) : [];
            const countries = film.countries ? film.countries.map(c => c.country).join(', ') : '';
            const posterUrl = film.posterUrl || film.posterUrlPreview || '';

            // Get director and actors
            const directors = staffData.filter ? staffData.filter(s => s.professionKey === 'DIRECTOR').slice(0, 3) : [];
            const actors = staffData.filter ? staffData.filter(s => s.professionKey === 'ACTOR').slice(0, 8) : [];

            const filmLength = film.filmLength ? `${Math.floor(film.filmLength / 60)}ч ${film.filmLength % 60}мин` : '';

            modalBody.innerHTML = `
                <div class="film-detail">
                    <div class="film-detail__poster">
                        <img src="${posterUrl}" alt="${title}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 450%22><rect fill=%22%2316161f%22 width=%22300%22 height=%22450%22/><text fill=%22%235c5c72%22 font-size=%2260%22 x=%22150%22 y=%22240%22 text-anchor=%22middle%22>🎬</text></svg>'">
                    </div>
                    <div class="film-detail__content">
                        <h2 class="film-detail__title">${title}</h2>
                        ${originalTitle && originalTitle !== title ? `<div class="film-detail__original-title">${originalTitle}</div>` : ''}
                        
                        <div class="film-detail__rating-row">
                            ${rating ? `
                                <div class="film-detail__rating-badge film-detail__rating-badge--${ratingClass}">
                                    ★ ${rating}
                                </div>
                            ` : ''}
                            ${film.ratingKinopoiskVoteCount ? `
                                <span class="film-detail__votes">${formatNumber(film.ratingKinopoiskVoteCount)} оценок</span>
                            ` : ''}
                            ${film.ratingImdb ? `
                                <div class="film-detail__rating-badge film-detail__rating-badge--medium" style="font-size:0.85rem">
                                    IMDb ${film.ratingImdb}
                                </div>
                            ` : ''}
                        </div>

                        <div class="film-detail__genres">
                            ${genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}
                        </div>

                        <div class="film-detail__info-grid">
                            ${film.year ? `
                                <div class="film-detail__info-item">
                                    <span class="film-detail__info-label">Год</span>
                                    <span class="film-detail__info-value">${film.year}${film.endYear ? ` — ${film.endYear}` : ''}</span>
                                </div>
                            ` : ''}
                            ${countries ? `
                                <div class="film-detail__info-item">
                                    <span class="film-detail__info-label">Страна</span>
                                    <span class="film-detail__info-value">${countries}</span>
                                </div>
                            ` : ''}
                            ${filmLength ? `
                                <div class="film-detail__info-item">
                                    <span class="film-detail__info-label">Длительность</span>
                                    <span class="film-detail__info-value">${filmLength}</span>
                                </div>
                            ` : ''}
                            ${film.ratingAgeLimits ? `
                                <div class="film-detail__info-item">
                                    <span class="film-detail__info-label">Возраст</span>
                                    <span class="film-detail__info-value">${film.ratingAgeLimits.replace('age', '')}+</span>
                                </div>
                            ` : ''}
                            ${directors.length > 0 ? `
                                <div class="film-detail__info-item">
                                    <span class="film-detail__info-label">Режиссёр</span>
                                    <span class="film-detail__info-value">${directors.map(d => d.nameRu || d.nameEn).join(', ')}</span>
                                </div>
                            ` : ''}
                            ${film.slogan ? `
                                <div class="film-detail__info-item">
                                    <span class="film-detail__info-label">Слоган</span>
                                    <span class="film-detail__info-value" style="font-style:italic;color:var(--color-text-secondary)">${film.slogan}</span>
                                </div>
                            ` : ''}
                        </div>

                        ${film.description ? `
                            <div class="film-detail__description">
                                <h3>Описание</h3>
                                <p>${film.description}</p>
                            </div>
                        ` : ''}

                        ${actors.length > 0 ? `
                            <div class="film-detail__description">
                                <h3>В ролях</h3>
                                <p>${actors.map(a => a.nameRu || a.nameEn).join(', ')}</p>
                            </div>
                        ` : ''}

                        <a href="https://www.sspoisk.ru/film/${filmId}/" target="_blank" rel="noopener" class="btn btn--primary btn--watch" style="margin-top:8px">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                Смотреть на Шонька плеере
                             </a>

                        <div class="film-detail__similar" id="modal-similar"></div>
                    </div>
                </div>
            `;

            // Load similar films
            similarsPromise.then(data => {
                const similarContainer = document.getElementById('modal-similar');
                const items = data.items || [];
                if (items.length > 0 && similarContainer) {
                    similarContainer.innerHTML = `
                        <h3>Похожие фильмы</h3>
                        <div class="similar-films">
                            ${items.slice(0, 8).map(f => `
                                <div class="film-card" data-film-id="${f.filmId}" onclick="UI.openFilmModal(${f.filmId})">
                                    <div class="film-card__poster">
                                        <img src="${f.posterUrlPreview || f.posterUrl}" alt="${f.nameRu || f.nameEn}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'placeholder\\'>🎬</div>'">
                                    </div>
                                    <div class="film-card__info">
                                        <div class="film-card__title">${f.nameRu || f.nameEn || ''}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
            });

        } catch (error) {
            console.error('Error loading film details:', error);
            modalBody.innerHTML = `
                <div style="padding:48px;text-align:center">
                    <p style="font-size:1.2rem;margin-bottom:12px">😞 Ошибка загрузки</p>
                    <p style="color:var(--color-text-muted)">${error.message}</p>
                </div>
            `;
        }
    }

    /**
     * Close modal
     */
    function closeModal() {
        const modal = document.getElementById('film-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    /**
     * Format large numbers
     */
    function formatNumber(num) {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    /**
     * Render search results
     */
    function renderSearchResults(container, films) {
        if (!films || films.length === 0) {
            container.innerHTML = '<div class="search-empty">Ничего не найдено</div>';
            container.classList.add('active');
            return;
        }

        container.innerHTML = films.slice(0, 8).map(film => {
            const title = film.nameRu || film.nameEn || film.nameOriginal || '';
            const year = film.year || '';
            const rating = film.rating && film.rating !== 'null' ? `★ ${film.rating}` : '';
            const poster = film.posterUrlPreview || '';
            const id = film.filmId || film.kinopoiskId;
            return `
                <div class="search-result-item" data-film-id="${id}">
                    ${poster ? `<img src="${poster}" alt="${title}" loading="lazy">` : ''}
                    <div class="search-result-info">
                        <h4>${title}</h4>
                        <span>${[year, rating].filter(Boolean).join(' • ')}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.classList.add('active');

        // Add click handlers
        container.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const filmId = item.getAttribute('data-film-id');
                openFilmModal(parseInt(filmId));
                container.classList.remove('active');
                document.getElementById('search-input').value = '';
            });
        });
    }

    return {
        createFilmCard,
        createSkeletonCards,
        renderFilms,
        openFilmModal,
        closeModal,
        renderSearchResults,
        formatRating,
        getRatingClass,
        filterRussianJunk,
    };
})();
