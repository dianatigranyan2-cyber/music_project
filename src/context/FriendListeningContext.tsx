'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {useAuth} from './AuthContext';
import {usePlayer} from './PlayerContext';
import {useMusicLibrary} from '../hooks/useMusicLibrary';
import {createClient} from '../lib/supabase/client';
import {friendPosition} from '../lib/friendListening';
import type {FriendListeningState} from '../lib/friendListening';

const EMPTY:FriendListeningState={friends:[],following:null,listeners:[],serverNow:'',preferences:{broadcast:true,allowFollow:true}};
function useFriendListeningController(){
 const {user}=useAuth();const userId=user?.id;const {library}=useMusicLibrary();
 const player=usePlayer();const {setListeningController,syncListeningAudio,startListeningAudio}=player;
 const [deviceId]=useState(()=>crypto.randomUUID());const [supabase]=useState(()=>createClient());
 const [state,setState]=useState<FriendListeningState>(EMPTY);const current=useRef(EMPTY);const received=useRef(0);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [networkError,setNetworkError]=useState('');const [publishError,setPublishError]=useState('');
 const [connected,setConnected]=useState(true);const [sound,setSound]=useState(false);const soundRef=useRef(false);
 const epoch=useRef(0);const refreshing=useRef(false);const changing=useRef(false);const liveUser=useRef(userId);
 const sequence=useRef(0);const published=useRef(false);const claimed=useRef(false);const publishing=useRef(false);const publishAgain=useRef(false);const publishLocked=useRef(false);
 const latestPlayer=useRef({track:player.currentTrack,playing:player.isPlaying,position:player.currentTime});
 useEffect(()=>{liveUser.current=userId;},[userId]);
 const request=useCallback(async(body:Record<string,unknown>)=>{
  if(!userId)throw new Error('Войдите в Melo, чтобы слушать вместе.');
  const response=await fetch('/api/music/listening',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,deviceId,expectedUserId:userId}),signal:AbortSignal.timeout(12000)});
  const result=await response.json();if(liveUser.current!==userId)throw new Error('Аккаунт изменился.');if(!response.ok)throw new Error(result.error||'Не удалось подключить прослушивание.');return result.data;
 },[deviceId,userId]);
 const accept=useCallback((incoming:FriendListeningState)=>{
  const next={...incoming,preferences:incoming.preferences??{broadcast:true,allowFollow:true}};
  if(Date.parse(next.serverNow)<Date.parse(current.current.serverNow))return;
  if(next.following){publishLocked.current=true;published.current=false;}
  if(current.current.following&&!next.following){setListeningController(null);soundRef.current=false;setSound(false);}
  current.current=next;received.current=performance.now();setState(next);setConnected(true);setNetworkError('');
 },[setListeningController]);
 const refresh=useCallback(async()=>{
  if(!userId||refreshing.current)return;refreshing.current=true;const version=epoch.current;
  try{const next=await request({action:'state'});if(version===epoch.current)accept(next);}
  catch(e){if(version===epoch.current){setConnected(false);setNetworkError(e instanceof Error?e.message:'Нет связи с Melo.');}}
  finally{refreshing.current=false;}
 },[userId,request,accept]);
 const publish=useCallback(async()=>{
  if(publishing.current){publishAgain.current=true;return;}
  if(!userId||!current.current.preferences.broadcast||current.current.following||publishLocked.current)return;
  const snapshot=latestPlayer.current;if(!snapshot.track.source||(!snapshot.playing&&!published.current))return;
  publishing.current=true;published.current=true;const version=epoch.current;
  try{
   do{
    publishAgain.current=false;const value=latestPlayer.current;
    if(current.current.following||publishLocked.current||!value.track.source)break;
    const claim=!claimed.current&&value.playing;claimed.current=true;
    const accepted=await request({action:'publish',trackId:value.track.id,playing:value.playing,position:value.position,sequence:++sequence.current,claim});
    if(version===epoch.current)setPublishError(accepted||!current.current.preferences.broadcast||!!current.current.following?'':'Активность музыки сейчас передаёт другая вкладка этого аккаунта.');
   }while(publishAgain.current&&version===epoch.current);
  }catch(e){if(version===epoch.current)setPublishError(e instanceof Error?e.message:'Не удалось показать музыку друзьям.');}
  finally{publishing.current=false;}
 },[userId,request]);
 const toggleSound=useCallback(()=>{const next=!soundRef.current;soundRef.current=next;setSound(next);if(next)startListeningAudio();},[startListeningAudio]);
 const follow=useCallback(async(hostId:string)=>{
  if(changing.current)return;changing.current=true;setBusy(true);setError('');const version=++epoch.current;
  try{
   const next:FriendListeningState=await request({action:'follow',hostId});if(version!==epoch.current)return;
   publishLocked.current=true;published.current=false;soundRef.current=true;setSound(true);accept(next);
   if(next.following){
    setListeningController({id:next.following.id,name:next.following.name,toggleSound,soundEnabled:()=>soundRef.current});
    const track=library?.tracks.find(t=>t.id===next.following?.trackId)??null;
    syncListeningAudio(track,track?[track]:[],friendPosition(next.following,next.serverNow,0,track?.duration),next.following.playing);
   }
  }catch(e){setError(e instanceof Error?e.message:'Не удалось присоединиться к другу.');}
  finally{changing.current=false;setBusy(false);}
 },[request,accept,library,setListeningController,syncListeningAudio,toggleSound]);
 const leave=useCallback(async()=>{
  if(changing.current)return;changing.current=true;setBusy(true);setError('');const version=++epoch.current;
  try{const next=await request({action:'leave'});if(version===epoch.current){setListeningController(null);soundRef.current=false;setSound(false);accept(next);}}
  catch(e){setError(e instanceof Error?e.message:'Не удалось отключиться. Повторите действие.');}
  finally{changing.current=false;setBusy(false);}
 },[request,accept,setListeningController]);
 const updatePreferences=useCallback(async(broadcast:boolean,allowFollow:boolean)=>{
  if(changing.current)return;changing.current=true;setBusy(true);setError('');
  try{accept(await request({action:'preferences',broadcast,allowFollow}));setPublishError('');if(broadcast)void publish();}
  catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить настройки музыки.');}
  finally{changing.current=false;setBusy(false);}
 },[request,accept,publish]);
 const followId=state.following?.id;
 useEffect(()=>{
  const target=current.current.following;if(!followId||!target)return;
  setListeningController({id:target.id,name:target.name,toggleSound,soundEnabled:()=>soundRef.current});
  return ()=>setListeningController(null);
 },[followId,setListeningController,toggleSound]);
 useEffect(()=>{
  if(!followId||!library)return;
  const sync=()=>{
   const target=current.current.following;if(!target)return;
   const track=library.tracks.find(t=>t.id===target.trackId)??null;
   syncListeningAudio(track,track?[track]:[],friendPosition(target,current.current.serverNow,performance.now()-received.current,track?.duration),soundRef.current&&connected&&target.playing&&!player.error?.includes('Нажмите'));
  };
  sync();const timer=setInterval(sync,1000);return ()=>clearInterval(timer);
 },[followId,state,library,sound,connected,player.error,syncListeningAudio]);
 useEffect(()=>{if(followId&&player.error?.includes('Нажмите'))soundRef.current=false;},[followId,player.error]);
 const observed=useRef({id:'',playing:false,time:0,at:0});
 useEffect(()=>{
  latestPlayer.current={track:player.currentTrack,playing:player.isPlaying,position:player.currentTime};
  const previous=observed.current;const at=performance.now();
  observed.current={id:player.currentTrack.id,playing:player.isPlaying,time:player.currentTime,at};
  if(followId)return;
  if(publishLocked.current){if(player.isPlaying)return;publishLocked.current=false;}
  const jumped=previous.id===player.currentTrack.id&&Math.abs(player.currentTime-previous.time-(previous.playing?(at-previous.at)/1000:0))>1;
  if(previous.id!==player.currentTrack.id||previous.playing!==player.isPlaying||jumped)void publish();
 },[player.currentTrack,player.currentTime,player.isPlaying,followId,publish]);
 useEffect(()=>{
  if(!userId)return;
  void refresh();
  const channel=supabase.channel('friend-music:'+userId+':'+deviceId);
  for(const table of ['friend_music_activity','friend_music_follows'])for(const event of ['INSERT','UPDATE'] as const)channel.on('postgres_changes',{event,schema:'public',table},()=>void refresh());
  channel.subscribe(status=>{if(status==='SUBSCRIBED')void refresh();});
  const timer=setInterval(()=>{void refresh();void publish();},5000);
  const online=()=>{void refresh();void publish();};window.addEventListener('online',online);window.addEventListener('focus',online);
  return ()=>{clearInterval(timer);void supabase.removeChannel(channel);window.removeEventListener('online',online);window.removeEventListener('focus',online);};
 },[userId,deviceId,supabase,refresh,publish]);
 useEffect(()=>{
  if(!userId)return;
  const exiting=()=>{
   const send=(body:Record<string,unknown>)=>void fetch('/api/music/listening',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,deviceId,expectedUserId:userId}),keepalive:true}).catch(()=>{});
   if(current.current.following)send({action:'leave'});
   else if(published.current){const value=latestPlayer.current;if(value.track.source)send({action:'publish',trackId:value.track.id,playing:false,position:value.position,sequence:++sequence.current,claim:false});}
  };
  window.addEventListener('pagehide',exiting);return ()=>window.removeEventListener('pagehide',exiting);
 },[userId,deviceId]);
 useEffect(()=>{const version=epoch;return ()=>{++version.current;setListeningController(null);};},[setListeningController]);
 return {...state,ready:!!userId&&!!state.serverNow,error:error||networkError||publishError,busy,connected,sound:sound&&!player.error?.includes('Нажмите'),follow,leave,toggleSound,refresh,updatePreferences};
}
const FriendListeningContext=createContext<ReturnType<typeof useFriendListeningController>|null>(null);
export function FriendListeningProvider({children}:{children:React.ReactNode}){const value=useFriendListeningController();return <FriendListeningContext.Provider value={value}>{children}</FriendListeningContext.Provider>;}
export function useFriendListening(){const context=useContext(FriendListeningContext);if(!context)throw new Error('FriendListeningProvider missing');return context;}
