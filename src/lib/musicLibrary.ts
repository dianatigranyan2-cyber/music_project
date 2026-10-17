import type { Track } from '../types';

export interface MusicArtist { id: string; name: string; slug: string; sourceUrl: string }
export interface MusicAlbum { id: string; artistId: string; title: string; year: number | null }
export interface MusicLibrary { tracks: Track[]; artists: MusicArtist[]; albums: MusicAlbum[] }
export interface MusicTrackRow {
  id: string; title: string; artist_id: string; album_id: string | null;
  duration_seconds: number; genre: string; track_number: number | null; audio_path: string;
  cover_path?: string | null; source_url: string; attribution: string; license_url: string; license_code: string;
  music_artists: { id: string; name: string; slug: string; source_url: string };
  music_albums: { id: string; title: string; release_year: number | null } | null;
}
export function mapLibrary(rows: MusicTrackRow[], storageBase: string): MusicLibrary {
  const artists = new Map<string, MusicArtist>();
  const albums = new Map<string, MusicAlbum>();
  const tracks = rows.map(row => {
    const artist = row.music_artists;
    artists.set(artist.id, { id: artist.id, name: artist.name, slug: artist.slug, sourceUrl: artist.source_url });
    const album = row.music_albums;
    if (album) albums.set(album.id, { id: album.id, artistId: artist.id, title: album.title, year: album.release_year });
    return {
      id: row.id, title: row.title, artist: artist.name, artistId: artist.id,
      album: album?.title ?? 'Сингл', albumId: album?.id,
      duration: row.duration_seconds, genre: row.genre, trackNumber: row.track_number ?? undefined,
      coverUrl: row.cover_path ? storageBase.replace(/\/music-audio$/, '/music-covers') + '/' + encodeURIComponent(row.cover_path) : '/music-placeholder.svg', source: 'library' as const,
      streamUrl: storageBase + '/' + encodeURIComponent(row.audio_path),
      sourceUrl: row.source_url, attribution: row.attribution, licenseUrl: row.license_url, licenseCode: row.license_code,
    };
  });
  return { tracks, artists: [...artists.values()], albums: [...albums.values()] };
}
export function filterMusic(tracks: Track[], query: string, genre = ''): Track[] {
  const words = query.trim().normalize('NFKC').toLocaleLowerCase().replaceAll('ё','е').split(/\s+/).filter(Boolean);
  return tracks.filter(track => (!genre || track.genre === genre) && words.every(word =>
    [track.title, track.artist, track.album].join(' ').normalize('NFKC').toLocaleLowerCase().replaceAll('ё','е').includes(word)));
}
