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
                    <div className="text-[0.55rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Чат</div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
                {messages.length === 0 && (
                    <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
                        Начните беседу 💬
                    </p>
                )}
                {messages.map((msg) => {
                    const isMine = msg.from === currentUid;
                    return (
                        <div
                            key={msg.id}
                            className={`mb-3 flex ${isMine ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[75%] rounded-[0.9rem] px-4 py-2.5 ${isMine
                                        ? 'rounded-br-sm bg-[rgb(201_184_154_/_0.15)] text-[var(--color-text)]'
                                        : 'rounded-bl-sm border border-[var(--color-border)] bg-[rgb(255_255_255_/_0.04)] text-[var(--color-text)]'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap break-words text-[0.85rem] leading-relaxed">{msg.text}</p>
                                <div className={`mt-1 text-[0.5rem] ${isMine ? 'text-right' : 'text-left'} text-[var(--color-text-muted)]`}>
                                    {formatTime(msg.createdAt)}
                                    {isMine && (
                                        <span className="ml-1">
                                            {msg.read ? '✓✓' : '✓'}
                                        </span>
                                    )}
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
                        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                        </svg>
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
