import { isMusicId } from './personalMusic';
import { parseStoryPresentation, type StoryPresentation } from './storyPresentation';

export interface EditableStory {
  id: string; user_id: string; media_url: string; media_path?: string | null; media_type: 'image' | 'video';
  created_at: string; expires_at: string; caption?: string; music_track_id?: string | null;
  music_start_seconds?: number; music_duration_seconds?: number;
  presentation?: StoryPresentation | Record<string, never>;
}
export interface StoryDraft {
  caption: string; musicTrackId: string | null; musicStart: number; musicDuration: number;
  mediaPath: string; mediaType: 'image' | 'video';
  presentation: StoryPresentation;
}
export function parseStoryDraft(value: unknown, userId: string): StoryDraft | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.caption !== 'string' || v.caption.length > 300 || typeof v.mediaPath !== 'string' || !v.mediaPath.startsWith(userId + '/') || v.mediaPath.split('/').some(part => part === '.' || part === '..') || !['image', 'video'].includes(String(v.mediaType))) return null;
  if (v.musicTrackId !== null && !isMusicId(v.musicTrackId)) return null;
  if (!Number.isInteger(v.musicStart) || (v.musicStart as number) < 0 || !Number.isInteger(v.musicDuration) || (v.musicDuration as number) < 1 || (v.musicDuration as number) > 15) return null;
  const presentation = parseStoryPresentation(v.presentation);
  if (!presentation || !v.musicTrackId && presentation.layers.some(layer => layer.kind === 'music')) return null;
  return { caption: v.caption.trim(), mediaPath: v.mediaPath, mediaType: v.mediaType as 'image' | 'video', musicTrackId: v.musicTrackId as string | null, musicStart: v.musicTrackId ? v.musicStart as number : 0, musicDuration: v.musicTrackId ? v.musicDuration as number : 15, presentation };
}
export async function validateStoryFile(file: File): Promise<string | null> {
  if (!file.size || file.size > 50 * 1024 * 1024) return 'Выберите файл до 50 МБ.';
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const matches = file.type === 'image/jpeg' && b[0] === 255 && b[1] === 216 && b[2] === 255
    || file.type === 'image/png' && [137,80,78,71,13,10,26,10].every((v,i) => b[i] === v)
    || file.type === 'image/webp' && String.fromCharCode(...b.slice(0,4)) === 'RIFF' && String.fromCharCode(...b.slice(8,12)) === 'WEBP'
    || file.type === 'video/mp4' && String.fromCharCode(...b.slice(4,8)) === 'ftyp'
    || file.type === 'video/webm' && [26,69,223,163].every((v,i) => b[i] === v);
  return matches ? null : 'Поддерживаются JPEG, PNG, WebP, MP4 и WebM. Проверьте формат файла.';
}
