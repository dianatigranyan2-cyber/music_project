import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {isMusicId} from '../../../../lib/personalMusic';
export async function POST(request:NextRequest){
  try{
    const body=await request.json();
    if(!isMusicId(body?.trackId))return NextResponse.json({error:'Некорректная песня.'},{status:400});
    const client=await createClient();const {data:{user}}=await client.auth.getUser();
    if(!user||user.id!==body.expectedUserId)return NextResponse.json({error:'Требуется вход.'},{status:401});
    const {data,error}=await client.rpc('music_record_listen',{p_track_id:body.trackId});
    if(error)return NextResponse.json({error:'Не удалось обновить историю.'},{status:409});
    return NextResponse.json({userId:user.id,trackId:body.trackId,playedAt:data},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return NextResponse.json({error:'Не удалось обновить историю.'},{status:503});}
}
