import { Track, Friend, Story, UserProfile } from '../types';

export const CURRENT_USER: UserProfile = {
  id: 'u0',
  name: 'Алексей Смирнов',
  handle: '@alex_melo',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  status: 'Слушает вместе с друзьями'
};

export const INITIAL_TRACK: Track = {
  id: 't1',
  title: 'Starboy (feat. Daft Punk)',
  artist: 'The Weeknd',
  album: 'Starboy',
  coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&auto=format&fit=crop&q=80',
  duration: 230 // 3:50
};

export const DEMO_TRACKS: Track[] = [
  INITIAL_TRACK,
  {
    id: 't2',
    title: 'Midnight City',
    artist: 'M83',
    album: 'Hurry Up, We\'re Dreaming',
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop&q=80',
    duration: 243
  },
  {
    id: 't3',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&auto=format&fit=crop&q=80',
    duration: 200
  },
  {
    id: 't4',
    title: 'Resonance',
    artist: 'HOME',
    album: 'Odyssey',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
    duration: 212
  }
];

export const MOCK_STORIES: Story[] = [
  {
    id: 's0',
    userId: 'u0',
    userName: 'Моя история',
    userAvatar: CURRENT_USER.avatarUrl,
    hasUnseen: false,
    isCurrentUser: true
  },
  {
    id: 's1',
    userId: 'u1',
    userName: 'Алина',
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    hasUnseen: true
  },
  {
    id: 's2',
    userId: 'u2',
    userName: 'Максим',
    userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    hasUnseen: true
  },
  {
    id: 's3',
    userId: 'u3',
    userName: 'София',
    userAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    hasUnseen: false
  },
  {
    id: 's4',
    userId: 'u4',
    userName: 'Илья',
    userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    hasUnseen: true
  },
  {
    id: 's5',
    userId: 'u5',
    userName: 'Диана',
    userAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    hasUnseen: false
  }
];

export const MOCK_FRIENDS: Friend[] = [
  {
    id: 'f1',
    name: 'Алина Ковалёва',
    username: 'alina_vibes',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    isOnline: true,
    statusMessage: 'Вайб на вечер ✨',
    mutualFriends: 12,
    listeningProgress: 65,
    currentTrack: {
      id: 't2',
      title: 'Midnight City',
      artist: 'M83',
      album: 'Hurry Up, We\'re Dreaming',
      coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop&q=80',
      duration: 243
    }
  },
  {
    id: 'f2',
    name: 'Максим Орлов',
    username: 'max_beat',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    isOnline: true,
    statusMessage: 'Кодинг под синтвейв 💻',
    mutualFriends: 8,
    listeningProgress: 30,
    currentTrack: {
      id: 't4',
      title: 'Resonance',
      artist: 'HOME',
      album: 'Odyssey',
      coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
      duration: 212
    }
  },
  {
    id: 'f3',
    name: 'София Лебедева',
    username: 'sofia_music',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    isOnline: true,
    statusMessage: 'Новый альбом просто пушка 🔥',
    mutualFriends: 19,
    listeningProgress: 88,
    currentTrack: {
      id: 't3',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      album: 'After Hours',
      coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&auto=format&fit=crop&q=80',
      duration: 200
    }
  },
  {
    id: 'f4',
    name: 'Илья Волков',
    username: 'ilya_rock',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    isOnline: false,
    statusMessage: 'Был в сети 20 мин назад',
    mutualFriends: 5
  },
  {
    id: 'f5',
    name: 'Диана Морозова',
    username: 'diana_wave',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    isOnline: true,
    statusMessage: 'Отдыхаю 🎧',
    mutualFriends: 15,
    listeningProgress: 42,
    currentTrack: {
      id: 't1',
      title: 'Starboy (feat. Daft Punk)',
      artist: 'The Weeknd',
      album: 'Starboy',
      coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&auto=format&fit=crop&q=80',
      duration: 230
    }
  }
];
