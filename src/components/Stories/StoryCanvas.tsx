'use client';

import { useRef, type ReactNode, type PointerEvent } from 'react';
import { clamp, STORY_FILTERS, type StoryLayer, type StoryPresentation } from '../../lib/storyPresentation';
import styles from './StoryCanvas.module.css';

export function StoryCanvas({ presentation, children, music, editable = false, cropMode = false, selectedId, onSelect, onEdit, onMove, onMediaMove, onDelete }: {
  presentation: StoryPresentation; children: ReactNode; music?: { title: string; artist: string };
  editable?: boolean; cropMode?: boolean; selectedId?: string | null;
  onSelect?: (id: string | null) => void; onEdit?: (id: string) => void; onMove?: (id: string, x: number, y: number) => void;
  onMediaMove?: (x: number, y: number) => void; onDelete?: (id: string) => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; id: string | null; px: number; py: number; x: number; y: number } | null>(null);
  const didDrag = useRef(false);
  const startDrag = (event: PointerEvent<HTMLElement>, layer?: StoryLayer) => {
    if (!editable || event.button !== 0 || !layer && !cropMode) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    didDrag.current = false;
    onSelect?.(layer?.id ?? null);
    drag.current = { pointer: event.pointerId, id: layer?.id ?? null, px: event.clientX, py: event.clientY, x: layer?.x ?? presentation.media.x, y: layer?.y ?? presentation.media.y };
  };
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId || !canvas.current) return;
    const bounds = canvas.current.getBoundingClientRect();
    if (Math.hypot(event.clientX - active.px, event.clientY - active.py) > 4) didDrag.current = true;
    const dx = (event.clientX - active.px) / bounds.width * 100;
    const dy = (event.clientY - active.py) / bounds.height * 100;
    if (active.id) onMove?.(active.id, clamp(active.x + dx, 5, 95), clamp(active.y + dy, 8, 92));
    else onMediaMove?.(clamp(active.x - dx, 0, 100), clamp(active.y - dy, 0, 100));
  };
  const finishDrag = () => { drag.current = null; };
  return <div ref={canvas} className={`${styles.canvas} ${cropMode ? styles.cropMode : ''}`} aria-label={editable ? 'Холст истории' : 'Оформление истории'} onPointerDown={event => { if (editable) onSelect?.(null); startDrag(event); }} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}>
    <div className={styles.media} style={{ filter: STORY_FILTERS[presentation.filter].css, transform: `scale(${presentation.media.zoom})`, transformOrigin: `${presentation.media.x}% ${presentation.media.y}%` }}>
      <div className={styles.asset} style={{ '--story-fit': presentation.media.fit, '--story-position': `${presentation.media.x}% ${presentation.media.y}%` } as React.CSSProperties}>{children}</div>
    </div>
    {presentation.layers.map(layer => {
      if (layer.kind === 'music' && !music) return null;
      const content = layer.kind === 'music' ? <span className={styles.music}><span className={styles.note}>♫</span><span><strong>{music?.title}</strong><small>{music?.artist}</small></span></span> : layer.text;
      const style: React.CSSProperties = { left: layer.x + '%', top: layer.y + '%', fontSize: layer.size + 'cqw', color: layer.color, transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`, fontFamily: layer.font === 'serif' ? 'Georgia, serif' : layer.font === 'mono' ? 'monospace' : 'inherit' };
      const className = `${styles.layer} ${styles[layer.background]} ${layer.kind === 'sticker' ? styles.sticker : ''} ${editable && selectedId === layer.id ? styles.selected : ''}`;
      return editable ? <button key={layer.id} type="button" className={className} style={style} aria-label={layer.kind === 'music' ? 'Музыкальная наклейка' : layer.kind === 'sticker' ? 'Стикер ' + layer.text : 'Текст: ' + layer.text} aria-pressed={selectedId === layer.id} onClick={event => { event.stopPropagation(); if (didDrag.current) { didDrag.current = false; return; } onSelect?.(layer.id); onEdit?.(layer.id); }} onFocus={() => onSelect?.(layer.id)} onPointerDown={event => startDrag(event, layer)} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag} onKeyDown={event => {
        const moves: Record<string, [number, number]> = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] };
        if (moves[event.key]) { event.preventDefault(); const [x,y] = moves[event.key]; onMove?.(layer.id, clamp(layer.x+x,5,95), clamp(layer.y+y,8,92)); }
        if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onDelete?.(layer.id); }
      }}>{content}</button> : <div key={layer.id} className={className} style={style}>{content}</div>;
    })}
    {editable && cropMode && <div className={styles.cropGrid} aria-hidden="true"/>}
  </div>;
}
