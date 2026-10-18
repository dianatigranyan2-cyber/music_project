import type {Track} from '../types';
import {isMusicId} from './personalMusic';
import type {RepeatMode} from './musicFeatures';
export interface PlayerSession {
  version:1; trackId:string|null; queueIds:string[]; originalQueueIds:string[];
  currentTime:number; volume:number; muted:boolean; repeat:boolean; shuffle:boolean;
  repeatMode?:RepeatMode;
}
const ids=(value:unknown):string[]=>Array.isArray(value)?[...new Set(value.filter(isMusicId))].slice(0,1000):[];
export function parsePlayerSession(raw:string|null):PlayerSession|null {
  try {
    const s=JSON.parse(raw??'null');
    if(!s||s.version!==1)return null;
    return {version:1,trackId:isMusicId(s.trackId)?s.trackId:null,queueIds:ids(s.queueIds),originalQueueIds:ids(s.originalQueueIds),
      currentTime:Number.isFinite(s.currentTime)?Math.max(0,s.currentTime):0,
      volume:Number.isFinite(s.volume)?Math.max(0,Math.min(100,s.volume)):80,
      muted:s.muted===true,repeat:s.repeat===true,repeatMode:['off','all','one'].includes(s.repeatMode)?s.repeatMode:s.repeat===true?'one':'off',shuffle:s.shuffle===true};
  } catch{return null;}
}
export function resolvePlayerSession(session:PlayerSession,tracks:Track[]) {
  const map=new Map(tracks.filter(t=>t.source==='library'||t.source==='audius').map(t=>[t.id,t]));
  const resolve=(ids:string[])=>ids.map(id=>map.get(id)).filter((t):t is Track=>!!t);
  const queue=resolve(session.queueIds);
  const track=map.get(session.trackId??'')??queue[0]??null;
  if(track&&!queue.some(t=>t.id===track.id))queue.unshift(track);
  const original=resolve(session.originalQueueIds);
  for(const item of queue)if(!original.some(t=>t.id===item.id))original.push(item);
  return {track,queue,original,currentTime:track?.id===session.trackId?Math.min(session.currentTime,track.duration):0};
}
