'use client';
import {AppIcon} from '../Icons/AppIcon';
import type {Track} from '../../types';
import {useState} from 'react';
import {coverHue} from '../../lib/musicFeatures';
import styles from './MusicLibrary.module.css';
export function PlaylistCover({tracks,src,title}:{tracks:Track[];src?:string|null;title:string}){
  const [failedSrc,setFailedSrc]=useState<string|null>(null);
  return <span className={styles.playlistCover} aria-label={`Обложка: ${title}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {src&&failedSrc!==src?<img src={src} alt="" onError={()=>setFailedSrc(src)}/>:<span className={tracks.length>1?styles.coverCollage:styles.coverSingle}>
      {(tracks.length?tracks.slice(0,4):[null]).map((t,i)=><span key={t?.id??i} style={{background:`linear-gradient(140deg,hsl(${coverHue(t?.id??title)} 56% 38%),hsl(${(coverHue(t?.id??title)+55)%360} 55% 22%))`}}>
        {t&&t.coverUrl&&!t.coverUrl.endsWith('/music-placeholder.svg')?
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.coverUrl} alt=""/>:<span aria-hidden="true">{t?.title.slice(0,1)??<AppIcon name="music" size="1em"/>}</span>}
      </span>)}
    </span>}
  </span>;
}
