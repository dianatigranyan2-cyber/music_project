import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import type { PublicProfileData } from '../../../../lib/profileMusic';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (!username.trim() || username.length > 100) return NextResponse.json({ error: 'Профиль не найден.' }, { status: 404 });
  try {
    const client = await createClient();
    const { data, error } = await client.rpc('music_public_profile', { p_username: username });
    if (error) return NextResponse.json({ error: 'Не удалось загрузить профиль. Попробуйте ещё раз.' }, { status: 503 });
    if (!data) return NextResponse.json({ error: 'Профиль не найден.' }, { status: 404 });
    const profile = data as PublicProfileData;
    const paths = profile.playlists.map(item => item.coverPath).filter((path): path is string => !!path);
    const signed = paths.length ? await client.storage.from('music-playlist-covers').createSignedUrls(paths, 60) : null;
    const covers = new Map(signed?.data?.map(item => [item.path, item.signedUrl]));
    return NextResponse.json({ ...profile, playlists: profile.playlists.map(item => ({ ...item, coverUrl: covers.get(item.coverPath ?? '') ?? null })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Не удалось загрузить профиль. Проверьте подключение.' }, { status: 503 });
  }
}
