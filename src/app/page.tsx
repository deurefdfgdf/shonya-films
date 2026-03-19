'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import BackgroundOrbs from '@/components/BackgroundOrbs';
import Header from '@/components/Header';
import Hero from '@/components/Hero';

import BentoGrid from '@/components/BentoGrid';
import MarqueeStrip from '@/components/MarqueeStrip';
import FilmRow from '@/components/FilmRow';
import CatalogSection from '@/components/CatalogSection';
import FilmModal from '@/components/FilmModal';
import Footer from '@/components/Footer';
import Preloader from '@/components/Preloader';
import MagneticCursor from '@/components/MagneticCursor';
import AiAssistant from '@/components/AiAssistant';
import ProfileSection from '@/components/ProfileSection';
import { KinoAPI, type Film, filterFilms } from '@/lib/api';

export default function Home() {
  const [preloaderDone, setPreloaderDone] = useState(false);
  const [section, setSection] = useState('home');
  const [modalFilmId, setModalFilmId] = useState<number | null>(null);

  const [popularFilms, setPopularFilms] = useState<Film[]>([]);
  const [topFilms, setTopFilms] = useState<Film[]>([]);
  const [premiereFilms, setPremiereFilms] = useState<Film[]>([]);
  const [heroFilms, setHeroFilms] = useState<Film[]>([]);
  const [homeLoading, setHomeLoading] = useState(true);

  const loadHome = useCallback(async () => {
    setHomeLoading(true);

    const now = new Date();
    const results = await Promise.allSettled([
      KinoAPI.getTopFilms('TOP_POPULAR_MOVIES', 1),
      KinoAPI.getTopFilms('TOP_250_MOVIES', 1),
      KinoAPI.getPremieres(now.getFullYear(), now.getMonth() + 1),
    ]);

    if (results[0].status === 'fulfilled') {
      const films = results[0].value.items || results[0].value.films || [];
      const filtered = filterFilms(films).slice(0, 6);
      setPopularFilms(filtered);
      setHeroFilms(filtered.slice(0, 5));
    }

    if (results[1].status === 'fulfilled') {
      const films = results[1].value.items || results[1].value.films || [];
      setTopFilms(filterFilms(films).slice(0, 6));
    }

    if (results[2].status === 'fulfilled') {
      const films = results[2].value.items || [];
      setPremiereFilms(films.slice(0, 6));
    }

    setHomeLoading(false);
  }, []);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const [navKey, setNavKey] = useState(0);
  const navigate = (nextSection: string) => {
    if (nextSection === section) {
      setNavKey((k) => k + 1);
    }
    setSection(nextSection);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openModal = (id: number) => setModalFilmId(id);
  const closeModal = () => setModalFilmId(null);

  return (
    <>
      <MagneticCursor />

      {!preloaderDone && <Preloader onComplete={() => setPreloaderDone(true)} />}

      <motion.div
        initial={{ opacity: 0 }}
        animate={preloaderDone ? { opacity: 1 } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <BackgroundOrbs />

        <div className="relative z-[3]">
          <Header
            activeSection={section}
            onNavigate={navigate}
            onFilmClick={openModal}
          />

          {section === 'home' ? (
            <>
              <Hero
                films={heroFilms}
                onDetailsClick={openModal}
                ready={preloaderDone}
              />


              <div className="relative pb-20">
                <BentoGrid films={popularFilms} onFilmClick={openModal} />

                <MarqueeStrip films={[...popularFilms, ...topFilms]} />

                <FilmRow
                  title="Топ 250"
                  films={topFilms}
                  loading={homeLoading}
                  onSeeAll={() => navigate('top250')}
                  onFilmClick={openModal}
                />

                <MarqueeStrip films={[...topFilms, ...premiereFilms]} />

                <FilmRow
                  title="Премьеры месяца"
                  films={premiereFilms}
                  loading={homeLoading}
                  onSeeAll={() => navigate('premieres')}
                  onFilmClick={openModal}
                />
              </div>
            </>
          ) : section === 'ai' ? (
            <AiAssistant key={navKey} onFilmClick={openModal} />
          ) : section === 'profile' ? (
            <ProfileSection key={navKey} onFilmClick={openModal} />
          ) : (
            <CatalogSection type={section} onFilmClick={openModal} />
          )}

          <Footer onNavigate={navigate} />
        </div>

        <FilmModal
          filmId={modalFilmId}
          onClose={closeModal}
          onFilmClick={openModal}
        />
      </motion.div>
    </>
  );
}
