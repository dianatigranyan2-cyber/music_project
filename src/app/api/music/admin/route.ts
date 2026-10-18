import { NextResponse } from 'next/server';
import { createHash,randomUUID } from 'node:crypto';
import { musicAdminClient as adminClient } from '../../../../lib/musicAdminAuth';
import { parseCatalogMetadata,audioExtension } from '../../../../lib/catalogAdmin';
import { validateMusicCover } from '../../../../lib/musicFeatures';
export const dynamic='force-dynamic';
export async function GET(){
  const supabase=await adminClient();if(!supabase)return NextResponse.json({error:'Доступ только для администратора музыки.'},{status:403});
  const tracks=[];
  for(let offset=0;;offset+=500){
    const {data,error}=await supabase.from('music_tracks').select('id,title,genre,is_published,source_url,attribution,license_code,cover_path,duration_seconds,provider,external_id,music_artists(name),music_albums(title)').order('created_at',{ascending:false}).range(offset,offset+499);
    if(error)return NextResponse.json({error:'Не удалось загрузить каталог.'},{status:503});tracks.push(...data);if(data.length<500)break;
  }
  return NextResponse.json({tracks},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
  const supabase=await adminClient();if(!supabase)return NextResponse.json({error:'Доступ запрещён.'},{status:403});
  const uploaded:{bucket:string;path:string}[]=[];
  try{
    if(Number(request.headers.get('content-length')??0)>60*1024*1024)return NextResponse.json({error:'Слишком большой файл.'},{status:413});
    const form=await request.formData();const metadata=parseCatalogMetadata(JSON.parse(String(form.get('metadata'))));
    if(!metadata)return NextResponse.json({error:'Проверьте название, исполнителя, источник и лицензию.'},{status:400});
    const data:Record<string,unknown>={...metadata};
    const audio=form.get('audio');const cover=form.get('cover');
    if(!metadata.id){
      if(!(audio instanceof File)||audio.size>52428800)throw new Error('Нужен MP3 или M4A до 50 МБ.');
      const bytes=new Uint8Array(await audio.arrayBuffer());const extension=audioExtension(bytes);
      const duration=Number(form.get('duration'));
      if(!extension||!Number.isInteger(duration)||duration<1||duration>86400)throw new Error('Не удалось определить аудиофайл или длительность.');
      const path=randomUUID()+'.'+extension;
      const {error}=await supabase.storage.from('music-audio').upload(path,bytes,{contentType:extension==='mp3'?'audio/mpeg':'audio/mp4'});if(error)throw new Error('Не удалось загрузить аудио.');uploaded.push({bucket:'music-audio',path});
      Object.assign(data,{audio_path:path,audio_sha256:createHash('sha256').update(bytes).digest('hex'),audio_bytes:bytes.length,duration_seconds:duration});
    }
    if(cover instanceof File&&cover.size){
      const problem=await validateMusicCover(cover);if(problem)throw new Error(problem);
      const path=randomUUID()+({'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}[cover.type]);
      const {error}=await supabase.storage.from('music-covers').upload(path,cover,{contentType:cover.type});if(error)throw new Error('Не удалось загрузить обложку.');uploaded.push({bucket:'music-covers',path});data.cover_path=path;
    }
    const {data:id,error}=await supabase.rpc('catalog_save_track',{p_data:data});
    if(error)throw new Error(error.code==='23505'?'Этот аудиофайл уже есть в каталоге.':'Не удалось сохранить трек. Проверьте данные и лицензию.');
    return NextResponse.json({id});
  }catch(error){
    await Promise.allSettled(uploaded.map(item=>supabase.storage.from(item.bucket).remove([item.path])));
    return NextResponse.json({error:error instanceof Error?error.message:'Не удалось сохранить трек.'},{status:400});
  }
}
