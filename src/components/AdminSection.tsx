'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

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
            { id: 'users' as AdminTab, label: 'Пользователи' },
            { id: 'messages' as AdminTab, label: 'Сообщения' },
            { id: 'stats' as AdminTab, label: 'Статистика' },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full border px-4 py-2 text-[0.62rem] uppercase tracking-[0.18em] transition-all ${
                tab === t.id
                  ? 'border-[rgb(201_184_154_/_0.3)] bg-[rgb(201_184_154_/_0.1)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
              data-clickable
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {tab === 'users' && <UsersTab />}
          {tab === 'messages' && <MessagesTab />}
          {tab === 'stats' && <StatsTab />}
        </div>
      </section>
    </div>
  );
}

/* ─── Users Tab ─── */
function UsersTab() {
  const [users, setUsers] = useState<PublicProfile[]>([]);
  const [settings, setSettings] = useState<AdminSettings>({ bannedUsers: [], aiBlockedUsers: [] });
  const [search, setSearch] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

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
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const updateSettings = async (newSettings: AdminSettings) => {
    await setDoc(doc(db, 'admin', 'settings'), newSettings, { merge: true });
    setSettings(newSettings);
  };

  const toggleBan = async (uid: string) => {
    setLoadingAction(uid + '-ban');
    const newBanned = settings.bannedUsers.includes(uid)
      ? settings.bannedUsers.filter((id) => id !== uid)
      : [...settings.bannedUsers, uid];
    await updateSettings({ ...settings, bannedUsers: newBanned });
    setLoadingAction(null);
  };

  const toggleAIBlock = async (uid: string) => {
    setLoadingAction(uid + '-ai');
    const newBlocked = settings.aiBlockedUsers.includes(uid)
      ? settings.aiBlockedUsers.filter((id) => id !== uid)
      : [...settings.aiBlockedUsers, uid];
    await updateSettings({ ...settings, aiBlockedUsers: newBlocked });
    setLoadingAction(null);
  };

  const filtered = search.trim()
    ? users.filter((u) => u.searchName?.includes(search.toLowerCase()) || u.uid.includes(search))
    : users;

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по имени или UID..."
        className="w-full max-w-md rounded-[0.85rem] border border-[var(--color-border)] bg-[rgb(255_255_255_/_0.04)] px-4 py-2.5 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[rgb(201_184_154_/_0.3)]"
      />

      <div className="mt-6 space-y-3">
        {filtered.map((u) => {
          const isBanned = settings.bannedUsers.includes(u.uid);
          const isBlocked = settings.aiBlockedUsers.includes(u.uid);
          return (
            <div key={u.uid} className="glass-panel flex items-center gap-4 rounded-[1rem] p-4">
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
                <div className="truncate text-sm text-[var(--color-text)]">{u.displayName || 'Без имени'}</div>
                <div className="truncate text-[0.6rem] text-[var(--color-text-muted)]">{u.uid}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => toggleAIBlock(u.uid)}
                  disabled={loadingAction === u.uid + '-ai'}
                  className={`rounded-full border px-3 py-1.5 text-[0.55rem] uppercase tracking-[0.14em] transition-all ${
                    isBlocked
                      ? 'border-[rgb(184_168_110_/_0.4)] bg-[rgb(184_168_110_/_0.12)] text-[var(--color-warning)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-warning)] hover:text-[var(--color-warning)]'
                  }`}
                  data-clickable
                >
                  {isBlocked ? 'ИИ заблокирован' : 'Блок ИИ'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleBan(u.uid)}
                  disabled={loadingAction === u.uid + '-ban'}
                  className={`rounded-full border px-3 py-1.5 text-[0.55rem] uppercase tracking-[0.14em] transition-all ${
                    isBanned
                      ? 'border-[rgb(184_114_114_/_0.4)] bg-[rgb(184_114_114_/_0.12)] text-[var(--color-danger)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]'
                  }`}
                  data-clickable
                >
                  {isBanned ? 'Забанен' : 'Бан'}
                </button>
              </div>
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
  const [text, setText] = useState('');
  const [targetUid, setTargetUid] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<AdminMsg[]>([]);

  useEffect(() => {
    getDocs(query(collection(db, 'admin', 'messages', 'items'), orderBy('createdAt', 'desc')))
      .then((snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminMsg)));
      })
      .catch(() => {});
  }, []);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const msgData: Record<string, unknown> = { text: text.trim(), createdAt: serverTimestamp() };
      if (targetUid.trim()) msgData.targetUid = targetUid.trim();
      await addDoc(collection(db, 'admin', 'messages', 'items'), msgData);
      setMessages((prev) => [{ id: Date.now().toString(), text: text.trim(), createdAt: new Date(), targetUid: targetUid.trim() || undefined }, ...prev]);
      setText('');
      setTargetUid('');
    } catch (err) {
      console.error('[AdminMessage] error:', err);
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
        <input
          type="text"
          value={targetUid}
          onChange={(e) => setTargetUid(e.target.value)}
          placeholder="UID получателя (пусто = всем)"
          className="mt-2 w-full rounded-[0.6rem] border border-[var(--color-border)] bg-[rgb(255_255_255_/_0.03)] px-4 py-2 text-[0.8rem] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[rgb(201_184_154_/_0.3)]"
        />
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

      <div className="mt-8 space-y-3">
        <div className="text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          История ({messages.length})
        </div>
        {messages.map((msg) => (
          <div key={msg.id} className="glass-panel rounded-[0.8rem] p-4">
            <p className="text-sm text-[var(--color-text)]">{msg.text}</p>
            <div className="mt-2 flex gap-3 text-[0.55rem] text-[var(--color-text-muted)]">
              {msg.targetUid ? <span>Для: {msg.targetUid}</span> : <span>Всем</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Stats Tab ─── */
function StatsTab() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    setLoadingStats(true);
    getDocs(collection(db, 'publicProfiles'))
      .then((snap) => {
        setTotalUsers(snap.size);
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Всего пользователей" value={loadingStats ? '...' : String(totalUsers)} />
      <StatCard label="Платформа" value="Next.js + Firebase" />
      <StatCard label="ИИ модель" value="Step 3.5 Flash" />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel rounded-[1.2rem] p-5">
      <div className="text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-light text-[var(--color-text)]">{value}</div>
    </div>
  );
}
