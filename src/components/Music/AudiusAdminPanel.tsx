'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {usePlayer} from '../../context/PlayerContext';
import {AUDIUS_STATUS_LABELS, audiusInput} from '../../lib/audius';
import type {AudiusCheck, AudiusTrack} from '../../lib/audius';
import styles from './AudiusAdminPanel.module.css';

type SearchResponse = {tracks: AudiusTrack[]; hasMore: boolean; nextOffset: number; mode: 'public' | 'token'};
type PreviewState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
const endpoint = '/api/music/admin/audius';

type ImportResult = {id: string; alreadyImported: boolean; isPublished: boolean};
export function AudiusImportForm({check, onImported}: {check: AudiusCheck; onImported?: (result: ImportResult) => void}) {
  const {track, assessment} = check;
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.account.verified ? track.account.name : '');
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState(track.genre || 'Другое');
  const [isPublished, setPublished] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{alreadyImported: boolean; isPublished: boolean} | null>(null);
  const pending = useRef(false);
  if (!assessment.canPreview || assessment.status !== 'available') return <p className={styles.hint}>Добавление недоступно: выберите песню с открытым воспроизведением и указанными условиями.</p>;
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({trackId: track.id, title, artist, album, genre, isPublished}), signal: AbortSignal.timeout(30000)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось добавить песню.');
      setSaved(data); setPublished(data.isPublished); onImported?.(data);
    } catch (error) {setError(error instanceof Error ? error.message : 'Не удалось добавить песню.');}
    finally {pending.current = false; setBusy(false);}
  }
  return <form className={styles.importForm} onSubmit={save} aria-label="Добавление песни из Audius">
    <h4>Добавить в Melo</h4>
    <p className={styles.hint}>Проверьте исполнителя: именно это имя появится у песни в Melo. Аудио будет играть через Audius. Источник, авторы и условия сохранятся автоматически.</p>
    <label>Название песни<input required maxLength={200} value={title} disabled={busy || !!saved} onChange={event => setTitle(event.target.value)}/></label>
    <label>Исполнитель<input required maxLength={200} value={artist} disabled={busy || !!saved} onChange={event => setArtist(event.target.value)} placeholder="Имя исполнителя, а не загрузившего"/></label>
    <label>Альбом (необязательно)<input maxLength={200} value={album} disabled={busy || !!saved} onChange={event => setAlbum(event.target.value)}/></label>
    <label>Жанр<input required maxLength={100} value={genre} disabled={busy || !!saved} onChange={event => setGenre(event.target.value)}/></label>
    <label className={styles.publish}><input type="checkbox" checked={isPublished} disabled={busy || !!saved} onChange={event => setPublished(event.target.checked)}/>Показывать трек в каталоге</label>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {saved ? <p role="status">{saved.alreadyImported ? 'Песня уже есть в Melo. Повторная копия не создана.' : 'Песня добавлена в Melo.'} {saved.isPublished ? 'Доступна в каталоге, поиске и плейлистах.' : 'Сохранена как скрытый трек. Опубликовать её можно в списке управления музыкой.'}</p>
      : <button className={styles.button} disabled={busy || !artist.trim() || !title.trim() || !genre.trim()}>{busy ? 'Добавляем…' : 'Добавить в Melo'}</button>}
  </form>;
}

export function AudiusCheckDetails({check, catalogId, previewState, audioRef, onPlay, onPlaying, onWaiting, onPause, onError}: {
  check: AudiusCheck; catalogId?: string | null; previewState: PreviewState; audioRef: React.RefObject<HTMLAudioElement | null>;
  onPlay: () => void; onPlaying: () => void; onWaiting: () => void; onPause: () => void; onError: () => void;
}) {
  const {track, assessment} = check;
  return <section className={styles.details} aria-label="Проверка выбранного трека">
    <h3>{track.title}</h3>
    <p className={`${styles.status} ${styles[assessment.status]}`} role="status">{AUDIUS_STATUS_LABELS[assessment.status]}</p>
    <ul className={styles.reasons}>{assessment.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
    <dl className={styles.metadata}>
      <div><dt>Аккаунт Audius</dt><dd>{track.account.name} · @{track.account.handle}{track.account.verified ? ' · Подтверждённый аккаунт' : ''}</dd></div>
      <div><dt>Лицензия в Audius</dt><dd>{track.license || 'Не указана'}</dd></div>
      {track.copyright && <div><dt>Указанные правообладатели</dt><dd>{track.copyright}</dd></div>}
      <div><dt>Длительность</dt><dd>{Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')}</dd></div>
    </dl>
    <p className={styles.hint}>Аккаунт загрузившего может отличаться от исполнителя. Доступность через API не подтверждает владение авторскими правами.</p>
    <a className={styles.source} href={track.sourceUrl} target="_blank" rel="noopener noreferrer">Открыть источник в Audius ↗</a>
    {assessment.canPreview && <div className={styles.preview}>
      <h4>Проверочное прослушивание</h4>
      {catalogId && <p>Прослушивание сохранённого трека Melo.</p>}
      <audio key={track.id + ':' + check.checkedAt} ref={audioRef} controls preload="none"
        aria-label={`Проверочное прослушивание: ${track.title}`}
        src={catalogId ? `/api/music/audius/${catalogId}/stream` : endpoint + '?' + new URLSearchParams({track: track.id, preview: '1'})}
        onPlay={onPlay} onPlaying={onPlaying} onWaiting={onWaiting} onPause={onPause} onEnded={onPause} onError={onError}/>
      {previewState === 'loading' && <p role="status">Загружаем поток Audius…</p>}
      {previewState === 'playing' && <p role="status">Аудио воспроизводится.</p>}
      {previewState === 'paused' && <p role="status">Прослушивание на паузе.</p>}
      {previewState === 'error' && <p role="alert" className={styles.error}>Не удалось воспроизвести поток Audius. Повторите проверку или откройте источник.</p>}
    </div>}
    <p className={styles.hint}>Использование через API регулируют <a href="https://audius.org/open-music-license.pdf" target="_blank" rel="noopener noreferrer">условия Audius</a> и ограничения автора. Для историй эти песни пока недоступны.</p>
  </section>;
}

export function AudiusAdminPanel({onImported}: {onImported?: () => void}) {
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [check, setCheck] = useState<AudiusCheck | null>(null);
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [previewState, setPreviewState] = useState<PreviewState>('idle');
  const searchRequest = useRef<AbortController | null>(null);
  const checkRequest = useRef<AbortController | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const checkPanel = useRef<HTMLDivElement>(null);
  const releaseFocus = useRef<(() => void) | null>(null);
  const {acquireStoryAudioFocus} = usePlayer();
  const releasePreview = useCallback(() => {
    releaseFocus.current?.();
    releaseFocus.current = null;
  }, []);
  const stopPreview = useCallback(() => {
    audio.current?.pause();
    releasePreview();
  }, [releasePreview]);
  useEffect(() => () => {
    searchRequest.current?.abort(); checkRequest.current?.abort(); stopPreview();
  }, [stopPreview]);
  useEffect(() => {
    if (check || checkError) checkPanel.current?.scrollIntoView({block: 'start', behavior: 'smooth'});
  }, [check, checkError]);

  async function search(value: string, append = false) {
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setSearchError('');
    if (!audiusInput(value)) {setSearchError('Введите от 2 до 200 символов для поиска или HTTPS-ссылку на песню в Audius.'); setSearching(false); return;}
    if (!append) {
      checkRequest.current?.abort(); stopPreview(); setSelectedId(null); setCheck(null); setCheckError(''); setChecking(false);
      setResult(null); setSearchedQuery(value.trim()); setCatalogId(null);
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({q: value.trim(), offset: String(append ? result?.nextOffset ?? 0 : 0)});
      const response = await fetch(endpoint + '?' + params, {signal: controller.signal, cache: 'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось выполнить поиск Audius.');
      if (controller.signal.aborted) return;
      setResult(previous => ({...data, tracks: append ? [...new Map([...(previous?.tracks ?? []), ...data.tracks].map((track: AudiusTrack) => [track.id, track])).values()] : data.tracks}));
    } catch (error) {
      if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : 'Не удалось связаться с Audius.');
    } finally {if (!controller.signal.aborted) setSearching(false);}
  }

  async function select(id: string) {
    checkRequest.current?.abort(); stopPreview();
    const controller = new AbortController();
    checkRequest.current = controller;
    setSelectedId(id); setCheck(null); setCatalogId(null); setChecking(true); setCheckError(''); setPreviewState('idle');
    try {
      const response = await fetch(endpoint + '?' + new URLSearchParams({track: id}), {signal: controller.signal, cache: 'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось проверить трек.');
      if (!controller.signal.aborted) setCheck(data);
    } catch (error) {
      if (!controller.signal.aborted) setCheckError(error instanceof Error ? error.message : 'Не удалось проверить трек.');
    } finally {if (!controller.signal.aborted) setChecking(false);}
  }

  return <section className={styles.panel} aria-label="Поиск и проверка Audius">
    <h2>Audius</h2>
    <p className={styles.hint}>Найдите песню и проверьте её перед добавлением в Melo.</p>
    <form className={styles.search} onSubmit={event => {event.preventDefault(); void search(query);}}>
      <label htmlFor="audius-search">Название песни, имя аккаунта или ссылка Audius</label>
      <div className={styles.searchRow}><input id="audius-search" type="search" maxLength={2000} value={query}
        onChange={event => setQuery(event.target.value)} placeholder="Например, Skrillex или ссылка на песню" required/>
        <button className={styles.button} type="submit" disabled={searching}>{searching ? 'Ищем…' : 'Найти'}</button></div>
    </form>
    {searchError && <p className={styles.error} role="alert">{searchError}</p>}
    {searching && <p role="status">Загружаем результаты Audius…</p>}
    {result && <>
      <p className={styles.hint}>{result.mode === 'public' ? 'Публичный доступ Audius: возможны ограничения на число запросов.' : 'Подключение к Audius настроено.'}</p>
      {!result.tracks.length ? <p role="status">Ничего не найдено. Попробуйте другое название или вставьте ссылку на песню.</p> : <ul className={styles.results} aria-label="Результаты поиска Audius">
        {result.tracks.map(track => <li key={track.id}>
          <div><strong>{track.title}</strong><p>Аккаунт Audius: {track.account.name} · @{track.account.handle}{track.account.verified ? ' ✓' : ''}</p>
            <small>{track.genre || 'Жанр не указан'} · {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')}</small></div>
          <button type="button" className={styles.button} aria-label={`Проверить: ${track.title}`}
            aria-pressed={selectedId === track.id} onClick={() => void select(track.id)}>{selectedId === track.id && checking ? 'Проверяем…' : 'Проверить'}</button>
        </li>)}
      </ul>}
      {result.hasMore && <button type="button" className={styles.button} disabled={searching} onClick={() => void search(searchedQuery, true)}>Показать ещё</button>}
    </>}
    <div ref={checkPanel} className={styles.selection}>
    {checking && <p role="status">Проверяем доступ и ограничения выбранной песни…</p>}
    {checkError && <div role="alert" className={styles.error}><p>{checkError}</p><button className={styles.button} type="button" onClick={() => selectedId && void select(selectedId)}>Повторить проверку</button></div>}
    {check && <AudiusCheckDetails check={check} catalogId={catalogId} previewState={previewState} audioRef={audio}
      onPlay={() => {releaseFocus.current ??= acquireStoryAudioFocus(); setPreviewState('loading');}}
      onPlaying={() => setPreviewState('playing')}
      onWaiting={() => {if (audio.current && !audio.current.paused) setPreviewState('loading');}}
      onPause={() => {releasePreview(); setPreviewState(value => value === 'error' ? 'error' : 'paused');}}
      onError={() => {releasePreview(); setPreviewState('error');}}/>}
    {check && <AudiusImportForm key={check.track.id} check={check} onImported={result=>{stopPreview();setCatalogId(result.id);setPreviewState('idle');onImported?.();}}/>}
    </div>
  </section>;
}
