'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    getPendingRequests,
    getSentRequests,
    getFriends,
    removeFriend,
    getFriendWatchedFilms,
    getFriendActivity,
    cancelFriendRequest,
    type PublicProfile,
    type FriendRequest,
    type FriendEntry,
    type WatchedFilmEntry,
    type ActivityItem,
} from '@/lib/friends';
import ChatWindow, { getUnreadCount } from '@/components/ChatWindow';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

type FriendsTab = 'friends' | 'requests' | 'search' | 'activity';

interface FriendsSectionProps {
    onFilmClick: (id: number) => void;
}

/* ─── Helpers ─── */

/** #1 — Relative timestamps: "2 мин назад", "вчера", etc. */
function timeAgo(ts: unknown): string {
    if (!ts) return '';
    const seconds = (ts as { seconds?: number })?.seconds;
    if (!seconds) return '';
    const now = Date.now() / 1000;
    const diff = Math.floor(now - seconds);
    if (diff < 60) return 'только что';
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
    if (diff < 172800) return 'вчера';
    if (diff < 604800) return `${Math.floor(diff / 86400)} дн назад`;
    const d = new Date(seconds * 1000);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/** #2 — Online status check (active within last 5 min) */
function isOnline(lastActive: unknown): boolean {
    if (!lastActive) return false;
    const seconds = (lastActive as { seconds?: number })?.seconds;
    if (!seconds) return false;
    return (Date.now() / 1000 - seconds) < 300;
}

export default function FriendsSection({ onFilmClick }: FriendsSectionProps) {
    const { user, signIn, watchedFilms } = useAuth();
    const [tab, setTab] = useState<FriendsTab>('friends');
    const [friends, setFriends] = useState<FriendEntry[]>([]);
    const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
    const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // #3 — Unread counts per friend
    const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());

    // Friend profile view
    const [selectedFriend, setSelectedFriend] = useState<FriendEntry | null>(null);
    const [friendFilms, setFriendFilms] = useState<WatchedFilmEntry[]>([]);
    const [friendFilmsLoading, setFriendFilmsLoading] = useState(false);
    const [friendOnline, setFriendOnline] = useState(false);

    // Chat
    const [chatFriend, setChatFriend] = useState<FriendEntry | null>(null);

    // #4 — Sort mode
    const [sortMode, setSortMode] = useState<'name' | 'recent'>('name');

    // #5 — Remove confirmation dialog
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        if (!user) return;
        try {
            const [fr, pr, sr] = await Promise.all([
                getFriends(user.uid),
                getPendingRequests(user.uid),
                getSentRequests(user.uid),
            ]);
            setFriends(fr);
            setPendingRequests(pr);
            setSentRequests(sr);

            // Load activity
            if (fr.length > 0) {
                const act = await getFriendActivity(fr);
                setActivity(act);
            }

            // #3 — Load unread counts for all friends
            if (fr.length > 0) {
                const counts = new Map<string, number>();
                const results = await Promise.allSettled(
                    fr.map(async (f) => {
                        const count = await getUnreadCount(user.uid, f.uid);
                        return { uid: f.uid, count };
                    })
                );
                results.forEach((r) => {
                    if (r.status === 'fulfilled' && r.value.count > 0) {
                        counts.set(r.value.uid, r.value.count);
                    }
                });
                setUnreadCounts(counts);
            }
        } catch (err) {
            console.error('[FriendsSection] loadData error:', err);
        }
        setLoading(false);
        setRefreshing(false);
    }, [user]);

    useEffect(() => {
        setLoading(true);
        void loadData();
    }, [loadData]);

    // #6 — Refresh button
    const handleRefresh = () => {
        setRefreshing(true);
        void loadData();
    };

    const viewFriendProfile = async (friend: FriendEntry) => {
        setSelectedFriend(friend);
        setFriendFilmsLoading(true);
        // Check online status
        try {
            const userDoc = await getDoc(doc(db, 'users', friend.uid));
            if (userDoc.exists()) {
                setFriendOnline(isOnline(userDoc.data().lastActive));
            }
        } catch { setFriendOnline(false); }

        try {
            const films = await getFriendWatchedFilms(friend.uid);
            setFriendFilms(films);
        } catch {
            setFriendFilms([]);
        }
        setFriendFilmsLoading(false);
    };

    // #7 — Sorted friends
    const sortedFriends = [...friends].sort((a, b) => {
        if (sortMode === 'name') return (a.displayName || '').localeCompare(b.displayName || '');
        // Sort by addedAt descending
        const aTime = (a.addedAt as { seconds?: number })?.seconds || 0;
        const bTime = (b.addedAt as { seconds?: number })?.seconds || 0;
        return bTime - aTime;
    });

    // #8 — Total unread count for badge
    const totalUnread = Array.from(unreadCounts.values()).reduce((a, b) => a + b, 0);

    if (!user) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center pt-[var(--header-height)]">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: EASE }}
                    className="text-center"
                >
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[var(--color-border)] bg-[rgb(255_255_255_/_0.03)]">
                        <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-[var(--color-text-muted)]" stroke="currentColor" strokeWidth="1">
                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                        </svg>
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)]">Войдите, чтобы найти друзей и общаться</p>
                    <button type="button" onClick={signIn} className="editorial-button editorial-button--solid mt-5" data-clickable>
                        <span className="text-[0.72rem]">Войти через Google</span>
                    </button>
                </motion.div>
            </div>
        );
    }

    // #9 — Improved friend profile overlay with stats
    if (selectedFriend) {
        // Calculate stats
        const likedCount = friendFilms.filter((f) => f.reaction === 'liked').length;
        const dislikedCount = friendFilms.filter((f) => f.reaction === 'disliked').length;
        // #10 — Common films: films you both watched
        const myFilmIds = new Set(Array.from(watchedFilms.keys()).map(String));
        const commonFilms = friendFilms.filter((f) => myFilmIds.has(f.filmId));

        return (
            <div className="pb-20 pt-[calc(var(--header-height)+2.75rem)]">
                <section className="section-shell">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                        <button
                            type="button"
                            onClick={() => setSelectedFriend(null)}
                            className="mb-6 flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.18em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                            data-clickable
                        >
                            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            Назад к друзьям
                        </button>

                        {/* Profile header */}
                        <div className="flex items-center gap-5">
                            <div className="relative">
                                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-[var(--color-border)]">
                                    {selectedFriend.photoURL ? (
                                        <img src={selectedFriend.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)] text-xl text-[var(--color-accent)]">
                                            {selectedFriend.displayName?.[0] || '?'}
                                        </div>
                                    )}
                                </div>
                                {/* #11 — Online indicator dot */}
                                {friendOnline && (
                                    <div className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2 border-[rgb(14_14_14)] bg-[rgb(110_184_110)]" />
                                )}
                            </div>
                            <div>
                                <h2 className="display-title text-2xl text-[var(--color-text)]">{selectedFriend.displayName}</h2>
                                <p className="mt-1 text-[0.62rem] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                                    {friendOnline ? <span className="text-[rgb(110_184_110)]">онлайн</span> : 'был(а) недавно'}
                                </p>
                            </div>
                        </div>

                        {/* #12 — Profile stats cards */}
                        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <StatMini label="Просмотрено" value={String(friendFilms.length)} />
                            <StatMini label="Понравилось" value={String(likedCount)} accent />
                            <StatMini label="Не понравилось" value={String(dislikedCount)} />
                            <StatMini label="Общие фильмы" value={String(commonFilms.length)} accent />
                        </div>

                        {/* #13 — Common films section */}
                        {commonFilms.length > 0 && (
                            <div className="mt-8">
                                <div className="text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-accent)]">
                                    Общие фильмы ({commonFilms.length})
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {commonFilms.slice(0, 12).map((film) => (
                                        <button
                                            key={film.filmId}
                                            type="button"
                                            onClick={() => onFilmClick(parseInt(film.filmId, 10))}
                                            className="rounded-full border border-[rgb(201_184_154_/_0.2)] bg-[rgb(201_184_154_/_0.06)] px-3 py-1.5 text-[0.7rem] text-[var(--color-accent)] transition-all hover:bg-[rgb(201_184_154_/_0.12)]"
                                            data-clickable
                                        >
                                            {film.title}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* All watched films */}
                        <div className="mt-8">
                            <div className="text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                                Все просмотренные ({friendFilms.length})
                            </div>
                            {friendFilmsLoading ? (
                                <div className="mt-6 flex justify-center">
                                    <div className="h-5 w-5 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]" />
                                </div>
                            ) : friendFilms.length === 0 ? (
                                <p className="mt-6 text-sm text-[var(--color-text-muted)]">Пока ничего не посмотрел</p>
                            ) : (
                                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {friendFilms.map((film, i) => (
                                        <motion.button
                                            key={film.filmId}
                                            type="button"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.5), ease: EASE }}
                                            onClick={() => onFilmClick(parseInt(film.filmId, 10))}
                                            className="glass-panel flex items-center gap-3 rounded-[0.8rem] p-3 text-left transition-all hover:bg-[rgb(255_255_255_/_0.04)]"
                                            data-clickable
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm text-[var(--color-text)]">{film.title}</div>
                                                <div className="mt-1 flex items-center gap-2 text-[0.55rem] text-[var(--color-text-muted)]">
                                                    {film.reaction === 'liked' && <span className="text-[var(--color-accent)]">👍 Понравилось</span>}
                                                    {film.reaction === 'disliked' && <span className="text-[var(--color-danger)]">👎 Не понравилось</span>}
                                                    {film.reaction === 'neutral' && <span>😐 Нейтрально</span>}
                                                    {!film.reaction && <span>Без оценки</span>}
                                                </div>
                                            </div>
                                            {/* Show if common */}
                                            {myFilmIds.has(film.filmId) && (
                                                <span className="shrink-0 text-[0.5rem] uppercase tracking-wider text-[var(--color-accent)]">✦ общий</span>
                                            )}
                                        </motion.button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </section>
            </div>
        );
    }

    return (
        <div className="pb-20 pt-[calc(var(--header-height)+2.75rem)]">
            <section className="section-shell">
                <div className="flex items-end justify-between">
                    <motion.h1
                        className="display-title text-[clamp(3rem,8vw,6rem)] text-[var(--color-text)]"
                        initial={{ opacity: 0, y: 34 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.75, ease: EASE }}
                    >
                        Друзья
                    </motion.h1>
                    {/* #6 — Refresh button */}
                    <motion.button
                        type="button"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="mb-3 flex items-center gap-1.5 text-[0.55rem] uppercase tracking-[0.18em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                        data-clickable
                    >
                        <svg viewBox="0 0 24 24" fill="none" className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} stroke="currentColor" strokeWidth="1.5">
                            <path d="M21 12a9 9 0 11-2.63-6.36" /><path d="M21 3v6h-6" />
                        </svg>
                        {refreshing ? 'Обновление...' : 'Обновить'}
                    </motion.button>
                </div>

                {/* #14 — Tabs with notification badges */}
                <div className="mt-8 flex flex-wrap gap-2">
                    {([
                        { id: 'friends' as FriendsTab, label: `Друзья (${friends.length})`, badge: totalUnread },
                        { id: 'requests' as FriendsTab, label: 'Заявки', badge: pendingRequests.length },
                        { id: 'search' as FriendsTab, label: 'Поиск', badge: 0 },
                        { id: 'activity' as FriendsTab, label: 'Лента', badge: 0 },
                    ]).map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={`relative rounded-full border px-4 py-2 text-[0.62rem] uppercase tracking-[0.18em] transition-all ${tab === t.id
                                    ? 'border-[rgb(201_184_154_/_0.3)] bg-[rgb(201_184_154_/_0.1)] text-[var(--color-accent)]'
                                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                                }`}
                            data-clickable
                        >
                            {t.label}
                            {t.badge > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[0.45rem] font-medium text-white">
                                    {t.badge > 99 ? '99+' : t.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* #15 — Animated tab content transitions */}
                <div className="mt-8">
                    {loading ? (
                        <div className="flex flex-col items-center gap-3 py-16">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
                            <span className="text-[0.6rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Загрузка данных...</span>
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={tab}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.3, ease: EASE }}
                            >
                                {tab === 'friends' && (
                                    <FriendsListTab
                                        friends={sortedFriends}
                                        unreadCounts={unreadCounts}
                                        sortMode={sortMode}
                                        onSortChange={setSortMode}
                                        onViewProfile={viewFriendProfile}
                                        onOpenChat={(f) => setChatFriend(f)}
                                        confirmRemove={confirmRemove}
                                        onConfirmRemoveToggle={setConfirmRemove}
                                        onRemove={async (friendUid) => {
                                            await removeFriend(user.uid, friendUid);
                                            setConfirmRemove(null);
                                            void loadData();
                                        }}
                                    />
                                )}
                                {tab === 'requests' && (
                                    <RequestsTab
                                        pending={pendingRequests}
                                        sent={sentRequests}
                                        onAccept={async (id) => {
                                            await acceptFriendRequest(id);
                                            void loadData();
                                        }}
                                        onReject={async (id) => {
                                            await rejectFriendRequest(id);
                                            void loadData();
                                        }}
                                        onCancelSent={async (id) => {
                                            await cancelFriendRequest(id);
                                            void loadData();
                                        }}
                                    />
                                )}
                                {tab === 'search' && (
                                    <SearchTab
                                        currentUid={user.uid}
                                        currentName={user.displayName || ''}
                                        currentPhoto={user.photoURL || ''}
                                        friends={friends}
                                        sentRequests={sentRequests}
                                        pendingRequests={pendingRequests}
                                        onRequestSent={() => void loadData()}
                                    />
                                )}
                                {tab === 'activity' && (
                                    <ActivityTab activity={activity} onFilmClick={onFilmClick} />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>
            </section>

            {/* Chat slide-in with backdrop */}
            <AnimatePresence>
                {chatFriend && user && (
                    <>
                        {/* #16 — Backdrop overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="fixed inset-0 z-[55] bg-black/50"
                            onClick={() => setChatFriend(null)}
                        />
                        <ChatWindow
                            currentUid={user.uid}
                            friendUid={chatFriend.uid}
                            friendName={chatFriend.displayName}
                            friendPhoto={chatFriend.photoURL}
                            onClose={() => {
                                setChatFriend(null);
                                // Refresh unread counts after closing chat
                                void loadData();
                            }}
                        />
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ─── Mini Stat Card ─── */
function StatMini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className="glass-panel rounded-[0.8rem] px-3 py-3 text-center">
            <div className={`text-xl font-light ${accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'}`}>{value}</div>
            <div className="mt-1 text-[0.5rem] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</div>
        </div>
    );
}

/* ─── Friends List Tab ─── */
function FriendsListTab({
    friends,
    unreadCounts,
    sortMode,
    onSortChange,
    onViewProfile,
    onOpenChat,
    confirmRemove,
    onConfirmRemoveToggle,
    onRemove,
}: {
    friends: FriendEntry[];
    unreadCounts: Map<string, number>;
    sortMode: 'name' | 'recent';
    onSortChange: (m: 'name' | 'recent') => void;
    onViewProfile: (f: FriendEntry) => void;
    onOpenChat: (f: FriendEntry) => void;
    confirmRemove: string | null;
    onConfirmRemoveToggle: (uid: string | null) => void;
    onRemove: (uid: string) => void;
}) {
    if (friends.length === 0) {
        return (
            <div className="flex flex-col items-center py-16">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-border)] bg-[rgb(255_255_255_/_0.02)]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-[var(--color-text-muted)]" stroke="currentColor" strokeWidth="1">
                        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                        <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">У вас пока нет друзей</p>
                <p className="mt-1 text-[0.65rem] text-[var(--color-text-muted)]">Перейдите на вкладку «Поиск» чтобы найти людей</p>
            </div>
        );
    }

    return (
        <div>
            {/* #4 — Sort toggle */}
            <div className="mb-4 flex items-center gap-3">
                <span className="text-[0.5rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Сортировка:</span>
                <button
                    type="button"
                    onClick={() => onSortChange('name')}
                    className={`text-[0.55rem] uppercase tracking-[0.14em] transition-colors ${sortMode === 'name' ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                    data-clickable
                >
                    по имени
                </button>
                <span className="text-[0.55rem] text-[var(--color-text-muted)]">·</span>
                <button
                    type="button"
                    onClick={() => onSortChange('recent')}
                    className={`text-[0.55rem] uppercase tracking-[0.14em] transition-colors ${sortMode === 'recent' ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                    data-clickable
                >
                    по дате
                </button>
            </div>

            <div className="space-y-3">
                {friends.map((friend, i) => {
                    const unread = unreadCounts.get(friend.uid) || 0;
                    const isConfirming = confirmRemove === friend.uid;
                    return (
                        <motion.div
                            key={friend.uid}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4), ease: EASE }}
                            className="glass-panel flex items-center gap-4 rounded-[1rem] p-4"
                        >
                            {/* Avatar with online dot */}
                            <button
                                type="button"
                                onClick={() => onViewProfile(friend)}
                                className="relative h-12 w-12 shrink-0 overflow-visible"
                                data-clickable
                            >
                                <div className="h-full w-full overflow-hidden rounded-full border border-[var(--color-border)] transition-all hover:border-[var(--color-accent)]">
                                    {friend.photoURL ? (
                                        <img src={friend.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)] text-sm text-[var(--color-accent)]">
                                            {friend.displayName?.[0] || '?'}
                                        </div>
                                    )}
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => onViewProfile(friend)}
                                className="min-w-0 flex-1 text-left"
                                data-clickable
                            >
                                <div className="truncate text-sm text-[var(--color-text)]">{friend.displayName || 'Без имени'}</div>
                            </button>

                            {/* Actions */}
                            <div className="flex shrink-0 items-center gap-2">
                                {/* #3 — Unread badge on chat button */}
                                <button
                                    type="button"
                                    onClick={() => onOpenChat(friend)}
                                    className="relative rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[0.55rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)] transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                                    data-clickable
                                >
                                    Чат
                                    {unread > 0 && (
                                        <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--color-danger)] px-0.5 text-[0.4rem] font-medium text-white">
                                            {unread}
                                        </span>
                                    )}
                                </button>

                                {/* #5 — Remove with confirmation */}
                                {isConfirming ? (
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => onRemove(friend.uid)}
                                            className="rounded-full border border-[var(--color-danger)] bg-[rgb(184_114_114_/_0.1)] px-2.5 py-1.5 text-[0.5rem] uppercase tracking-[0.1em] text-[var(--color-danger)]"
                                            data-clickable
                                        >
                                            Да
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onConfirmRemoveToggle(null)}
                                            className="rounded-full border border-[var(--color-border)] px-2.5 py-1.5 text-[0.5rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)]"
                                            data-clickable
                                        >
                                            Нет
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onConfirmRemoveToggle(friend.uid)}
                                        className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[0.55rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)] transition-all hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                                        data-clickable
                                    >
                                        Удалить
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

/* ─── Requests Tab ─── */
function RequestsTab({
    pending,
    sent,
    onAccept,
    onReject,
    onCancelSent,
}: {
    pending: FriendRequest[];
    sent: FriendRequest[];
    onAccept: (id: string) => void;
    onReject: (id: string) => void;
    onCancelSent: (id: string) => void;
}) {
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    return (
        <div>
            {/* Incoming */}
            <div className="mb-4 flex items-center gap-2">
                <div className="text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    Входящие
                </div>
                {pending.length > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[rgb(154_184_154_/_0.2)] px-1 text-[0.45rem] font-medium text-[rgb(154_184_154)]">
                        {pending.length}
                    </span>
                )}
            </div>
            {pending.length === 0 ? (
                <p className="mb-8 text-[0.75rem] text-[var(--color-text-muted)]">Нет входящих заявок</p>
            ) : (
                <div className="mb-8 space-y-3">
                    {pending.map((req, i) => (
                        <motion.div
                            key={req.id}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.35, delay: i * 0.06, ease: EASE }}
                            className="glass-panel flex items-center gap-4 rounded-[1rem] p-4"
                        >
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[var(--color-border)]">
                                {req.fromPhoto ? (
                                    <img src={req.fromPhoto} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)] text-sm text-[var(--color-accent)]">
                                        {req.fromName?.[0] || '?'}
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm text-[var(--color-text)]">{req.fromName}</div>
                                <div className="mt-0.5 text-[0.5rem] text-[var(--color-text-muted)]">{timeAgo(req.createdAt)}</div>
                            </div>
                            <div className="flex shrink-0 gap-2">
                                <button
                                    type="button"
                                    disabled={actionLoading === req.id}
                                    onClick={async () => { setActionLoading(req.id); await onAccept(req.id); setActionLoading(null); }}
                                    className="rounded-full border border-[rgb(154_184_154_/_0.3)] bg-[rgb(154_184_154_/_0.08)] px-3 py-1.5 text-[0.55rem] uppercase tracking-[0.14em] text-[rgb(154_184_154)] transition-all hover:bg-[rgb(154_184_154_/_0.15)]"
                                    data-clickable
                                >
                                    {actionLoading === req.id ? '...' : 'Принять'}
                                </button>
                                <button
                                    type="button"
                                    disabled={actionLoading === req.id}
                                    onClick={async () => { setActionLoading(req.id); await onReject(req.id); setActionLoading(null); }}
                                    className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[0.55rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)] transition-all hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                                    data-clickable
                                >
                                    Отклонить
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Sent — #17 — Cancel sent requests */}
            <div className="mb-4 text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                Отправленные ({sent.length})
            </div>
            {sent.length === 0 ? (
                <p className="text-[0.75rem] text-[var(--color-text-muted)]">Нет отправленных заявок</p>
            ) : (
                <div className="space-y-3">
                    {sent.map((req) => (
                        <div key={req.id} className="glass-panel flex items-center gap-3 rounded-[0.8rem] p-3">
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm text-[var(--color-text-muted)]">
                                    Ожидает ответа
                                </div>
                                <div className="mt-0.5 text-[0.5rem] text-[var(--color-text-muted)]">{timeAgo(req.createdAt)}</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => onCancelSent(req.id)}
                                className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[0.55rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)] transition-all hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                                data-clickable
                            >
                                Отменить
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─── Search Tab ─── */
function SearchTab({
    currentUid,
    currentName,
    currentPhoto,
    friends,
    sentRequests,
    pendingRequests,
    onRequestSent,
}: {
    currentUid: string;
    currentName: string;
    currentPhoto: string;
    friends: FriendEntry[];
    sentRequests: FriendRequest[];
    pendingRequests: FriendRequest[];
    onRequestSent: () => void;
}) {
    const [queryStr, setQueryStr] = useState('');
    const [results, setResults] = useState<PublicProfile[]>([]);
    const [searching, setSearching] = useState(false);
    const [sendingTo, setSendingTo] = useState<string | null>(null);
    const [sentSuccess, setSentSuccess] = useState<Set<string>>(new Set());
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus search input
    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleSearch = (value: string) => {
        setQueryStr(value);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        if (value.trim().length < 2) {
            setResults([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        searchTimeout.current = setTimeout(async () => {
            try {
                const res = await searchUsers(value, currentUid);
                setResults(res);
            } catch {
                setResults([]);
            }
            setSearching(false);
        }, 350);
    };

    const friendUids = new Set(friends.map((f) => f.uid));
    const sentUids = new Set(sentRequests.map((r) => r.to));
    const pendingFromUids = new Set(pendingRequests.map((r) => r.from));

    return (
        <div>
            {/* Search input with icon */}
            <div className="relative w-full max-w-md">
                <svg viewBox="0 0 24 24" fill="none" className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="7.5" /><path d="m20 20-3.5-3.5" />
                </svg>
                <input
                    ref={inputRef}
                    type="text"
                    value={queryStr}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Поиск по имени..."
                    className="w-full rounded-[0.85rem] border border-[var(--color-border)] bg-[rgb(255_255_255_/_0.04)] py-2.5 pl-11 pr-4 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[rgb(201_184_154_/_0.3)]"
                />
                {searching && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]" />
                    </div>
                )}
            </div>

            {/* Results */}
            <div className="mt-6 space-y-3">
                {!searching && results.length === 0 && queryStr.trim().length >= 2 && (
                    <div className="flex flex-col items-center py-10">
                        <svg viewBox="0 0 24 24" fill="none" className="mb-3 h-8 w-8 text-[var(--color-text-muted)]" stroke="currentColor" strokeWidth="1">
                            <circle cx="11" cy="11" r="7.5" /><path d="m20 20-3.5-3.5" />
                        </svg>
                        <p className="text-sm text-[var(--color-text-muted)]">Никого не нашли по запросу «{queryStr}»</p>
                    </div>
                )}

                {queryStr.trim().length < 2 && !searching && (
                    <p className="py-10 text-center text-[0.75rem] text-[var(--color-text-muted)]">Введите минимум 2 символа для поиска</p>
                )}

                {results.map((profile, i) => {
                    const isFriend = friendUids.has(profile.uid);
                    const isSent = sentUids.has(profile.uid) || sentSuccess.has(profile.uid);
                    const hasPendingFromThem = pendingFromUids.has(profile.uid);

                    return (
                        <motion.div
                            key={profile.uid}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.05, ease: EASE }}
                            className="glass-panel flex items-center gap-4 rounded-[1rem] p-4"
                        >
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[var(--color-border)]">
                                {profile.photoURL ? (
                                    <img src={profile.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)] text-sm text-[var(--color-accent)]">
                                        {profile.displayName?.[0] || '?'}
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm text-[var(--color-text)]">{profile.displayName}</div>
                            </div>
                            <div>
                                {isFriend ? (
                                    <span className="rounded-full border border-[rgb(201_184_154_/_0.2)] bg-[rgb(201_184_154_/_0.06)] px-2.5 py-1 text-[0.5rem] uppercase tracking-[0.12em] text-[var(--color-accent)]">✓ Друзья</span>
                                ) : hasPendingFromThem ? (
                                    <span className="text-[0.55rem] uppercase tracking-[0.14em] text-[rgb(154_184_154)]">Ждёт вашего ответа</span>
                                ) : isSent ? (
                                    <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[0.5rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Отправлено ✓</span>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={sendingTo === profile.uid}
                                        onClick={async () => {
                                            setSendingTo(profile.uid);
                                            await sendFriendRequest(currentUid, profile.uid, currentName, currentPhoto);
                                            setSentSuccess((prev) => new Set(prev).add(profile.uid));
                                            onRequestSent();
                                            setSendingTo(null);
                                        }}
                                        className="rounded-full border border-[rgb(201_184_154_/_0.3)] bg-[rgb(201_184_154_/_0.06)] px-3.5 py-1.5 text-[0.55rem] uppercase tracking-[0.14em] text-[var(--color-accent)] transition-all hover:bg-[rgb(201_184_154_/_0.14)] disabled:opacity-50"
                                        data-clickable
                                    >
                                        {sendingTo === profile.uid ? '...' : '+ Добавить'}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

/* ─── Activity Feed Tab ─── */
function ActivityTab({
    activity,
    onFilmClick,
}: {
    activity: ActivityItem[];
    onFilmClick: (id: number) => void;
}) {
    if (activity.length === 0) {
        return (
            <div className="flex flex-col items-center py-16">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-border)] bg-[rgb(255_255_255_/_0.02)]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-[var(--color-text-muted)]" stroke="currentColor" strokeWidth="1">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">Пока ничего нет</p>
                <p className="mt-1 text-[0.65rem] text-[var(--color-text-muted)]">Добавьте друзей, чтобы видеть их активность</p>
            </div>
        );
    }

    const reactionEmoji = (r?: string) => {
        if (r === 'liked') return '👍';
        if (r === 'disliked') return '👎';
        if (r === 'neutral') return '😐';
        return '🎬';
    };

    return (
        <div className="space-y-3">
            {activity.map((item, i) => (
                <motion.div
                    key={`${item.friendUid}-${item.filmId}-${i}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.5), ease: EASE }}
                    className="glass-panel flex items-start gap-4 rounded-[1rem] p-4"
                >
                    <div className="mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[var(--color-border)]">
                        {item.friendPhoto ? (
                            <img src={item.friendPhoto} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)] text-xs text-[var(--color-accent)]">
                                {item.friendName?.[0] || '?'}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed text-[var(--color-text)]">
                            <span className="font-medium">{item.friendName}</span>
                            {' '}посмотрел{' '}
                            <button
                                type="button"
                                onClick={() => onFilmClick(parseInt(item.filmId, 10))}
                                className="text-[var(--color-accent)] underline decoration-[var(--color-accent)]/30 underline-offset-2 transition-colors hover:decoration-[var(--color-accent)]"
                                data-clickable
                            >
                                {item.filmTitle}
                            </button>
                            {' '}{reactionEmoji(item.reaction)}
                        </p>
                        {/* #1 — Relative time */}
                        <p className="mt-1 text-[0.5rem] text-[var(--color-text-muted)]">{timeAgo(item.addedAt)}</p>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
