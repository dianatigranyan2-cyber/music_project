export interface PersonalPlaylist { id: string; title: string; description: string; trackIds: string[]; coverPath?:string|null; coverUrl?:string|null; shared?:boolean; shareToken?:string; showOnProfile?:boolean }
export interface PersonalMusicData { userId: string; favoriteIds: string[]; playlists: PersonalPlaylist[]; savedArtistIds:string[]; savedAlbumIds:string[]; history:{trackId:string;playedAt:string}[] }
export type PersonalMusicAction =
  | { action: 'favorite'; trackId: string; liked: boolean }
  | { action:'save-artist'|'save-album'; itemId:string; saved:boolean }
  | { action:'cover'; playlistId:string; path:string|null }
  | { action:'sharing'; playlistId:string; enabled:boolean }
  | { action:'profile-visibility'; playlistId:string; enabled:boolean }
  | { action: 'create'; playlistId: string; title: string; description: string }
  | { action: 'rename'; playlistId: string; title: string; description: string }
  | { action: 'delete'; playlistId: string }
  | { action: 'add' | 'remove'; playlistId: string; trackId: string }
  | { action: 'reorder'; playlistId: string; trackIds: string[] };
export const isMusicId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function parsePersonalMusicAction(value: unknown): PersonalMusicAction | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.action === 'favorite' && isMusicId(v.trackId) && typeof v.liked === 'boolean') return { action:v.action,trackId:v.trackId,liked:v.liked };
  if ((v.action==='save-artist'||v.action==='save-album')&&isMusicId(v.itemId)&&typeof v.saved==='boolean')return {action:v.action,itemId:v.itemId,saved:v.saved};
  if (!isMusicId(v.playlistId)) return null;
  if(v.action==='cover'&&(v.path===null||typeof v.path==='string'&&/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(v.path)))return {action:'cover',playlistId:v.playlistId,path:v.path as string|null};
  if(v.action==='sharing'&&typeof v.enabled==='boolean')return {action:'sharing',playlistId:v.playlistId,enabled:v.enabled};
  if(v.action==='profile-visibility'&&typeof v.enabled==='boolean')return {action:'profile-visibility',playlistId:v.playlistId,enabled:v.enabled};
  if ((v.action==='create' || v.action==='rename') && typeof v.title==='string' && v.title.trim().length>0 && v.title.trim().length<=100 && typeof v.description==='string' && v.description.length<=500)
    return {action:v.action,playlistId:v.playlistId,title:v.title.trim(),description:v.description.trim()};
  if (v.action==='delete') return {action:v.action,playlistId:v.playlistId};
  if ((v.action==='add' || v.action==='remove') && isMusicId(v.trackId)) return {action:v.action,playlistId:v.playlistId,trackId:v.trackId};
  if (v.action==='reorder' && Array.isArray(v.trackIds) && v.trackIds.length<=1000 && v.trackIds.every(isMusicId) && new Set(v.trackIds).size===v.trackIds.length)
    return {action:v.action,playlistId:v.playlistId,trackIds:v.trackIds};
  return null;
}
export function movePlaylistTrack(ids: string[], id: string, direction: -1 | 1): string[] {
  const index=ids.indexOf(id), destination=index+direction;
  if (index<0 || destination<0 || destination>=ids.length) return ids;
  const result=[...ids]; [result[index],result[destination]]=[result[destination],result[index]]; return result;
}
