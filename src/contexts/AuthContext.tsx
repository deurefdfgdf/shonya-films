'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, googleProvider, db } from '@/lib/firebase';

interface WatchedFilm {
  title: string;
  addedAt: unknown;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  watchedFilms: Map<number, WatchedFilm>;
  isWatched: (id: number) => boolean;
  toggleWatched: (id: number, title: string) => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  watchedFilmTitles: string[];
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchedFilms, setWatchedFilms] = useState<Map<number, WatchedFilm>>(new Map());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) setWatchedFilms(new Map());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, 'users', user.uid, 'watchedFilms');
    const unsub = onSnapshot(colRef, (snapshot) => {
      const map = new Map<number, WatchedFilm>();
      snapshot.docs.forEach((d) => {
        const id = parseInt(d.id, 10);
        if (!isNaN(id)) map.set(id, d.data() as WatchedFilm);
      });
      setWatchedFilms(map);
    });
    return unsub;
  }, [user]);

  const isWatched = useCallback(
    (id: number) => watchedFilms.has(id),
    [watchedFilms]
  );

  const toggleWatched = useCallback(
    async (kinopoiskId: number, title: string) => {
      if (!user) return;
      const docRef = doc(db, 'users', user.uid, 'watchedFilms', String(kinopoiskId));
      if (watchedFilms.has(kinopoiskId)) {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, { title, addedAt: serverTimestamp() });
      }
    },
    [user, watchedFilms]
  );

  const handleSignIn = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      // User closed popup or blocked
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const watchedFilmTitles = useMemo(
    () => Array.from(watchedFilms.values()).map((f) => f.title).slice(0, 50),
    [watchedFilms]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      watchedFilms,
      isWatched,
      toggleWatched,
      signIn: handleSignIn,
      signOut: handleSignOut,
      watchedFilmTitles,
    }),
    [user, loading, watchedFilms, isWatched, toggleWatched, handleSignIn, handleSignOut, watchedFilmTitles]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
