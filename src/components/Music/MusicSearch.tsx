'use client';
import {useId,useRef,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {useMusicLibrary} from '../../hooks/useMusicLibrary';
import {usePlayer} from '../../context/PlayerContext';
import {musicSuggestions} from '../../lib/musicFeatures';
import styles from '../Header/Header.module.css';
export function MusicSearch({mobile=false,onClose}:{mobile?:boolean;onClose?:()=>void}){
  const {library}=useMusicLibrary();const {searchQuery,setSearchQuery,playTrack}=usePlayer();
  const [open,setOpen]=useState(false);const [active,setActive]=useState(-1);const id=useId();const wrapper=useRef<HTMLDivElement>(null);const router=useRouter();
  const friendsSearch=usePathname()==='/friends';
  const suggestions=library?musicSuggestions(library,searchQuery):[];
  const expanded=!friendsSearch&&open&&!!searchQuery.trim();
  const choose=(index:number)=>{
    const item=suggestions[index];if(!item)return;
    if(item.kind==='track'){
      const track=library?.tracks.find(t=>t.id===item.id);if(track)playTrack(track);
      setSearchQuery(item.label);router.push('/#music');
    }else{setSearchQuery('');router.push(`/music/${item.kind==='artist'?'artists':'albums'}/${item.id}`);}
    setOpen(false);setActive(-1);
  };
  return <div className={styles.searchWrapper} ref={wrapper} onBlur={event=>{if(!wrapper.current?.contains(event.relatedTarget as Node|null))setOpen(false);}}>
    <span className={styles.searchIcon}>🔍</span>
    <input className={styles.searchInput} type="text" role="combobox" aria-label={friendsSearch?'Поиск друзей':'Поиск музыки'} aria-autocomplete={friendsSearch?'none':'list'} aria-expanded={expanded} aria-controls={expanded?id:undefined} aria-activedescendant={expanded&&active>=0&&active<suggestions.length?`${id}-${active}`:undefined}
      placeholder={friendsSearch?'Поиск друзей...':mobile?'Поиск треков, исполнителей...':'Поиск треков, исполнителей и друзей...'} value={searchQuery} autoComplete="off" autoFocus={mobile}
      onFocus={()=>setOpen(true)} onChange={e=>{setSearchQuery(e.target.value);setOpen(true);setActive(-1);}}
      onKeyDown={event=>{
        if(friendsSearch)return;
        if(event.key==='Escape'){setOpen(false);setActive(-1);event.preventDefault();}
        else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);setActive(previous=>!suggestions.length?-1:previous<0?(event.key==='ArrowDown'?0:suggestions.length-1):(previous+(event.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length);}
        else if(event.key==='Enter'){event.preventDefault();if(expanded&&active>=0&&active<suggestions.length)choose(active);else{setOpen(false);router.push('/#music');}}
      }}/>
    {(searchQuery||mobile)&&<button className={styles.clearBtn} aria-label={mobile?'Закрыть поиск':'Очистить поиск'} onClick={()=>{setSearchQuery('');setOpen(false);onClose?.();}}>✕</button>}
    {expanded&&<div className={styles.suggestions}>
      <div id={id} role="listbox" aria-label="Подсказки поиска">
        {suggestions.map((s,index)=><button key={s.kind+s.id} id={`${id}-${index}`} role="option" aria-selected={active===index} tabIndex={-1} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(index)}><span aria-hidden="true">{s.kind==='track'?'▶':s.kind==='artist'?'♪':'▣'}</span><span>{s.label}<small>{s.detail}{s.kind==='track'?' · Песня':''}</small></span></button>)}
      </div>
      {!suggestions.length&&<p>{library?'Ничего не найдено в каталоге Melo.':'Загружаем каталог…'}</p>}
      <button className={styles.allResults} onMouseDown={e=>e.preventDefault()} onClick={()=>{setOpen(false);router.push('/#music');}}>Все результаты →</button>
    </div>}
  </div>;
}
