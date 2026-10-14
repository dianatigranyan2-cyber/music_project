'use client';



import React, { useCallback, useEffect, useRef, useState } from 'react';

import Link from 'next/link';

import styles from './page.module.css';

import { usePlayer } from '../../context/PlayerContext';

import { useAuth } from '../../context/AuthContext';
import { useMessageNotifications } from '../../context/MessageNotificationsContext';
import { useSocialPresence } from '../../context/SocialPresenceContext';
import { useTypingIndicator } from '../../hooks/useTypingIndicator';

import { createClient } from '../../lib/supabase/client';



interface Message {

  id: string;

  sender: 'me' | 'them';

  text: string;

  time: string;

  created_at: string;

  read_at: string | null;

  edited_at: string | null;

  story_id: string | null;

  is_story_reply: boolean;

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

  edited_at: string | null;

  story_id: string | null;

  is_story_reply: boolean;

}



interface StorySnippet {

  id: string;

  media_url: string;

  media_type: 'image' | 'video';

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



  const { selectedChatId, setSelectedChatId } = useMessageNotifications();
  const { getOnlineStatus, getStatusLabel } = useSocialPresence();
  const { isTyping, updateTyping, stopTyping } = useTypingIndicator(currentUser?.id ?? null, selectedChatId);

  const [inputMessage, setInputMessage] = useState('');

  const [chatHistories, setChatHistories] = useState<

    Record<string, Message[]>

  >({});

  const [searchQuery, setSearchQuery] = useState('');

  const [friends, setFriends] = useState<RealFriend[]>([]);

  // undefined = loading, null = unavailable, StorySnippet = loaded.
  const [storiesMap, setStoriesMap] = useState<Record<string, StorySnippet | null>>({});
  const pendingStoryIdsRef = useRef<Set<string>>(new Set());
  const storyRetryTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const storiesMapRef = useRef(storiesMap);
  storiesMapRef.current = storiesMap;

  // Context menu state: which message id + position

  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);

  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);



  // A missing row can be temporary (RLS, network, or propagation delay).
  // Never start network requests or timers from a React state updater.
  const fetchStorySnippets = useCallback(async (ids: string[], attempt = 0) => {
    if (!ids.length) return;

    const { data, error } = await supabase
      .from('stories')
      .select('id, media_path, media_type, expires_at')
      .in('id', ids);

    if (error) {
      console.error('Error loading story previews:', error);
    }

    const updates: Record<string, StorySnippet | null> = {};
    const foundIds = new Set<string>();

    if (!error && data) {
      for (const story of data) {
        // Expired or missing stories should not display previews
        if (
          !story.media_path ||
          new Date(story.expires_at).getTime() <= Date.now()
        ) {
          foundIds.add(story.id);
          updates[story.id] = null;
          continue;
        }

        const { data: signedData, error: signedError } =
          await supabase.storage
            .from('stories')
            .createSignedUrl(story.media_path, 300);

        foundIds.add(story.id);

        if (signedError || !signedData?.signedUrl) {
          console.error('Error loading story preview:', signedError);
          updates[story.id] = null;
          continue;
        }

        updates[story.id] = {
          id: story.id,
          media_url: signedData.signedUrl,
          media_type: story.media_type === 'video' ? 'video' : 'image',
        };
      }
    }

    const missing = ids.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      const delays = [2000, 5000];
      if (attempt < delays.length) {
        const timer = setTimeout(() => {
          storyRetryTimersRef.current.delete(timer);
          const stillMissing = missing.filter((id) => pendingStoryIdsRef.current.has(id));
          if (stillMissing.length) void fetchStorySnippets(stillMissing, attempt + 1);
        }, delays[attempt]);
        storyRetryTimersRef.current.add(timer);
      } else {
        missing.forEach((id) => {
          updates[id] = null;
        });
      }
    }

    setStoriesMap((prev) => ({
      ...prev,
      ...updates,
    }));

    ids.forEach((id) => {
      if (foundIds.has(id) || attempt >= 2) {
        pendingStoryIdsRef.current.delete(id);
      }
    });
  }, [supabase]);

  // Load previews whenever messages introduce new story IDs.
  useEffect(() => {
    if (!currentUser) return;

    const newIds = new Set<string>();
    for (const messages of Object.values(chatHistories)) {
      for (const message of messages) {
        const isStoryReply = message.is_story_reply || Boolean(message.story_id);
        if (
          isStoryReply &&
          message.story_id &&
          !(message.story_id in storiesMapRef.current) &&
          !pendingStoryIdsRef.current.has(message.story_id)
        ) {
          newIds.add(message.story_id);
        }
      }
    }

    if (newIds.size) {
      const ids = [...newIds];
      ids.forEach((id) => pendingStoryIdsRef.current.add(id));
      void fetchStorySnippets(ids);
    }
  }, [currentUser, chatHistories, fetchStorySnippets]);

  useEffect(() => {
    return () => {
      storyRetryTimersRef.current.forEach(timer => clearTimeout(timer));
      storyRetryTimersRef.current.clear();
      pendingStoryIdsRef.current.clear();
    };
  }, []);

  // Inline edit state

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const [editingText, setEditingText] = useState('');

  const [isSavingEdit, setIsSavingEdit] = useState(false);



  // Long press timer ref

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const longPressStartPos = useRef<{ x: number; y: number } | null>(null);



  const messagesEndRef = useRef<HTMLDivElement>(null);

  const listScrollRef = useRef<number>(0);

  const listContainerRef = useRef<HTMLDivElement>(null);



  // Close context menu when clicking outside or pressing Escape.

  useEffect(() => {

    if (!openMenuMessageId) return;



    const handleMouseDown = (e: MouseEvent) => {

      const target = e.target as HTMLElement;

      if (!target.closest(`.${styles.floatingMenu}`)) {

        setOpenMenuMessageId(null);

        setMenuPos(null);

      }

    };

    const handleKeyDown = (e: KeyboardEvent) => {

      if (e.key === 'Escape') {

        setOpenMenuMessageId(null);

        setMenuPos(null);

      }

    };



    document.addEventListener('mousedown', handleMouseDown);

    document.addEventListener('keydown', handleKeyDown);

    return () => {

      document.removeEventListener('mousedown', handleMouseDown);

      document.removeEventListener('keydown', handleKeyDown);

    };

  }, [openMenuMessageId]);



  // Cancel edit on Escape.

  useEffect(() => {

    if (!editingMessageId) return;

    const handleKeyDown = (e: KeyboardEvent) => {

      if (e.key === 'Escape') {

        setEditingMessageId(null);

        setEditingText('');

      }

    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);

  }, [editingMessageId]);



  // Long press open helper.

  const openMenu = useCallback((msgId: string, x: number, y: number) => {

    setOpenMenuMessageId(msgId);

    setMenuPos({ x, y });

  }, []);



  const cancelLongPress = useCallback(() => {

    if (longPressTimer.current) {

      clearTimeout(longPressTimer.current);

      longPressTimer.current = null;

    }

    longPressStartPos.current = null;

  }, []);



  const handleBubbleMouseDown = useCallback(

    (e: React.MouseEvent<HTMLDivElement>, msgId: string) => {

      if (e.button !== 0) return; // left button only

      longPressStartPos.current = { x: e.clientX, y: e.clientY };

      longPressTimer.current = setTimeout(() => {

        openMenu(msgId, e.clientX, e.clientY);

        longPressStartPos.current = null;

      }, 550);

    },

    [openMenu]

  );



  const handleBubbleMouseMove = useCallback((e: React.MouseEvent) => {

    if (!longPressStartPos.current) return;

    const dx = e.clientX - longPressStartPos.current.x;

    const dy = e.clientY - longPressStartPos.current.y;

    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) cancelLongPress();

  }, [cancelLongPress]);



  const handleBubbleTouchStart = useCallback(

    (e: React.TouchEvent<HTMLDivElement>, msgId: string) => {

      const touch = e.touches[0];

      longPressStartPos.current = { x: touch.clientX, y: touch.clientY };

      longPressTimer.current = setTimeout(() => {

        openMenu(msgId, touch.clientX, touch.clientY);

        longPressStartPos.current = null;

      }, 550);

    },

    [openMenu]

  );



  const handleBubbleTouchMove = useCallback((e: React.TouchEvent) => {

    if (!longPressStartPos.current) return;

    const touch = e.touches[0];

    const dx = touch.clientX - longPressStartPos.current.x;

    const dy = touch.clientY - longPressStartPos.current.y;

    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) cancelLongPress();

  }, [cancelLongPress]);



  const handleBubbleContextMenu = useCallback(

    (e: React.MouseEvent<HTMLDivElement>, msgId: string) => {

      e.preventDefault();

      openMenu(msgId, e.clientX, e.clientY);

    },

    [openMenu]

  );



  // Save edit via RPC.

  const handleSaveEdit = useCallback(async () => {

    if (!editingMessageId) return;

    const trimmed = editingText.trim();

    if (!trimmed || trimmed.length > 5000) return;



    setIsSavingEdit(true);

    const { error } = await supabase.rpc('edit_own_message', {

      message_id: editingMessageId,

      new_content: trimmed,

    });

    setIsSavingEdit(false);



    if (error) {

      console.error('Error editing message:', error);

      return;

    }



    // Optimistic local update.

    const now = new Date().toISOString();

    setChatHistories((prev) => {

      const updated: Record<string, Message[]> = {};

      for (const [fid, msgs] of Object.entries(prev)) {

        updated[fid] = msgs.map((m) =>

          m.id === editingMessageId

            ? { ...m, text: trimmed, edited_at: now }

            : m

        );

      }

      return updated;

    });



    setEditingMessageId(null);

    setEditingText('');

  }, [editingMessageId, editingText, supabase]);



  const handleCancelEdit = useCallback(() => {

    setEditingMessageId(null);

    setEditingText('');

  }, []);



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

          'id, sender_id, receiver_id, content, created_at, read_at, edited_at, story_id, is_story_reply')

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

          edited_at: message.edited_at,

          story_id: message.story_id,

          is_story_reply: message.is_story_reply,

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

          'id, sender_id, receiver_id, content, created_at, read_at, edited_at, story_id, is_story_reply')

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

          edited_at: message.edited_at,

          story_id: message.story_id,

          is_story_reply: message.is_story_reply,

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

            edited_at: message.edited_at,

            story_id: message.story_id,

            is_story_reply: message.is_story_reply,

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

                    text: updatedMessage.content,

                    read_at: updatedMessage.read_at,

                    edited_at: updatedMessage.edited_at,

                    story_id: updatedMessage.story_id,

                    is_story_reply: updatedMessage.is_story_reply,

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



  // Realtime DELETE — message removal.

  useEffect(() => {

    if (!currentUser) return;



    const channel = supabase

      .channel(`messages-delete-${currentUser.id}`)

      .on(

        'postgres_changes',

        {

          event: 'DELETE',

          schema: 'public',

          table: 'messages',

        },

        (payload) => {

          const deletedId = payload.old?.id;

          if (!deletedId) return;



          setChatHistories((prev) => {

            let found = false;

            for (const msgs of Object.values(prev)) {

              if (msgs.some((m) => m.id === deletedId)) {

                found = true;

                break;

              }

            }



            if (!found) return prev;



            const updated: Record<string, Message[]> = {};

            for (const [friendId, msgs] of Object.entries(prev)) {

              updated[friendId] = msgs.filter((m) => m.id !== deletedId);

            }

            return updated;

          });

        }

      )

      .subscribe();



    return () => {

      supabase.removeChannel(channel);

    };

  }, [currentUser, supabase]);



  // Delete own message.

  const handleDeleteMessage = async (messageId: string) => {

    if (!currentUser) return;



    setOpenMenuMessageId(null);



    const { error } = await supabase

      .from('messages')

      .delete()

      .eq('id', messageId);



    if (error) {

      console.error('Error deleting message:', error);

      return;

    }



    setChatHistories((prev) => {

      const updated: Record<string, Message[]> = {};

      for (const [friendId, msgs] of Object.entries(prev)) {

        updated[friendId] = msgs.filter((m) => m.id !== messageId);

      }

      return updated;

    });

  };



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
    stopTyping();



    const { data, error } = await supabase

      .from('messages')

      .insert({

        sender_id: currentUser.id,

        receiver_id: selectedChatId,

        content,

      })

      .select(

        'id, sender_id, receiver_id, content, created_at, read_at, edited_at, story_id, is_story_reply')

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

      edited_at: data.edited_at ?? null,

      story_id: data.story_id ?? null,

      is_story_reply: data.is_story_reply ?? false,

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
                    <span
                      className={`${styles.onlineDot} ${getOnlineStatus(friend.id) === 'online' ? styles.online : styles.offline}`}
                      title={getStatusLabel(friend.id)}
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



                  <span className={`${styles.headerStatus} ${isTyping ? styles.typingStatus : ''}`} aria-live="polite">

                    {isTyping ? 'печатает…' : getStatusLabel(activeFriend.id)}

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

                  const isEditing = editingMessageId === msg.id;



                  // Avatar grouping: show avatar only on the last 'them' bubble

                  // in a consecutive same-day sequence.

                  const nextMsg = messages[index + 1];

                  const nextDate = nextMsg

                    ? getDateLabel(nextMsg.created_at)

                    : null;

                  const showAvatar =

                    msg.sender === 'them' &&

                    (!nextMsg ||

                      nextMsg.sender !== 'them' ||

                      nextDate !== currentDate);



                  return (

                    <React.Fragment key={msg.id}>

                      {showDateDivider && (

                        <div className={styles.dateDivider}>

                          <span>{currentDate}</span>

                        </div>

                      )}



                      <div

                        className={`${styles.messageRow} ${msg.sender === 'me' ? styles.myRow : styles.theirRow

                          }`}

                      >

                        {/* Avatar slot — only for 'them' messages */}

                        {msg.sender === 'them' && (

                          showAvatar ? (

                            // eslint-disable-next-line @next/next/no-img-element

                            <img

                              src={

                                activeFriend.avatar_url ||

                                '/default-avatar.png'

                              }

                              alt={

                                activeFriend.display_name ||

                                activeFriend.username

                              }

                              className={styles.messageAvatar}

                            />

                          ) : (

                            <div className={styles.messageAvatarSpacer} />

                          )

                        )}



                        <div

                          className={`${styles.messageBubble} ${msg.sender === 'me'

                            ? styles.myBubble

                            : styles.theirBubble

                            }`}

                          {...(msg.sender === 'me'

                            ? {

                              onMouseDown: (e: React.MouseEvent<HTMLDivElement>) =>

                                handleBubbleMouseDown(e, msg.id),

                              onMouseMove: handleBubbleMouseMove,

                              onMouseUp: cancelLongPress,

                              onMouseLeave: cancelLongPress,

                              onTouchStart: (e: React.TouchEvent<HTMLDivElement>) =>

                                handleBubbleTouchStart(e, msg.id),

                              onTouchMove: handleBubbleTouchMove,

                              onTouchEnd: cancelLongPress,

                              onContextMenu: (e: React.MouseEvent<HTMLDivElement>) =>

                                handleBubbleContextMenu(e, msg.id),

                            }

                            : {})}

                        >

                          {isEditing ? (

                            <div className={styles.editForm}>

                              <textarea

                                className={styles.editTextarea}

                                value={editingText}

                                onChange={(e) =>

                                  setEditingText(e.target.value)

                                }

                                onKeyDown={(e) => {

                                  if (e.key === 'Enter' && !e.shiftKey) {

                                    e.preventDefault();

                                    handleSaveEdit();

                                  }

                                }}

                                maxLength={5000}

                                autoFocus

                              />

                              <div className={styles.editActions}>

                                <button

                                  type="button"

                                  className={styles.cancelEditBtn}

                                  onClick={handleCancelEdit}

                                >

                                  Отмена

                                </button>

                                <button

                                  type="button"

                                  className={styles.saveEditBtn}

                                  onClick={handleSaveEdit}

                                  disabled={

                                    isSavingEdit ||

                                    !editingText.trim() ||

                                    editingText.trim().length > 5000

                                  }

                                >

                                  Сохранить

                                </button>

                              </div>

                            </div>

                          ) : (

                            <>

                              {(msg.is_story_reply || Boolean(msg.story_id)) && (

                                !msg.story_id ? (

                                  <div className={styles.storyUnavailableBadge}>

                                    <span>📷</span> История недоступна

                                  </div>

                                ) : (() => {

                                  const storySnippet = storiesMap[msg.story_id];

                                  if (storySnippet === undefined) {

                                    return (

                                      <div className={styles.storyPreviewLoading}>

                                        <span>📷</span> Загрузка истории...

                                      </div>

                                    );

                                  }



                                  if (storySnippet === null) {

                                    return (

                                      <div className={styles.storyUnavailableBadge}>

                                        <span>📷</span> История недоступна

                                      </div>

                                    );

                                  }



                                  return (

                                    <div className={styles.storyPreviewWrapper}>

                                      <Link

                                        href={`/stories/${storySnippet.id}`}

                                        className={styles.storyPreviewLink}

                                        onClick={(e) => e.stopPropagation()}

                                        title="Посмотреть историю"

                                      >

                                        {storySnippet.media_type === 'video' ? (

                                          <div className={styles.storyPreviewVideoWrapper}>

                                            <video

                                              src={storySnippet.media_url}

                                              className={styles.storyPreviewVideo}

                                              muted

                                              playsInline

                                              preload="metadata"

                                            />

                                            <div className={styles.playOverlay}>▶</div>

                                          </div>

                                        ) : (

                                          /* eslint-disable-next-line @next/next/no-img-element */

                                          <img

                                            src={storySnippet.media_url}

                                            alt="Превью истории"

                                            className={styles.storyPreviewImg}

                                          />

                                        )}

                                      </Link>

                                    </div>

                                  );

                                })()

                              )}



                              <p className={styles.messageText}>

                                {msg.text}

                              </p>

                            </>

                          )}



                          {!isEditing && (

                            <div className={styles.messageInfo}>

                              <span className={styles.timeLabel}>

                                {msg.time}

                              </span>



                              {msg.edited_at && (

                                <span className={styles.editedLabel}>

                                  изменено

                                </span>

                              )}



                              {msg.sender === 'me' && (

                                <span

                                  className={`${styles.readStatus} ${msg.read_at ? styles.messageRead : ''

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

                onChange={(e) => {
                  setInputMessage(e.target.value);
                  updateTyping(Boolean(e.target.value.trim()));
                }}
                onBlur={stopTyping}

                className={styles.messageInput}

              />



              <button

                type="submit"

                className={styles.sendBtn}

              >

                ✈️

              </button>

            </form>



            {/* Floating context menu – fixed viewport position */}

            {openMenuMessageId && menuPos && (

              <div

                className={styles.floatingMenu}

                style={{

                  position: 'fixed',

                  top: menuPos.y + 8,

                  left: Math.min(menuPos.x, window.innerWidth - 170),

                  zIndex: 9999,

                }}

              >

                <button

                  type="button"

                  className={styles.menuItem}

                  onClick={() => {

                    const msg = messages.find(

                      (m) => m.id === openMenuMessageId

                    );

                    if (msg) {

                      setEditingMessageId(msg.id);

                      setEditingText(msg.text);

                    }

                    setOpenMenuMessageId(null);

                    setMenuPos(null);

                  }}

                >

                  <span className={styles.menuIcon}>✏️</span>

                  Редактировать

                </button>



                <button

                  type="button"

                  className={styles.deleteMenuItem}

                  onClick={() => {

                    handleDeleteMessage(openMenuMessageId);

                    setMenuPos(null);

                  }}

                >

                  <span className={styles.menuIcon}>🗑️</span>

                  Удалить

                </button>

              </div>

            )}

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
