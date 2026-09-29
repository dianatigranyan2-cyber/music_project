'use client';

import React, { useState } from 'react';
import styles from './page.module.css';
import { MOCK_FRIENDS, DEMO_TRACKS } from '../../../data/mockData';
import { usePlayer } from '../../../context/PlayerContext';

export default function RoomPage() {
  const { currentTrack, playTrack } = usePlayer();
  const [chatMessages, setChatMessages] = useState([
    { id: '1', user: 'Алексей Смирнов', text: 'Всем привет! Какой трек следующий?', time: '18:02' },
    { id: '2', user: 'Мария Соколова', text: 'Поставьте Midnight City, пожалуйста! ✨', time: '18:05' },
  ]);
  const [inputMsg, setInputMsg] = useState('');

  const participants = [
    { name: 'Вы (Хост)', isHost: true, avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80' },
    ...MOCK_FRIENDS.slice(0, 3).map((f) => ({ name: f.name, isHost: false, avatar: f.avatarUrl })),
  ];

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    setChatMessages([
      ...chatMessages,
      {
        id: `rm_${Date.now()}`,
        user: 'Вы',
        text: inputMsg,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInputMsg('');
  };

  return (
    <div className={styles.container}>
      {/* Room Header */}
      <header className={styles.roomHeader}>
        <div>
          <div className={styles.liveTag}>🔴 LIVE ROOM #1</div>
          <h1 className={styles.title}>Синтвейв & Ночной Чилл 🎧</h1>
          <p className={styles.sub}>Синхронное воспроизведение • {participants.length} участников</p>
        </div>
        <button className={styles.leaveBtn}>Покинуть комнату</button>
      </header>

      <div className={styles.roomGrid}>
        {/* Left Column: Player & Queue */}
        <div className={styles.leftCol}>
          {/* Active Track Banner */}
          <div className={styles.activeBanner}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentTrack.coverUrl} alt={currentTrack.title} className={styles.cover} />
            <div className={styles.activeMeta}>
              <span className={styles.syncBadge}>⚡ Синхронизировано</span>
              <h2 className={styles.trackTitle}>{currentTrack.title}</h2>
              <p className={styles.trackArtist}>{currentTrack.artist}</p>
            </div>
          </div>

          {/* Participants Strip */}
          <div className={styles.participantsSection}>
            <h3 className={styles.sectionTitle}>Участники комнат ({participants.length})</h3>
            <div className={styles.participantsRow}>
              {participants.map((p, idx) => (
                <div key={idx} className={styles.participant}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.avatar} alt={p.name} className={styles.pAvatar} />
                  <span className={styles.pName}>{p.name}</span>
                  {p.isHost && <span className={styles.hostBadge}>HOST</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Queue List */}
          <div className={styles.queueSection}>
            <h3 className={styles.sectionTitle}>Очередь воспроизведения</h3>
            <div className={styles.queueList}>
              {DEMO_TRACKS.map((t, idx) => (
                <div key={t.id} className={styles.queueRow} onClick={() => playTrack(t)}>
                  <span className={styles.qIdx}>{idx + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.coverUrl} alt={t.title} className={styles.qCover} />
                  <div className={styles.qMeta}>
                    <span className={styles.qTitle}>{t.title}</span>
                    <span className={styles.qArtist}>{t.artist}</span>
                  </div>
                  <button className={styles.qPlayBtn}>▶</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Chat */}
        <div className={styles.chatCol}>
          <h3 className={styles.chatTitle}>Чат комнаты 💬</h3>
          <div className={styles.chatFeed}>
            {chatMessages.map((m) => (
              <div key={m.id} className={styles.chatMsg}>
                <div className={styles.msgHeader}>
                  <span className={styles.msgUser}>{m.user}</span>
                  <span className={styles.msgTime}>{m.time}</span>
                </div>
                <p className={styles.msgBody}>{m.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChat} className={styles.chatForm}>
            <input
              type="text"
              placeholder="Написать в чат..."
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              className={styles.chatInput}
            />
            <button type="submit" className={styles.sendBtn}>
              Отправить
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
