import 'server-only';
import {checkAudius, AudiusError} from './audiusServer';
import {audiusCatalogData, parseAudiusImport} from './audiusImport';
import {isMusicId} from './personalMusic';
import type {musicAdminClient} from './musicAdminAuth';

type AdminClient = NonNullable<Awaited<ReturnType<typeof musicAdminClient>>>;
const databaseError = (code?: string) => new AudiusError(
  ['PGRST202', 'PGRST204', '42703'].includes(code ?? '')
    ? 'Импорт Audius ещё не подключён к базе. Нужно применить supabase/audius_catalog.sql.'
    : 'Не удалось сохранить песню Audius. Проверьте данные и повторите попытку.',
  503,
);

export async function importAudiusTrack(client: AdminClient, value: unknown, signal?: AbortSignal) {
  const input = parseAudiusImport(value);
  if (!input) throw new AudiusError('Укажите исполнителя и проверьте название песни.', 400);
  const check = await checkAudius(input.trackId, signal);
  if (!check.assessment.canPreview || check.assessment.status !== 'available' || check.track.duration > 86400) {
    throw new AudiusError('Условия этого трека требуют проверки или открытое воспроизведение недоступно. Выберите другой трек.', 409);
  }
  const {data, error} = await client.rpc('catalog_save_audius', {p_data: audiusCatalogData(check.track, input, check.checkedAt)});
  if (error || !data) throw databaseError(error?.code);
  return data as {id: string; artistId: string; alreadyImported: boolean; isPublished: boolean};
}

export async function editAudiusTrack(client: AdminClient, value: unknown, signal?: AbortSignal) {
  if (!value || typeof value !== 'object' || !('id' in value) || !isMusicId(value.id)) throw new AudiusError('Не найден редактируемый трек.', 400);
  const {data: existing, error: readError} = await client.from('music_tracks')
    .select('id,provider,external_id,external_cover_url,external_metadata,source_url,attribution,duration_seconds')
    .eq('id', value.id).eq('provider', 'audius').maybeSingle();
  if (readError) throw databaseError(readError.code);
  if (!existing) throw new AudiusError('Трек Audius не найден.', 404);
  const input = parseAudiusImport({...value, trackId: existing.external_id});
  if (!input || !input.title || !input.genre) throw new AudiusError('Укажите название, исполнителя и жанр.', 400);
  let data;
  if (input.isPublished) {
    const check = await checkAudius(input.trackId, signal);
    if (!check.assessment.canPreview || check.assessment.status !== 'available') throw new AudiusError('Audius больше не подтверждает открытое воспроизведение этой песни. Можно снять её с публикации.', 409);
    data = audiusCatalogData(check.track, input, check.checkedAt);
  } else {
    // Taking down a song must work even if Audius is unavailable or removed it.
    data = {
      title: input.title, artist: input.artist, album: input.album, genre: input.genre, is_published: false,
      external_id: existing.external_id, source_url: existing.source_url, duration_seconds: existing.duration_seconds,
      external_cover_url: existing.external_cover_url, external_metadata: existing.external_metadata,
      attribution: existing.attribution,
    };
  }
  const {data: saved, error} = await client.rpc('catalog_save_audius', {p_data: {...data, id: existing.id}});
  if (error || !saved) throw databaseError(error?.code);
  return saved as {id: string; artistId: string; alreadyImported: boolean; isPublished: boolean};
}
