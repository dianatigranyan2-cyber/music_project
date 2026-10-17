'use client';

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import styles from '../../app/settings/page.module.css';

export function AccountPrivacy({ disabled = false }: { disabled?: boolean }) {
  const { user, profile, updateProfile } = useAuth();
  const ready = profile?.id === user?.id && typeof profile?.is_private === 'boolean';
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const change = async (isPrivate: boolean) => {
    if (!ready || saving || disabled || profile?.is_private === isPrivate) return;
    setSaving(true); setNotice(''); setError('');
    try {
      const result = await updateProfile({ is_private: isPrivate });
      if (result.error) setError('Не удалось сохранить приватность. Попробуйте ещё раз.');
      else setNotice('Настройки приватности сохранены.');
    } catch { setError('Не удалось сохранить приватность. Проверьте подключение.'); }
    finally { setSaving(false); }
  };
  return <section className={styles.section} aria-labelledby="account-privacy-title">
    <h2 id="account-privacy-title" className={styles.sectionTitle}>Приватность аккаунта</h2>
    <fieldset className={styles.privacyOptions} disabled={!ready || saving || disabled}>
      <legend className={styles.label}>Кто видит подробности профиля</legend>
      <label className={styles.privacyChoice}><input type="radio" name="account-privacy" aria-label="Публичный аккаунт" checked={ready && !profile?.is_private} onChange={() => void change(false)}/><span><strong>Публичный аккаунт</strong><small>Описание, статистика, любимые песни и выбранные плейлисты видны всем.</small></span></label>
      <label className={styles.privacyChoice}><input type="radio" name="account-privacy" aria-label="Закрытый аккаунт" checked={ready && !!profile?.is_private} onChange={() => void change(true)}/><span><strong>Закрытый аккаунт</strong><small>Имя и аватар видны всем. Подробности профиля — только вам и принятым друзьям.</small></span></label>
    </fieldset>
    <p className={styles.fieldNote}>Настройка сохраняется сразу. Плейлисты, которыми вы поделились по ссылке, остаются доступны по этой ссылке.</p>
    {(!ready || saving || notice) && <p role="status" className={styles.fieldNote}>{!ready ? 'Загружаем настройки приватности…' : saving ? 'Сохраняем…' : notice}</p>}
    {error && <p role="alert" className={styles.errorBanner}>{error}</p>}
  </section>;
}
