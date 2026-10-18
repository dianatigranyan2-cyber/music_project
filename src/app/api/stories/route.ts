import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { parseStoryDraft } from '../../../lib/storyEditing';
import { isMusicId } from '../../../lib/personalMusic';
export async function POST(request: Request) {
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
  try {
    const body = await request.json();
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user || body.expectedUserId !== user.id) return fail('Войдите в свой аккаунт и повторите сохранение.', 401);
    if (!['create','update'].includes(body.action) || body.action === 'update' && !isMusicId(body.storyId)) return fail('Некорректная история.', 400);
    const draft = parseStoryDraft(body, user.id);
    if (!draft) return fail('Проверьте текст, файл и фрагмент музыки.', 400);
    if (draft.musicTrackId) {
      const music = await client.from('music_tracks').select('provider').eq('id', draft.musicTrackId).eq('is_published', true).maybeSingle();
      if (music.error || !music.data) return fail('Выбранная музыка недоступна.', 409);
      if (music.data.provider === 'audius') return fail('Музыка Audius пока доступна для прослушивания, но не для историй.', 400);
    }
    const previous = body.action === 'update' ? await client.from('stories').select('id,media_path').eq('id', body.storyId).eq('user_id', user.id).gt('expires_at', new Date().toISOString()).maybeSingle() : null;
    if (previous && (previous.error || !previous.data)) return fail('История недоступна для редактирования.', 404);
    const exists = await client.storage.from('stories').exists(draft.mediaPath);
    if (exists.error || !exists.data) return fail('Сначала загрузите фото или видео.', 400);
    const media = await client.storage.from('stories').createSignedUrl(draft.mediaPath, 300);
    if (media.error || !media.data) return fail('Не удалось подготовить фото или видео.', 503);
    const values = { caption: draft.caption, presentation: draft.presentation, music_track_id: draft.musicTrackId, music_start_seconds: draft.musicStart, music_duration_seconds: draft.musicDuration, media_path: draft.mediaPath, media_type: draft.mediaType, media_url: '' };
    const result = body.action === 'create'
      ? await client.from('stories').insert({ ...values, user_id: user.id }).select('*').single()
      : await client.from('stories').update(values).eq('id', body.storyId).eq('user_id', user.id).gt('expires_at', new Date().toISOString()).select('*').maybeSingle();
    if (result.error || !result.data) return fail('Не удалось сохранить историю. Проверьте доступность выбранного трека и срок истории.', 409);
    if (previous?.data?.media_path && previous.data.media_path !== draft.mediaPath) {
      try {
        const used = await client.from('stories').select('id').eq('media_path', previous.data.media_path).limit(1);
        if (!used.error && !used.data?.length) await client.storage.from('stories').remove([previous.data.media_path]);
      } catch {
        // The edit is already saved; a cleanup failure must not report it as failed.
        console.warn('Не удалось удалить старый файл истории после сохранения.');
      }
    }
    return NextResponse.json({ ...result.data, media_url: media.data.signedUrl }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return fail('Не удалось сохранить историю. Проверьте подключение.', 503); }
}
