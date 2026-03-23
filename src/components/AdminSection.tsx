'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ToastNotifications';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

type AdminTab = 'users' | 'messages' | 'stats';

interface PublicProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  searchName: string;
}

interface AdminSettings {
  bannedUsers: string[];
  aiBlockedUsers: string[];
}

interface AdminMsg {
  id: string;
  text: string;
  createdAt: unknown;
  targetUid?: string;
  targetName?: string;
}

export default function AdminSection() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<AdminTab>('users');

  if (!isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center pt-[var(--header-height)]">
        <p className="text-sm text-[var(--color-text-muted)]">Доступ запрещён</p>
      </div>
    );
  }

  return (
    <div className="pb-20 pt-[calc(var(--header-height)+2.75rem)]">
      <section className="section-shell">
        <motion.h1
          className="display-title text-[clamp(3rem,8vw,6rem)] text-[var(--color-text)]"
          initial={{ opacity: 0, y: 34 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: EASE }}
        >
          Админ-панель
        </motion.h1>

        {/* Tabs */}
        <div className="mt-8 flex gap-2">
          {([
            { id: 'users' as AdminTab, label: 'Пользователи', icon: '👥' },
            { id: 'messages' as AdminTab, label: 'Сообщения', icon: '✉️' },
            { id: 'stats' as AdminTab, label: 'Статистика', icon: '📊' },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full border px-4 py-2 text-[0.62rem] uppercase tracking-[0.18em] transition-all ${tab === t.id
                  ? 'border-[rgb(201_184_154_/_0.3)] bg-[rgb(201_184_154_/_0.1)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              data-clickable
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="mt-8"
          >
            {tab === 'users' && <UsersTab />}
            {tab === 'messages' && <MessagesTab />}
            {tab === 'stats' && <StatsTab />}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}

/* ─── Users Tab ─── */
function UsersTab() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<PublicProfile[]>([]);
  const [settings, setSettings] = useState<AdminSettings>({ bannedUsers: [], aiBlockedUsers: [] });
  const [search, setSearch] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [usersSnap, settingsSnap] = await Promise.all([
      getDocs(collection(db, 'publicProfiles')),
      getDoc(doc(db, 'admin', 'settings')),
    ]);

    const profiles: PublicProfile[] = [];
    usersSnap.docs.forEach((d) => {
      profiles.push(d.data() as PublicProfile);
    });
    setUsers(profiles);

    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      setSettings({
        bannedUsers: data.bannedUsers || [],
        aiBlockedUsers: data.aiBlockedUsers || [],
      });
    } else {
      // Initialize admin/settings document if it doesn't exist
      try {
        await setDoc(doc(db, 'admin', 'settings'), { bannedUsers: [], aiBlockedUsers: [] });
      } catch (err) {
        console.error('[AdminSection] Failed to init admin/settings:', err);
      }
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const updateSettings = async (newSettings: AdminSettings) => {
    await setDoc(doc(db, 'admin', 'settings'), newSettings, { merge: true });
    setSettings(newSettings);
  };

  const toggleBan = async (uid: string, name: string) => {
    setLoadingAction(uid + '-ban');
    const isBanned = settings.bannedUsers.includes(uid);
    const newBanned = isBanned
      ? settings.bannedUsers.filter((id) => id !== uid)
      : [...settings.bannedUsers, uid];
    await updateSettings({ ...settings, bannedUsers: newBanned });
    showToast(
      isBanned ? `${name} разбанен` : `${name} забанен`,
      isBanned ? 'success' : 'warning'
    );
    setLoadingAction(null);
    setConfirmAction(null);
  };

  const toggleAIBlock = async (uid: string, name: string) => {
    setLoadingAction(uid + '-ai');
    const isBlocked = settings.aiBlockedUsers.includes(uid);
    const newBlocked = isBlocked
      ? settings.aiBlockedUsers.filter((id) => id !== uid)
      : [...settings.aiBlockedUsers, uid];
    await updateSettings({ ...settings, aiBlockedUsers: newBlocked });
    showToast(
      isBlocked ? `ИИ разблокирован для ${name}` : `ИИ заблокирован для ${name}`,
      isBlocked ? 'success' : 'warning'
    );
    setLoadingAction(null);
  };

  const deleteUser = async (uid: string, name: string) => {
    try {
      await Promise.all([
        deleteDoc(doc(db, 'publicProfiles', uid)),
        deleteDoc(doc(db, 'users', uid)),
      ]);
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
      showToast(`Профиль ${name} удалён`, 'success');
    } catch {
      showToast('Ошибка удаления', 'error');
    }
    setConfirmAction(null);
  };

  const filtered = search.trim()
    ? users.filter((u) => u.searchName?.includes(search.toLowerCase()) || u.displayName?.toLowerCase().includes(search.toLowerCase()))
    : users;

  // Count stats
  const bannedCount = settings.bannedUsers.length;
  const blockedCount = settings.aiBlockedUsers.length;

  return (
    <div>
      {/* Quick stats */}
      <div className="mb-6 flex flex-wrap gap-3">
        <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-[0.55rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          Всего: {users.length}
        </span>
        {bannedCount > 0 && (
          <span className="rounded-full border border-[var(--color-danger)] bg-[rgb(184_114_114_/_0.08)] px-3 py-1 text-[0.55rem] uppercase tracking-[0.14em] text-[var(--color-danger)]">
            Забанено: {bannedCount}
          </span>
        )}
        {blockedCount > 0 && (
          <span className="rounded-full border border-[var(--color-warning)] bg-[rgb(184_168_110_/_0.08)] px-3 py-1 text-[0.55rem] uppercase tracking-[0.14em] text-[var(--color-warning)]">
            ИИ блок: {blockedCount}
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative w-full max-w-md">
        <svg viewBox="0 0 24 24" fill="none" className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="7.5" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени..."
          className="w-full rounded-[0.85rem] border border-[var(--color-border)] bg-[rgb(255_255_255_/_0.04)] py-2.5 pl-11 pr-4 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[rgb(201_184_154_/_0.3)]"
        />
      </div>

      <div className="mt-6 space-y-3">
        {filtered.map((u) => {
          const isBanned = settings.bannedUsers.includes(u.uid);
          const isBlocked = settings.aiBlockedUsers.includes(u.uid);
          const isConfirming = confirmAction === u.uid;
          return (
            <div key={u.uid} className={`glass-panel flex items-center gap-4 rounded-[1rem] p-4 ${isBanned ? 'border-l-2 border-l-[var(--color-danger)]' : ''}`}>
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[var(--color-border)]">
                {u.photoURL ? (
                  <img src={u.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)] text-sm text-[var(--color-accent)]">
                    {u.displayName?.[0] || '?'}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-[var(--color-text)]">{u.displayName || 'Без имени'}</span>
                  {isBanned && <span className="rounded bg-[rgb(184_114_114_/_0.15)] px-1.5 py-0.5 text-[0.45rem] uppercase text-[var(--color-danger)]">бан</span>}
                  {isBlocked && <span className="rounded bg-[rgb(184_168_110_/_0.15)] px-1.5 py-0.5 text-[0.45rem] uppercase text-[var(--color-warning)]">ИИ блок</span>}
                </div>
                <div className="truncate text-[0.55rem] text-[var(--color-text-muted)]">{u.uid.slice(0, 20)}...</div>
              </div>

              {isConfirming ? (
                <div className="flex items-center gap-2">
                  <span className="text-[0.5rem] text-[var(--color-danger)]">Удалить?</span>
                  <button type="button" onClick={() => deleteUser(u.uid, u.displayName)} className="rounded-full border border-[var(--color-danger)] px-2 py-1 text-[0.5rem] text-[var(--color-danger)]" data-clickable>Да</button>
                  <button type="button" onClick={() => setConfirmAction(null)} className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[0.5rem] text-[var(--color-text-muted)]" data-clickable>Нет</button>
                </div>
              ) : (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleAIBlock(u.uid, u.displayName)}
                    disabled={loadingAction === u.uid + '-ai'}
                    className={`rounded-full border px-2.5 py-1.5 text-[0.5rem] uppercase tracking-[0.1em] transition-all ${isBlocked
                        ? 'border-[rgb(184_168_110_/_0.4)] bg-[rgb(184_168_110_/_0.12)] text-[var(--color-warning)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-warning)] hover:text-[var(--color-warning)]'
                      }`}
                    data-clickable
                  >
                    {isBlocked ? '🤖 ✗' : '🤖'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleBan(u.uid, u.displayName)}
                    disabled={loadingAction === u.uid + '-ban'}
                    className={`rounded-full border px-2.5 py-1.5 text-[0.5rem] uppercase tracking-[0.1em] transition-all ${isBanned
                        ? 'border-[rgb(184_114_114_/_0.4)] bg-[rgb(184_114_114_/_0.12)] text-[var(--color-danger)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]'
                      }`}
                    data-clickable
                  >
                    {isBanned ? '🔓' : '🔒'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAction(u.uid)}
                    className="rounded-full border border-[var(--color-border)] px-2.5 py-1.5 text-[0.5rem] text-[var(--color-text-muted)] transition-all hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                    data-clickable
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            {users.length === 0 ? 'Загрузка...' : 'Никого не найдено'}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Messages Tab ─── */
function MessagesTab() {
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<AdminMsg[]>([]);

  // User search for targeting
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<PublicProfile[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<PublicProfile | null>(null);
  const [searching, setSearching] = useState(false);
  const [allUsers, setAllUsers] = useState<PublicProfile[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Load all users for broadcast and message history
    getDocs(collection(db, 'publicProfiles'))
      .then((snap) => {
        setAllUsers(snap.docs.map((d) => d.data() as PublicProfile));
      })
      .catch(() => { });

    // Load message history
    getDocs(query(collection(db, 'admin', 'messages', 'items'), orderBy('createdAt', 'desc')))
      .then((snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminMsg)));
      })
      .catch(() => { });
  }, []);

  const handleUserSearch = (value: string) => {
    setUserSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.trim().length < 2) { setUserResults([]); return; }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const q = value.toLowerCase();
        const end = q + '\uf8ff';
        const snap = await getDocs(
          query(collection(db, 'publicProfiles'), where('searchName', '>=', q), where('searchName', '<=', end), limit(10))
        );
        setUserResults(snap.docs.map((d) => d.data() as PublicProfile));
      } catch { setUserResults([]); }
      setSearching(false);
    }, 300);
  };

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const msgData: Record<string, unknown> = {
        text: text.trim(),
        createdAt: serverTimestamp(),
      };
      if (selectedTarget) {
        msgData.targetUid = selectedTarget.uid;
        msgData.targetName = selectedTarget.displayName;
      }

      // Save to admin log
      await addDoc(collection(db, 'admin', 'messages', 'items'), msgData);

      // Write to user notifications
      const notifData = { text: text.trim(), createdAt: serverTimestamp(), targetUid: selectedTarget?.uid || null };

      if (selectedTarget) {
        // Send to specific user
        await addDoc(collection(db, 'users', selectedTarget.uid, 'notifications'), notifData);
        showToast(`Сообщение отправлено ${selectedTarget.displayName}`, 'success');
      } else {
        // Broadcast: write to ALL users' notifications
        const batch: Promise<unknown>[] = [];
        allUsers.forEach((u) => {
          batch.push(addDoc(collection(db, 'users', u.uid, 'notifications'), notifData));
        });
        await Promise.allSettled(batch);
        showToast(`Сообщение отправлено всем (${allUsers.length})`, 'success');
      }

      setMessages((prev) => [{
        id: Date.now().toString(),
        text: text.trim(),
        createdAt: new Date(),
        targetUid: selectedTarget?.uid,
        targetName: selectedTarget?.displayName,
      }, ...prev]);
      setText('');
      setSelectedTarget(null);
      setUserSearch('');
    } catch (err) {
      console.error('[AdminMessage] error:', err);
      showToast('Ошибка отправки', 'error');
    }
    setSending(false);
  };

  return (
    <div>
      <div className="glass-panel rounded-[1.2rem] p-5">
        <div className="text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Новое сообщение</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Текст сообщения..."
          className="mt-3 w-full resize-none rounded-[0.6rem] border border-[var(--color-border)] bg-[rgb(255_255_255_/_0.03)] px-4 py-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[rgb(201_184_154_/_0.3)]"
          rows={3}
        />

        {/* Target user — search by nickname */}
        <div className="mt-3">
          <div className="text-[0.5rem] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Получатель</div>

          {selectedTarget ? (
            <div className="mt-2 flex items-center gap-3 rounded-[0.6rem] border border-[rgb(201_184_154_/_0.2)] bg-[rgb(201_184_154_/_0.06)] px-3 py-2">
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-[var(--color-border)]">
                {selectedTarget.photoURL ? (
                  <img src={selectedTarget.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)] text-[0.5rem] text-[var(--color-accent)]">
                    {selectedTarget.displayName?.[0]}
                  </div>
                )}
              </div>
              <span className="flex-1 text-sm text-[var(--color-accent)]">{selectedTarget.displayName}</span>
              <button
                type="button"
                onClick={() => { setSelectedTarget(null); setUserSearch(''); }}
                className="text-[0.55rem] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                data-clickable
              >
                ✕ Убрать
              </button>
            </div>
          ) : (
            <div className="relative mt-2">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => handleUserSearch(e.target.value)}
                placeholder="Поиск по нику (пусто = всем)..."
                className="w-full rounded-[0.6rem] border border-[var(--color-border)] bg-[rgb(255_255_255_/_0.03)] px-4 py-2 text-[0.8rem] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[rgb(201_184_154_/_0.3)]"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-3 w-3 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]" />
                </div>
              )}

              {/* Search results dropdown */}
              {userResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-[0.6rem] border border-[var(--color-border)] bg-[rgb(18_18_18)] shadow-lg">
                  {userResults.map((u) => (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => {
                        setSelectedTarget(u);
                        setUserSearch('');
                        setUserResults([]);
                      }}
                      className="flex w-full items-center gap-3 border-b border-[var(--color-border)] px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[rgb(255_255_255_/_0.04)]"
                      data-clickable
                    >
                      <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-[var(--color-border)]">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)] text-[0.5rem] text-[var(--color-accent)]">
                            {u.displayName?.[0]}
                          </div>
                        )}
                      </div>
                      <span className="truncate text-sm text-[var(--color-text)]">{u.displayName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Send mode indicator */}
        <div className="mt-3 text-[0.5rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          {selectedTarget
            ? `Отправить → ${selectedTarget.displayName}`
            : `📢 Отправить всем (${allUsers.length} пользователей)`}
        </div>

        <button
          type="button"
          onClick={send}
          disabled={sending || !text.trim()}
          className="editorial-button editorial-button--solid mt-4"
          data-clickable
        >
          <span className="text-[0.72rem]">{sending ? 'Отправка...' : 'Отправить'}</span>
        </button>
      </div>

      {/* Message history */}
      <div className="mt-8 space-y-3">
        <div className="text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          История ({messages.length})
        </div>
        {messages.map((msg) => (
          <div key={msg.id} className="glass-panel rounded-[0.8rem] p-4">
            <p className="text-sm text-[var(--color-text)]">{msg.text}</p>
            <div className="mt-2 flex gap-3 text-[0.55rem] text-[var(--color-text-muted)]">
              {msg.targetName
                ? <span>Для: <span className="text-[var(--color-accent)]">{msg.targetName}</span></span>
                : msg.targetUid
                  ? <span>Для: {(msg.targetUid as string).slice(0, 12)}...</span>
                  : <span className="text-[var(--color-accent)]">📢 Всем</span>}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">Нет отправленных сообщений</p>
        )}
      </div>
    </div>
  );
}

/* ─── Stats Tab ─── */
function StatsTab() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [bannedCount, setBannedCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    setLoadingStats(true);
    Promise.all([
      getDocs(collection(db, 'publicProfiles')),
      getDoc(doc(db, 'admin', 'settings')),
    ])
      .then(([usersSnap, settingsSnap]) => {
        setTotalUsers(usersSnap.size);
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setBannedCount((data.bannedUsers || []).length);
        }
      })
      .catch(() => { })
      .finally(() => setLoadingStats(false));
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Всего пользователей" value={loadingStats ? '...' : String(totalUsers)} icon="👥" />
      <StatCard label="Забанено" value={loadingStats ? '...' : String(bannedCount)} icon="🔒" />
      <StatCard label="Платформа" value="Next.js" icon="⚡" />
      <StatCard label="ИИ модель" value="MiniMax" icon="🤖" />
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="glass-panel rounded-[1.2rem] p-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div className="text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{label}</div>
      </div>
      <div className="mt-2 text-2xl font-light text-[var(--color-text)]">{value}</div>
    </div>
  );
}
