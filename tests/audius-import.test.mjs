import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as audius from '../src/lib/audius.ts';
const require=createRequire(import.meta.url);
async function load(path,deps={}) {
  const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const mod={exports:{}};new Function('require','module','exports',code)(name=>name==='server-only'?{}:deps[name]??require(name),mod,mod.exports);return mod.exports;
}
const pure=await load('src/lib/audiusImport.ts',{'./audius':audius});
const personal=await load('src/lib/personalMusic.ts');
const playback=await load('src/lib/musicPlayback.ts');
const {mapLibrary}=await load('src/lib/musicLibrary.ts');
const sessions=await load('src/lib/playerSession.ts',{'./personalMusic':personal});
class AudiusError extends Error {constructor(message,status){super(message);this.status=status;}}
const id='00000000-0000-4000-8000-000000000001';
const track=audius.normalizeAudiusTrack({id:'G0wyE',title:'Song',duration:123,genre:'Pop',permalink:'/account/song',user:{name:'Uploader',handle:'account'},license:'All rights reserved',is_available:true,is_streamable:true,access:{stream:true},artwork:{'480x480':'https://cdn.example.com/cover.jpg'}});
const open={track,assessment:audius.assessAudiusTrack(track),checkedAt:'2026-10-18T12:00:00Z'};
let checked=open,checks=0,existing=null;
const server={AudiusError,checkAudius:async externalId=>{checks++;if(checked instanceof Error)throw checked;assert.equal(externalId,'G0wyE');return checked;},audiusPublicStream:externalId=>'https://api.audius.co/v1/tracks/'+externalId+'/stream?app_name=Melo'};
const catalog=await load('src/lib/audiusCatalog.ts',{'./audiusImport':pure,'./audiusServer':server,'./personalMusic':personal});
const input={trackId:'G0wyE',artist:'Real Performer',isPublished:true};
function client(){return {rpc:async(name,{p_data})=>{assert.equal(name,'catalog_save_audius');return {data:{id,p_data}};},from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:existing})})};}

test('Audius import requires curated artist, validates flags and uses fresh server metadata instead of client URLs or licenses',async()=>{
  for(const bad of [{...input,artist:''},{...input,isPublished:'true'},{...input,trackId:'../bad'},{...input,title:'x'.repeat(201)}]) assert.equal(pure.parseAudiusImport(bad),null);
  checked=open;checks=0;
  const saved=await catalog.importAudiusTrack(client(),{...input,source_url:'https://evil.test',license:'CC0',duration_seconds:999,external_metadata:{secret:'bad'}});
  assert.equal(checks,1);assert.equal(saved.p_data.artist,'Real Performer');assert.equal(saved.p_data.source_url,track.sourceUrl);assert.equal(saved.p_data.duration_seconds,123);
  assert.equal(saved.p_data.external_metadata.license,'All rights reserved');assert.equal(saved.p_data.external_cover_url,'https://cdn.example.com/cover.jpg');
  assert.match(saved.p_data.attribution,/Uploader/);assert.match(saved.p_data.attribution,/Real Performer/);assert.doesNotMatch(JSON.stringify(saved.p_data),/evil|secret|CC0/);
});
test('revoked access blocks import; a hidden track can still be edited when the provider is unavailable',async()=>{
  checked={...open,assessment:{status:'unavailable',canPreview:false}};
  await assert.rejects(catalog.importAudiusTrack(client(),input),{status:409});
  existing={id,provider:'audius',external_id:'G0wyE',source_url:track.sourceUrl,duration_seconds:123,attribution:'Original source and terms',external_metadata:{license:track.license},external_cover_url:null};
  checked=new AudiusError('unavailable',503);checks=0;
  const saved=await catalog.editAudiusTrack(client(),{id,title:'Changed',artist:'Performer',genre:'Pop',isPublished:false,trackId:'evil'});
  assert.equal(checks,0);assert.equal(saved.p_data.external_id,'G0wyE');assert.equal(saved.p_data.is_published,false);
  await assert.rejects(catalog.editAudiusTrack(client(),{id,title:'Changed',artist:'Performer',genre:'Pop',isPublished:true}),{status:503});
  existing=null;await assert.rejects(catalog.editAudiusTrack(client(),{id,...input}),{status:404});
});
test('Audius catalog IDs stay stable for mixed playback queues and restored sessions; arbitrary external URLs cannot play',()=>{
  const library=mapLibrary([{id,title:'Song',artist_id:'artist',duration_seconds:123,genre:'Pop',provider:'audius',external_id:'G0wyE',audio_path:null,external_cover_url:track.artworkUrl,music_artists:{id:'artist',name:'Real Performer',slug:'real',source_url:track.sourceUrl},music_albums:null,source_url:track.sourceUrl,license_code:'Audius-OML',license_url:'https://audius.org/open-music-license.pdf',attribution:'terms'}],'https://storage.test/music-audio');
  const song=library.tracks[0];assert.equal(song.id,id);assert.equal(song.artist,'Real Performer');assert.equal(song.source,'audius');assert.equal(song.streamUrl,`/api/music/audius/${id}/stream`);
  assert.equal(playback.isPlayableTrack(song),true);assert.equal(playback.isPlayableTrack({...song,streamUrl:'https://evil.test/audio'}),false);
  const native={...song,id:'native',source:'library',streamUrl:'https://storage.test/native.mp3'};
  assert.equal(playback.playbackQueue(song,[native,song]).length,2);
  const session=sessions.parsePlayerSession(JSON.stringify({version:1,trackId:id,queueIds:[id],currentTime:42}));
  assert.equal(sessions.resolvePlayerSession(session,[song]).track,song);
  assert.equal(sessions.resolvePlayerSession(session,[song]).currentTime,42);
});

let streamRow=null,isAdmin=false;
const stream=await load('src/app/api/music/audius/[id]/stream/route.ts',{
  '../../../../../../lib/personalMusic':personal,'../../../../../../lib/audiusServer':server,
  '../../../../../../lib/supabase/server':{createClient:async()=>({from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:streamRow})}),rpc:async()=>({data:isAdmin})})},
});
test('public playback requires a catalog record, publication or admin, and freshly open Audius access',async()=>{
  const get=value=>stream.GET(new Request('http://localhost/api/stream'),{params:Promise.resolve({id:value})});
  checked=open;checks=0;assert.equal((await get('G0wyE')).status,404);assert.equal((await get(id)).status,404);assert.equal(checks,0);
  streamRow={id,external_id:'G0wyE',is_published:false};assert.equal((await get(id)).status,404);assert.equal(checks,0);
  isAdmin=true;assert.equal((await get(id)).status,307);
  isAdmin=false;streamRow.is_published=true;const response=await get(id);assert.equal(response.status,307);assert.match(response.headers.get('location'),/tracks\/G0wyE\/stream/);assert.doesNotMatch(response.headers.get('location'),/token|secret/);
  checked={...open,assessment:{status:'unavailable',canPreview:false}};assert.equal((await get(id)).status,409);
});
