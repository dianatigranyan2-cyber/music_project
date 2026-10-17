'use client';
import {useFriendListening} from '../../context/FriendListeningContext';
import {useMusicLibrary} from '../../hooks/useMusicLibrary';
import styles from './FriendListeningStatus.module.css';
export function FriendListeningStatus(){
 const {following,listeners,sound,busy,error,connected,toggleSound,leave,refresh}=useFriendListening();
 if(!following&&!listeners.length&&!error)return null;
 return <aside className={styles.banner} aria-label="Совместное прослушивание">
  {error&&<p role="alert">{error} <button onClick={()=>void refresh()}>Повторить</button></p>}
  {following&&<div className={styles.row}><span>🎧 Слушаете вместе с <strong>{following.name}</strong>{!connected?' · восстанавливаем связь':!following.playing?' · пауза':''}</span><button onClick={toggleSound}>{sound?'Выключить звук у себя':'Включить звук'}</button><button disabled={busy} onClick={()=>void leave()}>Отключиться</button></div>}
  {!!listeners.length&&<p role="status">🎧 С вами слушают: {listeners.map(p=>p.name).join(', ')}</p>}
 </aside>;
}
export function ListenWithFriend({friendId}:{friendId:string}){
 const {friends,following,busy,follow,leave}=useFriendListening();const {library}=useMusicLibrary();
 const activity=friends.find(f=>f.id===friendId);const track=activity?.playing?library?.tracks.find(t=>t.id===activity.trackId):null;
 if(!track&&following?.id!==friendId)return null;
 return <div className={styles.inline}>{track&&<span>🎵 {track.title} · {track.artist}</span>}<button disabled={busy||!activity?.canJoin&&following?.id!==friendId} onClick={()=>void(following?.id===friendId?leave():follow(friendId))}>{following?.id===friendId?'Отключиться':activity?.canJoin?'🎧 Слушать вместе':'Подключение отключено'}</button></div>;
}
