'use client';
import { useState, type InputHTMLAttributes } from 'react';
import styles from './PasswordInput.module.css';

export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return <div className={styles.wrapper}>
    <input {...props} type={visible ? 'text' : 'password'} className={`${props.className ?? ''} ${styles.input}`}/>
    <button type="button" className={styles.eye} aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={visible} disabled={props.disabled} onClick={() => setVisible(value => !value)}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="m3 3 18 18"/>}</svg>
    </button>
  </div>;
}
