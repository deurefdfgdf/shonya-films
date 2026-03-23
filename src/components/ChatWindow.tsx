'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    collection,
    doc,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    updateDoc,
    writeBatch,
    getDocs,
    where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

interface ChatMessage {
    id: string;
    from: string;
    text: string;
    createdAt: unknown;
    read: boolean;
}

interface ChatWindowProps {
    currentUid: string;
    friendUid: string;
    friendName: string;
    friendPhoto: string;
    onClose: () => void;
}

function getChatId(uid1: string, uid2: string): string {
    return [uid1, uid2].sort().join('_');
}

/* Date separator helper */
function getDateLabel(ts: unknown): string {
    if (!ts) return '';
    const seconds = (ts as { seconds?: number })?.seconds;
    if (!seconds) return '';
    const d = new Date(seconds * 1000);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / 86400000);
    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Вчера';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function getDateKey(ts: unknown): string {
    if (!ts) return '';
    const seconds = (ts as { seconds?: number })?.seconds;
    if (!seconds) return '';
    const d = new Date(seconds * 1000);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function ChatWindow({
    currentUid,
    friendUid,
    friendName,
    friendPhoto,
    onClose,
}: ChatWindowProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const chatId = getChatId(currentUid, friendUid);
    const messagesRef = collection(db, 'chats', chatId, 'messages');

    // Listen for messages in real-time
    useEffect(() => {
        const q = query(messagesRef, orderBy('createdAt', 'asc'));
        const unsub = onSnapshot(q, (snapshot) => {
            const msgs: ChatMessage[] = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            } as ChatMessage));
            setMessages(msgs);

            // Mark unread messages as read
            snapshot.docs.forEach((d) => {
                const data = d.data();
                if (data.from !== currentUid && !data.read) {
                    updateDoc(doc(db, 'chats', chatId, 'messages', d.id), { read: true }).catch(() => { });
                }
            });
        }, () => { });

        return unsub;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId, currentUid]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input on open
    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 400);
    }, []);

    const sendMessage = useCallback(async () => {
        if (!text.trim() || sending) return;
        setSending(true);
        try {
            await addDoc(messagesRef, {
                from: currentUid,
                text: text.trim(),
                createdAt: serverTimestamp(),
                read: false,
            });
            setText('');
            // Re-focus input after send
            setTimeout(() => inputRef.current?.focus(), 50);
        } catch (err) {
            console.error('[Chat] send error:', err);
        }
        setSending(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, sending, currentUid, chatId]);

    const formatTime = (ts: unknown) => {
        if (!ts) return '';
        const seconds = (ts as { seconds?: number })?.seconds;
        if (!seconds) return '';
        const d = new Date(seconds * 1000);
        return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    };

    // Message grouping: consecutive messages from same sender within 2 min
    const shouldShowAvatar = (msg: ChatMessage, index: number): boolean => {
        if (msg.from === currentUid) return false;
        if (index === 0) return true;
        const prev = messages[index - 1];
        if (prev.from !== msg.from) return true;
        const prevSec = (prev.createdAt as { seconds?: number })?.seconds || 0;
        const currSec = (msg.createdAt as { seconds?: number })?.seconds || 0;
        return currSec - prevSec > 120;
    };

    // Track which date separators to show
    const shownDates = new Set<string>();

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.45, ease: EASE }}
            className="fixed bottom-0 right-0 top-0 z-[60] flex w-full max-w-md flex-col border-l border-[var(--color-border)] bg-[rgb(14_14_14_/_0.97)]"
            style={{ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
        >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                    data-clickable
                >
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[var(--color-border)]">
                    {friendPhoto ? (
                        <img src={friendPhoto} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)] text-xs text-[var(--color-accent)]">
                            {friendName?.[0] || '?'}
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-[var(--color-text)]">{friendName}</div>
                    <div className="text-[0.5rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                        {messages.length > 0 ? `${messages.length} сообщ.` : 'Чат'}
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center py-16">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-border)] bg-[rgb(255_255_255_/_0.02)]">
                            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-[var(--color-text-muted)]" stroke="currentColor" strokeWidth="1">
                                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                            </svg>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)]">Начните беседу</p>
                        <p className="mt-1 text-[0.6rem] text-[var(--color-text-muted)]">Напишите первое сообщение 💬</p>
                    </div>
                )}

                {messages.map((msg, index) => {
                    const isMine = msg.from === currentUid;
                    const showAvatar = shouldShowAvatar(msg, index);

                    // Date separator
                    const dateKey = getDateKey(msg.createdAt);
                    let dateSeparator: string | null = null;
                    if (dateKey && !shownDates.has(dateKey)) {
                        shownDates.add(dateKey);
                        dateSeparator = getDateLabel(msg.createdAt);
                    }

                    return (
                        <div key={msg.id}>
                            {/* Date separator */}
                            {dateSeparator && (
                                <div className="my-4 flex items-center gap-3">
                                    <div className="h-px flex-1 bg-[var(--color-border)]" />
                                    <span className="text-[0.5rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{dateSeparator}</span>
                                    <div className="h-px flex-1 bg-[var(--color-border)]" />
                                </div>
                            )}

                            <div className={`mb-1.5 flex ${isMine ? 'justify-end' : 'justify-start'} ${showAvatar && !isMine ? 'mt-3' : ''}`}>
                                {/* Friend avatar for grouped messages */}
                                {!isMine && (
                                    <div className="mr-2 mt-auto w-7 shrink-0">
                                        {showAvatar && (
                                            <div className="h-7 w-7 overflow-hidden rounded-full border border-[var(--color-border)]">
                                                {friendPhoto ? (
                                                    <img src={friendPhoto} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)] text-[0.5rem] text-[var(--color-accent)]">
                                                        {friendName?.[0] || '?'}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div
                                    className={`max-w-[70%] rounded-[0.9rem] px-3.5 py-2 ${isMine
                                            ? 'rounded-br-sm bg-[rgb(201_184_154_/_0.15)] text-[var(--color-text)]'
                                            : 'rounded-bl-sm border border-[var(--color-border)] bg-[rgb(255_255_255_/_0.04)] text-[var(--color-text)]'
                                        }`}
                                >
                                    <p className="whitespace-pre-wrap break-words text-[0.82rem] leading-relaxed">{msg.text}</p>
                                    <div className={`mt-0.5 text-[0.45rem] ${isMine ? 'text-right' : 'text-left'} text-[var(--color-text-muted)]`}>
                                        {formatTime(msg.createdAt)}
                                        {isMine && (
                                            <span className="ml-1" style={{ color: msg.read ? 'rgb(110 184 110)' : undefined }}>
                                                {msg.read ? '✓✓' : '✓'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-[var(--color-border)] px-5 py-4">
                <div className="flex items-center gap-3">
                    <input
                        ref={inputRef}
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                void sendMessage();
                            }
                        }}
                        placeholder="Сообщение..."
                        className="flex-1 rounded-[0.85rem] border border-[var(--color-border)] bg-[rgb(255_255_255_/_0.04)] px-4 py-2.5 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[rgb(201_184_154_/_0.3)]"
                    />
                    <button
                        type="button"
                        onClick={() => void sendMessage()}
                        disabled={!text.trim() || sending}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgb(201_184_154_/_0.3)] bg-[rgb(201_184_154_/_0.08)] text-[var(--color-accent)] transition-all hover:bg-[rgb(201_184_154_/_0.15)] disabled:opacity-40"
                        data-clickable
                    >
                        {sending ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border border-[var(--color-accent)] border-t-transparent" />
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
                                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

/* ─── Utility: get unread count for a friend ─── */
export async function getUnreadCount(currentUid: string, friendUid: string): Promise<number> {
    const chatId = getChatId(currentUid, friendUid);
    try {
        const snap = await getDocs(
            query(
                collection(db, 'chats', chatId, 'messages'),
                where('from', '==', friendUid),
                where('read', '==', false)
            )
        );
        return snap.size;
    } catch {
        return 0;
    }
}

/* ─── Utility: mark all as read ─── */
export async function markAllRead(currentUid: string, friendUid: string): Promise<void> {
    const chatId = getChatId(currentUid, friendUid);
    try {
        const snap = await getDocs(
            query(
                collection(db, 'chats', chatId, 'messages'),
                where('from', '==', friendUid),
                where('read', '==', false)
            )
        );
        if (snap.empty) return;
        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
            batch.update(doc(db, 'chats', chatId, 'messages', d.id), { read: true });
        });
        await batch.commit();
    } catch {
        // ignore
    }
}
