import type { PersonalPlaylist } from './personalMusic';
import type { Profile } from '../context/AuthContext';

export interface ProfileMusicData {
  favoriteIds: string[];
  playlists: PersonalPlaylist[];
}

export interface PublicProfileData extends ProfileMusicData {
  profile: Profile;
  friendCount: number | null;
  canViewDetails?: boolean;
}
