'use client';
import {createContext,useContext,useState,useEffect,useCallback,useRef} from 'react';
import {useAuth} from './AuthContext';
import {createClient} from '../lib/supabase/client';
type BlockData={userId:string;peerIds:string[];outgoing:{id:string;username:string;displayName:string|null}[]};
const BlockingContext=createContext<{data:BlockData|null;ready:boolean;busy:boolean;error:string;refresh:()=>void;setBlocked:(peer:string,blocked:boolean)=>Promise<boolean>}|null>(null);
export function BlockingProvider({children}:{children:React.ReactNode}){
  const {user,loading}=useAuth();const userId=user?.id;
  const [client]=useState(()=>createClient());const [data,setData]=useState<BlockData|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [attempt,setAttempt]=useState(0);const scope=useRef(userId);
  useEffect(()=>{scope.current=userId;},[userId]);
  useEffect(()=>{if(!userId)return;let active=true;async function load(){const {data,error}=await client.rpc('social_blocks').abortSignal(AbortSignal.timeout(15000));if(!active||scope.current!==userId)return;if(error)setError('Не удалось проверить блокировки.');else{setData(data);setError('');}}
    void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},10000);window.addEventListener('focus',load);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',load);};
  },[client,userId,attempt]);
  const setBlocked=useCallback(async(peer:string,blocked:boolean)=>{
    if(!userId||busy)return false;setBusy(true);setError('');
    try{const {data,error}=await client.rpc('set_user_block',{p_peer:peer,p_blocked:blocked}).abortSignal(AbortSignal.timeout(15000));if(error)throw error;if(scope.current!==userId)return false;setData(data);return true;}
    catch{if(scope.current===userId)setError('Не удалось изменить блокировку. Попробуйте ещё раз.');return false;}finally{setBusy(false);}
  },[client,userId,busy]);
  return <BlockingContext.Provider value={{data:data?.userId===userId?data:null,ready:!loading&&(!userId||data?.userId===userId),busy,error,refresh:()=>setAttempt(n=>n+1),setBlocked}}>{children}</BlockingContext.Provider>;
}
export function useBlocking(){const context=useContext(BlockingContext);if(!context)throw new Error('BlockingProvider missing');return context;}
