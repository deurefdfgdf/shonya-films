'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
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
    type PublicProfile,
    type FriendRequest,
    type FriendEntry,
    type WatchedFilmEntry,
    type ActivityItem,
} from '@/lib/friends';
import ChatWindow from '@/components/ChatWindow';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

type FriendsTab = 'friends' | 'requests' | 'search' | 'activity';

interface FriendsSectionProps {
    onFilmClick: (id: number) => void;
}

export default function FriendsSection({ onFilmClick }: FriendsSectionProps) {
    const { user, signIn } = useAuth();
    const [tab, setTab] = useState<FriendsTab>('friends');
    const [friends, setFriends] = useState<FriendEntry[]>([]);
    const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
    const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Friend profile view
    const [selectedFriend, setSelectedFriend] = useState<FriendEntry | null>(null);
    const [friendFilms, setFriendFilms] = useState<WatchedFilmEntry[]>([]);
    const [friendFilmsLoading, setFriendFilmsLoading] = useState(false);

    // Chat
    const [chatFriend, setChatFriend] = useState<FriendEntry | null>(null);

    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
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
        } catch (err) {
            console.error('[FriendsSection] loadData error:', err);
        }
        setLoading(false);
    }, [user]);

    useEffect(() => { void loadData(); }, [loadData]);

    const viewFriendProfile = async (friend: FriendEntry) => {
        setSelectedFriend(friend);
        setFriendFilmsLoading(true);
        try {
            const films = await getFriendWatchedFilms(friend.uid);
            setFriendFilms(films);
        } catch {
            setFriendFilms([]);
        }
        setFriendFilmsLoading(false);
    };

    if (!user) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center pt-[var(--header-height)]">
                <div className="text-center">
                    <p className="text-sm text-[var(--color-text-muted)]">Войдите, чтобы управлять друзьями</p>
                    <button type="button" onClick={signIn} className="editorial-button editorial-button--solid mt-4" data-clickable>
                        <span className="text-[0.72rem]">Войти через Google</span>
                    </button>
                </div>
            </div>
        );
    }

    // Friend profile overlay
    if (selectedFriend) {
        return (
            <div className="pb-20 pt-[calc(var(--header-height)+2.75rem)]">
                <section className="section-shell">
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

                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[var(--color-border)]">
                            {selectedFriend.photoURL ? (
                                <img src={selectedFriend.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)] text-lg text-[var(--color-accent)]">
                                    {selectedFriend.displayName?.[0] || '?'}
                                </div>
                            )}
                        </div>
                        <div>
                            <h2 className="display-title text-2xl text-[var(--color-text)]">{selectedFriend.displayName}</h2>
                            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                                {friendFilms.length} фильмов просмотрено
                            </p>
                        </div>
                    </div>

                    <div className="mt-8">
                        <div className="text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                            Просмотренные фильмы
                        </div>
                        {friendFilmsLoading ? (
                            <div className="mt-6 flex justify-center">
                                <div className="h-5 w-5 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]" />
                            </div>
                        ) : friendFilms.length === 0 ? (
                            <p className="mt-6 text-sm text-[var(--color-text-muted)]">Пока ничего не посмотрел</p>
                        ) : (
                            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {friendFilms.map((film) => (
                                    <button
                                        key={film.filmId}
                                        type="button"
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
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
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
                    Друзья
                </motion.h1>

                {/* Tabs */}
                <div className="mt-8 flex flex-wrap gap-2">
                    {([
                        { id: 'friends' as FriendsTab, label: `Друзья (${friends.length})` },
                        { id: 'requests' as FriendsTab, label: `Заявки${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}` },
                        { id: 'search' as FriendsTab, label: 'Поиск' },
                        { id: 'activity' as FriendsTab, label: 'Лента' },
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
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="mt-8">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="h-5 w-5 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]" />
                        </div>
                    ) : (
                        <>
                            {tab === 'friends' && (
                                <FriendsListTab
                                    friends={friends}
                                    onViewProfile={viewFriendProfile}
                                    onOpenChat={(f) => setChatFriend(f)}
                                    onRemove={async (friendUid) => {
                                        await removeFriend(user.uid, friendUid);
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
                                />
                            )}
                            {tab === 'search' && (
                                <SearchTab
                                    currentUid={user.uid}
                                    currentName={user.displayName || ''}
                                    currentPhoto={user.photoURL || ''}
                                    friends={friends}
                                    sentRequests={sentRequests}
                                    onRequestSent={() => void loadData()}
                                />
                            )}
                            {tab === 'activity' && (
                                <ActivityTab activity={activity} onFilmClick={onFilmClick} />
                            )}
                        </>
                    )}
                </div>
            </section>

            {/* Chat slide-in */}
            <AnimatePresence>
                {chatFriend && user && (
                    <ChatWindow
                        currentUid={user.uid}
                        friendUid={chatFriend.uid}
                        friendName={chatFriend.displayName}
                        friendPhoto={chatFriend.photoURL}
                        onClose={() => setChatFriend(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

/* ─── Friends List Tab ─── */
function FriendsListTab({
    friends,
    onViewProfile,
    onOpenChat,
    onRemove,
}: {
    friends: FriendEntry[];
    onViewProfile: (f: FriendEntry) => void;
    onOpenChat: (f: FriendEntry) => void;
    onRemove: (uid: string) => void;
}) {
    if (friends.length === 0) {
        return (
            <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
                У вас пока нет друзей. Найдите кого-нибудь на вкладке «Поиск»!
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {friends.map((friend) => (
                <div key={friend.uid} className="glass-panel flex items-center gap-4 rounded-[1rem] p-4">
                    <button
                        type="button"
                        onClick={() => onViewProfile(friend)}
                        className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-[var(--color-border)] transition-all hover:border-[var(--color-accent)]"
                        data-clickable
                    >
                        {friend.photoURL ? (
                            <img src={friend.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)] text-sm text-[var(--color-accent)]">
                                {friend.displayName?.[0] || '?'}
                            </div>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewProfile(friend)}
                        className="min-w-0 flex-1 text-left"
                        data-clickable
                    >
                        <div className="truncate text-sm text-[var(--color-text)]">{friend.displayName || 'Без имени'}</div>
                    </button>
                    <div className="flex shrink-0 gap-2">
                        <button
                            type="button"
                            onClick={() => onOpenChat(friend)}
                            className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[0.55rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)] transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                            data-clickable
                        >
                            Чат
                        </button>
                        <button
                            type="button"
                            onClick={() => onRemove(friend.uid)}
                            className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[0.55rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)] transition-all hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                            data-clickable
                        >
                            Удалить
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ─── Requests Tab ─── */
function RequestsTab({
    pending,
    sent,
    onAccept,
    onReject,
}: {
    pending: FriendRequest[];
    sent: FriendRequest[];
    onAccept: (id: string) => void;
    onReject: (id: string) => void;
}) {
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    return (
        <div>
            {/* Incoming */}
            <div className="mb-6 text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                Входящие ({pending.length})
            </div>
            {pending.length === 0 ? (
                <p className="mb-8 text-sm text-[var(--color-text-muted)]">Нет входящих заявок</p>
            ) : (
                <div className="mb-8 space-y-3">
                    {pending.map((req) => (
                        <div key={req.id} className="glass-panel flex items-center gap-4 rounded-[1rem] p-4">
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
                            </div>
                            <div className="flex shrink-0 gap-2">
                                <button
                                    type="button"
                                    disabled={actionLoading === req.id}
                                    onClick={async () => { setActionLoading(req.id); await onAccept(req.id); setActionLoading(null); }}
                                    className="rounded-full border border-[rgb(154_184_154_/_0.3)] bg-[rgb(154_184_154_/_0.08)] px-3 py-1.5 text-[0.55rem] uppercase tracking-[0.14em] text-[rgb(154_184_154)] transition-all hover:bg-[rgb(154_184_154_/_0.15)]"
                                    data-clickable
                                >
                                    Принять
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
                        </div>
                    ))}
                </div>
            )}

            {/* Sent */}
            <div className="mb-4 text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                Отправленные ({sent.length})
            </div>
            {sent.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Нет отправленных заявок</p>
            ) : (
                <div className="space-y-3">
                    {sent.map((req) => (
                        <div key={req.id} className="glass-panel flex items-center gap-3 rounded-[0.8rem] p-3">
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm text-[var(--color-text-muted)]">
                                    Заявка отправлена: {req.to.slice(0, 12)}...
                                </div>
                            </div>
                            <span className="text-[0.55rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                                Ожидает
                            </span>
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
    onRequestSent,
}: {
    currentUid: string;
    currentName: string;
    currentPhoto: string;
    friends: FriendEntry[];
    sentRequests: FriendRequest[];
    onRequestSent: () => void;
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<PublicProfile[]>([]);
    const [searching, setSearching] = useState(false);
    const [sendingTo, setSendingTo] = useState<string | null>(null);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearch = (value: string) => {
        setQuery(value);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        if (value.trim().length < 2) {
            setResults([]);
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
        }, 400);
    };

    const friendUids = new Set(friends.map((f) => f.uid));
    const sentUids = new Set(sentRequests.map((r) => r.to));

    return (
        <div>
            <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Введите никнейм или имя..."
                className="w-full max-w-md rounded-[0.85rem] border border-[var(--color-border)] bg-[rgb(255_255_255_/_0.04)] px-4 py-2.5 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[rgb(201_184_154_/_0.3)]"
            />

            <div className="mt-6 space-y-3">
                {searching && (
                    <div className="flex justify-center py-6">
                        <div className="h-4 w-4 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]" />
                    </div>
                )}

                {!searching && results.length === 0 && query.trim().length >= 2 && (
                    <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">Никого не нашли</p>
                )}

                {results.map((profile) => {
                    const isFriend = friendUids.has(profile.uid);
                    const isSent = sentUids.has(profile.uid);

                    return (
                        <div key={profile.uid} className="glass-panel flex items-center gap-4 rounded-[1rem] p-4">
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
                                    <span className="text-[0.55rem] uppercase tracking-[0.14em] text-[var(--color-accent)]">Уже друзья</span>
                                ) : isSent ? (
                                    <span className="text-[0.55rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Заявка отправлена</span>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={sendingTo === profile.uid}
                                        onClick={async () => {
                                            setSendingTo(profile.uid);
                                            await sendFriendRequest(currentUid, profile.uid, currentName, currentPhoto);
                                            onRequestSent();
                                            setSendingTo(null);
                                        }}
                                        className="rounded-full border border-[rgb(201_184_154_/_0.3)] bg-[rgb(201_184_154_/_0.06)] px-3.5 py-1.5 text-[0.55rem] uppercase tracking-[0.14em] text-[var(--color-accent)] transition-all hover:bg-[rgb(201_184_154_/_0.14)]"
                                        data-clickable
                                    >
                                        {sendingTo === profile.uid ? '...' : 'Добавить'}
                                    </button>
                                )}
                            </div>
                        </div>
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
            <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
                Пока ничего нет. Добавьте друзей, чтобы видеть их активность!
            </p>
        );
    }

    const reactionLabel = (r?: string) => {
        if (r === 'liked') return ' и поставил 👍';
        if (r === 'disliked') return ' и поставил 👎';
        return '';
    };

    return (
        <div className="space-y-3">
            {activity.map((item, i) => (
                <motion.div
                    key={`${item.friendUid}-${item.filmId}-${i}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.04, ease: EASE }}
                    className="glass-panel flex items-center gap-4 rounded-[1rem] p-4"
                >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[var(--color-border)]">
                        {item.friendPhoto ? (
                            <img src={item.friendPhoto} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)] text-xs text-[var(--color-accent)]">
                                {item.friendName?.[0] || '?'}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm text-[var(--color-text)]">
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
                            {reactionLabel(item.reaction)}
                        </p>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
