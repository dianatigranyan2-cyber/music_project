'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {useAuth} from './AuthContext';
import type {PersonalMusicAction,PersonalMusicData} from '../lib/personalMusic';
import {mergeListen,mergeHistory,validateMusicCover} from '../lib/musicFeatures';
import {createClient} from '../lib/supabase/client';
interface PersonalMusicContextType {
  data: PersonalMusicData | null; loading:boolean; busy:boolean; error:string; signedIn:boolean;
  mutate:(action:PersonalMusicAction)=>Promise<boolean>; refresh:()=>void;
  recordListen:(trackId:string)=>Promise<void>; uploadCover:(playlistId:string,file:File)=>Promise<boolean>;
}
const PersonalMusicContext=createContext<PersonalMusicContextType | null>(null);
export function PersonalMusicProvider({children}:{children:React.ReactNode}) {
  const {user,loading:authLoading}=useAuth(); const userId=user?.id??null;
  const [data,setData]=useState<PersonalMusicData|null>(null);
  const [failure,setFailure]=useState<{userId:string;message:string}|null>(null);
  const [loadedFor,setLoadedFor]=useState<string|null>(null);
  const [busyFor,setBusyFor]=useState<string|null>(null); const pending=useRef(new Set<string>());
  const [attempt,setAttempt]=useState(0); const owner=useRef(userId);
  const revision=useRef(0);
  useEffect(()=>{owner.current=userId;},[userId]);
  useEffect(()=>{
    if (authLoading || !userId) return;
    const controller=new AbortController();
    const version=revision.current;
    void fetch('/api/music/personal',{signal:controller.signal,cache:'no-store'}).then(async response=>{
      const value=await response.json();
      if (!response.ok) throw new Error(value.error);
      if (!controller.signal.aborted && version===revision.current && owner.current===userId && value.userId===userId) {setData(previous=>previous?.userId===userId?{...value,history:mergeHistory(value.history??[],previous.history??[])}:value);setFailure(null);}
    }).catch(error=>{if(!controller.signal.aborted && version===revision.current && owner.current===userId)setFailure({userId,message:error instanceof Error?error.message:'Не удалось загрузить музыку.'});})
      .finally(()=>{if(!controller.signal.aborted && owner.current===userId)setLoadedFor(userId);});
    return ()=>controller.abort();
  },[authLoading,userId,attempt]);
  const mutate=useCallback(async(action:PersonalMusicAction)=>{
    if(!userId || pending.current.has(userId))return false;
    pending.current.add(userId);setBusyFor(userId);setFailure(null);
    ++revision.current;
    try {
      const response=await fetch('/api/music/personal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...action,expectedUserId:userId}),signal:AbortSignal.timeout(30000)});
      const value=await response.json(); if(!response.ok)throw new Error(value.error);
      if(owner.current!==userId || value.userId!==userId)return false;
      ++revision.current;
      setData(previous=>previous?.userId===userId?{...value,history:mergeHistory(value.history??[],previous.history??[])}:value);setLoadedFor(userId);return true;
    } catch(error) {
      if(owner.current===userId)setFailure({userId,message:error instanceof Error?error.message:'Не удалось сохранить музыку.'});return false;
    } finally {pending.current.delete(userId);setBusyFor(previous=>previous===userId?null:previous);}
  },[userId]);
  const recordListen=useCallback(async(trackId:string)=>{
    if(!userId)return;
    try{
      const response=await fetch('/api/music/history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trackId,expectedUserId:userId}),signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('История прослушиваний временно недоступна.');
      const entry=await response.json();
      if(owner.current===userId&&entry.userId===userId)setData(previous=>previous?.userId===userId?{...previous,history:mergeListen(previous.history??[],{trackId:entry.trackId,playedAt:entry.playedAt})}:previous);
    }catch{if(owner.current===userId)console.warn('Не удалось обновить историю прослушиваний.');}
  },[userId]);
  const uploadCover=useCallback(async(playlistId:string,file:File)=>{
    if(!userId||pending.current.has(userId))return false;
    pending.current.add(userId);setBusyFor(userId);setFailure(null);
    const path=userId+'/'+crypto.randomUUID()+({ 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}[file.type]??'.jpg');
    try{
      const problem=await validateMusicCover(file);if(problem){setFailure({userId,message:problem});return false;}
      if(owner.current!==userId)return false;
      const {error}=await createClient().storage.from('music-playlist-covers').upload(path,file,{contentType:file.type,upsert:false});
      if(error)throw error;
      if(owner.current!==userId)return false;
    }catch{if(owner.current===userId)setFailure({userId,message:'Не удалось загрузить обложку. Попробуйте ещё раз.'});return false;}
    finally{pending.current.delete(userId);setBusyFor(previous=>previous===userId?null:previous);}
    return mutate({action:'cover',playlistId,path});
  },[userId,mutate]);
  return <PersonalMusicContext.Provider value={{data:data?.userId===userId?data:null,loading:authLoading||Boolean(userId && loadedFor!==userId),busy:busyFor===userId && !!userId,error:failure?.userId===userId?failure.message:'',signedIn:!!userId,mutate,recordListen,uploadCover,refresh:()=>setAttempt(n=>n+1)}}>{children}</PersonalMusicContext.Provider>;
}
export function usePersonalMusic(){const context=useContext(PersonalMusicContext);if(!context)throw new Error('PersonalMusicProvider missing');return context;}
