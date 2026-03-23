'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { getSoundsEnabled, setSoundsEnabled } from '@/lib/sounds';

interface ProfileSettingsProps {
  open: boolean;
  onClose: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function ProfileSettings({ open, onClose }: ProfileSettingsProps) {
  const { user, updateNickname, uploadAvatar, deleteAccount } = useAuth();
  const [nickname, setNickname] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [soundsOn, setSoundsOn] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && user) {
      setNickname(user.displayName || '');
      setAvatarPreview(null);
      setAvatarFile(null);
      setError('');
      setSoundsOn(getSoundsEnabled());
      setConfirmDelete(false);
    }
  }, [open, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Только изображения');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Максимум 5 МБ');
      return;
    }

    setError('');
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError('');

    const trimmed = nickname.trim();
    if (!trimmed) {
      setError('Введите имя');
      setSaving(false);
      return;
    }

    let ok = true;

    if (trimmed !== user.displayName) {
      ok = await updateNickname(trimmed);
      if (!ok) {
        setError('Ошибка сохранения имени');
        setSaving(false);
        return;
      }
    }

    if (avatarFile) {
      ok = await uploadAvatar(avatarFile);
      if (!ok) {
        setError('Ошибка загрузки фото');
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    setDeleting(true);
    const ok = await deleteAccount();
    setDeleting(false);
    if (ok) {
      onClose();
    } else {
      setError('Ошибка удаления. Войдите заново и попробуйте ещё раз.');
    }
  };

  const currentAvatar = avatarPreview || user?.photoURL || '';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[3000] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 bg-[rgb(0_0_0_/_0.6)] backdrop-blur-[10px]"
            onClick={onClose}
          />

          <motion.div
            className="relative z-10 w-full max-w-[380px] rounded-[1.8rem] border border-[rgb(255_255_255_/_0.08)] bg-[rgb(16_16_16_/_0.96)] p-7 shadow-2xl"
            initial={{ opacity: 0, scale: 0.88, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 text-[0.58rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              Настройки профиля
            </div>

            {/* Avatar */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="group relative h-24 w-24 overflow-hidden rounded-full border-2 border-[rgb(201_184_154_/_0.2)] transition-all hover:border-[rgb(201_184_154_/_0.5)]"
                data-clickable
              >
                {currentAvatar ? (
                  <img
                    src={currentAvatar}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[rgb(201_184_154_/_0.08)] text-3xl text-[var(--color-accent)]">
                    {user?.displayName?.[0] || '?'}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-[rgb(0_0_0_/_0.5)] opacity-0 transition-opacity group-hover:opacity-100">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="h-6 w-6">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <p className="mt-2 text-center text-[0.55rem] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              Нажмите чтобы изменить
            </p>

            {/* Nickname */}
            <div className="mt-6">
              <label className="block text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                Имя
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={30}
                className="mt-2 w-full rounded-[0.85rem] border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.04)] px-4 py-2.5 text-[0.88rem] text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[rgb(201_184_154_/_0.4)]"
                placeholder="Ваше имя"
              />
            </div>

            {/* Sounds toggle */}
            <div className="mt-5 flex items-center justify-between">
              <label className="text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                Звуки интерфейса
              </label>
              <button
                type="button"
                onClick={() => {
                  const next = !soundsOn;
                  setSoundsOn(next);
                  setSoundsEnabled(next);
                }}
                className={`relative h-6 w-11 rounded-full border transition-colors duration-300 ${soundsOn
                    ? 'border-[rgb(201_184_154_/_0.3)] bg-[rgb(201_184_154_/_0.2)]'
                    : 'border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.04)]'
                  }`}
                data-clickable
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full transition-all duration-300 ${soundsOn
                      ? 'left-[1.35rem] bg-[var(--color-accent)]'
                      : 'left-0.5 bg-[var(--color-text-muted)]'
                    }`}
                />
              </button>
            </div>

            {/* Error */}
            {error && (
              <p className="mt-3 text-center text-[0.6rem] text-[#e05555]">{error}</p>
            )}

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-[0.85rem] border border-[rgb(201_184_154_/_0.3)] bg-[rgb(201_184_154_/_0.1)] py-2.5 text-[0.63rem] uppercase tracking-[0.18em] text-[var(--color-accent)] transition-colors hover:bg-[rgb(201_184_154_/_0.18)] disabled:opacity-50"
                data-clickable
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 text-[0.6rem] uppercase tracking-[0.18em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
                data-clickable
              >
                Отмена
              </button>
            </div>

            {/* Delete Account */}
            <div className="mt-6 border-t border-[var(--color-border)] pt-5">
              {confirmDelete ? (
                <div className="text-center">
                  <p className="text-[0.65rem] text-[var(--color-danger)]">
                    Все данные будут удалены безвозвратно. Вы уверены?
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 rounded-[0.85rem] border border-[var(--color-danger)] bg-[rgb(184_114_114_/_0.1)] py-2 text-[0.58rem] uppercase tracking-[0.16em] text-[var(--color-danger)] transition-colors hover:bg-[rgb(184_114_114_/_0.2)] disabled:opacity-50"
                      data-clickable
                    >
                      {deleting ? 'Удаление...' : 'Да, удалить'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 rounded-[0.85rem] border border-[var(--color-border)] py-2 text-[0.58rem] uppercase tracking-[0.16em] text-[var(--color-text-muted)]"
                      data-clickable
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-2 text-[0.55rem] uppercase tracking-[0.16em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-danger)]"
                  data-clickable
                >
                  Удалить аккаунт
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
