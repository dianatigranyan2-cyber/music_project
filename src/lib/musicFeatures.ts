import type {Track} from '../types';
import type {MusicLibrary} from './musicLibrary';
export type RepeatMode='off'|'all'|'one';
export const nextRepeatMode=(mode:RepeatMode):RepeatMode=>mode==='off'?'all':mode==='all'?'one':'off';
export function nextQueueTrack(queue:Track[],id:string,repeat:RepeatMode):Track|null{
  const index=queue.findIndex(t=>t.id===id);
  if(index<0)return null;
  return queue[index+1]??(repeat==='all'?queue[0]??null:null);
}
export function mergeListen(history:{trackId:string;playedAt:string}[],entry:{trackId:string;playedAt:string}){
  const old=history.find(h=>h.trackId===entry.trackId);
  if(old&&old.playedAt>entry.playedAt)return history;
  return [entry,...history.filter(h=>h.trackId!==entry.trackId)].sort((a,b)=>b.playedAt.localeCompare(a.playedAt)).slice(0,100);
}
export function mergeHistory(first:{trackId:string;playedAt:string}[],second:{trackId:string;playedAt:string}[]){return second.reduce((all,entry)=>mergeListen(all,entry),first);}
const normalize=(value:string)=>value.toLocaleLowerCase('ru').replaceAll('ё','е').trim();
export interface MusicSuggestion {id:string;kind:'track'|'artist'|'album';label:string;detail:string}
export function musicSuggestions(library:MusicLibrary,query:string):MusicSuggestion[]{
  const words=normalize(query).split(/\s+/).filter(Boolean);
  if(!words.length)return [];
  const matches=(label:string)=>words.every(word=>normalize(label).includes(word));
  const artists=library.artists.filter(a=>matches(a.name)).slice(0,3).map(a=>({id:a.id,kind:'artist' as const,label:a.name,detail:'Исполнитель'}));
  const albums=library.albums.filter(a=>matches(a.title+' '+(library.artists.find(ar=>ar.id===a.artistId)?.name??''))).slice(0,3).map(a=>({id:a.id,kind:'album' as const,label:a.title,detail:'Альбом'}));
  const tracks=library.tracks.filter(t=>matches(t.title+' '+t.artist)).sort((a,b)=>Number(normalize(b.title).startsWith(normalize(query)))-Number(normalize(a.title).startsWith(normalize(query)))||a.title.localeCompare(b.title)).slice(0,5).map(t=>({id:t.id,kind:'track' as const,label:t.title,detail:t.artist}));
  return [...artists,...albums,...tracks].slice(0,9);
}
export const MUSIC_MOODS=[
  {id:'lyrical',title:'Лирическое настроение',description:'Русскоязычный синт-поп и песни с вокалом',colors:['#7134a9','#db6297'],genres:['Синт-поп','Электропоп','Поп']},
  {id:'focus',title:'Для работы',description:'Инструментальная музыка без отвлекающих слов',colors:['#265ba7','#598ca8'],genres:['Инструментальная','Эмбиент']},
  {id:'calm',title:'Спокойный вечер',description:'Эмбиент, джаз и неторопливые мелодии',colors:['#494684','#ab769e'],genres:['Эмбиент','Джаз']},
  {id:'walk',title:'На прогулку',description:'Электроника и синт-поп для движения',colors:['#b15b38','#e0a35d'],genres:['Электроника','Синт-поп','Электропоп','Поп']},
];
export function moodTracks(id:string,tracks:Track[]){const mood=MUSIC_MOODS.find(m=>m.id===id);return mood?tracks.filter(t=>mood.genres.includes(t.genre??'')).sort((a,b)=>a.title.localeCompare(b.title)):[];}
export function coverHue(id:string){let hash=0;for(const char of id)hash=(hash*31+char.charCodeAt(0))|0;return (hash>>>0)%360;}
export async function validateMusicCover(file:File):Promise<string|null>{
  if(file.size>5*1024*1024)return 'Выберите изображение до 5 МБ.';
  const b=new Uint8Array(await file.slice(0,16).arrayBuffer());
  const jpeg=file.type==='image/jpeg'&&b[0]===255&&b[1]===216&&b[2]===255;
  const png=file.type==='image/png'&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v);
  const webp=file.type==='image/webp'&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP';
  return jpeg||png||webp?null:'Выберите изображение JPEG, PNG или WebP.';
}
