import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { parsePersonalMusicAction } from '../../../../lib/personalMusic';
export const dynamic='force-dynamic';
type Client = Awaited<ReturnType<typeof createClient>>;
async function readPersonal(client: Client, userId: string) {
  const [favorites, playlists, artists, albums, history]=await Promise.all([
    client.from('music_favorites').select('track_id').eq('user_id',userId).order('created_at',{ascending:false}),
    client.from('music_playlists').select('id,title,description,cover_path,is_shared,share_token,show_on_profile,music_playlist_tracks(track_id,position)').eq('user_id',userId).order('created_at',{ascending:false}),
    client.from('music_saved_artists').select('artist_id').eq('user_id',userId).order('created_at',{ascending:false}),
    client.from('music_saved_albums').select('album_id').eq('user_id',userId).order('created_at',{ascending:false}),
    client.from('music_history').select('track_id,played_at').eq('user_id',userId).order('played_at',{ascending:false}).limit(100),
  ]);
  if (favorites.error || playlists.error || artists.error || albums.error || history.error) throw new Error('Не удалось загрузить личную библиотеку.');
  const paths=playlists.data.map(p=>p.cover_path as string|null).filter((path):path is string=>!!path);
  const signed=paths.length?await client.storage.from('music-playlist-covers').createSignedUrls(paths,3600):null;
  const covers=new Map(signed?.data?.map(p=>[p.path,p.signedUrl]));
  return {userId,favoriteIds:favorites.data.map(row=>row.track_id as string),savedArtistIds:artists.data.map(r=>r.artist_id),savedAlbumIds:albums.data.map(r=>r.album_id),history:history.data.map(r=>({trackId:r.track_id,playedAt:r.played_at})),playlists:playlists.data.map(row=>({id:row.id,title:row.title,description:row.description,coverPath:row.cover_path,coverUrl:covers.get(row.cover_path)??null,shared:row.is_shared,shareToken:row.share_token,showOnProfile:row.show_on_profile,trackIds:[...row.music_playlist_tracks].sort((a,b)=>a.position-b.position).map(t=>t.track_id as string)}))};
}
const failure=(message: string,status: number)=>NextResponse.json({error:message},{status});
export async function GET() {
  try {
    const client=await createClient(); const {data:{user}}=await client.auth.getUser();
    if (!user) return failure('Войдите в аккаунт, чтобы открыть свою музыку.',401);
    return NextResponse.json(await readPersonal(client,user.id),{headers:{'Cache-Control':'private, no-store'}});
  } catch { return failure('Не удалось загрузить личную библиотеку. Попробуйте ещё раз.',503); }
}
export async function POST(request: NextRequest) {
  try {
    if (Number(request.headers.get('content-length'))>100000) return failure('Слишком большой запрос.',413);
    let body;
    try {body=await request.json();}catch{return failure('Некорректный запрос.',400);}
    const action=parsePersonalMusicAction(body);
    if (!action) return failure('Проверьте данные плейлиста или песни.',400);
    const client=await createClient(); const {data:{user}}=await client.auth.getUser();
    if (!user) return failure('Войдите в аккаунт, чтобы сохранять музыку.',401);
    if (body.expectedUserId!==user.id) return failure('Аккаунт изменился. Повторите действие.',409);
    let result;
    switch(action.action) {
      case 'save-artist':case 'save-album': {
        const table=action.action==='save-artist'?'music_saved_artists':'music_saved_albums';
        const column=action.action==='save-artist'?'artist_id':'album_id';
        result=action.saved?await client.from(table).upsert({user_id:user.id,[column]:action.itemId},{onConflict:'user_id,'+column,ignoreDuplicates:true}):await client.from(table).delete().eq('user_id',user.id).eq(column,action.itemId);break;
      }
      case 'cover': {
        if(action.path&&!action.path.startsWith(user.id+'/'))return failure('Эта обложка недоступна.',403);
        if(action.path){const file=await client.storage.from('music-playlist-covers').exists(action.path);if(file.error||!file.data)return failure('Сначала загрузите обложку.',400);}
        result=await client.from('music_playlists').update({cover_path:action.path}).eq('id',action.playlistId).eq('user_id',user.id).select('id');break;
      }
      case 'sharing':result=await client.rpc('music_playlist_sharing',{p_playlist_id:action.playlistId,p_enabled:action.enabled});break;
      case 'profile-visibility':result=await client.from('music_playlists').update({show_on_profile:action.enabled}).eq('id',action.playlistId).eq('user_id',user.id).select('id');break;
      case 'favorite': result=action.liked
        ? await client.from('music_favorites').upsert({user_id:user.id,track_id:action.trackId},{onConflict:'user_id,track_id',ignoreDuplicates:true})
        : await client.from('music_favorites').delete().eq('user_id',user.id).eq('track_id',action.trackId); break;
      case 'create': result=await client.from('music_playlists').upsert({id:action.playlistId,user_id:user.id,title:action.title,description:action.description},{onConflict:'id',ignoreDuplicates:true}); break;
      case 'rename': result=await client.from('music_playlists').update({title:action.title,description:action.description}).eq('user_id',user.id).eq('id',action.playlistId).select('id'); break;
      case 'delete': result=await client.from('music_playlists').delete().eq('user_id',user.id).eq('id',action.playlistId).select('id'); break;
      case 'add': result=await client.rpc('music_playlist_add_track',{p_playlist_id:action.playlistId,p_track_id:action.trackId}); break;
      case 'remove': result=await client.from('music_playlist_tracks').delete().eq('playlist_id',action.playlistId).eq('track_id',action.trackId); break;
      case 'reorder': result=await client.rpc('music_playlist_reorder',{p_playlist_id:action.playlistId,p_track_ids:action.trackIds}); break;
    }
    if (result.error) return failure(result.error.code==='22023'?'Состав плейлиста изменился. Обновите страницу.':'Не удалось сохранить изменения. Попробуйте ещё раз.',409);
    if ((action.action==='rename' || action.action==='delete'||action.action==='cover'||action.action==='profile-visibility') && !result.data?.length) return failure('Плейлист не найден.',404);
    return NextResponse.json(await readPersonal(client,user.id),{headers:{'Cache-Control':'private, no-store'}});
  } catch { return failure('Не удалось сохранить изменения. Проверьте подключение.',503); }
}
