import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {isMusicId} from '../../../../../lib/personalMusic';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  if(!isMusicId(token))return NextResponse.json({error:'Подборка не найдена.'},{status:404});
  try{
    const client=await createClient();const {data,error}=await client.rpc('music_shared_playlist',{p_token:token});
    if(error)return NextResponse.json({error:'Не удалось загрузить подборку.'},{status:503});
    if(!data)return NextResponse.json({error:'Ссылка отключена или подборка удалена.'},{status:404});
    const cover=data.coverPath?await client.storage.from('music-playlist-covers').createSignedUrl(data.coverPath,60):null;
    return NextResponse.json({...data,coverUrl:cover?.data?.signedUrl??null},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Не удалось загрузить подборку.'},{status:503});}
}
