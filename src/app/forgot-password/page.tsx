'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../lib/supabase/client';
import { authErrorMessage } from '../../lib/authErrors';
import styles from '../login/page.module.css';

export default function ForgotPasswordPage() {
  const [email,setEmail]=useState('');
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState('');
  return <div className={styles.container}><section className={styles.card}>
    <h1 className={styles.title}>Восстановить пароль</h1>
    <p className={styles.subtitle}>Отправим ссылку на почту вашего аккаунта Melo.</p>
    {sent ? <p role="status">Если аккаунт с таким адресом существует, письмо придёт на указанную почту. Откройте ссылку в этом же браузере.</p> : <form className={styles.form} onSubmit={async event=>{
      event.preventDefault();if(busy)return;setBusy(true);setError('');
      try {
        const {error}=await createClient().auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/auth/callback?next=/reset-password'});
        if(error)throw error;setSent(true);
      } catch (error) {setError(authErrorMessage(error,'recovery'));}
      finally {setBusy(false);}
    }}>
      <label className={styles.label} htmlFor="recovery-email">Email</label>
      <input id="recovery-email" className={styles.input} type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} disabled={busy}/>
      <button className={styles.submitBtn} disabled={busy}>{busy?'Отправляем…':'Отправить ссылку'}</button>
    </form>}
    {error&&<p role="alert" className={styles.errorBanner}>{error}</p>}
    <p className={styles.footerText}><Link href="/login" className={styles.link}>Вернуться ко входу</Link></p>
  </section></div>;
}
