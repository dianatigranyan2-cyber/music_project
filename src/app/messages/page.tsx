'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from './page.module.css';
import { usePlayer } from '../../context/PlayerContext';
import { useAuth } from '../../context/AuthContext';
import { createClient } from '../../lib/supabase/client';

interface Message {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
  created_at: string;
  read_at: string | null;
}

interface RealFriend {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface DatabaseMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

const getDateLabel = (dateString: string) => {
  const messageDate = new Date(dateString);
  const today = new Date();

  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const messageStart = new Date(
    messageDate.getFullYear(),
    messageDate.getMonth(),
    messageDate.getDate()
  );

  const difference =
    todayStart.getTime() - messageStart.getTime();

  const oneDay = 24 * 60 * 60 * 1000;

  if (difference === 0) {
    return 'Сегодня';
  }

  if (difference === oneDay) {
    return 'Вчера';
  }

  return messageDate.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
};

export default function MessagesPage() {
  const { setMobileChatOpen } = usePlayer();
  const { user: currentUser } = useAuth();
  const [supabase] = useState(() => createClient());

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [chatHistories, setChatHistories] = useState<
    Record<string, Message[]>
  >({});
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<RealFriend[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<number>(0);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Hide mobile navigation/player while a chat is open.
  useEffect(() => {
    setMobileChatOpen(!!selectedChatId);

    return () => {
      setMobileChatOpen(false);
    };
  }, [selectedChatId, setMobileChatOpen]);

  // Load friends.
  useEffect(() => {
    if (!currentUser) {
      setFriends([]);
      return;
    }

    const loadFriends = async () => {
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(
          `sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`
        );

      if (friendshipsError) {
        console.error('Error loading friendships:', friendshipsError);
        return;
      }

      const friendIds = (friendships || []).map((friendship) =>
        friendship.sender_id === currentUser.id
          ? friendship.receiver_id
          : friendship.sender_id
      );

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', friendIds);

      if (profilesError) {
        console.error('Error loading friend profiles:', profilesError);
        return;
      }

      setFriends(profiles || []);
    };

    loadFriends();
  }, [currentUser, supabase]);

  // Load all messages for the chat list.
  useEffect(() => {
    if (!currentUser) {
      setChatHistories({});
      return;
    }

    if (friends.length === 0) {
      setChatHistories({});
      return;
    }

    const loadChatListMessages = async () => {
      const friendIds = new Set(friends.map((friend) => friend.id));

      const { data, error } = await supabase
        .from('messages')
        .select(
          'id, sender_id, receiver_id, content, created_at, read_at'
        )
        .or(
          `sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`
        )
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading chat list messages:', error);
        return;
      }

      const histories: Record<string, Message[]> = {};

      for (const message of (data || []) as DatabaseMessage[]) {
        const friendId =
          message.sender_id === currentUser.id
            ? message.receiver_id
            : message.sender_id;

        if (!friendIds.has(friendId)) continue;

        if (!histories[friendId]) {
          histories[friendId] = [];
        }

        histories[friendId].push({
          id: message.id,
          sender: message.sender_id === currentUser.id ? 'me' : 'them',
          text: message.content,
          time: new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          created_at: message.created_at,
          read_at: message.read_at,
        });
      }

      setChatHistories(histories);
    };

    loadChatListMessages();
  }, [currentUser, friends, supabase]);

  // Load selected chat.
  useEffect(() => {
    if (!currentUser || !selectedChatId) return;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(
          'id, sender_id, receiver_id, content, created_at, read_at'
        )
        .or(
          `and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedChatId}),and(sender_id.eq.${selectedChatId},receiver_id.eq.${currentUser.id})`
        )
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      const databaseMessages = (data || []) as DatabaseMessage[];

      const formattedMessages: Message[] = databaseMessages.map(
        (message) => ({
          id: message.id,
          sender: message.sender_id === currentUser.id ? 'me' : 'them',
          text: message.content,
          time: new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          created_at: message.created_at,
          read_at: message.read_at,
        })
      );

      setChatHistories((prev) => ({
        ...prev,
        [selectedChatId]: formattedMessages,
      }));
    };

    loadMessages();
  }, [currentUser, selectedChatId, supabase]);

  // Mark incoming messages as read when chat is opened.
  useEffect(() => {
    if (!currentUser || !selectedChatId) return;

    const markMessagesAsRead = async () => {
      const readTime = new Date().toISOString();

      const { error } = await supabase
        .from('messages')
        .update({
          read_at: readTime,
        })
        .eq('sender_id', selectedChatId)
        .eq('receiver_id', currentUser.id)
        .is('read_at', null);

      if (error) {
        console.error('Error marking messages as read:', error);
        return;
      }

      // Update local state immediately.
      setChatHistories((prev) => {
        const currentMessages = prev[selectedChatId] || [];

        return {
          ...prev,
          [selectedChatId]: currentMessages.map((message) =>
            message.sender === 'them' && !message.read_at
              ? {
                ...message,
                read_at: readTime,
              }
              : message
          ),
        };
      });
    };

    markMessagesAsRead();
  }, [currentUser, selectedChatId, supabase]);

  // Realtime INSERT — new messages.
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`messages-insert-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const message = payload.new as DatabaseMessage;

          if (
            message.sender_id !== currentUser.id &&
            message.receiver_id !== currentUser.id
          ) {
            return;
          }

          const friendId =
            message.sender_id === currentUser.id
              ? message.receiver_id
              : message.sender_id;

          if (!friends.some((friend) => friend.id === friendId)) {
            return;
          }

          let readAt = message.read_at;

          // If user is already inside this chat,
          // immediately mark the new incoming message as read.
          if (
            message.receiver_id === currentUser.id &&
            selectedChatId === message.sender_id
          ) {
            const readTime = new Date().toISOString();

            const { error } = await supabase
              .from('messages')
              .update({
                read_at: readTime,
              })
              .eq('id', message.id)
              .eq('receiver_id', currentUser.id);

            if (!error) {
              readAt = readTime;
            } else {
              console.error(
                'Error marking realtime message as read:',
                error
              );
            }
          }

          const newMessage: Message = {
            id: message.id,
            sender:
              message.sender_id === currentUser.id ? 'me' : 'them',
            text: message.content,
            time: new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            created_at: message.created_at,
            read_at: readAt,
          };

          setChatHistories((prev) => {
            const currentMessages = prev[friendId] || [];

            if (
              currentMessages.some(
                (existingMessage) =>
                  existingMessage.id === newMessage.id
              )
            ) {
              return prev;
            }

            return {
              ...prev,
              [friendId]: [...currentMessages, newMessage],
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, friends, selectedChatId, supabase]);

  // Realtime UPDATE — read status changes.
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`messages-update-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updatedMessage = payload.new as DatabaseMessage;

          if (
            updatedMessage.sender_id !== currentUser.id &&
            updatedMessage.receiver_id !== currentUser.id
          ) {
            return;
          }

          const friendId =
            updatedMessage.sender_id === currentUser.id
              ? updatedMessage.receiver_id
              : updatedMessage.sender_id;

          setChatHistories((prev) => {
            const currentMessages = prev[friendId] || [];

            const messageExists = currentMessages.some(
              (message) => message.id === updatedMessage.id
            );

            if (!messageExists) {
              return prev;
            }

            return {
              ...prev,
              [friendId]: currentMessages.map((message) =>
                message.id === updatedMessage.id
                  ? {
                    ...message,
                    read_at: updatedMessage.read_at,
                  }
                  : message
              ),
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, supabase]);

  // Auto-scroll.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [chatHistories, selectedChatId]);

  const activeFriend = friends.find(
    (friend) => friend.id === selectedChatId
  );

  const messages: Message[] = selectedChatId
    ? chatHistories[selectedChatId] || []
    : [];

  const handleOpenChat = (friendId: string) => {
    listScrollRef.current =
      listContainerRef.current?.scrollTop || 0;

    setSelectedChatId(friendId);
  };

  const handleBack = () => {
    setSelectedChatId(null);

    requestAnimationFrame(() => {
      if (listContainerRef.current) {
        listContainerRef.current.scrollTop =
          listScrollRef.current;
      }
    });
  };

  // Send message.
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    const content = inputMessage.trim();

    if (!content || !selectedChatId || !currentUser) return;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: currentUser.id,
        receiver_id: selectedChatId,
        content,
      })
      .select(
        'id, sender_id, receiver_id, content, created_at, read_at'
      )
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return;
    }

    const newMessage: Message = {
      id: data.id,
      sender: 'me',
      text: data.content,
      time: new Date(data.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      created_at: data.created_at,
      read_at: data.read_at,
    };

    setChatHistories((prev) => {
      const currentMessages = prev[selectedChatId] || [];

      if (
        currentMessages.some(
          (message) => message.id === newMessage.id
        )
      ) {
        return prev;
      }

      return {
        ...prev,
        [selectedChatId]: [
          ...currentMessages,
          newMessage,
        ],
      };
    });

    setInputMessage('');
  };

  // Search + sort by newest message.
  const filteredFriends = friends
    .filter((friend) => {
      const query = searchQuery.trim().toLowerCase();

      return (
        friend.username.toLowerCase().includes(query) ||
        (friend.display_name || '')
          .toLowerCase()
          .includes(query)
      );
    })
    .sort((a, b) => {
      const aHistory = chatHistories[a.id] || [];
      const bHistory = chatHistories[b.id] || [];

      const aLastMessage =
        aHistory[aHistory.length - 1];

      const bLastMessage =
        bHistory[bHistory.length - 1];

      if (!aLastMessage && !bLastMessage) return 0;
      if (!aLastMessage) return 1;
      if (!bLastMessage) return -1;

      return (
        new Date(bLastMessage.created_at).getTime() -
        new Date(aLastMessage.created_at).getTime()
      );
    });

  return (
    <div
      className={`${styles.container} ${selectedChatId ? styles.chatOpen : ''
        }`}
    >
      {/* CHAT LIST */}
      <div
        className={`${styles.listPanel} ${selectedChatId ? styles.listPanelHidden : ''
          }`}
        ref={listContainerRef}
      >
        <div className={styles.listHeader}>
          <h1 className={styles.listTitle}>
            Сообщения
          </h1>

          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>
              🔍
            </span>

            <input
              type="text"
              placeholder="Поиск друзей и переписок..."
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery(e.target.value)
              }
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.chatsList}>
          {filteredFriends.length > 0 ? (
            filteredFriends.map((friend) => {
              const history =
                chatHistories[friend.id] || [];

              const lastMsg =
                history[history.length - 1];

              // Count only unread messages received from this friend.
              const unreadCount = history.filter(
                (message) =>
                  message.sender === 'them' &&
                  message.read_at === null
              ).length;

              return (
                <div
                  key={friend.id}
                  className={`${styles.chatItem} ${friend.id === selectedChatId
                    ? styles.activeChatItem
                    : ''
                    }`}
                  onClick={() =>
                    handleOpenChat(friend.id)
                  }
                >
                  <div className={styles.avatarWrapper}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        friend.avatar_url ||
                        '/default-avatar.png'
                      }
                      alt={
                        friend.display_name ||
                        friend.username
                      }
                      className={styles.avatar}
                    />
                  </div>

                  <div className={styles.chatMeta}>
                    <div className={styles.chatTopRow}>
                      <span
                        className={`${styles.friendName} ${unreadCount > 0
                          ? styles.unreadFriendName
                          : ''
                          }`}
                      >
                        {friend.display_name ||
                          friend.username}
                      </span>

                      <div className={styles.chatRightInfo}>
                        {lastMsg && (
                          <span
                            className={`${styles.msgTime} ${unreadCount > 0
                              ? styles.unreadTime
                              : ''
                              }`}
                          >
                            {lastMsg.time}
                          </span>
                        )}

                        {unreadCount > 0 && (
                          <span
                            className={styles.unreadBadge}
                            title={`${unreadCount} непрочитанных`}
                          >
                            {unreadCount > 99
                              ? '99+'
                              : unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={styles.chatBottomRow}>
                      <span className={styles.handle}>
                        @{friend.username}
                      </span>
                    </div>

                    {lastMsg && (
                      <p
                        className={`${styles.lastMsgText} ${unreadCount > 0
                          ? styles.unreadLastMessage
                          : ''
                          }`}
                      >
                        {lastMsg.sender === 'me'
                          ? 'Вы: '
                          : ''}
                        {lastMsg.text}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className={styles.emptyState}>
              <p>
                {searchQuery
                  ? `Нет переписок по запросу «${searchQuery}»`
                  : 'У вас пока нет друзей для переписки'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CHAT WINDOW */}
      <div
        className={`${styles.chatPanel} ${!selectedChatId
          ? styles.chatPanelHidden
          : ''
          }`}
      >
        {activeFriend && (
          <>
            <div className={styles.chatHeader}>
              <button
                className={styles.backBtn}
                onClick={handleBack}
                title="Назад"
              >
                ← Назад
              </button>

              <div className={styles.headerUserInfo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    activeFriend.avatar_url ||
                    '/default-avatar.png'
                  }
                  alt={
                    activeFriend.display_name ||
                    activeFriend.username
                  }
                  className={styles.headerAvatar}
                />

                <div className={styles.headerMeta}>
                  <span className={styles.headerName}>
                    {activeFriend.display_name ||
                      activeFriend.username}
                  </span>

                  <span className={styles.headerStatus}>
                    @{activeFriend.username}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.messagesContainer}>
              {messages.length > 0 ? (
                messages.map((msg, index) => {
                  const currentDate = getDateLabel(msg.created_at);

                  const previousDate =
                    index > 0
                      ? getDateLabel(messages[index - 1].created_at)
                      : null;

                  const showDateDivider =
                    index === 0 || currentDate !== previousDate;

                  return (
                    <React.Fragment key={msg.id}>
                      {showDateDivider && (
                        <div className={styles.dateDivider}>
                          <span>{currentDate}</span>
                        </div>
                      )}

                      <div
                        className={`${styles.messageBubble} ${
                          msg.sender === 'me'
                            ? styles.myBubble
                            : styles.theirBubble
                        }`}
                      >
                        <p className={styles.messageText}>
                          {msg.text}
                        </p>

                        <div className={styles.messageInfo}>
                          <span className={styles.timeLabel}>
                            {msg.time}
                          </span>

                          {msg.sender === 'me' && (
                            <span
                              className={`${styles.readStatus} ${
                                msg.read_at ? styles.messageRead : ''
                              }`}
                              title={
                                msg.read_at
                                  ? 'Прочитано'
                                  : 'Доставлено'
                              }
                            >
                              {msg.read_at ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              ) : (
                <div className={styles.emptyChat}>
                  <p>
                    Начните переписку с{' '}
                    {activeFriend.display_name || activeFriend.username}!
                  </p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSendMessage}
              className={styles.sendForm}
            >
              <input
                type="text"
                placeholder="Написать сообщение..."
                value={inputMessage}
                onChange={(e) =>
                  setInputMessage(e.target.value)
                }
                className={styles.messageInput}
              />

              <button
                type="submit"
                className={styles.sendBtn}
              >
                ✈️
              </button>
            </form>
          </>
        )}

        {!activeFriend && (
          <div className={styles.selectPrompt}>
            <p>
              Выберите переписку слева, чтобы начать
              общение.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}