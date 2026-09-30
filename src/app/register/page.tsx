'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { useAuth } from '../../context/AuthContext';

export default function RegisterPage() {
  const { signUp, checkUsernameTaken, user } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect home
  React.useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    // Validation
    if (!cleanUsername || !cleanEmail || !password) {
      setError('Заполните все обязательные поля');
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

    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }

    setLoading(true);

    // Check if username is already taken in profiles table
    const isTaken = await checkUsernameTaken(cleanUsername);
    if (isTaken) {
      setError('Имя пользователя уже занято. Пожалуйста, выберите другое.');
      setLoading(false);
      return;
    }

    const result = await signUp(cleanEmail, password, cleanUsername);
    setLoading(false);

    if (result.error) {
      if (result.error.includes('User already registered')) {
        setError('Пользователь с таким e-mail уже зарегистрирован');
      } else {
        setError(result.error);
      }
    } else {
      router.push('/');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brandHeader}>
          <div className={styles.logoIcon}>♪</div>
          <h1 className={styles.title}>Регистрация в Melo</h1>
          <p className={styles.subtitle}>Создайте аккаунт и присоединяйтесь к музыкальному сообществу</p>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Имя пользователя (username)</label>
            <input
              type="text"
              placeholder="alex_melo"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              placeholder="example@melo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Пароль</label>
            <input
              type="password"
              placeholder="Минимум 6 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              required
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Создание аккаунта...' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className={styles.footerText}>
          Уже есть аккаунт?{' '}
          <Link href="/login" className={styles.link}>
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
