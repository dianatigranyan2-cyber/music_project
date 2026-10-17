import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { mapLibrary, type MusicTrackRow } from '../../../../lib/musicLibrary';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const supabase = await createClient();
    // Page through the catalogue: Supabase's default 1,000-row limit must not hide new songs.
    const rows: MusicTrackRow[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('music_tracks')
        .select('id,title,artist_id,album_id,duration_seconds,genre,track_number,audio_path,cover_path,source_url,attribution,license_url,license_code,music_artists!inner(id,name,slug,source_url),music_albums(id,title,release_year)')
        .eq('is_published', true).order('id').range(offset, offset + 499);
      if (error) {
        const setupRequired = error.code === 'PGRST205' || error.code === '42P01';
        return NextResponse.json({ error: setupRequired
          ? 'Музыкальная библиотека ещё не подключена к Supabase.'
          : 'Не удалось загрузить музыку. Попробуйте ещё раз.', setupRequired }, { status: 503 });
      }
      rows.push(...data as unknown as MusicTrackRow[]);
      if (data.length < 500) break;
    }
    return NextResponse.json(mapLibrary(rows, process.env.NEXT_PUBLIC_SUPABASE_URL! + '/storage/v1/object/public/music-audio'), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Не удалось подключиться к музыкальной библиотеке.' }, { status: 503 });
  }
}
