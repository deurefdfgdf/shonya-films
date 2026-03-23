'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  reload,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, googleProvider, db, storage } from '@/lib/firebase';

interface WatchedFilm {
  title: string;
  addedAt: unknown;
  reaction?: 'liked' | 'neutral' | 'disliked';
}

export interface AdminMessage {
  id: string;
  text: string;
  createdAt: unknown;
  targetUid?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isAIBlocked: boolean;
  isBanned: boolean;
  adminMessages: AdminMessage[];
  watchedFilms: Map<number, WatchedFilm>;
  isWatched: (id: number) => boolean;
  toggleWatched: (id: number, title: string) => Promise<boolean>;
  setFilmReaction: (id: number, reaction: 'liked' | 'neutral' | 'disliked') => Promise<void>;
  updateNickname: (name: string) => Promise<boolean>;
  uploadAvatar: (file: File) => Promise<boolean>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
  watchedFilmTitles: string[];
  watchedWithReactions: Array<{ title: string; reaction?: string }>;
}

const ADMIN_EMAIL = 'pyfingg@gmail.com';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchedFilms, setWatchedFilms] = useState<Map<number, WatchedFilm>>(new Map());
  const [userRole, setUserRole] = useState<string>('user');
  const [isAIBlocked, setIsAIBlocked] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [adminMessages, setAdminMessages] = useState<AdminMessage[]>([]);

  const isAdmin = useMemo(
    () => user?.email === ADMIN_EMAIL || userRole === 'admin',
    [user, userRole]
  );

  // Sync/create user profile document on login
  const syncUserProfile = useCallback(async (u: User) => {
    const profileRef = doc(db, 'users', u.uid);
    const publicRef = doc(db, 'publicProfiles', u.uid);

    try {
      const profileSnap = await getDoc(profileRef);
      if (!profileSnap.exists()) {
        // First login — create profile
        const role = u.email === ADMIN_EMAIL ? 'admin' : 'user';
        await setDoc(profileRef, {
          displayName: u.displayName || '',
          photoURL: u.photoURL || '',
          email: u.email || '',
          searchName: (u.displayName || '').toLowerCase(),
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp(),
          role,
        });
        setUserRole(role);
      } else {
        const data = profileSnap.data();
        setUserRole(data.role || 'user');
        // Update lastActive
        await updateDoc(profileRef, { lastActive: serverTimestamp() }).catch(() => { });
      }

      // Sync public profile for search
      await setDoc(publicRef, {
        displayName: u.displayName || '',
        searchName: (u.displayName || '').toLowerCase(),
        photoURL: u.photoURL || '',
        uid: u.uid,
      }, { merge: true });
    } catch (err) {
      console.error('[syncUserProfile] error:', err);
    }
  }, []);

  // Check if user is banned or AI-blocked
  const checkAdminSettings = useCallback(async (uid: string) => {
    try {
      const settingsSnap = await getDoc(doc(db, 'admin', 'settings'));
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        const banned = (data.bannedUsers as string[] || []).includes(uid);
        const aiBlocked = (data.aiBlockedUsers as string[] || []).includes(uid);
        setIsBanned(banned);
        setIsAIBlocked(aiBlocked);
        return banned;
      }
    } catch {
      // Admin settings might not exist yet or permission denied
    }
    return false;
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const banned = await checkAdminSettings(u.uid);
        if (banned) {
          await firebaseSignOut(auth);
          setUser(null);
          setLoading(false);
          return;
        }
        setUser(u);
        await syncUserProfile(u);
      } else {
        setUser(null);
        setWatchedFilms(new Map());
        setUserRole('user');
        setIsAIBlocked(false);
        setIsBanned(false);
      }
      setLoading(false);
    });
    return unsub;
  }, [syncUserProfile, checkAdminSettings]);

  // Listen to notifications for this user (written by admin to user's subcollection)
  useEffect(() => {
    if (!user) { setAdminMessages([]); return; }
    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'notifications'),
      (snapshot) => {
        const msgs: AdminMessage[] = [];
        snapshot.docs.forEach((d) => {
          const data = d.data();
          msgs.push({ id: d.id, text: data.text, createdAt: data.createdAt, targetUid: data.targetUid });
        });
        setAdminMessages(msgs);
      },
      () => { } // ignore errors
    );
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, 'users', user.uid, 'watchedFilms');
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        const map = new Map<number, WatchedFilm>();
        snapshot.docs.forEach((d) => {
          const id = parseInt(d.id, 10);
          if (!isNaN(id)) map.set(id, d.data() as WatchedFilm);
        });
        setWatchedFilms(map);
      },
      (err) => {
        console.error('[onSnapshot] Firestore read error:', err);
      }
    );
    return unsub;
  }, [user]);

  const isWatched = useCallback(
    (id: number) => watchedFilms.has(id),
    [watchedFilms]
  );

  const toggleWatched = useCallback(
    async (kinopoiskId: number, title: string): Promise<boolean> => {
      if (!user) return false;
      const docRef = doc(db, 'users', user.uid, 'watchedFilms', String(kinopoiskId));
      try {
        if (watchedFilms.has(kinopoiskId)) {
          await deleteDoc(docRef);
        } else {
          await setDoc(docRef, { title, addedAt: serverTimestamp() });
        }
        return true;
      } catch (err) {
        console.error('[toggleWatched] Firestore error:', err);
        return false;
      }
    },
    [user, watchedFilms]
  );

  const setFilmReaction = useCallback(
    async (kinopoiskId: number, reaction: 'liked' | 'neutral' | 'disliked') => {
      if (!user) return;
      const docRef = doc(db, 'users', user.uid, 'watchedFilms', String(kinopoiskId));
      try {
        await updateDoc(docRef, { reaction });
      } catch {
        // doc might not exist yet, ignore
      }
    },
    [user]
  );

  const updateNickname = useCallback(
    async (name: string): Promise<boolean> => {
      if (!user) return false;
      try {
        await updateProfile(user, { displayName: name });
        await reload(user);
        // Update Firestore profile and public profile
        const searchName = name.toLowerCase();
        await setDoc(doc(db, 'users', user.uid), { displayName: name, searchName }, { merge: true });
        await setDoc(doc(db, 'publicProfiles', user.uid), { displayName: name, searchName, photoURL: user.photoURL || '', uid: user.uid }, { merge: true });
        setUser({ ...user });
        return true;
      } catch (err) {
        console.error('[updateNickname] error:', err);
        return false;
      }
    },
    [user]
  );

  const uploadAvatar = useCallback(
    async (file: File): Promise<boolean> => {
      if (!user) return false;
      try {
        const storageRef = ref(storage, `avatars/${user.uid}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        await updateProfile(user, { photoURL: url });
        await reload(user);
        // Update Firestore profile and public profile
        await setDoc(doc(db, 'users', user.uid), { photoURL: url }, { merge: true });
        await setDoc(doc(db, 'publicProfiles', user.uid), { photoURL: url }, { merge: true });
        setUser({ ...user });
        return true;
      } catch (err) {
        console.error('[uploadAvatar] error:', err);
        return false;
      }
    },
    [user]
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

  const deleteAccount = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    try {
      // Delete Firestore data
      await Promise.allSettled([
        deleteDoc(doc(db, 'users', user.uid)),
        deleteDoc(doc(db, 'publicProfiles', user.uid)),
      ]);
      // Delete Firebase Auth account
      await user.delete();
      return true;
    } catch (err) {
      console.error('[deleteAccount] error:', err);
      // If re-auth required, just sign out
      await firebaseSignOut(auth);
      return false;
    }
  }, [user]);

  const watchedFilmTitles = useMemo(
    () => Array.from(watchedFilms.values()).map((f) => f.title).slice(0, 50),
    [watchedFilms]
  );

  const watchedWithReactions = useMemo(
    () => Array.from(watchedFilms.values()).map((f) => ({
      title: f.title,
      reaction: f.reaction,
    })).slice(0, 50),
    [watchedFilms]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin,
      isAIBlocked,
      isBanned,
      adminMessages,
      watchedFilms,
      isWatched,
      toggleWatched,
      setFilmReaction,
      updateNickname,
      uploadAvatar,
      signIn: handleSignIn,
      signOut: handleSignOut,
      deleteAccount,
      watchedFilmTitles,
      watchedWithReactions,
    }),
    [user, loading, isAdmin, isAIBlocked, isBanned, adminMessages, watchedFilms, isWatched, toggleWatched, setFilmReaction, updateNickname, uploadAvatar, handleSignIn, handleSignOut, deleteAccount, watchedFilmTitles, watchedWithReactions]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
