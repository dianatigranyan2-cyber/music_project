'use client';
import {useEffect,useRef} from 'react';
import styles from '../../app/playlists/page.module.css';
export function PlaylistDialog({children,busy,onClose}:{children:React.ReactNode;busy:boolean;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const dialog=ref.current;
    const previous=document.activeElement;
    dialog?.showModal();
    return ()=>{dialog?.close();if(previous instanceof HTMLElement)previous.focus();};
  },[]);
  return <dialog ref={ref} className={styles.nativeDialog} aria-labelledby="playlist-form-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>{children}</dialog>;
}
