'use client';

import React, { useState } from 'react';
import styles from './page.module.css';

export default function SettingsPage() {
  const [broadcastListening, setBroadcastListening] = useState(true);
  const [allowRoomInvites, setAllowRoomInvites] = useState(true);
  const [audioQuality, setAudioQuality] = useState('high');
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Настройки аккаунта</h1>
        <p className={styles.subtitle}>Управляйте приватностью, качеством звука и уведомлениями Melo.</p>
      </header>

      {savedNotice && (
        <div className={styles.savedBanner}>
          ✓ Настройки успешно сохранены!
        </div>
      )}

      <form onSubmit={handleSave} className={styles.form}>
        {/* Account & Profile Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Профиль и аккаунт</h2>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Отображаемое имя</label>
            <input type="text" defaultValue="Александр Ковалев" className={styles.input} />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Email</label>
            <input type="email" defaultValue="alex.melo@example.com" className={styles.input} />
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
          <button type="submit" className={styles.saveBtn}>
            Сохранить изменения
          </button>
        </div>
      </form>
    </div>
  );
}
