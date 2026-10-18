import type {AudiusTrack} from './audius';
import {audiusTrackId} from './audius';

export interface AudiusImportInput {
  trackId: string; title: string; artist: string; album: string; genre: string; isPublished: boolean;
}
export function parseAudiusImport(value: unknown): AudiusImportInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const trackId = audiusTrackId(data.trackId);
  if (!trackId || typeof data.artist !== 'string' || typeof data.isPublished !== 'boolean') return null;
  const result = {trackId, title: '', artist: data.artist.trim(), album: '', genre: '', isPublished: data.isPublished};
  if (!result.artist || result.artist.length > 200) return null;
  for (const key of ['title', 'album', 'genre'] as const) {
    if (data[key] !== undefined && typeof data[key] !== 'string') return null;
    result[key] = typeof data[key] === 'string' ? data[key].trim() : '';
    if (result[key].length > (key === 'genre' ? 100 : 200)) return null;
  }
  return result;
}
export function audiusCatalogData(track: AudiusTrack, input: AudiusImportInput, checkedAt: string) {
  const title = input.title || track.title;
  const attribution = `«${title}» — ${input.artist}. Источник: ${track.sourceUrl}. Аккаунт Audius: ${track.account.name} (@${track.account.handle}). Лицензия в Audius: ${track.license || 'не указана'}.${track.copyright ? ' Правообладатели: ' + track.copyright + '.' : ''} Воспроизведение через API Audius по Open Music License: https://audius.org/open-music-license.pdf`;
  return {
    title, artist: input.artist, album: input.album, genre: input.genre || track.genre || 'Другое',
    duration_seconds: track.duration, external_id: track.id, source_url: track.sourceUrl,
    attribution, is_published: input.isPublished, external_cover_url: track.artworkUrl,
    external_metadata: {account: track.account, license: track.license, copyright: track.copyright, checkedAt},
  };
}
