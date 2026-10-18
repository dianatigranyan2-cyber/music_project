import 'server-only';
import {AUDIUS_PAGE_SIZE, assessAudiusTrack, audiusInput, audiusTrackId, normalizeAudiusTrack} from './audius';
import type {AudiusCheck, AudiusTrack} from './audius';

const API = 'https://api.audius.co/v1';
export class AudiusError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export function audiusConnectionMode(): 'token' | 'public' {
  return process.env.AUDIUS_BEARER_TOKEN?.trim() ? 'token' : 'public';
}
async function audiusJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const token = process.env.AUDIUS_BEARER_TOKEN?.trim();
  let response: Response;
  try {
    response = await fetch(API + path, {
      headers: {Accept: 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
      cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AudiusError('Не удалось связаться с Audius. Попробуйте ещё раз.', 503);
  }
  if (response.status === 404) throw new AudiusError('Трек в Audius не найден или удалён.', 404);
  if (response.status === 429) throw new AudiusError('Audius временно ограничил число запросов. Повторите поиск немного позже.', 429);
  if (response.status === 401 || response.status === 403) throw new AudiusError('Audius отклонил запрос. Если токен настроен, проверьте его в настройках сервера.', 503);
  if (!response.ok) throw new AudiusError('Audius временно недоступен. Попробуйте позже.', 502);
  try {
    const value = await response.json();
    if (!value || typeof value !== 'object' || !('data' in value)) throw new Error();
    return value.data;
  } catch { throw new AudiusError('Audius вернул данные, которые не удалось прочитать.', 502); }
}
export async function searchAudius(value: string, offset: number, signal?: AbortSignal) {
  const input = audiusInput(value);
  if (!input || !Number.isInteger(offset) || offset < 0 || offset > 1000) throw new AudiusError('Введите название песни или HTTPS-ссылку на трек в Audius.', 400);
  const data = input.kind === 'url'
    ? await audiusJson('/resolve?' + new URLSearchParams({url: input.value}), signal)
    : await audiusJson('/tracks/search?' + new URLSearchParams({query: input.value, limit: String(AUDIUS_PAGE_SIZE), offset: String(offset)}), signal);
  const rows = input.kind === 'url' ? [data] : data;
  if (!Array.isArray(rows)) throw new AudiusError('Не удалось прочитать результаты поиска Audius.', 502);
  const tracks = rows.map(row => normalizeAudiusTrack(row)).filter((track): track is AudiusTrack => track !== null);
  if (input.kind === 'url' && !tracks.length) throw new AudiusError('По ссылке не найден отдельный музыкальный трек. Вставьте ссылку на песню, а не на профиль или плейлист.', 400);
  return {tracks, hasMore: input.kind === 'search' && rows.length >= AUDIUS_PAGE_SIZE, nextOffset: offset + AUDIUS_PAGE_SIZE, mode: audiusConnectionMode()};
}
export async function checkAudius(id: string, signal?: AbortSignal): Promise<AudiusCheck> {
  if (!audiusTrackId(id)) throw new AudiusError('Некорректный идентификатор трека Audius.', 400);
  const [data, access] = await Promise.all([
    audiusJson('/tracks/' + id, signal), audiusJson('/tracks/' + id + '/access-info', signal),
  ]);
  const track = normalizeAudiusTrack(data, access);
  if (!track || track.id !== id) throw new AudiusError('Не удалось проверить сведения об этом треке.', 502);
  return {track, assessment: assessAudiusTrack(track), checkedAt: new Date().toISOString()};
}
export function audiusPublicStream(id: string): string {
  if (!audiusTrackId(id)) throw new AudiusError('Некорректный идентификатор трека Audius.', 400);
  // The browser follows Audius's public stream redirect; no app token is exposed.
  return API + '/tracks/' + id + '/stream?app_name=Melo';
}
