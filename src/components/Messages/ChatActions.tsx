'use client';
import { AppIcon } from '../Icons/AppIcon';
import {useEffect,useId,useRef,useState} from 'react';
import {BlockUser} from '../Profile/BlockUser';
import styles from './ChatActions.module.css';

export function ChatActions({peerId,name,musicDisabled,onMusic}:{peerId:string;name:string;musicDisabled:boolean;onMusic:()=>void}){
  const [open,setOpen]=useState(false);const ref=useRef<HTMLDivElement>(null);const id=useId();
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!ref.current?.querySelector('dialog[open]')){setOpen(false);ref.current?.querySelector<HTMLButtonElement>('button')?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  return <div className={styles.wrapper} ref={ref}>
    <button type="button" className={styles.trigger} aria-label="Действия чата" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>⋯</button>
    {open&&<div id={id} className={styles.menu} role="group" aria-label="Действия чата">
      <button type="button" className={styles.item} disabled={musicDisabled} onClick={()=>{setOpen(false);onMusic();}}><AppIcon name="music" size={16}/> Отправить музыку</button>
      <BlockUser id={peerId} name={name} placement="menu"/>
    </div>}
  </div>;
}
