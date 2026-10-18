'use client';
import { AppIcon } from '../Icons/AppIcon';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePlayer } from '../../context/PlayerContext';
import { useMusicLibrary } from '../../hooks/useMusicLibrary';
import { createClient } from '../../lib/supabase/client';
import { filterMusic } from '../../lib/musicLibrary';
import { validateStoryFile, type EditableStory } from '../../lib/storyEditing';
import { initialStoryPresentation, newStoryLayer, STORY_FILTERS, STORY_STICKERS, type StoryLayer } from '../../lib/storyPresentation';
import { StoryCanvas } from './StoryCanvas';
import styles from './StoryEditor.module.css';

type Panel = 'text' | 'music' | 'stickers' | 'crop' | 'filters' | null;

function LayerControls({ layer, onChange }: { layer: StoryLayer; onChange: (change: Partial<StoryLayer>) => void }) {
  return <div className={styles.layerControls}>
    {layer.kind !== 'sticker' && <>
      <label>Цвет текста<input type="color" value={layer.color} onChange={event => onChange({ color: event.target.value })}/></label>
      <div className={styles.choices} aria-label="Фон наклейки">{(['none','dark','light'] as const).map((value, i) => <button key={value} type="button" aria-pressed={layer.background === value} onClick={() => onChange({ background: value, color: value === 'light' && layer.color === '#ffffff' ? '#181124' : value === 'dark' && layer.color === '#181124' ? '#ffffff' : layer.color })}>{['Без фона','Тёмный','Светлый'][i]}</button>)}</div>
    </>}
    {layer.kind === 'text' && <label>Шрифт<select value={layer.font} onChange={event => onChange({ font: event.target.value as StoryLayer['font'] })}><option value="sans">Обычный</option><option value="serif">Классический</option><option value="mono">Печатный</option></select></label>}
    <label>Размер наклейки<input type="range" min={2} max={layer.kind === 'music' ? 8 : 24} step={.5} value={layer.size} onChange={event => onChange({ size: Number(event.target.value) })}/></label>
    <label>Поворот: {Math.round(layer.rotation)}°<input type="range" min={-180} max={180} step={1} value={layer.rotation} onChange={event => onChange({ rotation: Number(event.target.value) })}/></label>
    <details><summary>Точное положение</summary><label>По горизонтали<input type="range" min={5} max={95} value={layer.x} onChange={event => onChange({ x: Number(event.target.value) })}/></label><label>По вертикали<input type="range" min={8} max={92} value={layer.y} onChange={event => onChange({ y: Number(event.target.value) })}/></label></details>
  </div>;
}

export function StoryEditor({ story, initialFile, onClose, onSaved }: { story?: EditableStory; initialFile?: File; onClose: () => void; onSaved: (story: EditableStory) => void }) {
  const { user } = useAuth();
  const { library, error: libraryError, retry } = useMusicLibrary();
  const { acquireStoryAudioFocus } = usePlayer();
  const [supabase] = useState(() => createClient());
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const playbackAttempt = useRef(0);
  const [file, setFile] = useState<File | undefined>(initialFile);
  const [preview, setPreview] = useState(story?.media_url ?? '');
  const [presentation, setPresentation] = useState(() => initialStoryPresentation(story?.presentation, story?.caption ?? '', !!story?.music_track_id));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [trackId, setTrackId] = useState<string | null>(story?.music_track_id ?? null);
  const [start, setStart] = useState(story?.music_start_seconds ?? 0);
  const [duration, setDuration] = useState(story?.music_duration_seconds ?? 15);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const storyTracks = library?.tracks.filter(item => item.source !== 'audius') ?? [];
  const track = storyTracks.find(item => item.id === trackId);
  const selected = presentation.layers.find(layer => layer.id === selectedId);
  const textLength = presentation.layers.filter(layer => layer.kind === 'text').reduce((total, layer) => total + layer.text.length, 0);
  const mediaType = file ? file.type.startsWith('video/') ? 'video' : 'image' : story?.media_type;
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    queueMicrotask(() => setPreview(url));
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => { if (playing) return acquireStoryAudioFocus(); }, [playing, acquireStoryAudioFocus]);
  useEffect(() => {
    const pause = () => { if (document.hidden) { audio.current?.pause(); video.current?.pause(); setPlaying(false); } };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  useEffect(() => {
    if (!playing || track || mediaType === 'video') return;
    const timer = setTimeout(() => setPlaying(false), 5000);
    return () => clearTimeout(timer);
  }, [playing, track, mediaType]);
  const stopPreview = () => { playbackAttempt.current++; audio.current?.pause(); video.current?.pause(); setPlaying(false); };
  const playPreview = async () => {
    if (playing) { stopPreview(); return; }
    const attempt = ++playbackAttempt.current;
    setError(''); setPlaying(true);
    try {
      const starts: Promise<void>[] = [];
      if (audio.current && track) { audio.current.currentTime = start; starts.push(audio.current.play()); }
      if (video.current) { video.current.currentTime = 0; starts.push(video.current.play()); }
      await Promise.all(starts);
    } catch { if (attempt === playbackAttempt.current) { stopPreview(); setError('Не удалось включить предпросмотр. Попробуйте ещё раз или выберите другую песню.'); } }
  };
  const patchLayer = (id: string, change: Partial<StoryLayer>) => {
    stopPreview();
    setPresentation(value => ({ ...value, layers: value.layers.map(layer => layer.id === id ? { ...layer, ...change } : layer) }));
  };
  const addLayer = (kind: StoryLayer['kind'], text = '') => {
    stopPreview();
    if (presentation.layers.length >= 20) { setError('В одной истории может быть до 20 наклеек.'); return; }
    if (kind === 'text' && textLength + text.length > 300) { setError('В истории можно разместить до 300 символов текста.'); return; }
    const layer = newStoryLayer(kind, crypto.randomUUID(), text);
    setPresentation(value => ({ ...value, layers: [...value.layers, layer] }));
    setSelectedId(layer.id);
  };
  const removeLayer = (id: string) => {
    stopPreview();
    if (presentation.layers.find(layer => layer.id === id)?.kind === 'music') { setTrackId(null); setStart(0); setDuration(15); }
    setPresentation(value => ({ ...value, layers: value.layers.filter(layer => layer.id !== id) }));
    setSelectedId(null);
  };
  const chooseTrack = (id: string, length: number) => {
    stopPreview();
    let sticker = presentation.layers.find(layer => layer.kind === 'music');
    if (!sticker && presentation.layers.length >= 20) { setError('Удалите одну наклейку, чтобы добавить музыку.'); return; }
    if (!sticker) {
      sticker = newStoryLayer('music', crypto.randomUUID());
      setPresentation(value => ({ ...value, layers: [...value.layers, sticker!] }));
    }
    setSelectedId(sticker.id); setTrackId(id); setStart(0); setDuration(Math.min(15,length));
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true); setError(''); stopPreview();
    let uploaded: string | null = null;
    try {
      let path = story?.media_path;
      if (file) {
        const problem = await validateStoryFile(file);
        if (problem) throw new Error(problem);
        const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' } as Record<string,string>)[file.type];
        path = user.id + '/' + crypto.randomUUID() + '.' + extension;
        const result = await supabase.storage.from('stories').upload(path, file, { contentType: file.type });
        if (result.error) throw new Error('Не удалось загрузить фото или видео.');
        uploaded = path;
      }
      if (!path || !mediaType) throw new Error('Выберите фото или видео.');
      const caption = presentation.layers.filter(layer => layer.kind === 'text').map(layer => layer.text).join('\n').slice(0,300);
      const response = await fetch('/api/stories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: story ? 'update' : 'create', storyId: story?.id, expectedUserId: user.id, caption, presentation, musicTrackId: trackId, musicStart: start, musicDuration: duration, mediaPath: path, mediaType }), signal: AbortSignal.timeout(45000) });
      const result = await response.json();
      if (!response.ok) {
        if (uploaded && [400,404,409].includes(response.status)) await supabase.storage.from('stories').remove([uploaded]);
        throw new Error(result.error || 'Не удалось сохранить историю.');
      }
      onSaved(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось сохранить историю.'); }
    finally { setBusy(false); }
  };
  const panelTitle = { text: 'Текст', music: 'Музыка', stickers: 'Стикеры', crop: 'Кадрирование', filters: 'Фильтры' };
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="story-editor-title" onCancel={event => { event.preventDefault(); if (busy) return; if (panel) setPanel(null); else if (previewMode) { stopPreview(); setPreviewMode(false); } else onClose(); }}>
    <form className={styles.form} onSubmit={save} onKeyDown={event => { if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault(); }}>
      <header className={styles.header}><button type="button" className={styles.iconButton} aria-label="Закрыть редактор истории" disabled={busy} onClick={onClose}>✕</button><h2 id="story-editor-title">{previewMode ? 'Предпросмотр' : story ? 'Редактировать историю' : 'Новая история'}</h2><button type="button" className={styles.secondary} disabled={busy} onClick={() => { stopPreview(); setPanel(null); setSelectedId(null); setPreviewMode(!previewMode); }}> {previewMode ? 'К редактору' : 'Предпросмотр'}</button></header>
      <div className={styles.workspace}>
        <div className={styles.stageArea}>
          {!previewMode && <div className={styles.tools} role="toolbar" aria-label="Инструменты истории">
            <button type="button" disabled={busy} aria-label="Добавить текст" aria-pressed={panel === 'text'} onClick={() => { if (selected?.kind !== 'text') addLayer('text','Твой текст'); setPanel('text'); }}><b>Aa</b><small>Текст</small></button>
            <button type="button" disabled={busy} aria-label="Добавить музыку" aria-pressed={panel === 'music'} onClick={() => setPanel('music')}><AppIcon name="music" size={22}/><small>Музыка</small></button>
            <button type="button" disabled={busy} aria-label="Добавить стикер" aria-pressed={panel === 'stickers'} onClick={() => setPanel('stickers')}><b>☺</b><small>Стикеры</small></button>
            <button type="button" disabled={busy} aria-label="Кадрировать фото или видео" aria-pressed={panel === 'crop'} onClick={() => { setSelectedId(null); setPanel('crop'); }}><b>⌗</b><small>Кадр</small></button>
            <button type="button" disabled={busy} aria-label="Выбрать фильтр" aria-pressed={panel === 'filters'} onClick={() => setPanel('filters')}><b>◐</b><small>Фильтр</small></button>
            <button type="button" disabled={busy} aria-label="Заменить фото или видео" onClick={() => fileInput.current?.click()}><b>▧</b><small>Заменить</small></button>
          </div>}
          <div className={styles.stage}><StoryCanvas presentation={presentation} editable={!previewMode && !busy} cropMode={panel === 'crop'} selectedId={selectedId} music={track} onSelect={setSelectedId} onEdit={id => { const layer = presentation.layers.find(item => item.id === id); if(layer) setPanel(layer.kind === 'text' ? 'text' : layer.kind === 'music' ? 'music' : 'stickers'); }} onMove={(id,x,y) => patchLayer(id,{x,y})} onDelete={removeLayer} onMediaMove={(x,y) => setPresentation(value => ({ ...value, media: { ...value.media, x, y } }))}>
            {preview && (mediaType === 'video' ? <video ref={video} src={preview} preload="metadata" playsInline muted={!!trackId} onEnded={stopPreview} onError={() => { stopPreview(); setError('Не удалось открыть видео. Проверьте формат файла.'); }}/>
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={preview} alt="Предпросмотр истории"/>)}
          </StoryCanvas></div>
          {previewMode ? <button type="button" className={styles.previewPlay} onClick={() => void playPreview()}><AppIcon name={playing ? 'pause' : 'play'} size={18}/> {playing ? 'Пауза' : 'Смотреть со звуком'}</button> : selected && <div className={styles.selectionBar}><span>Наклейка выбрана</span><button type="button" disabled={busy} onClick={() => setPanel(selected.kind === 'text' ? 'text' : selected.kind === 'music' ? 'music' : 'stickers')}>Изменить</button><button type="button" disabled={busy} aria-label="Удалить выбранную наклейку" onClick={() => removeLayer(selected.id)}>Удалить</button></div>}
        </div>
        {!previewMode && panel && <aside className={styles.panel} aria-label={panelTitle[panel]}><div className={styles.panelHeading}><h3>{panelTitle[panel]}</h3><button type="button" className={styles.secondary} onClick={() => setPanel(null)}>Готово</button></div>
          <fieldset disabled={busy} className={styles.panelBody}>
            {panel === 'text' && (selected?.kind === 'text' ? <><label>Текст наклейки<textarea autoFocus maxLength={300-textLength+selected.text.length} value={selected.text} onChange={event => patchLayer(selected.id,{text:event.target.value})}/></label><small>{textLength}/300 символов в истории</small><LayerControls layer={selected} onChange={change => patchLayer(selected.id,change)}/><button type="button" className={styles.secondary} onClick={() => addLayer('text','Твой текст')}>＋ Ещё текст</button></> : <button type="button" className={styles.secondary} onClick={() => addLayer('text','Твой текст')}>＋ Добавить текст</button>)}
            {panel === 'music' && <>
              <label>Поиск музыки<input placeholder="Название песни или исполнитель" value={query} onChange={event => setQuery(event.target.value)}/></label>
              {libraryError && <p role="status">{libraryError} <button type="button" onClick={retry}>Повторить</button></p>}
              {!library && !libraryError && <p role="status">Загружаем музыку…</p>}
              {library && <div className={styles.results}>{filterMusic(storyTracks,query).slice(0,20).map(item => <button type="button" key={item.id} aria-pressed={item.id === trackId} onClick={() => chooseTrack(item.id,item.duration)}><span className={styles.trackNote}><AppIcon name="music"/></span><span>{item.title}<small>{item.artist}</small></span></button>)}{!filterMusic(storyTracks,query).length && <p>Ничего не найдено. Попробуйте другое название.</p>}</div>}
              {trackId && <div className={styles.fragment}><strong>{track ? track.title + ' — ' + track.artist : 'Трек недоступен'}</strong>{track && <><label>Начало: {start} сек.<input type="range" min={0} max={Math.max(0,track.duration-duration)} step={1} value={start} onChange={event => { stopPreview(); setStart(Number(event.target.value)); }}/></label><label>Длительность: {duration} сек.<input type="range" min={1} max={Math.min(15,track.duration)} step={1} value={duration} onChange={event => { stopPreview(); const next=Number(event.target.value); setDuration(next); setStart(Math.min(start,track.duration-next)); }}/></label><button type="button" className={styles.secondary} onClick={() => void playPreview()}><AppIcon name={playing ? 'pause' : 'play'} size={18}/> {playing ? 'Пауза' : 'Прослушать фрагмент'}</button></>}
                <button type="button" className={styles.secondary} onClick={() => { const sticker=presentation.layers.find(layer=>layer.kind==='music'); if(sticker) removeLayer(sticker.id); }}>Убрать музыку</button>
                {selected?.kind === 'music' && <LayerControls layer={selected} onChange={change => patchLayer(selected.id,change)}/>}<small>До 15 секунд. Исходный звук видео при добавлении музыки выключается.</small>
              </div>}
            </>}
            {panel === 'stickers' && <><div className={styles.stickers}>{STORY_STICKERS.map(emoji => <button type="button" key={emoji} aria-label={'Добавить стикер ' + emoji} onClick={() => addLayer('sticker',emoji)}>{emoji}</button>)}</div>{selected?.kind === 'sticker' && <LayerControls layer={selected} onChange={change => patchLayer(selected.id,change)}/>}</>}
            {panel === 'crop' && <><p>Перетаскивай изображение на холсте, чтобы выбрать кадр.</p><div className={styles.choices}><button type="button" aria-pressed={presentation.media.fit==='cover'} onClick={() => setPresentation(value => ({...value,media:{...value.media,fit:'cover'}}))}>Заполнить</button><button type="button" aria-pressed={presentation.media.fit==='contain'} onClick={() => setPresentation(value => ({...value,media:{...value.media,fit:'contain'}}))}>Целиком</button></div><label>Приближение<input type="range" min={1} max={3} step={.05} value={presentation.media.zoom} onChange={event => setPresentation(value => ({...value,media:{...value.media,zoom:Number(event.target.value)}}))}/></label><label>Сместить по горизонтали<input type="range" min={0} max={100} value={presentation.media.x} onChange={event => setPresentation(value => ({...value,media:{...value.media,x:Number(event.target.value)}}))}/></label><label>Сместить по вертикали<input type="range" min={0} max={100} value={presentation.media.y} onChange={event => setPresentation(value => ({...value,media:{...value.media,y:Number(event.target.value)}}))}/></label><button type="button" className={styles.secondary} onClick={() => setPresentation(value => ({...value,media:{fit:'cover',zoom:1,x:50,y:50}}))}>Сбросить кадр</button></>}
            {panel === 'filters' && <div className={styles.filters}>{Object.entries(STORY_FILTERS).map(([key,filter]) => <button type="button" key={key} aria-pressed={presentation.filter===key} onClick={() => setPresentation(value => ({...value,filter:key as typeof value.filter}))}><span style={{filter:filter.css}}>◒</span>{filter.label}</button>)}</div>}
          </fieldset>
        </aside>}
      </div>
      <input ref={fileInput} type="file" aria-label="Фото или видео истории" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" hidden disabled={busy} onChange={async event => { const next=event.currentTarget.files?.[0]; event.currentTarget.value=''; if(!next) return; stopPreview(); const problem=await validateStoryFile(next); if(problem) {setError(problem);return;} setError('');setFile(next);setPresentation(value=>({...value,media:{fit:'cover',zoom:1,x:50,y:50}})); }}/>
      {track && <audio ref={audio} key={track.id} src={track.streamUrl} preload="metadata" onEnded={stopPreview} onError={() => {stopPreview();setError('Не удалось прослушать трек. Попробуйте другую песню.');}} onTimeUpdate={() => {if(audio.current && audio.current.currentTime>=start+duration) stopPreview();}}/>}
      <footer className={styles.footer}>{error && <p role="alert">{error}</p>}<div><span className={styles.hint}>{previewMode ? 'Так историю увидят твои друзья' : 'Перетаскивай текст и наклейки по холсту'}</span><button className={styles.publish} disabled={busy || !user || !preview || !!trackId && !track}>{busy ? 'Сохраняем…' : story ? 'Сохранить' : 'Опубликовать историю'}</button></div></footer>
    </form>
  </dialog>;
}
