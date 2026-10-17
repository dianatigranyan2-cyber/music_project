'use client';
import Link from 'next/link';
import {usePersonalMusic} from '../../context/PersonalMusicContext';
import styles from './MusicLibrary.module.css';
export function SaveMusicButton({id,kind}:{id:string;kind:'artist'|'album'}){
  const {data,signedIn,loading,busy,error,mutate}=usePersonalMusic();
  const saved=(kind==='artist'?data?.savedArtistIds:data?.savedAlbumIds)?.includes(id)??false;
  return <span>{!signedIn?<Link className={styles.button} href="/login">Войти и сохранить</Link>:<button className={styles.button} disabled={loading||busy} aria-pressed={saved} onClick={()=>mutate({action:kind==='artist'?'save-artist':'save-album',itemId:id,saved:!saved})}>{saved?'✓ Сохранено':kind==='artist'?'+ Сохранить исполнителя':'+ Сохранить альбом'}</button>}{error&&<small role="status">{error}</small>}</span>;
}
