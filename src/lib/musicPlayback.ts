import type { Track } from '../types';

export const EMPTY_TRACK: Track = { id: '', title: 'Выберите музыку', artist: 'Библиотека Melo', album: '', coverUrl: '/music-placeholder.svg', duration: 0 };
export function isPlayableTrack(track: Track): boolean { return track.source === 'library' && Boolean(track.streamUrl?.startsWith('https://')); }
export function playbackQueue(track: Track, collection: Track[]): Track[] {
  const unique = new Map(collection.filter(isPlayableTrack).map(item => [item.id, item]));
  if (isPlayableTrack(track)) unique.set(track.id, track);
  return [...unique.values()];
}
export function adjacentTrack(queue: Track[], id: string, direction: 1 | -1): Track | null {
  const index = queue.findIndex(track => track.id === id);
  return index < 0 ? null : queue[index + direction] ?? null;
}
export function shuffledQueue(queue: Track[], id: string): Track[] {
  const current = queue.find(track => track.id === id);
  const rest = queue.filter(track => track.id !== id);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return current ? [current, ...rest] : rest;
}
export function enqueueTrack(queue: Track[], currentId: string, track: Track, next: boolean): Track[] {
  if (!isPlayableTrack(track) || track.id === currentId) return queue;
  const result = queue.filter(item => item.id !== track.id);
  result.splice(next ? Math.max(0, result.findIndex(item => item.id === currentId) + 1) : result.length, 0, track);
  return result;
}
