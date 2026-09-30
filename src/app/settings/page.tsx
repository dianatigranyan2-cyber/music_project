'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { useAuth } from '../../context/AuthContext';
import { CURRENT_USER } from '../../data/mockData';

export default function SettingsPage() {
  const { user, profile, updateProfile, uploadAvatar, checkUsernameTaken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const [broadcastListening, setBroadcastListening] = useState(true);
  const [allowRoomInvites, setAllowRoomInvites] = useState(true);
  const [audioQuality, setAudioQuality] = useState('high');

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form inputs with loaded profile
  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || '');
    } else if (user) {
      setUsername(user.user_metadata?.username || user.email?.split('@')[0] || '');
    }
  }, [profile, user]);

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // 1. File Type Validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Ошибка: Допустимы только форматы изображений JPEG, PNG или WebP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. File Size Validation (5 MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Ошибка: Размер изображения превышает максимально допустимый лимит 5 МБ.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingAvatar(true);
    const result = await uploadAvatar(file);
    setUploadingAvatar(false);

    if (result.error) {
      setError(result.error);
    } else if (result.url) {
      setAvatarUrl(result.url);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedNotice(false);

    const cleanUsername = username.trim();
    const cleanDisplayName = displayName.trim();
    const cleanBio = bio.trim();
    const cleanAvatarUrl = avatarUrl.trim();

    if (!cleanUsername) {
      setError('Имя пользователя (username) не может быть пустым');
      return;
    }

    if (cleanUsername.length < 3) {
      setError('Имя пользователя должно содержать не менее 3 символов');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setError('Имя пользователя может содержать только латинские буквы, цифры и символ подчеркивания');
      return;
    }

    if (cleanDisplayName.length > 50) {
      setError('Отображаемое имя не должно превышать 50 символов');
      return;
    }

    if (cleanBio.length > 300) {
      setError('Описание профиля (био) не должно превышать 300 символов');
      return;
    }

    setSaving(true);

    // If username changed, check availability
    if (cleanUsername !== profile?.username) {
      const isTaken = await checkUsernameTaken(cleanUsername);
      if (isTaken) {
        setError('Это имя пользователя уже занято. Выберите другое.');
        setSaving(false);
        return;
      }
    }

    const result = await updateProfile({
      username: cleanUsername,
      display_name: cleanDisplayName || null,
      bio: cleanBio || null,
      avatar_url: cleanAvatarUrl || null,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    }
  };

  const currentPreviewAvatar = avatarUrl || CURRENT_USER.avatarUrl;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Настройки аккаунта</h1>
        <p className={styles.subtitle}>Управляйте личной информацией, аватаркой и настройками Melo.</p>
      </header>

      {savedNotice && (
        <div className={styles.savedBanner}>
          ✓ Профиль успешно обновлен!
        </div>
      )}

      {error && (
        <div className={styles.errorBanner}>
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className={styles.form}>
        {/* Account & Profile Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Профиль и аккаунт</h2>

          {/* Avatar Upload Field */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Аватар профиля</label>
            <div className={styles.avatarSection}>
              <div className={styles.avatarPreviewWrapper}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={currentPreviewAvatar} alt="Аватар" className={styles.avatarPreview} />
              </div>
              <div className={styles.avatarUploadControls}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarFileSelect}
                  accept="image/jpeg,image/png,image/webp"
                  className={styles.fileInputHidden}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={styles.fileSelectBtn}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? '⏳ Загрузка...' : '📷 Загрузить аватарку'}
                </button>
                <span className={styles.fieldNote}>JPEG, PNG или WebP (до 5 МБ)</span>
              </div>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Имя пользователя (username) *</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={styles.input}
              placeholder="alex_melo"
              required
            />
            <span className={styles.fieldNote}>Уникальный идентификатор @username в Melo</span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Отображаемое имя (Display Name)</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={styles.input}
              placeholder="Алексей Смирнов"
              maxLength={50}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Email (аккаунт)</label>
            <input
              type="email"
              value={user?.email || ''}
              className={styles.input}
              disabled
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>О себе / Био</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={styles.textarea}
              placeholder="Расскажите о ваших музыкальных вкусах..."
              maxLength={300}
            />
            <span className={styles.fieldNote}>{bio.length}/300 символов</span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Прямая ссылка на аватарку (URL)</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className={styles.input}
              placeholder="https://images.unsplash.com/..."
            />
          </div>
        </section>

        {/* Audio Quality Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Качество воспроизведения</h2>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Качество аудиопотока</label>
            <select
              value={audioQuality}
              onChange={(e) => setAudioQuality(e.target.value)}
              className={styles.select}
            >
              <option value="normal">Стандартное (160 kbps)</option>
              <option value="high">Высокое (320 kbps)</option>
              <option value="lossless">FLAC Lossless (Hi-Fi)</option>
            </select>
          </div>
        </section>

        {/* Privacy Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Приватность и социальные функции</h2>
          <div className={styles.toggleRow}>
            <div>
              <span className={styles.toggleTitle}>Транслировать статус прослушивания</span>
              <p className={styles.toggleDesc}>Друзья будут видеть, какой трек вы слушаете прямо сейчас.</p>
            </div>
            <input
              type="checkbox"
              checked={broadcastListening}
              onChange={(e) => setBroadcastListening(e.target.checked)}
              className={styles.checkbox}
            />
          </div>

          <div className={styles.toggleRow}>
            <div>
              <span className={styles.toggleTitle}>Приглашения в комнаты</span>
              <p className={styles.toggleDesc}>Разрешить друзьям отправлять приглашения в совместные сессии.</p>
            </div>
            <input
              type="checkbox"
              checked={allowRoomInvites}
              onChange={(e) => setAllowRoomInvites(e.target.checked)}
              className={styles.checkbox}
            />
          </div>
        </section>

        <div className={styles.actions}>
          <button type="submit" className={styles.saveBtn} disabled={saving || uploadingAvatar}>
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </form>
    </div>
  );
}
