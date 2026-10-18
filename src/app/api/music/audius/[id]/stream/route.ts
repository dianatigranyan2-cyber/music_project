import {NextResponse} from 'next/server';
import {createClient} from '../../../../../../lib/supabase/server';
import {isMusicId} from '../../../../../../lib/personalMusic';
import {AudiusError, audiusPublicStream, checkAudius} from '../../../../../../lib/audiusServer';

export const dynamic = 'force-dynamic';
const headers = {'Cache-Control': 'private, no-store'};

export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  try {
    const {id} = await params;
    if (!isMusicId(id)) return NextResponse.json({error: 'Трек не найден.'}, {status: 404, headers});
    const client = await createClient();
    const {data: track, error} = await client.from('music_tracks').select('id,provider,external_id,is_published').eq('id', id).eq('provider', 'audius').maybeSingle();
    if (error) return NextResponse.json({error: 'Не удалось проверить трек.'}, {status: 503, headers});
    if (!track) return NextResponse.json({error: 'Трек не найден или снят с публикации.'}, {status: 404, headers});
    if (!track.is_published) {
      const {data: admin, error: denied} = await client.rpc('is_music_admin');
      if (denied || !admin) return NextResponse.json({error: 'Трек не найден.'}, {status: 404, headers});
    }
    const check = await checkAudius(track.external_id, request.signal);
    if (!check.assessment.canPreview || check.assessment.status !== 'available') return NextResponse.json({error: 'Audius больше не разрешает открытое воспроизведение этой песни.'}, {status: 409, headers});
    return new NextResponse(null, {status: 307, headers: {...headers, Location: audiusPublicStream(track.external_id)}});
  } catch (error) {
    return NextResponse.json({error: error instanceof AudiusError ? error.message : 'Песня Audius сейчас недоступна.'}, {status: error instanceof AudiusError ? error.status : 503, headers});
  }
}
