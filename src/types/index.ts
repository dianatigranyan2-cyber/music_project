export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number; // in seconds
}

export interface Friend {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  isOnline: boolean;
  currentTrack?: Track;
  listeningProgress?: number; // percentage 0-100
  statusMessage?: string;
  mutualFriends?: number;
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  avatarUrl?: string;
  mediaUrl?: string;
  hasUnseen: boolean;
  isCurrentUser?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  status: string;
}
