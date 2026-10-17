import assert from 'node:assert/strict';
import test from 'node:test';
import {nextRepeatMode,nextQueueTrack,mergeListen,mergeHistory,musicSuggestions,moodTracks,validateMusicCover} from '../src/lib/musicFeatures.ts';
const track=(id,title='Песня',genre='Синт-поп')=>({id,title,artist:'Артист',artistId:'ar',album:'Альбом',albumId:'al',genre,duration:180,source:'library',streamUrl:'https://example.com/'+id+'.mp3'});
test('repeat cycles through off/all/one, wraps only in all mode, and handles one-song and empty queues',()=>{
  assert.equal(nextRepeatMode('off'),'all');assert.equal(nextRepeatMode('all'),'one');assert.equal(nextRepeatMode('one'),'off');
  const a=track('a'),b=track('b');assert.equal(nextQueueTrack([a,b],'b','all'),a);assert.equal(nextQueueTrack([a,b],'b','off'),null);assert.equal(nextQueueTrack([a,b],'b','one'),null);assert.equal(nextQueueTrack([a],'a','all'),a);assert.equal(nextQueueTrack([],'a','all'),null);assert.equal(nextQueueTrack([a],'missing','all'),null);
});
test('history deduplicates tracks, caps entries and never replaces a newer listen with a stale response',()=>{
  const a={trackId:'a',playedAt:'2026-10-15T10:00:00Z'},b={trackId:'b',playedAt:'2026-10-15T11:00:00Z'};
  assert.deepEqual(mergeListen([a],b),[b,a]);assert.deepEqual(mergeListen([b],{...b,playedAt:'2026-10-15T09:00:00Z'}),[b]);
  assert.deepEqual(mergeHistory([a],[b,a]),[b,a]);assert.equal(mergeListen(Array.from({length:100},(_,i)=>({trackId:String(i),playedAt:a.playedAt})),b).length,100);
});
test('search suggestions normalize ё, match all query words and distinguish performers from track titles',()=>{
  const library={artists:[{id:'ar',name:'Артист'}],albums:[{id:'al',artistId:'ar',title:'Вечер'}],tracks:[track('a','Возьмёмся за руки'),track('b','Артист') ]};
  assert.equal(musicSuggestions(library,'возьмемся руки')[0].label,'Возьмёмся за руки');assert.equal(musicSuggestions(library,'неизвестная').length,0);assert.equal(musicSuggestions(library,'')[0],undefined);
  const result=musicSuggestions(library,'Артист');assert.equal(result[0].kind,'artist');assert.ok(result.some(s=>s.kind==='track'));assert.ok(result.some(s=>s.kind==='album'));
});
test('mood collections use actual catalog genres and do not include unrelated music',()=>{
  const tracks=[track('a','А','Электропоп'),track('b','Б','Эмбиент'),track('c','В','Джаз')];
  assert.deepEqual(moodTracks('lyrical',tracks).map(t=>t.id),['a']);assert.deepEqual(moodTracks('calm',tracks).map(t=>t.id),['b','c']);assert.deepEqual(moodTracks('unknown',tracks),[]);
});
test('cover validation rejects oversized files, SVG and disguised non-image content',async()=>{
  const png=new File([Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0])],'cover.png',{type:'image/png'});
  assert.equal(await validateMusicCover(png),null);
  assert.ok(await validateMusicCover(new File(['<svg/>'],'cover.svg',{type:'image/svg+xml'})));
  assert.ok(await validateMusicCover(new File(['not an image'],'cover.png',{type:'image/png'})));
  assert.ok(await validateMusicCover(new File([new Uint8Array(5*1024*1024+1)],'cover.jpg',{type:'image/jpeg'})));
});
