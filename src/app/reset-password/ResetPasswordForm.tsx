'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { createClient } from '../../lib/supabase/client';
import { PasswordInput } from '../../components/Auth/PasswordInput';
import { passwordProblem } from '../../lib/passwords';
import { authErrorMessage } from '../../lib/authErrors';
import styles from '../login/page.module.css';

export function ResetPasswordForm({expired}:{expired:boolean}) {
  const {user,loading}=useAuth();
  const [password,setPassword]=useState('');const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);const [error,setError]=useState('');
  return <div className={styles.container}><section className={styles.card}>
    <h1 className={styles.title}>Новый пароль</h1>
    {loading?<p role="status">Проверяем ссылку…</p>:done?<><p role="status">Пароль сохранён.</p><Link className={styles.link} href="/">Открыть Melo</Link></>:!user||expired?<><p>Ссылка недействительна или истекла. Запросите новое письмо.</p><Link className={styles.link} href="/forgot-password">Получить новую ссылку</Link></>:<form className={styles.form} onSubmit={async event=>{
      event.preventDefault();if(busy)return;const problem=passwordProblem(password,confirmation);if(problem){setError(problem);return;}setBusy(true);setError('');
      try{const {error}=await createClient().auth.updateUser({password});if(error)throw error;setPassword('');setConfirmation('');setDone(true);}
      catch(error){setError(authErrorMessage(error,'password'));}finally{setBusy(false);}
    }}>
      <label className={styles.label} htmlFor="new-password">Новый пароль</label><PasswordInput id="new-password" autoComplete="new-password" className={styles.input} value={password} required minLength={6} maxLength={72} disabled={busy} onChange={event=>setPassword(event.target.value)}/>
      <label className={styles.label} htmlFor="confirm-new-password">Повторите пароль</label><PasswordInput id="confirm-new-password" autoComplete="new-password" className={styles.input} value={confirmation} required disabled={busy} onChange={event=>setConfirmation(event.target.value)}/>
      {error&&<p role="alert" className={styles.errorBanner}>{error}</p>}<button className={styles.submitBtn} disabled={busy}>{busy?'Сохраняем…':'Сохранить пароль'}</button>
    </form>}
  </section></div>;
}
