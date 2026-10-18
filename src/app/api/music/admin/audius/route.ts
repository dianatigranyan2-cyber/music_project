import {NextResponse} from 'next/server';
import {musicAdminClient} from '../../../../../lib/musicAdminAuth';
import {AudiusError, audiusPublicStream, checkAudius, searchAudius} from '../../../../../lib/audiusServer';
import {importAudiusTrack, editAudiusTrack} from '../../../../../lib/audiusCatalog';

export const dynamic = 'force-dynamic';
const headers = {'Cache-Control': 'private, no-store'};

export async function GET(request: Request) {
  try {
    if (!await musicAdminClient()) return NextResponse.json({error: 'Управление Audius доступно только администратору музыки.'}, {status: 403, headers});
    const params = new URL(request.url).searchParams;
    const id = params.get('track');
    if (id !== null) {
      const result = await checkAudius(id, request.signal);
      if (params.get('preview') === '1') {
        if (!result.assessment.canPreview) return NextResponse.json({error: 'Открытое воспроизведение этого трека не подтверждено.'}, {status: 403, headers});
        return new NextResponse(null, {status: 307, headers: {...headers, Location: audiusPublicStream(id)}});
      }
      return NextResponse.json(result, {headers});
    }
    const offset = params.get('offset') ?? '0';
    if (!/^\d{1,4}$/.test(offset)) return NextResponse.json({error: 'Некорректная страница поиска.'}, {status: 400, headers});
    return NextResponse.json(await searchAudius(params.get('q') ?? '', Number(offset), request.signal), {headers});
  } catch (error) {
    return NextResponse.json({error: error instanceof AudiusError ? error.message : 'Не удалось проверить Audius. Попробуйте ещё раз.'}, {status: error instanceof AudiusError ? error.status : 503, headers});
  }
}

async function save(request: Request, editing: boolean) {
  try {
    const client = await musicAdminClient();
    if (!client) return NextResponse.json({error: 'Добавлять музыку может только администратор каталога.'}, {status: 403, headers});
    if (Number(request.headers.get('content-length') ?? 0) > 8192) return NextResponse.json({error: 'Слишком большой запрос.'}, {status: 413, headers});
    let data: unknown;
    try {const body = await request.text(); if (body.length > 8192) throw new Error(); data = JSON.parse(body);}
    catch {return NextResponse.json({error: 'Не удалось прочитать сведения о песне.'}, {status: 400, headers});}
    const result = await (editing ? editAudiusTrack : importAudiusTrack)(client, data, request.signal);
    return NextResponse.json(result, {headers});
  } catch (error) {
    return NextResponse.json({error: error instanceof AudiusError ? error.message : 'Не удалось сохранить песню Audius.'}, {status: error instanceof AudiusError ? error.status : 503, headers});
  }
}
export const POST = (request: Request) => save(request, false);
export const PATCH = (request: Request) => save(request, true);
