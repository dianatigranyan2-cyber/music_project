'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './page.module.css';
import { MOCK_FRIENDS } from '../../data/mockData';
import { Friend } from '../../types';

interface Message {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
}

const INITIAL_HISTORIES: Record<string, Message[]> = {
  '1': [
    { id: 'm1', sender: 'them', text: 'Привет! Слушал новый альбом Daft Punk?', time: '14:20' },
    { id: 'm2', sender: 'me', text: 'Да! Трек Instant Crush просто огонь 🔥', time: '14:22' },
    { id: 'm3', sender: 'them', text: 'Давай включим в совместной комнате?', time: '14:25' },
  ],
  '2': [
    { id: 'm4', sender: 'them', text: 'Добавила новый трек в наш совместный плейлист.', time: 'Вчера' },
    { id: 'm5', sender: 'me', text: 'Отлично, послушаю сегодня вечером!', time: 'Вчера' },
  ],
  '3': [
    { id: 'm6', sender: 'them', text: 'Го в Room #1?', time: '12:00' },
  ],
};

export default function MessagesPage() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [chatHistories, setChatHistories] = useState<Record<string, Message[]>>(INITIAL_HISTORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<number>(0);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistories, selectedChatId]);

  const activeFriend: Friend | undefined = MOCK_FRIENDS.find((f) => f.id === selectedChatId);
  const messages: Message[] = selectedChatId ? (chatHistories[selectedChatId] || []) : [];

  const handleOpenChat = (friendId: string) => {
    // Save current list scroll position
    listScrollRef.current = listContainerRef.current?.scrollTop || 0;
    setSelectedChatId(friendId);
  };

  const handleBack = () => {
    setSelectedChatId(null);
    // Restore list scroll position after state update
    requestAnimationFrame(() => {
      if (listContainerRef.current) {
        listContainerRef.current.scrollTop = listScrollRef.current;
      }
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedChatId) return;
    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      sender: 'me',
      text: inputMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatHistories((prev) => ({
      ...prev,
      [selectedChatId]: [...(prev[selectedChatId] || []), newMsg],
    }));
    setInputMessage('');
  };

  const filteredFriends = MOCK_FRIENDS.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`${styles.container} ${selectedChatId ? styles.chatOpen : ''}`}>
      {/* ─── CHAT LIST PANEL ─── */}
      <div
        className={`${styles.listPanel} ${selectedChatId ? styles.listPanelHidden : ''}`}
        ref={listContainerRef}
      >
        <div className={styles.listHeader}>
          <h1 className={styles.listTitle}>Сообщения</h1>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Поиск друзей и переписок..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.chatsList}>
          {filteredFriends.length > 0 ? (
            filteredFriends.map((friend) => {
              const history = chatHistories[friend.id] || [];
              const lastMsg = history[history.length - 1];
              return (
                <div
                  key={friend.id}
                  className={`${styles.chatItem} ${
                    friend.id === selectedChatId ? styles.activeChatItem : ''
                  }`}
                  onClick={() => handleOpenChat(friend.id)}
                >
                  <div className={styles.avatarWrapper}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={friend.avatarUrl} alt={friend.name} className={styles.avatar} />
                    <span
                      className={`${styles.onlineDot} ${
                        friend.isOnline ? styles.online : styles.offline
                      }`}
                    />
                  </div>
                  <div className={styles.chatMeta}>
                    <div className={styles.chatTopRow}>
                      <span className={styles.friendName}>{friend.name}</span>
                      {lastMsg && <span className={styles.msgTime}>{lastMsg.time}</span>}
                    </div>
                    <div className={styles.chatBottomRow}>
                      <span className={styles.handle}>@{friend.username}</span>
                    </div>
                    {lastMsg && (
                      <p className={styles.lastMsgText}>
                        {lastMsg.sender === 'me' ? 'Вы: ' : ''}{lastMsg.text}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className={styles.emptyState}>
              <p>Нет переписок по запросу «{searchQuery}»</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── CHAT WINDOW PANEL ─── */}
      <div
        className={`${styles.chatPanel} ${!selectedChatId ? styles.chatPanelHidden : ''}`}
      >
        {activeFriend && (
          <>
            {/* Chat Header */}
            <div className={styles.chatHeader}>
              <button className={styles.backBtn} onClick={handleBack} title="Назад">
                ← Назад
              </button>
              <div className={styles.headerUserInfo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeFriend.avatarUrl} alt={activeFriend.name} className={styles.headerAvatar} />
                <div className={styles.headerMeta}>
                  <span className={styles.headerName}>{activeFriend.name}</span>
                  <span className={styles.headerStatus}>
                    {activeFriend.isOnline ? '🟢 В сети' : 'Был(а) недавно'}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages List */}
            <div className={styles.messagesContainer}>
              {messages.length > 0 ? (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`${styles.messageBubble} ${
                      msg.sender === 'me' ? styles.myBubble : styles.theirBubble
                    }`}
                  >
                    <p className={styles.messageText}>{msg.text}</p>
                    <span className={styles.timeLabel}>{msg.time}</span>
                  </div>
                ))
              ) : (
                <div className={styles.emptyChat}>
                  <p>Начните переписку с {activeFriend.name}!</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Send Form */}
            <form onSubmit={handleSendMessage} className={styles.sendForm}>
              <input
                type="text"
                placeholder="Написать сообщение..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className={styles.messageInput}
              />
              <button type="submit" className={styles.sendBtn}>
                ✈️
              </button>
            </form>
          </>
        )}

        {/* Desktop: show "select a chat" placeholder if no chat selected */}
        {!activeFriend && (
          <div className={styles.selectPrompt}>
            <p>Выберите переписку слева, чтобы начать общение.</p>
          </div>
        )}
      </div>
    </div>
  );
}
