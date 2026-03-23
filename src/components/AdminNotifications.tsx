'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, type AdminMessage } from '@/contexts/AuthContext';
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { playNotification } from '@/lib/sounds';
import ChatWindow from '@/components/ChatWindow';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

interface ChatNotif {
  friendUid: string;
  friendName: string;
  friendPhoto: string;
  unread: number;
  lastText: string;
}

/**
 * Global notification center — bottom-left corner.
 * Handles: admin messages, chat messages from friends, ban/AI-block alerts.
 */
export default function AdminNotifications() {
  const { user, adminMessages, isBanned, isAIBlocked } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [chatNotifs, setChatNotifs] = useState<ChatNotif[]>([]);
  const [openChat, setOpenChat] = useState<ChatNotif | null>(null);
  const soundedRef = useRef<Set<string>>(new Set());
  const prevTotalRef = useRef(0);

  // Listen to friend chats for unread messages
  useEffect(() => {
    if (!user) { setChatNotifs([]); return; }

    // Get friends list, then listen to each chat
    const friendsRef = collection(db, 'users', user.uid, 'friends');
    const unsub = onSnapshot(friendsRef, async (friendsSnap) => {
      const friends = friendsSnap.docs.map((d) => d.data() as { uid: string; displayName: string; photoURL: string });
      if (friends.length === 0) { setChatNotifs([]); return; }

      // For each friend, check unread messages
      const notifs: ChatNotif[] = [];
      await Promise.all(friends.map(async (f) => {
        const chatId = [user.uid, f.uid].sort().join('_');
        try {
          const snap = await getDocs(
            query(
              collection(db, 'chats', chatId, 'messages'),
              where('from', '==', f.uid),
              where('read', '==', false)
            )
          );
          if (snap.size > 0) {
            // Get last message text
            let lastText = '';
            snap.docs.forEach((d) => {
              const data = d.data();
              if (data.text) lastText = data.text;
            });
            notifs.push({
              friendUid: f.uid,
              friendName: f.displayName,
              friendPhoto: f.photoURL,
              unread: snap.size,
              lastText,
            });
          }
        } catch {
          // ignore
        }
      }));
      setChatNotifs(notifs);
    }, () => { /* ignore */ });

    return unsub;
  }, [user]);

  // Refresh chat notifs periodically (every 15s)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      // Re-fetch by triggering friends snapshot (already listening)
      // Just re-check unread counts
      try {
        const friendsSnap = await getDocs(collection(db, 'users', user.uid, 'friends'));
        const friends = friendsSnap.docs.map((d) => d.data() as { uid: string; displayName: string; photoURL: string });
        const notifs: ChatNotif[] = [];
        await Promise.all(friends.map(async (f) => {
          const chatId = [user.uid, f.uid].sort().join('_');
          try {
            const snap = await getDocs(
              query(
                collection(db, 'chats', chatId, 'messages'),
                where('from', '==', f.uid),
                where('read', '==', false)
              )
            );
            if (snap.size > 0) {
              let lastText = '';
              snap.docs.forEach((d) => { const data = d.data(); if (data.text) lastText = data.text; });
              notifs.push({ friendUid: f.uid, friendName: f.displayName, friendPhoto: f.photoURL, unread: snap.size, lastText });
            }
          } catch { /* ignore */ }
        }));
        setChatNotifs(notifs);
      } catch { /* ignore */ }
    }, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Play notification sound when new items arrive
  const visibleAdminMsgs = adminMessages.filter((m) => !dismissed.has(m.id));
  const totalCount = visibleAdminMsgs.length + chatNotifs.reduce((sum, c) => sum + c.unread, 0);

  useEffect(() => {
    if (totalCount > prevTotalRef.current) {
      playNotification();
    }
    prevTotalRef.current = totalCount;
  }, [totalCount]);

  // Play sound for specific new admin messages
  useEffect(() => {
    adminMessages.forEach((m) => {
      if (!soundedRef.current.has(m.id) && !dismissed.has(m.id)) {
        soundedRef.current.add(m.id);
      }
    });
  }, [adminMessages, dismissed]);

  const dismissMessage = useCallback(async (msg: AdminMessage) => {
    setDismissed((prev) => new Set(prev).add(msg.id));
    if (user) {
      try { await deleteDoc(doc(db, 'users', user.uid, 'notifications', msg.id)); } catch { /* */ }
    }
  }, [user]);

  const dismissAll = useCallback(async () => {
    const ids = visibleAdminMsgs.map((m) => m.id);
    setDismissed((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
    setExpanded(false);
    if (user) {
      await Promise.allSettled(ids.map((id) => deleteDoc(doc(db, 'users', user.uid, 'notifications', id))));
    }
  }, [user, visibleAdminMsgs]);

  const handleOpenChat = (notif: ChatNotif) => {
    setOpenChat(notif);
    setExpanded(false);
  };

  const handleCloseChat = () => {
    setOpenChat(null);
    // Trigger re-check of unread
    prevTotalRef.current = 0;
  };

  // Show ban/AI-block alerts
  const showBanAlert = isBanned;
  const showAIBlockAlert = isAIBlocked && !isBanned;

  if (!user || (totalCount === 0 && !showBanAlert && !showAIBlockAlert && !openChat)) return null;

  return (
    <>
      {/* Chat window overlay */}
      <AnimatePresence>
        {openChat && user && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[9999] bg-black/50"
              onClick={handleCloseChat}
            />
            <ChatWindow
              currentUid={user.uid}
              friendUid={openChat.friendUid}
              friendName={openChat.friendName}
              friendPhoto={openChat.friendPhoto}
              onClose={handleCloseChat}
            />
          </>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 left-6 z-[9998]" style={{ maxWidth: '400px' }}>
        <AnimatePresence>
          {/* Ban alert — always visible, can't dismiss */}
          {showBanAlert && !expanded && (
            <motion.div
              key="ban-alert"
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="mb-2 flex items-center gap-3 rounded-[1.2rem] border border-[rgb(184_114_114_/_0.4)] bg-[rgb(16_16_16_/_0.95)] px-4 py-3 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(184_114_114_/_0.15)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="rgb(184 114 114)" strokeWidth="1.5" className="h-4 w-4">
                  <circle cx="12" cy="12" r="10" /><path d="M4.93 4.93l14.14 14.14" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-[0.65rem] text-[rgb(184_114_114)]">Ваш аккаунт заблокирован администратором</div>
            </motion.div>
          )}

          {/* AI Block alert */}
          {showAIBlockAlert && !expanded && (
            <motion.div
              key="ai-block-alert"
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="mb-2 flex items-center gap-3 rounded-[1.2rem] border border-[rgb(184_168_110_/_0.4)] bg-[rgb(16_16_16_/_0.95)] px-4 py-3 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(184_168_110_/_0.15)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="rgb(184 168 110)" strokeWidth="1.5" className="h-4 w-4">
                  <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-[0.65rem] text-[rgb(184_168_110)]">ИИ-подбор фильмов заблокирован администратором</div>
            </motion.div>
          )}

          {/* Collapsed — notification badge */}
          {!expanded && totalCount > 0 && (
            <motion.button
              key="badge"
              type="button"
              onClick={() => setExpanded(true)}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="flex items-center gap-3 rounded-[1.2rem] border border-[rgb(201_184_154_/_0.25)] bg-[rgb(16_16_16_/_0.95)] px-4 py-3 shadow-2xl backdrop-blur-xl transition-colors hover:border-[rgb(201_184_154_/_0.4)]"
              data-clickable
            >
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(201_184_154_/_0.1)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" className="h-4 w-4">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-50" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--color-accent)]" />
                </span>
              </div>
              <div className="text-left">
                <div className="text-[0.65rem] font-medium text-[var(--color-text)]">
                  {chatNotifs.length > 0 && visibleAdminMsgs.length > 0
                    ? 'Новые уведомления'
                    : chatNotifs.length > 0
                      ? `Сообщение от ${chatNotifs[0].friendName}`
                      : 'Сообщение от админа'}
                </div>
                <div className="mt-0.5 max-w-[260px] truncate text-[0.55rem] text-[var(--color-text-muted)]">
                  {chatNotifs.length > 0 ? chatNotifs[0].lastText : visibleAdminMsgs[0]?.text}
                </div>
              </div>
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[0.5rem] font-semibold text-[rgb(10_10_10)]">
                {totalCount}
              </span>
            </motion.button>
          )}

          {/* Expanded — notification panel */}
          {expanded && (
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="rounded-[1.5rem] border border-[rgb(201_184_154_/_0.2)] bg-[rgb(16_16_16_/_0.97)] shadow-2xl backdrop-blur-xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" className="h-4 w-4">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    Уведомления ({totalCount})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {visibleAdminMsgs.length > 1 && (
                    <button
                      type="button"
                      onClick={dismissAll}
                      className="text-[0.5rem] uppercase tracking-[0.14em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                      data-clickable
                    >
                      Очистить все
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[rgb(255_255_255_/_0.06)] hover:text-[var(--color-text)]"
                    data-clickable
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Notification items */}
              <div className="max-h-[350px] overflow-y-auto px-3 py-2">
                <AnimatePresence>
                  {/* Chat notifications */}
                  {chatNotifs.map((notif) => (
                    <motion.button
                      key={`chat-${notif.friendUid}`}
                      type="button"
                      onClick={() => handleOpenChat(notif)}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="mt-1 flex w-full items-center gap-3 rounded-[0.8rem] px-3 py-3 text-left transition-colors hover:bg-[rgb(255_255_255_/_0.05)]"
                      data-clickable
                    >
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[var(--color-border)]">
                        {notif.friendPhoto ? (
                          <img src={notif.friendPhoto} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)] text-[0.5rem] text-[var(--color-accent)]">
                            {notif.friendName?.[0] || '?'}
                          </div>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-[var(--color-accent)] text-[0.35rem] font-bold text-[rgb(10_10_10)]">
                          {notif.unread}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[0.7rem] font-medium text-[var(--color-text)]">{notif.friendName}</div>
                        <div className="mt-0.5 truncate text-[0.6rem] text-[var(--color-text-muted)]">{notif.lastText}</div>
                      </div>
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" className="h-3.5 w-3.5 shrink-0">
                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.button>
                  ))}

                  {/* Divider if both types exist */}
                  {chatNotifs.length > 0 && visibleAdminMsgs.length > 0 && (
                    <div className="mx-3 my-2 border-t border-[var(--color-border)]" />
                  )}

                  {/* Admin messages */}
                  {visibleAdminMsgs.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12, height: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="mt-1 flex items-start gap-3 rounded-[0.8rem] px-3 py-3 transition-colors hover:bg-[rgb(255_255_255_/_0.03)]"
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgb(201_184_154_/_0.15)] bg-[rgb(201_184_154_/_0.06)]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" className="h-3.5 w-3.5">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[0.5rem] uppercase tracking-[0.12em] text-[var(--color-accent)]">Админ</div>
                        <p className="mt-0.5 text-[0.8rem] leading-relaxed text-[var(--color-text)]">{msg.text}</p>
                        <TimeAgo timestamp={msg.createdAt} />
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissMessage(msg)}
                        className="mt-0.5 shrink-0 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                        data-clickable
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3">
                          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                        </svg>
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function TimeAgo({ timestamp }: { timestamp: unknown }) {
  if (!timestamp) return null;
  const seconds = (timestamp as { seconds?: number })?.seconds;
  if (!seconds) return null;
  const now = Date.now() / 1000;
  const diff = Math.floor(now - seconds);
  let label = '';
  if (diff < 60) label = 'только что';
  else if (diff < 3600) label = `${Math.floor(diff / 60)} мин назад`;
  else if (diff < 86400) label = `${Math.floor(diff / 3600)} ч назад`;
  else label = `${Math.floor(diff / 86400)} дн назад`;
  return <span className="mt-1 block text-[0.5rem] text-[var(--color-text-muted)]">{label}</span>;
}
