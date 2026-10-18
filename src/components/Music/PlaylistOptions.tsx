'use client';

import {useEffect,useRef,type ReactNode} from 'react';
import styles from '../../app/playlists/page.module.css';

export function PlaylistOptions({children}:{children:ReactNode}) {
  const root=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))root.current?.removeAttribute('open');};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&root.current?.open){root.current.removeAttribute('open');root.current.querySelector('summary')?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[]);
  return <details ref={root} className={styles.options}><summary aria-label="Действия плейлиста" title="Действия плейлиста">⋯</summary><div className={styles.optionsMenu}>{children}</div></details>;
}
