'use client';

import {useCallback,useEffect,useId,useRef,useState} from 'react';
import type {Track} from '../../types';
import {createHoldToDrag,playlistOrderBefore} from '../../lib/holdToDrag';
import {movePlaylistTrack} from '../../lib/personalMusic';
import {MusicTracks} from './MusicLists';
import styles from './SortablePlaylistTracks.module.css';

type DragView = {id:string;delta:number;before:string|null};

export function SortablePlaylistTracks({trackIds,tracks,busy,onReorder}: {
  trackIds:string[]; tracks:Track[]; busy:boolean; onReorder:(ids:string[])=>Promise<boolean>;
}) {
  const root=useRef<HTMLDivElement>(null);
  const gesture=useRef<ReturnType<typeof createHoldToDrag>|null>(null);
  const latest=useRef({trackIds,busy,onReorder});
  const suppressClick=useRef(0);
  const saving=useRef(false);
  const [pendingOrder,setPendingOrder]=useState<string[]|null>(null);
  const [drag,setDrag]=useState<DragView|null>(null);
  const hintId=useId();
  const persist=useCallback(async(next:string[])=>{
    if(saving.current||latest.current.busy||next.every((id,index)=>id===latest.current.trackIds[index]))return;
    saving.current=true; setPendingOrder(next);
    try { await latest.current.onReorder(next); }
    finally { saving.current=false;setPendingOrder(null); }
  },[]);
  useEffect(()=>{latest.current={trackIds,busy,onReorder};},[trackIds,busy,onReorder]);
  useEffect(()=>{gesture.current?.cancel();},[trackIds,busy]);
  useEffect(()=>{
    let held:{id:string;y:number;scroll:number;ids:string[]}|null=null;
    let pointerY=0;
    let view:DragView|null=null;
    let touchId:number|null=null;
    let pointerId:number|null=null;
    let frame=0;
    const stop=()=>{cancelAnimationFrame(frame);held=null;view=null;setDrag(null);};
    const update=()=>{
      if(!held||!root.current)return;
      const rows=Array.from(root.current.querySelectorAll<HTMLElement>('[data-sortable-track]')).filter(row=>row.dataset.sortableTrack!==held?.id);
      const before=rows.find(row=>{const box=row.getBoundingClientRect();return pointerY<box.top+box.height/2;})?.dataset.sortableTrack??null;
      const next={id:held.id,delta:pointerY-held.y+window.scrollY-held.scroll,before};
      if(!view||next.delta!==view.delta||next.before!==view.before){view=next;setDrag(next);}
    };
    const scroll=()=>{
      if(!held)return;
      const bottom=window.innerHeight-(window.innerWidth<=768?140:90);
      const amount=pointerY<100?-10:pointerY>bottom?10:0;
      if(amount){window.scrollBy(0,amount);update();}
      frame=requestAnimationFrame(scroll);
    };
    const control=createHoldToDrag({
      start(point){
        if(latest.current.busy||saving.current)return;
        held={id:point.id,y:point.y,scroll:window.scrollY,ids:[...latest.current.trackIds]};
        pointerY=point.y;view={id:point.id,delta:0,before:point.id};setDrag(view);
        suppressClick.current=Date.now()+700;frame=requestAnimationFrame(scroll);
      },
      move(_x,y){pointerY=y;update();},
      end(){
        const previous=held,current=view;
        stop(); suppressClick.current=Date.now()+700;
        if(previous&&current&&previous.ids.join()===latest.current.trackIds.join())void persist(playlistOrderBefore(previous.ids,previous.id,current.before));
      },
      cancel(){stop();suppressClick.current=Date.now()+700;},
    });
    gesture.current=control;
    const element=root.current;
    const begin=(target:EventTarget|null,x:number,y:number)=>{
      if(latest.current.busy||saving.current||latest.current.trackIds.length<2||!(target instanceof Element))return false;
      if(!target.closest('[data-track-drag-handle]'))return false;
      const id=target.closest<HTMLElement>('[data-sortable-track]')?.dataset.sortableTrack;
      if(!id)return false;
      control.begin({id,x,y});return true;
    };
    const pointerStart=(event:PointerEvent)=>{if(event.pointerType!=='touch'&&event.button===0&&begin(event.target,event.clientX,event.clientY))pointerId=event.pointerId;};
    const pointerMove=(event:PointerEvent)=>{if(event.pointerId===pointerId)control.move(event.clientX,event.clientY);};
    const pointerEnd=(event:PointerEvent)=>{if(event.pointerId===pointerId){control.end();pointerId=null;}};
    const pointerCancel=(event:PointerEvent)=>{if(event.pointerId===pointerId){control.cancel();pointerId=null;}};
    const touchStart=(event:TouchEvent)=>{
      if(event.touches.length!==1){control.cancel();touchId=null;return;}
      const touch=event.touches[0];if(begin(event.target,touch.clientX,touch.clientY))touchId=touch.identifier;
    };
    const touchMove=(event:TouchEvent)=>{
      const touch=Array.from(event.touches).find(item=>item.identifier===touchId);
      if(!touch)return;
      if(control.isActive()&&event.cancelable)event.preventDefault();
      control.move(touch.clientX,touch.clientY);
    };
    const touchEnd=(event:TouchEvent)=>{if(Array.from(event.changedTouches).some(item=>item.identifier===touchId)){control.end();touchId=null;}};
    const cancel=()=>{control.cancel();pointerId=null;touchId=null;};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&control.isActive()){event.preventDefault();cancel();}};
    const visibility=()=>{if(document.hidden)cancel();};
    element?.addEventListener('pointerdown',pointerStart);
    element?.addEventListener('touchstart',touchStart,{passive:true});
    document.addEventListener('pointermove',pointerMove);
    document.addEventListener('pointerup',pointerEnd);
    document.addEventListener('pointercancel',pointerCancel);
    document.addEventListener('touchmove',touchMove,{passive:false});
    document.addEventListener('touchend',touchEnd);
    document.addEventListener('touchcancel',cancel);
    document.addEventListener('keydown',key);
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('blur',cancel);
    return()=>{
      control.cancel();cancelAnimationFrame(frame);gesture.current=null;
      element?.removeEventListener('pointerdown',pointerStart);element?.removeEventListener('touchstart',touchStart);
      document.removeEventListener('pointermove',pointerMove);document.removeEventListener('pointerup',pointerEnd);document.removeEventListener('pointercancel',pointerCancel);
      document.removeEventListener('touchmove',touchMove);document.removeEventListener('touchend',touchEnd);document.removeEventListener('touchcancel',cancel);
      document.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',cancel);
    };
  },[persist]);
  const order=pendingOrder??trackIds;
  const byId=new Map(tracks.map(track=>[track.id,track]));
  return <div ref={root} className={styles.list} role="group" aria-label="Песни плейлиста" aria-describedby={hintId} aria-busy={busy||!!pendingOrder}
    onDragStart={event=>event.preventDefault()}
    onContextMenu={event=>{if((event.target as Element).closest('[data-track-drag-handle]'))event.preventDefault();}}
    onClickCapture={event=>{if(Date.now()<suppressClick.current){event.preventDefault();event.stopPropagation();}}}
    onKeyDownCapture={event=>{
      if(!event.altKey||!['ArrowUp','ArrowDown'].includes(event.key)||busy||pendingOrder)return;
      const id=(event.target as Element).closest<HTMLElement>('[data-sortable-track]')?.dataset.sortableTrack;
      if(id){event.preventDefault();void persist(movePlaylistTrack(order,id,event.key==='ArrowUp'?-1:1));}
    }}>
    <p id={hintId} className={styles.srOnly}>Удерживайте песню и перемещайте вверх или вниз. С клавиатуры: Alt и стрелки вверх или вниз.</p>
    {order.map((id,index)=>{const track=byId.get(id);return <section key={id} data-sortable-track={id}
      className={`${styles.item} ${drag?.id===id?styles.dragging:''} ${drag?.before===id?styles.dropBefore:''} ${drag&&drag.before===null&&index===order.length-1?styles.dropAfter:''}`}
      style={drag?.id===id?{transform:`translateY(${drag.delta}px)`}:undefined}>
      {track?<MusicTracks tracks={[track]} playbackCollection={tracks}/>:<p data-track-drag-handle tabIndex={0}>Трек больше недоступен</p>}
    </section>;})}
    <span className={styles.srOnly} role="status">{drag?'Переместите песню и отпустите, чтобы сохранить порядок.':pendingOrder?'Сохраняем порядок песен…':''}</span>
  </div>;
}
