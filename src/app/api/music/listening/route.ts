import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {validMusicId} from '../../../../lib/friendListening';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
 try{
  const origin=request.headers.get('origin');if(origin&&origin!==request.nextUrl.origin)return reply({error:'Недопустимый источник запроса.'},403);
  if(Number(request.headers.get('content-length'))>10000)return reply({error:'Слишком большой запрос.'},413);
  let b;try{b=await request.json();}catch{return reply({error:'Некорректный запрос.'},400);}
  if(!b||!validMusicId(b.deviceId))return reply({error:'Некорректное подключение.'},400);
  const client=await createClient();const {data:{user}}=await client.auth.getUser();
  if(!user)return reply({error:'Войдите в Melo, чтобы слушать вместе.'},401);
  if(b.expectedUserId!==user.id)return reply({error:'Аккаунт изменился. Обновите страницу.'},409);
  let result;
  if(b.action==='state'||b.action==='leave')result=await client.rpc('friend_music_'+b.action,{p_device:b.deviceId});
  else if(b.action==='preferences'&&typeof b.broadcast==='boolean'&&typeof b.allowFollow==='boolean')result=await client.rpc('friend_music_preferences',{p_broadcast:b.broadcast,p_allow_follow:b.allowFollow,p_device:b.deviceId});
  else if(b.action==='follow'&&validMusicId(b.hostId))result=await client.rpc('friend_music_follow',{p_host:b.hostId,p_device:b.deviceId});
  else if(b.action==='publish'&&validMusicId(b.trackId)&&typeof b.playing==='boolean'&&typeof b.position==='number'&&Number.isFinite(b.position)&&b.position>=0&&b.position<=86400&&Number.isSafeInteger(b.sequence)&&b.sequence>=0)result=await client.rpc('friend_music_publish',{p_device:b.deviceId,p_sequence:b.sequence,p_track:b.trackId,p_playing:b.playing,p_position:b.position,p_claim:b.claim===true});
  else return reply({error:'Некорректное действие.'},400);
  if(result.error)return reply({error:['P0001','42501'].includes(result.error.code)?result.error.message:'Не удалось обновить прослушивание. Попробуйте ещё раз.'},result.error.code==='42501'?403:result.error.code==='P0001'?400:503);
  return reply({data:result.data,userId:user.id});
 }catch{return reply({error:'Не удалось связаться с Melo. Повторите действие.'},503);}
}
