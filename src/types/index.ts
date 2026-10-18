export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album: string;
  albumId?: string;
  coverUrl: string;
  duration: number; // in seconds
  source?: 'library' | 'audius';
  sourceUrl?: string;
  streamUrl?: string;
  genre?: string;
  trackNumber?: number;
  attribution?: string;
  licenseUrl?: string;
  licenseCode?: string;
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
