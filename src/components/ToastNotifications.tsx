'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export type ToastType = 'info' | 'success' | 'warning' | 'error';

interface Toast {
    id: string;
    text: string;
    type: ToastType;
    duration: number;
}

interface ToastContextValue {
    showToast: (text: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be inside ToastProvider');
    return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((text: string, type: ToastType = 'info', duration = 4000) => {
        const id = Date.now().toString() + Math.random().toString(36).slice(2);
        setToasts((prev) => [...prev.slice(-4), { id, text, type, duration }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Toast container */}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2" style={{ maxWidth: '360px' }}>
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => onRemove(toast.id), toast.duration);
        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onRemove]);

    const colors: Record<ToastType, { border: string; bg: string; icon: string }> = {
        info: { border: 'rgb(201 184 154 / 0.3)', bg: 'rgb(201 184 154 / 0.08)', icon: 'rgb(201 184 154)' },
        success: { border: 'rgb(110 184 110 / 0.3)', bg: 'rgb(110 184 110 / 0.08)', icon: 'rgb(110 184 110)' },
        warning: { border: 'rgb(184 168 110 / 0.3)', bg: 'rgb(184 168 110 / 0.08)', icon: 'rgb(184 168 110)' },
        error: { border: 'rgb(184 114 114 / 0.3)', bg: 'rgb(184 114 114 / 0.08)', icon: 'rgb(184 114 114)' },
    };

    const c = colors[toast.type];

    const icons: Record<ToastType, ReactNode> = {
        info: <path d="M12 16v-4M12 8h.01" />,
        success: <path d="M20 6L9 17l-5-5" />,
        warning: <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />,
        error: <path d="M18 6L6 18M6 6l12 12" />,
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="flex items-start gap-3 rounded-[1rem] border px-4 py-3"
            style={{
                borderColor: c.border,
                background: c.bg,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
            }}
        >
            <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0" stroke={c.icon} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {icons[toast.type]}
            </svg>
            <p className="flex-1 text-[0.8rem] leading-relaxed text-[var(--color-text)]">{toast.text}</p>
            <button
                type="button"
                onClick={() => onRemove(toast.id)}
                className="mt-0.5 shrink-0 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="1.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                </svg>
            </button>
        </motion.div>
    );
}
